import { hierarchy, partition } from 'd3-hierarchy';
import type { View, ViewNode } from './view';

/**
 * Polar layout. Angles are measured clockwise from 12 o'clock, in radians.
 * The tree occupies [GAP/2, 2π − GAP/2]; the empty wedge at the top holds the
 * "up" arrow to the parent. Because no node ever lives in that wedge, angles
 * can be interpolated linearly without wrapping, which preserves sibling
 * order (branches never cross) during transitions.
 */
export const GAP = (40 * Math.PI) / 180;
const SPAN = 2 * Math.PI - GAP;

export type Role = 'center' | 'slot' | 'ring';

export interface PlacedNode {
  node: ViewNode;
  role: Role;
  /** Display parent key (ring nodes only). */
  parentKey: string | null;
  theta: number;
  r: number;
  size: number;
  /** Text for the radial label, or null if hidden (overlap / no room). */
  label: string | null;
}

export interface Layout {
  nodes: Map<string, PlacedNode>;
  outerRadius: number;
  slotRadius: number;
}

const FONT_PX = 11;
const CHAR_PX = 6.2; // average glyph width at 11px
const MIN_LABEL_SEP = FONT_PX + 2;
const MIN_INNER_LABEL_PX = 90;

export function nodeSize(n: ViewNode, role: Role): number {
  if (role === 'center') return 9;
  if (role === 'slot') return 0;
  if (n.kind === 'more') return 2.5;
  return 2.5 + Math.min(4, Math.log10(n.numTips + 1) * 1.2);
}

export function displayName(n: ViewNode): string {
  if (n.kind === 'more') return `+${n.ids.length} more`;
  return (n.name ?? 'unknown') + (n.extinct ? ' †' : '');
}

function truncate(s: string, maxPx: number): string | null {
  const max = Math.floor(maxPx / CHAR_PX);
  if (max < 4) return null;
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

export function layoutView(view: View, outerRadius: number, labelMargin: number): Layout {
  const out = new Map<string, PlacedNode>();
  const rings = Math.max(1, view.maxDepth);
  const ringR = (d: number) => (outerRadius * d) / rings;
  const ringGap = outerRadius / rings;
  const slotRadius = Math.min(ringGap * 0.55, 56);

  // Angular weights: each visible leaf gets 1 + a log-scaled share of its
  // descendant count; internal nodes sum their children (d3 .sum()).
  const root = hierarchy(view.center, (n) => n.children).sum((n) =>
    n.children.length ? 0 : 1 + 0.35 * Math.log2(n.numTips + (n.kind === 'more' ? 0 : 1)),
  );
  const parted = partition<ViewNode>().size([SPAN, 1])(root);

  for (const h of parted.descendants()) {
    const n = h.data;
    const isCenter = h.depth === 0;
    const theta = isCenter ? 0 : GAP / 2 + (h.x0 + h.x1) / 2;
    const role: Role = isCenter ? 'center' : 'ring';
    out.set(n.key, {
      node: n,
      role,
      // The center keeps a (fading) link to the slot so the branch it arrived
      // on dissolves smoothly instead of vanishing.
      parentKey: isCenter ? (view.parentSlot?.key ?? null) : (n.parent?.key ?? null),
      theta,
      r: ringR(h.depth),
      size: nodeSize(n, role),
      label: null,
    });
  }

  if (view.parentSlot) {
    out.set(view.parentSlot.key, {
      node: view.parentSlot,
      role: 'slot',
      parentKey: null,
      theta: 0,
      r: slotRadius,
      size: 0,
      label: null,
    });
  }

  // Labels: place greedily by clade size (big clades win). Each label occupies
  // a radial band [r0, r1] along its angle; two labels clash when their bands
  // overlap and they are closer than one text line apart (measured along the
  // arc at the inner edge of the overlap). This also catches inner-ring labels
  // that spill outward into the next rings.
  const accepted: { th: number; r0: number; r1: number }[] = [];
  const candidates = [...out.values()]
    .filter((pn) => pn.role === 'ring' && (pn.node.kind === 'more' || pn.node.name))
    .sort((a, b) => b.node.numTips - a.node.numTips);
  for (const pn of candidates) {
    // Inner labels may spill past the next ring (the halo keeps them readable)
    // so deeper views with tight ring spacing still get names.
    const room = pn.node.depth === rings ? labelMargin : Math.max(ringGap, MIN_INNER_LABEL_PX);
    const text = truncate(displayName(pn.node), room - pn.size - 10);
    if (!text) continue;
    const r0 = pn.r + pn.size + 4;
    const r1 = r0 + text.length * CHAR_PX;
    const clash = accepted.some(
      (a) => a.r0 < r1 && r0 < a.r1 && Math.abs(a.th - pn.theta) * Math.max(a.r0, r0) < MIN_LABEL_SEP,
    );
    if (clash) continue;
    accepted.push({ th: pn.theta, r0, r1 });
    pn.label = text;
  }

  return { nodes: out, outerRadius, slotRadius };
}
