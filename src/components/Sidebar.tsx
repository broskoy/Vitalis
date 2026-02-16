// src/components/Sidebar.tsx
import { createSignal } from 'solid-js';
import { State, PRESETS } from '../state';
import { resetParticles } from '../engine'; // We might need to trigger a reset
import { Matrix } from './Matrix';

export const Sidebar = () => {
  // Local UI state (doesn't need to be in the global store)
  const [isOpen, setIsOpen] = createSignal(true);

  return (
    <div class="fixed top-6 right-6 z-50 w-72 bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl transition-all duration-500 overflow-hidden">
      
      {/* Header */}
      <div class="flex items-center justify-between px-5 py-4">
        <h1 class="text-lg font-light tracking-widest uppercase text-white select-none">
          Vitalis
        </h1>
        <button 
          onClick={() => setIsOpen(!isOpen())}
          class="text-white text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
        >
          {isOpen() ? '✕' : '☰'}
        </button>
      </div>

      {/* Accordion Content */}
      <div 
        class={`transition-all duration-500 ease-in-out px-5 overflow-hidden ${
          isOpen() ? 'max-h-[80vh] opacity-100 pb-5' : 'max-h-0 opacity-0'
        }`}
      >
        <div class="flex flex-col gap-5">
          <hr class="border-white/10" />

          {/* Gravity Slider */}
          <div class="flex flex-col gap-2">
            <div class="flex justify-between">
              <label class="text-xs font-bold text-zinc-500 uppercase">Gravity</label>
              <span class="text-xs text-zinc-500">{State.forceStrength.toFixed(2)}</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.01"
              class="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              value={State.forceStrength}
              onInput={(e) => State.forceStrength = parseFloat(e.currentTarget.value)}
            />
          </div>

          {/* Friction Slider */}
          <div class="flex flex-col gap-2">
            <div class="flex justify-between">
              <label class="text-xs font-bold text-zinc-500 uppercase">Friction</label>
              <span class="text-xs text-zinc-500">{State.friction.toFixed(2)}</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.01"
              class="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              value={State.friction}
              onInput={(e) => State.friction = parseFloat(e.currentTarget.value)}
            />
          </div>

          <hr class="border-white/10" />

          {/* Presets */}
          <div>
            <p class="text-xs font-bold text-zinc-500 uppercase mb-3">Presets</p>
            <div class="grid grid-cols-2 gap-2">
              <button 
                onClick={() => { State.attractions = PRESETS.worms; resetParticles(); }}
                class="bg-zinc-800 hover:bg-zinc-700 text-sm py-2 rounded border border-white/5 text-zinc-300 transition-colors"
              >
                Worms
              </button>
              <button 
                onClick={() => { State.attractions = PRESETS.cells; resetParticles(); }}
                class="bg-zinc-800 hover:bg-zinc-700 text-sm py-2 rounded border border-white/5 text-zinc-300 transition-colors"
              >
                Cells
              </button>
            </div>
          </div>

          <hr class="border-white/10" />

          {/* Matrix Component */}
          <div>
            <p class="text-xs font-bold text-zinc-500 uppercase mb-2">Attraction Matrix</p>
            <Matrix />
          </div>

        </div>
      </div>
    </div>
  );
};