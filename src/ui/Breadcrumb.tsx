import { createEffect, For, type Component } from 'solid-js';
import type { TreeProvider } from '../data/types';
import { chainFrom, lineage } from '../layout/view';

interface Crumb {
  key: string;
  label: string;
  unnamedRun: number; // >0 when this crumb stands for a run of unnamed clades
}

/** Root → center path. Runs of unnamed clades collapse into a single "…" crumb. */
export const Breadcrumb: Component<{
  provider: TreeProvider;
  centerKey: string;
  onSelect: (key: string) => void;
}> = (props) => {
  let el!: HTMLElement;

  const crumbs = (): Crumb[] => {
    const out: Crumb[] = [];
    for (const key of lineage(props.provider, props.centerKey)) {
      const name = chainFrom(props.provider, key).find((t) => t.name)?.name ?? null;
      const last = out[out.length - 1];
      if (!name && last?.unnamedRun) {
        last.key = key; // jump to the deepest clade of the run
        last.unnamedRun++;
      } else {
        out.push({ key, label: name ?? '…', unnamedRun: name ? 0 : 1 });
      }
    }
    return out;
  };

  createEffect(() => {
    props.centerKey;
    queueMicrotask(() => el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' }));
  });

  return (
    <nav class="breadcrumb" ref={el}>
      <For each={crumbs()}>
        {(c, i) => (
          <>
            {i() > 0 && <span class="sep">›</span>}
            <button
              classList={{ crumb: true, current: c.key === props.centerKey, unnamed: c.unnamedRun > 0 }}
              title={c.unnamedRun ? `${c.unnamedRun} unnamed clade${c.unnamedRun > 1 ? 's' : ''}` : c.label}
              onClick={() => props.onSelect(c.key)}
            >
              {c.label}
            </button>
          </>
        )}
      </For>
    </nav>
  );
};
