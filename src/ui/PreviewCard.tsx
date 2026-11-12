import { createMemo, For, Show, type Component } from 'solid-js';
import type { TreeProvider } from '../data/types';
import type { ViewNode } from '../layout/view';

export interface CardState {
  node: ViewNode;
  x: number;
  y: number;
  /** Pinned cards (touch, "+N more") stay until dismissed and offer an Open button. */
  pinned: boolean;
}

const fmt = new Intl.NumberFormat('en');
const ITALIC_RANKS = new Set(['genus', 'subgenus', 'species', 'subspecies', 'variety']);

/** For unnamed clades: follow the largest child down to the first named taxon. */
function representative(p: TreeProvider, id: string): string | null {
  let t = p.get(id);
  for (let i = 0; t && i < 40; i++) {
    if (t.name && i > 0) return t.name;
    t = t.childIds.length ? p.get(t.childIds[0]) : undefined;
  }
  return null;
}

/**
 * Placeholder preview (milestone 4 adds photo, common name and attribution).
 */
export const PreviewCard: Component<{
  provider: TreeProvider;
  state: CardState;
  /** The card belongs to the focused node: no "Open" (already there). */
  isCenter: boolean;
  onOpen: (key: string) => void;
}> = (props) => {
  const n = () => props.state.node;

  const style = createMemo(() => {
    const W = 260;
    const H = 150;
    const x = Math.min(window.innerWidth - W - 8, Math.max(8, props.state.x + 14));
    const y = props.state.y + 14 + H > window.innerHeight ? props.state.y - H - 14 : props.state.y + 14;
    return { left: `${x}px`, top: `${Math.max(8, y)}px`, width: `${W}px` };
  });

  const chainNames = () =>
    n()
      .ids.map((id) => props.provider.get(id)?.name)
      .filter((s): s is string => !!s);

  const hiddenNames = () =>
    n()
      .ids.slice(0, 8)
      .map((id) => props.provider.get(id)?.name ?? `unnamed (e.g. ${representative(props.provider, id) ?? '?'})`);

  return (
    <div class="card" classList={{ pinned: props.state.pinned }} style={style()}>
      <Show
        when={n().kind === 'taxon'}
        fallback={
          <>
            <div class="card-title">{n().ids.length} more groups</div>
            <div class="card-meta">{fmt.format(n().numTips)} species in total</div>
            <ul class="card-list">
              <For each={hiddenNames()}>{(s) => <li>{s}</li>}</For>
              <Show when={n().ids.length > 8}>
                <li class="muted">…</li>
              </Show>
            </ul>
          </>
        }
      >
        <div class="card-title" classList={{ italic: ITALIC_RANKS.has(n().rank ?? ''), muted: !n().name }}>
          {n().name ?? 'Unnamed clade'}
          {n().extinct ? ' †' : ''}
        </div>
        <div class="card-meta">
          {[n().rank, n().isTip ? null : `${fmt.format(n().numTips)} species`].filter(Boolean).join(' · ')}
        </div>
        <Show when={!n().name}>
          <div class="card-note">Includes {representative(props.provider, n().key) ?? '—'}</div>
        </Show>
        <Show when={chainNames().length > 1}>
          <div class="card-note">Chain: {chainNames().join(' › ')}</div>
        </Show>
        <Show when={props.state.pinned && !n().isTip && !props.isCenter}>
          <button class="card-open" onClick={() => props.onOpen(n().key)}>
            Open ›
          </button>
        </Show>
      </Show>
    </div>
  );
};
