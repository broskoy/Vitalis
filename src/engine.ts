// engine.ts
import { State, type Particle } from './state';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
// Alpha: false helps performance and ensures the background fade works correctly
const ctx = canvas.getContext('2d', { alpha: false })!;

// Setup Offscreen Buffer (for trails)
const buffer = document.createElement('canvas');
const bctx = buffer.getContext('2d')!;

const PARTICLE_COUNT = 800;
const REPULSION_RANGE = 20;

let particles: Particle[] = [];

// --- Helpers ---

function resize() {
    canvas.width = buffer.width = window.innerWidth;
    canvas.height = buffer.height = window.innerHeight;
}

function createParticle(): Particle {
    const type = Math.floor(Math.random() * 4);
    const colors = ["#FF0000", "#00FFFF", "#00FF00", "#FFFF00"];
    return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: 0, vy: 0,
        color: colors[type],
        type: type
    };
}

// --- Core Physics ---

function updatePhysics() {
    for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        let fx = 0, fy = 0;

        for (let j = 0; j < particles.length; j++) {
            if (i === j) continue;
            const p2 = particles[j];

            let dx = p2.x - p1.x;
            let dy = p2.y - p1.y;

            // Toroidal Wrap (Shortest path across screen edges)
            if (dx > canvas.width * 0.5) dx -= canvas.width;
            if (dx < -canvas.width * 0.5) dx += canvas.width;
            if (dy > canvas.height * 0.5) dy -= canvas.height;
            if (dy < -canvas.height * 0.5) dy += canvas.height;

            const distSq = dx * dx + dy * dy;
            if (distSq > 6400) continue; // Optimization: Ignore far particles

            const dist = Math.sqrt(distSq);

            // KEY: Read from the shared State object
            const force = State.attractions[p1.type][p2.type];

            // Attraction
            if (dist > REPULSION_RANGE && dist < 80) {
                const f = force * State.forceStrength / dist;
                fx += f * dx;
                fy += f * dy;
            }
            // Repulsion
            if (dist > 0 && dist < REPULSION_RANGE) {
                const f = -2.0 * State.forceStrength / dist;
                fx += f * dx;
                fy += f * dy;
            }
        }
        p1.vx += fx;
        p1.vy += fy;
    }

    // Movement & Friction
    for (let p of particles) {
        p.vx *= State.friction; // Read from State
        p.vy *= State.friction;
        p.x += p.vx;
        p.y += p.vy;

        // Wrap Position
        if (p.x < 0) p.x += canvas.width;
        if (p.x > canvas.width) p.x -= canvas.width;
        if (p.y < 0) p.y += canvas.height;
        if (p.y > canvas.height) p.y -= canvas.height;
    }
}

// --- Render Loop ---

function loop() {
    // 1. Draw trails using buffer method
    bctx.clearRect(0, 0, buffer.width, buffer.height);
    bctx.drawImage(canvas, 0, 0);

    // Clear screen with opaque color (Fixes alpha buildup)
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw buffer back with transparency
    ctx.globalAlpha = 0.85;
    ctx.drawImage(buffer, 0, 0);
    ctx.globalAlpha = 1.0;

    // 2. Draw Particles
    for (let p of particles) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
    }

    updatePhysics();
    requestAnimationFrame(loop);
}

// --- Public API ---

export function initEngine() {
    window.addEventListener('resize', resize);
    resize();
    resetParticles(); // Initial spawn
    loop(); // Start loop
}

export function resetParticles() {
    particles = Array.from({ length: PARTICLE_COUNT }, createParticle);
}