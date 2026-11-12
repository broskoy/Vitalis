import type { Taxon, TreeProvider } from './types';

/** Shape written by scripts/fetch-sample.mjs (flat preorder arrays). */
interface Snapshot {
  ids: string[];
  names: string[];
  parents: number[];
  rankTable: string[];
  ranks: number[];
  extinct: number[];
}

/** Whole subtree held in memory. Used for milestones 1–2. */
export class SampleProvider implements TreeProvider {
  readonly rootId: string;
  private nodes = new Map<string, Taxon>();

  private constructor(snap: Snapshot) {
    const { ids, names, parents, rankTable, ranks } = snap;
    const extinct = new Set(snap.extinct);
    const list: Taxon[] = ids.map((id, i) => ({
      id,
      name: names[i] || null,
      rank: rankTable[ranks[i]] && rankTable[ranks[i]] !== 'no rank' ? rankTable[ranks[i]] : null,
      numTips: 0,
      extinct: extinct.has(i),
      parentId: parents[i] >= 0 ? ids[parents[i]] : null,
      childIds: [],
    }));
    for (let i = 0; i < list.length; i++) {
      if (parents[i] >= 0) list[parents[i]].childIds.push(list[i].id);
    }
    // Preorder: children come after parents, so a reverse pass sums tips bottom-up.
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].childIds.length === 0) list[i].numTips = 1;
      if (parents[i] >= 0) list[parents[i]].numTips += list[i].numTips;
    }
    for (const t of list) this.nodes.set(t.id, t);
    for (const t of list) {
      t.childIds.sort((a, b) => this.nodes.get(b)!.numTips - this.nodes.get(a)!.numTips);
    }
    this.rootId = ids[0];
  }

  static async load(url: string): Promise<SampleProvider> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return new SampleProvider(await res.json());
  }

  get(id: string): Taxon | undefined {
    return this.nodes.get(id);
  }

  async ensure(): Promise<void> {
    // Everything is already in memory.
  }
}
