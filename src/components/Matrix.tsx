// src/components/Matrix.tsx
import { For } from 'solid-js';
import { State } from '../state';

export const Matrix = () => {
  return (
    <div class="grid grid-cols-4 gap-1 p-2 bg-white/5 rounded-lg border border-white/10">
      {/* Solid's <For> is like a map(), but highly optimized.
         It only updates the specific cell that changes.
      */}
      <For each={State.attractions}>
        {(row, i) => (
          <For each={row}>
            {(val, j) => (
              <input
                type="number"
                step="0.1"
                class="w-full bg-zinc-800 text-white text-xs py-1.5 rounded text-center focus:outline-none focus:ring-1 focus:ring-cyan-500"
                
                // 1. READ value from store
                value={val}
                
                // 2. WRITE value back to store on change
                onInput={(e) => {
                  const num = parseFloat(e.currentTarget.value);
                  // Direct mutation! Solid handles the reactivity.
                  State.attractions[i()][j()] = isNaN(num) ? 0 : num;
                }}
              />
            )}
          </For>
        )}
      </For>
    </div>
  );
};