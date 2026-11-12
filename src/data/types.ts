/** One node of the source tree (Open Tree synthetic tree node). */
export interface Taxon {
  /** "ott1234" for taxa, "mrcaott12ott34" for unnamed clades. Stable across sessions. */
  id: string;
  /** Scientific name; null for unnamed clades. */
  name: string | null;
  rank: string | null;
  /** Number of terminal tips (≈ species) below this node; 1 for a tip. */
  numTips: number;
  extinct: boolean;
  parentId: string | null;
  /** Child ids, sorted by numTips descending (largest clade first). */
  childIds: string[];
}

/**
 * Swappable data source. The prototype uses an in-memory snapshot; the live
 * Open Tree provider (milestone 3) will fetch lazily and cache by id.
 *
 * Contract: `get` is synchronous and only returns what is already loaded.
 * Callers `await ensure(...)` first for anything they are about to show.
 */
export interface TreeProvider {
  readonly rootId: string;
  get(id: string): Taxon | undefined;
  /** Ensure `id`, its ancestors, and its descendants `depth` levels down are loaded. */
  ensure(id: string, depth: number): Promise<void>;
}
