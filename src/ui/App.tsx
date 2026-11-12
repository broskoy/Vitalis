import { createResource, Show, type Component } from 'solid-js';
import { SampleProvider } from '../data/sampleProvider';
import { TreeExplorer } from './TreeExplorer';

export const App: Component = () => {
  const [provider] = createResource(() =>
    SampleProvider.load(`${import.meta.env.BASE_URL}data/mammalia.json`),
  );

  return (
    <Show
      when={provider()}
      fallback={<div class="status">{provider.error ? `Failed to load tree: ${provider.error}` : 'Loading tree…'}</div>}
    >
      {(p) => <TreeExplorer provider={p()} />}
    </Show>
  );
};
