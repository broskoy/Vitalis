import { select, type Selection } from 'd3-selection';
import { easeCubicInOut } from 'd3-ease';
import type { TreeProvider } from '../data/types';
import { displayParent, type View, type ViewNode } from '../layout/view';
import { displayName, layoutView, type Role } from '../layout/radial';

/**
 * SVG renderer. All motion runs through one requestAnimationFrame loop that
 * interpolates every node's POLAR state (θ, r) plus a few opacities, then
 * recomputes positions and link paths from those values each frame.
 *
 * Nodes that persist between views interpolate directly. Entering and
 * exiting nodes are "anchored" to their nearest persisting ancestor: their
 * position is the ancestor's current position plus an offset that grows from
 * (or shrinks to) zero, so new grandchildren sprout out of a moving parent and
 * pruned ones fold back into it.
 */

const DURATION = 600;
const TAU = Math.PI * 2;
/** How far (px) from a dot the pointer may land and still pick it. */
const PICK_REACH_MOUSE = 16;
const PICK_REACH_TOUCH = 28;
/** Within this distance a dot wins even over a label under the pointer. */
const DOT_PRIORITY = 12;

interface Press {
  key: string | null;
  x: number;
  y: number;
  fired: boolean;
  timer: number;
}

/** Ring nodes that can't be focused (species tips, "+N more"): drawn greyed out. */
const isInert = (d: { role: Role; node: ViewNode }) =>
  d.role === 'ring' && (d.node.isTip || d.node.kind === 'more');

/** Animated per-node state. */
interface Vis {
  th: number; // angle, clockwise from 12 o'clock
  r: number; // radius
  o: number; // overall opacity
  size: number; // circle radius
  lab: number; // radial label opacity
  ct: number; // center title opacity
  at: number; // parent-slot arrow + title opacity
  lo: number; // opacity of the link to the parent
}

type Track =
  | { mode: 'abs'; from: Vis; to: Vis; shortest: boolean }
  | { mode: 'anchored'; anchor: string; from: Vis; to: Vis; d0: [number, number]; d1: [number, number] };

interface Item {
  key: string;
  node: ViewNode;
  role: Role;
  parentKey: string | null;
  label: string | null;
  exiting: boolean;
}

