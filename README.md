# Vitalis 🧬

> A Particle Life simulation built with TypeScript and Vite.

Vitalis acts as a chaotic primordial soup where simple mathematical rules between 4 particle types give rise to complex, emergent structures like cells, gliders, and organic tissues.

## 🚀 Getting Started

1. **Install dependencies:**
    ```bash
    npm install
    ```

2. **Run locally:**
    ```bash
    npm run dev
    ```

## 🎮 Controls

The simulation runs automatically, but you can tweak the universe in real-time using the floating sidebar:

* **Gravity:** Increases the global attraction force.
* **Friction:** Determines how much velocity particles lose over time.
* **Presets:**
    * **Worms:** Creates self-propelling snake-like structures.
    * **Cells:** Forms stable clusters with distinct "membranes."

## 🧮 How it Works

The universe consists of 4 particle types (Red, Cyan, Green, Yellow). Interactions are governed by a **4x4 Attraction Matrix**:
* **Positive values (> 0.0):** Attraction
* **Negative values (< 0.0):** Repulsion
* **Zero:** Neutrality (Particles ignore each other)

The rendering engine utilizes an **Offscreen Buffer** and customized composite operations to generate smooth, persistent particle trails without the severe performance hits or alpha-channel rounding errors typical of standard HTML canvas clears.

## 🗺️ Roadmap

* **Matrix Editor:** Allow users to type numbers directly into the 4x4 grid in the sidebar to create their own custom species.
* **Save/Load System:** Save the current matrix configuration to LocalStorage or export it as a JSON file.
* **Brush Mode:** Click and drag on the canvas to spawn specific particles interactively (e.g., "Draw with Red").
* **Zoom & Pan:** Implement a camera system to explore larger simulated universes.
* **Mobile Support:** Add touch events for the floating sidebar UI.