import type { Taxon, TreeProvider } from '../data/types';

/**
 * The pruned, display-ready tree around the focused node.
 *
 * Display nodes are keyed by the id of the TOP of their single-child chain:
 * a chain A → B → C (each with exactly one child) shows as one node keyed "A".
 * Because the source topology is fixed, a given taxon always maps to the same
 * key, which is what keeps D3 joins (and therefore animations) stable.
 */
export interface ViewNode {
  key: string;
  kind: 'taxon' | 'more';
  /** Taxon ids in the chain, top → bottom. For 'more': the hidden sibling ids. */
  ids: string[];
  /** First named taxon in the chain (null → unnamed clade). */
  name: string | null;
  rank: string | null;
  numTips: number;
  extinct: boolean;
  depth: number;
  parent: ViewNode | null;
  children: ViewNode[];
  /** Has children in the data that are not drawn (not expanded). */
  collapsed: boolean;
  /** Is a terminal (species-level tip). */
  isTip: boolean;
}

export interface View {
  center: ViewNode;
  /** The center's display parent, drawn as the "up" arrow. Null at the root. */
  parentSlot: ViewNode | null;
  /** All nodes, center and slot included, by key. */
  nodes: Map<string, ViewNode>;
  /** Deepest ring actually used (0–MAX_RINGS). */
  maxDepth: number;
}

/** Rings always drawn when the data has them. */
export const MIN_RINGS = 3;
/** Sparse views (mostly binary splits) may keep adding rings up to this. */
export const MAX_RINGS = 6;
/** Add a ring beyond MIN_RINGS only while the view has fewer nodes than this. */
const SPARSE_BELOW = 40;
/** Max nodes on screen, center and parent slot included. */
export const NODE_BUDGET = 100;
/** Max children shown per parent, by the parent's depth (last value repeats). */
const CHILD_CAP = [20, 12, 8];

/** Walk up to the top of the single-child chain containing `id`. */
export function chainTop(p: TreeProvider, id: string): string {
  let t = p.get(id);
  while (t?.parentId) {
    const parent = p.get(t.parentId);
    if (!parent || parent.childIds.length !== 1) break;
    t = parent;
  }
  return t?.id ?? id;
}

/** Ids of the single-child chain starting at `topId`, top → bottom. */
export function chainFrom(p: TreeProvider, topId: string): Taxon[] {
  const out: Taxon[] = [];
  let t = p.get(topId);
  while (t) {
    out.push(t);
    if (t.childIds.length !== 1) break;
    t = p.get(t.childIds[0]);
  }
  return out;
}

/** Display key of the display parent of `key`, or null at the root. */
export function displayParent(p: TreeProvider, key: string): string | null {
  const parentId = p.get(key)?.parentId;
  return parentId ? chainTop(p, parentId) : null;
}

function makeNode(p: TreeProvider, key: string, depth: number, parent: ViewNode | null): ViewNode {
  const chain = chainFrom(p, key);
  const bottom = chain[chain.length - 1];
  const named = chain.find((t) => t.name);
  return {
    key,
    kind: 'taxon',
    ids: chain.map((t) => t.id),
    name: named?.name ?? null,
    rank: named?.rank ?? null,
    numTips: chain[0].numTips,
    extinct: chain[0].extinct,
    depth,
    parent,
    children: [],
    collapsed: bottom.childIds.length > 0,
    isTip: bottom.childIds.length === 0,
  };
}

const weight = (n: ViewNode) => Math.log2(1 + n.numTips);

/**
 * Split `budget` slots between candidates proportionally to weight
 * ("water filling"): candidates that need less than their share get exactly
 * what they need and the surplus is re-shared among the rest.
 * A truncated expansion needs at least 3 slots (2 children + a "+N" wedge).
 */
function allocate(cands: { node: ViewNode; demand: number }[], budget: number): Map<ViewNode, number> {
  const alloc = new Map<ViewNode, number>();
  let active = cands.slice();
  let pool = budget;
  for (;;) {
    const wsum = active.reduce((s, c) => s + weight(c.node), 0);
    const satisfied = active.filter((c) => c.demand <= (pool * weight(c.node)) / wsum);
    if (satisfied.length === 0) break;
    for (const c of satisfied) {
      alloc.set(c.node, c.demand);
      pool -= c.demand;
    }
    active = active.filter((c) => !satisfied.includes(c));
    if (active.length === 0) return alloc;
  }
  const wsum = active.reduce((s, c) => s + weight(c.node), 0);
  for (const c of active) {
    const a = Math.floor((pool * weight(c.node)) / wsum);
    if (a >= 3) {
      alloc.set(c.node, a);
      pool -= a;
    }
  }
  // Hand out rounding leftovers, heaviest first.
  for (const c of active.sort((a, b) => weight(b.node) - weight(a.node))) {
    const cur = alloc.get(c.node) ?? 0;
    const add = Math.min(pool, c.demand - cur);
    if (add > 0 && (cur + add >= 3 || cur + add === c.demand)) {
      alloc.set(c.node, cur + add);
      pool -= add;
    }
  }
  return alloc;
}

export function buildView(p: TreeProvider, focusId: string): View {
  const centerKey = chainTop(p, focusId);
  const nodes = new Map<string, ViewNode>();
  const center = makeNode(p, centerKey, 0, null);
  nodes.set(center.key, center);

  const slotKey = displayParent(p, centerKey);
  const parentSlot = slotKey ? makeNode(p, slotKey, -1, null) : null;
  if (parentSlot) nodes.set(parentSlot.key, parentSlot);

  let used = nodes.size;
  let level = [center];
  let maxDepth = 0;

  for (let depth = 0; depth < MAX_RINGS && level.length; depth++) {
    if (depth >= MIN_RINGS && used >= SPARSE_BELOW) break;
    const cap = CHILD_CAP[Math.min(depth, CHILD_CAP.length - 1)];
    const cands = level
      .filter((n) => n.collapsed)
      .map((n) => {
        const kids = chainFrom(p, n.key).at(-1)!.childIds;
        return { node: n, kids, demand: Math.min(kids.length, cap) };
      });
    const alloc = allocate(cands, NODE_BUDGET - used);
    const next: ViewNode[] = [];

    for (const { node, kids } of cands) {
      const slots = alloc.get(node) ?? 0;
      if (slots === 0) continue;
      const shown = slots >= kids.length ? kids.length : slots - 1;
      for (const kid of kids.slice(0, shown)) {
        const child = makeNode(p, chainTop(p, kid), depth + 1, node);
        node.children.push(child);
        nodes.set(child.key, child);
        next.push(child);
      }
      const hidden = kids.slice(shown);
      if (hidden.length) {
        const more: ViewNode = {
          key: `${node.key}::more`,
          kind: 'more',
          ids: hidden,
          name: null,
          rank: null,
          numTips: hidden.reduce((s, id) => s + (p.get(id)?.numTips ?? 0), 0),
          extinct: false,
          depth: depth + 1,
          parent: node,
          children: [],
          collapsed: false,
          isTip: false,
        };
        node.children.push(more);
        nodes.set(more.key, more);
      }
      node.collapsed = false;
      used += node.children.length;
      maxDepth = depth + 1;
    }
    // Next level, biggest clades first (they get first claim on leftovers).
    level = next.sort((a, b) => b.numTips - a.numTips);
  }

  return { center, parentSlot, nodes, maxDepth };
}

/** Display keys from the root down to (and including) `key`. */
export function lineage(p: TreeProvider, key: string): string[] {
  const out: string[] = [];
  for (let k: string | null = key; k; k = displayParent(p, k)) out.push(k);
  return out.reverse();
}