export interface RendererEvents {
  onTap(key: string, pointerType: string): void;
  onLongPress(key: string): void;
  onHover(key: string | null, x: number, y: number): void;
  onBackground(): void;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrapDelta = (d: number) => ((((d + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const px = (th: number, r: number) => r * Math.sin(th);
const py = (th: number, r: number) => -r * Math.cos(th);

/** Radial "step" link: arc at the parent's radius, then a radial segment out to the child. */
function stepPath(pth: number, pr: number, cth: number, cr: number): string {
  const x0 = px(cth, pr), y0 = py(cth, pr);
  const x1 = px(cth, cr), y1 = py(cth, cr);
  if (pr < 0.5) return `M${x0},${y0}L${x1},${y1}`;
  const d = cth - pth;
  const large = Math.abs(d) > Math.PI ? 1 : 0;
  const sweep = d > 0 ? 1 : 0;
  return `M${px(pth, pr)},${py(pth, pr)}A${pr},${pr} 0 ${large} ${sweep} ${x0},${y0}L${x1},${y1}`;
}

export class TreeRenderer {
  private svg: Selection<SVGSVGElement, unknown, null, undefined>;
  private stage: Selection<SVGGElement, unknown, null, undefined>;
  private linkLayer: Selection<SVGGElement, unknown, null, undefined>;
  private nodeLayer: Selection<SVGGElement, unknown, null, undefined>;

  private cur = new Map<string, Vis>();
  private items = new Map<string, Item>();
  private tracks = new Map<string, Track>();
  private view: View | null = null;
  private raf = 0;
  private width = 0;
  private height = 0;

  private press: Press | null = null;
  private hoverKey: string | null = null;

  constructor(
    el: SVGSVGElement,
    private provider: TreeProvider,
    private events: RendererEvents,
  ) {
    this.svg = select(el);
    this.stage = this.svg.append('g');
    this.linkLayer = this.stage.append('g').attr('class', 'links');
    this.nodeLayer = this.stage.append('g').attr('class', 'nodes');
    this.bindEvents();
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.svg.attr('width', width).attr('height', height);
    this.stage.attr('transform', `translate(${width / 2},${height / 2})`);
    if (this.view) this.show(this.view, false);
  }

  private geometry() {
    const m = Math.min(this.width, this.height);
    const margin = Math.max(56, Math.min(130, m * 0.2));
    return { outer: Math.max(60, m / 2 - margin), margin };
  }

  show(view: View, animate: boolean) {
    const firstRender = this.view === null;
    this.hoverKey = null;
    this.view = view;
    const { outer, margin } = this.geometry();
    const layout = layoutView(view, outer, margin);
    const beyond = outer + margin * 1.2;

    const target = new Map<string, Vis>();
    for (const [key, pn] of layout.nodes) {
      target.set(key, {
        th: pn.theta,
        r: pn.r,
        o: 1,
        size: pn.size,
        lab: pn.label ? 1 : 0,
        ct: pn.role === 'center' ? 1 : 0,
        at: pn.role === 'slot' ? 1 : 0,
        lo: pn.role === 'ring' ? 1 : 0,
      });
    }

    const oldItems = this.items;
    const parentOf = (key: string): string | null =>
      key.endsWith('::more') ? key.slice(0, -6) : displayParent(this.provider, key);
    const centerLineage = new Set<string>();
    for (let k: string | null = view.center.key; k; k = parentOf(k)) centerLineage.add(k);

    const tracks = new Map<string, Track>();
    const hidden = (v: Vis): Vis => ({ ...v, o: 0, size: 0, lab: 0, ct: 0, at: 0, lo: 0 });

    // 1. Persisting nodes: absolute polar interpolation.
    for (const [key, to] of target) {
      const from = this.cur.get(key);
      if (!from || !animate) continue;
      const f = { ...from };
      const t = { ...to };
      if (f.r < 0.5) f.th = t.th; // leaving the center: go straight out
      if (t.r < 0.5) t.th = f.th; // arriving at the center: go straight in
      const touchesSlot = oldItems.get(key)?.role === 'slot' || layout.nodes.get(key)!.role === 'slot';
      tracks.set(key, { mode: 'abs', from: f, to: t, shortest: touchesSlot });
    }

    const anchorFor = (key: string, oldRoleOk: (k: string) => boolean): string | null => {
      for (let k = parentOf(key); k; k = parentOf(k)) {
        if (tracks.get(k)?.mode === 'abs' && target.has(k) && oldRoleOk(k)) return k;
      }
      return null;
    };

    // 2. Entering nodes.
    for (const [key, to] of target) {
      if (tracks.has(key)) continue;
      if (!animate) continue;
      const role = layout.nodes.get(key)!.role;
      if (firstRender) {
        tracks.set(key, { mode: 'abs', from: { ...hidden(to), r: 0 }, to, shortest: false });
        continue;
      }
      if (role === 'slot') {
        tracks.set(key, { mode: 'abs', from: { ...hidden(to), r: beyond }, to, shortest: false });
        continue;
      }
      // Grow out of the nearest persisting ancestor, unless that ancestor was the
      // parent slot (then the node would sweep around from 12 o'clock).
      const anchor = anchorFor(key, (k) => oldItems.get(k)?.role !== 'slot');
      if (anchor) {
        const a = (tracks.get(anchor) as Extract<Track, { mode: 'abs' }>).to;
        tracks.set(key, {
          mode: 'anchored',
          anchor,
          from: hidden(to),
          to,
          d0: [0, 0],
          d1: [to.th - a.th, to.r - a.r],
        });
      } else {
        tracks.set(key, { mode: 'abs', from: { ...hidden(to), r: beyond }, to, shortest: false });
      }
    }

    // 3. Exiting nodes.
    for (const [key, from] of this.cur) {
      if (target.has(key) || !animate) continue;
      if (centerLineage.has(key)) {
        // An ancestor of the new center: leave upward through the top gap.
        const f = { ...from };
        if (f.r < 0.5) f.th = 0;
        tracks.set(key, { mode: 'abs', from: f, to: { ...hidden(f), th: 0, r: beyond }, shortest: true });
        continue;
      }
      const anchor = anchorFor(key, (k) => layout.nodes.get(k)!.role !== 'slot');
      if (anchor) {
        const a = (tracks.get(anchor) as Extract<Track, { mode: 'abs' }>).from;
        tracks.set(key, {
          mode: 'anchored',
          anchor,
          from,
          to: hidden(from),
          d0: [from.th - a.th, from.r - a.r],
          d1: [0, 0],
        });
      } else {
        tracks.set(key, { mode: 'abs', from, to: { ...hidden(from), r: beyond }, shortest: false });
      }
    }

    // Rebuild the item list: new view + still-animating exits.
    const items = new Map<string, Item>();
    for (const [key, pn] of layout.nodes) {
      items.set(key, { key, node: pn.node, role: pn.role, parentKey: pn.parentKey, label: pn.label, exiting: false });
    }
    if (animate) {
      for (const key of this.cur.keys()) {
        if (items.has(key)) continue;
        const old = oldItems.get(key);
        if (old) items.set(key, { ...old, exiting: true });
      }
    }
    this.items = items;
    this.tracks = tracks;

    if (!animate) {
      this.cur = new Map(target);
      cancelAnimationFrame(this.raf);
      this.join();
      this.draw();
      return;
    }

    this.join();
    cancelAnimationFrame(this.raf);
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / DURATION);
      this.step(easeCubicInOut(t));
      this.draw();
      if (t < 1) {
        this.raf = requestAnimationFrame(frame);
      } else {
        for (const [key, it] of this.items) {
          if (it.exiting) {
            this.items.delete(key);
            this.cur.delete(key);
          }
        }
        this.join();
        this.draw();
      }
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** Advance every track to eased time `e`, writing into `cur`. */
  private step(e: number) {
    const next = new Map<string, Vis>();
    const mix = (a: Vis, b: Vis): Vis => ({
      th: lerp(a.th, b.th, e),
      r: lerp(a.r, b.r, e),
      o: lerp(a.o, b.o, e),
      size: lerp(a.size, b.size, e),
      lab: lerp(a.lab, b.lab, e),
      ct: lerp(a.ct, b.ct, e),
      at: lerp(a.at, b.at, e),
      lo: lerp(a.lo, b.lo, e),
    });
    for (const [key, tr] of this.tracks) {
      if (tr.mode !== 'abs') continue;
      const v = mix(tr.from, tr.to);
      if (tr.shortest) v.th = tr.from.th + wrapDelta(tr.to.th - tr.from.th) * e;
      next.set(key, v);
    }
    for (const [key, tr] of this.tracks) {
      if (tr.mode !== 'anchored') continue;
      const a = next.get(tr.anchor)!;
      const v = mix(tr.from, tr.to);
      v.th = a.th + lerp(tr.d0[0], tr.d1[0], e);
      v.r = a.r + lerp(tr.d0[1], tr.d1[1], e);
      next.set(key, v);
    }
    // Keep angles in [0, 2π) so an interrupted transition never starts from an
    // out-of-range angle (which would make linear interpolation go the long way).
    for (const v of next.values()) v.th = ((v.th % TAU) + TAU) % TAU;
    this.cur = next;
  }

  /** Keyed D3 join: create/remove DOM for items. Runs once per view change, not per frame. */
  private join() {
    const items = [...this.items.values()];

    this.linkLayer
      .selectAll<SVGPathElement, Item>('path')
      .data(items.filter((d) => d.parentKey), (d) => d.key)
      .join('path')
      .attr('class', (d) => `link ${d.node.kind}`);

    const nodes = this.nodeLayer
      .selectAll<SVGGElement, Item>('g.node')
      .data(items, (d) => d.key)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'node');
        g.append('circle').attr('class', 'dot');
        g.append('text').attr('class', 'label').attr('dy', '0.32em');
        g.append('text').attr('class', 'title center-title').attr('y', 26).attr('text-anchor', 'middle');
        const slot = g.append('g').attr('class', 'slot-ui');
        slot.append('line').attr('class', 'stub');
        slot.append('rect').attr('class', 'slot-hit').attr('x', -18).attr('y', -16).attr('width', 36).attr('height', 32);
        slot.append('path').attr('class', 'arrow').attr('d', 'M-7,4L0,-4L7,4');
        return g;
      });

    nodes
      .attr('class', (d) =>
        [
          'node',
          d.role,
          d.node.kind,
          isInert(d) ? 'inert' : '',
          d.key === this.hoverKey ? 'hovered' : '',
          d.exiting ? 'exiting' : '',
        ].join(' '),
      )
      .each(function (d) {
        const g = select(this);
        g.select('text.label').text(d.label ?? '');
        g.select('text.center-title').text(d.role === 'center' && d.node.name ? displayName(d.node) : '');
      });
  }

  /** Per-frame attribute update from `cur`. */
  private draw() {
    const cur = this.cur;

    this.linkLayer.selectAll<SVGPathElement, Item>('path').each(function (d) {
      const c = cur.get(d.key);
      const p = d.parentKey ? cur.get(d.parentKey) : undefined;
      if (!c || !p) {
        this.setAttribute('d', '');
        return;
      }
      this.setAttribute('d', stepPath(p.th, p.r, c.th, c.r));
      this.setAttribute('opacity', String(c.lo * c.o));
    });

    this.nodeLayer.selectAll<SVGGElement, Item>('g.node').each(function (d) {
      const v = cur.get(d.key);
      if (!v) return;
      this.setAttribute('transform', `translate(${px(v.th, v.r)},${py(v.th, v.r)})`);
      this.setAttribute('opacity', String(v.o));
      const [dot, label, ctitle, slotUi] = this.children as unknown as SVGElement[];
      dot.setAttribute('r', String(Math.max(0, v.size)));

      // Radial label, flipped on the left half so it never reads upside down.
      const deg = (v.th * 180) / Math.PI - 90;
      const flip = ((v.th % TAU) + TAU) % TAU > Math.PI;
      const off = v.size + 4;
      label.setAttribute('transform', `rotate(${flip ? deg + 180 : deg})`);
      label.setAttribute('x', String(flip ? -off : off));
      label.setAttribute('text-anchor', flip ? 'end' : 'start');
      label.setAttribute('opacity', String(v.lab));

      ctitle.setAttribute('opacity', String(v.ct));
      slotUi.setAttribute('opacity', String(v.at));
      slotUi.style.display = v.at > 0.01 ? '' : 'none';
      (slotUi.firstChild as SVGLineElement).setAttribute('y1', '6');
      (slotUi.firstChild as SVGLineElement).setAttribute('y2', String(Math.max(6, v.r - 13)));
    });
  }

  /**
   * Hit testing. Dots are tiny, so instead of per-element hit areas we pick the
   * NEAREST visible node within reach of the pointer (more forgiving on touch).
   * Pressing a node's label, the center title or the up arrow picks it directly.
   */
  private pick(ev: PointerEvent): string | null {
    const nearest = this.nearest(ev);
    // A dot very close to the pointer beats a label/title that happens to
    // overlap it (labels can be long and crowd neighbours on small screens).
    if (nearest && nearest.dist < DOT_PRIORITY) return nearest.key;
    const direct = (ev.target as Element | null)?.closest?.('g.node');
    if (direct) {
      const d = select<Element, Item>(direct).datum();
      if (d && !d.exiting) return d.key;
    }
    return nearest?.key ?? null;
  }

  private nearest(ev: PointerEvent): { key: string; dist: number } | null {
    const rect = (this.svg.node() as SVGSVGElement).getBoundingClientRect();
    const x = ev.clientX - rect.left - this.width / 2;
    const y = ev.clientY - rect.top - this.height / 2;
    let best: string | null = null;
    let bestDist = ev.pointerType === 'mouse' ? PICK_REACH_MOUSE : PICK_REACH_TOUCH;
    for (const it of this.items.values()) {
      const v = this.cur.get(it.key);
      if (it.exiting || !v || v.o < 0.5) continue;
      const dist = Math.hypot(px(v.th, v.r) - x, py(v.th, v.r) - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = it.key;
      }
    }
    return best ? { key: best, dist: bestDist } : null;
  }

  private setHover(key: string | null, ev?: PointerEvent) {
    if (key === this.hoverKey) return;
    this.hoverKey = key;
    this.nodeLayer.selectAll<SVGGElement, Item>('g.node').classed('hovered', (d) => d.key === key);
    (this.svg.node() as SVGSVGElement).style.cursor = key ? 'pointer' : '';
    this.events.onHover(key, ev?.clientX ?? 0, ev?.clientY ?? 0);
  }

  private bindEvents() {
    this.svg
      .on('pointerdown', (ev: PointerEvent) => {
        this.clearPress();
        const key = this.pick(ev);
        const press: Press = { key, x: ev.clientX, y: ev.clientY, fired: false, timer: 0 };
        if (key) {
          press.timer = window.setTimeout(() => {
            press.fired = true;
            this.events.onLongPress(key);
          }, 500);
        }
        this.press = press;
      })
      .on('pointermove', (ev: PointerEvent) => {
        if (ev.pointerType === 'mouse') {
          if (!this.press) this.setHover(this.pick(ev), ev);
        } else if (this.press && Math.hypot(ev.clientX - this.press.x, ev.clientY - this.press.y) > 10) {
          this.clearPress(); // finger is dragging, not tapping
        }
      })
      .on('pointerup', (ev: PointerEvent) => {
        const press = this.press;
        this.clearPress();
        if (!press || press.fired) return;
        const key = this.pick(ev);
        if (!key && !press.key) this.events.onBackground();
        else if (key && key === press.key) {
          if (ev.pointerType === 'mouse') this.setHover(null);
          this.events.onTap(key, ev.pointerType);
        }
      })
      .on('pointercancel', () => this.clearPress())
      .on('pointerleave', (ev: PointerEvent) => {
        this.clearPress();
        if (ev.pointerType === 'mouse') this.setHover(null);
      })
      .on('contextmenu', (ev: Event) => ev.preventDefault());
  }

  private clearPress() {
    if (this.press) clearTimeout(this.press.timer);
    this.press = null;
  }

  /** Screen position of a node (for anchoring the touch preview card). */
  screenPos(key: string): { x: number; y: number } | null {
    const v = this.cur.get(key);
    if (!v) return null;
    const rect = (this.svg.node() as SVGSVGElement).getBoundingClientRect();
    return { x: rect.left + this.width / 2 + px(v.th, v.r), y: rect.top + this.height / 2 + py(v.th, v.r) };
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.clearPress();
  }
}
