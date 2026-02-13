// interface.ts
import { State, PRESETS } from './state';
import { resetParticles } from './engine';

export function initInterface() {
    // Select Elements
    const header = document.getElementById('panel-header')!;
    const content = document.getElementById('panel-content')!;
    const icon = document.getElementById('toggle-icon')!;

    // Toggle Logic
    header.addEventListener('click', () => {
        // Check if open by looking at max-height class or style
        const isOpen = content.classList.contains('open');

        if (isOpen) {
            // CLOSE
            content.classList.remove('open');
            content.style.maxHeight = '0px';
            content.style.opacity = '0';
            icon.textContent = '☰';
        } else {
            // OPEN
            content.classList.add('open');
            content.style.maxHeight = content.scrollHeight + 40 + 'px';
            content.style.opacity = '1';
            icon.textContent = '✕';
        }
    });


    // Physics Sliders
    const gravitySlider = document.querySelector('input[type="range"]:nth-of-type(1)') as HTMLInputElement;
    const frictionSlider = document.querySelector('input[type="range"]:nth-of-type(2)') as HTMLInputElement;

    gravitySlider.value = "5";
    frictionSlider.value = "80";

    gravitySlider.addEventListener('input', (e) => {
        const val = parseInt((e.target as HTMLInputElement).value);
        State.forceStrength = val / 50; // Map 0-10 -> 0.0 - 0.2
    });

    frictionSlider.addEventListener('input', (e) => {
        const val = parseInt((e.target as HTMLInputElement).value);
        State.friction = val / 100; // Map 0-100 -> 0.0 - 1.0
    });


    // Preset Buttons
    const presetButtons = document.querySelectorAll('.grid button');

    const wormsButton = presetButtons[0];
    const cellsButton = presetButtons[1];

    wormsButton.addEventListener('click', () => {
        State.attractions = PRESETS.worms;
        resetParticles();
    });

    cellsButton.addEventListener('click', () => {
        State.attractions = PRESETS.cells;
        resetParticles();
    });
}