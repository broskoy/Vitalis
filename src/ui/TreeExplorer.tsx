import { createEffect, createSignal, on, onCleanup, onMount, Show, type Component } from 'solid-js';
import type { TreeProvider } from '../data/types';
import { buildView, chainTop, type View } from '../layout/view';
import { TreeRenderer } from '../render/treeRenderer';
import { Breadcrumb } from './Breadcrumb';
import { PreviewCard, type CardState } from './PreviewCard';

const HOVER_DELAY = 150;

/** Focused node lives in the URL hash so Back/Forward and links work. */
function keyFromHash(p: TreeProvider): string {
  const id = decodeURIComponent(location.hash.slice(1));
  return id && p.get(id) ? chainTop(p, id) : p.rootId;
}

export const TreeExplorer: Component<{ provider: TreeProvider }> = (props) => {
  const p = props.provider;
  const [centerKey, setCenterKey] = createSignal(keyFromHash(p));
  const [view, setView] = createSignal<View>(buildView(p, centerKey()));
  const [card, setCard] = createSignal<CardState | null>(null);

  let container!: HTMLDivElement;
  let svg!: SVGSVGElement;
  let renderer: TreeRenderer;
  let hoverTimer = 0;

  const navigate = (key: string) => {
    if (key === centerKey()) return;
    location.hash = encodeURIComponent(key);
  };
  const goUp = () => {
    const slot = view().parentSlot;
    if (slot) navigate(slot.key);
  };
  const showCard = (key: string, pinned: boolean, x?: number, y?: number) => {
    const node = view().nodes.get(key);
    if (!node) return;
    const pos = x !== undefined && y !== undefined ? { x, y } : renderer.screenPos(key);
    if (!pos) return;
    setCard({ node, x: pos.x, y: pos.y, pinned });
  };
  const hideCard = () => {
    clearTimeout(hoverTimer);
    setCard(null);
  };

  onMount(() => {
    renderer = new TreeRenderer(svg, p, {
      onTap(key, pointerType) {
        const v = view();
        const node = v.nodes.get(key);
        if (!node) return;
        if (key === v.center.key || key === v.parentSlot?.key) {
          hideCard();
          goUp();
          return;
        }
        // "+N more" wedges and species tips have nothing to drill into: show the card.
        if (node.kind === 'more' || node.isTip) {
          showCard(key, true);
          return;
        }
        // Touch/pen: first tap previews, second tap on the same node focuses it.
        if (pointerType !== 'mouse' && card()?.node.key !== key) {
          showCard(key, true);
          return;
        }
        hideCard();
        navigate(key);
      },
      onLongPress(key) {
        showCard(key, true);
      },
      onHover(key, x, y) {
        clearTimeout(hoverTimer);
        if (card()?.pinned) return;
        if (!key) {
          setCard(null);
          return;
        }
        hoverTimer = window.setTimeout(() => showCard(key, false, x, y), HOVER_DELAY);
      },
      onBackground: hideCard,
    });

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      renderer.resize(width, height);
    });
    ro.observe(container);

    const onHash = () => setCenterKey(keyFromHash(p));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && card()) return hideCard();
      if (['Escape', 'Backspace', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        goUp();
      }
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('keydown', onKey);

    renderer.show(view(), true);

    onCleanup(() => {
      ro.disconnect();
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('keydown', onKey);
      renderer.destroy();
    });
  });

  createEffect(
    on(
      centerKey,
      (key) => {
        hideCard();
        const v = buildView(p, key);
        setView(v);
        renderer.show(v, true);
      },
      { defer: true },
    ),
  );

  return (
    <div class="app">
      <header>
        <Breadcrumb provider={p} centerKey={centerKey()} onSelect={navigate} />
      </header>
      <main ref={container}>
        <svg ref={svg} class="tree" />
      </main>
      <Show when={card()}>
        {(c) => (
          <PreviewCard
            provider={p}
            state={c()}
            onOpen={(key) => {
              hideCard();
              navigate(key);
            }}
          />
        )}
      </Show>
      <footer>
        <span>Data: Open Tree of Life synthetic tree (CC0)</span>
        <span class="hint">click to focus · center, ↑ or Esc to go up</span>
      </footer>
    </div>
  );
};
