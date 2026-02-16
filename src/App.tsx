import { onMount } from 'solid-js';
import { Sidebar } from './components/Sidebar';
import { initEngine } from './engine';

const App = () => {
  let canvasRef: HTMLCanvasElement | undefined;

  // When the component mounts, we hand the canvas to the engine
  onMount(() => {
    if (canvasRef) {
      initEngine(canvasRef);
    }
  });

  return (
    <main class="relative w-screen h-screen">
      {/* The Simulation Layer */}
      <canvas 
        ref={canvasRef} 
        class="block w-full h-full"
      />

      {/* The UI Layer */}
      <Sidebar />
    </main>
  );
};

export default App;