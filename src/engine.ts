import { State } from './state';

export type Particle = {
    x: number; y: number;
    vx: number; vy: number;
    color: string; type: number;
};

let particles: Particle[] = [];
let ctx: CanvasRenderingContext2D;
let canvas: HTMLCanvasElement;
let logicalWidth = 0;
let logicalHeight = 0;
let scale = 1;

const PARTICLE_COUNT = 1000;
const REPULSION_RANGE = 20;

function createParticle(): Particle {
    const type = Math.floor(Math.random() * 4);
    const colors = ["#FF0000", "#00FFFF", "#00FF00", "#FFFF00"];
    return {
        x: Math.random() * logicalWidth,
        y: Math.random() * logicalHeight,
        vx: 0, vy: 0,
        color: colors[type],
        type: type
    };
}

function updatePhysics() {

    const friction = State.friction;
    const forceStrength = State.forceStrength;
    const attractions = State.attractions;

    for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        let fx = 0, fy = 0;

        for (let j = 0; j < particles.length; j++) {
            if (i === j) continue;
            const p2 = particles[j];

            let dx = p2.x - p1.x;
            let dy = p2.y - p1.y;

            // Toroidal Wrap
            if (dx > logicalWidth * 0.5) dx -= logicalWidth;
            if (dx < -logicalWidth * 0.5) dx += logicalWidth;
            if (dy > logicalHeight * 0.5) dy -= logicalHeight;
            if (dy < -logicalHeight * 0.5) dy += logicalHeight;

            const distSq = dx * dx + dy * dy;
            if (distSq > 6400) continue;

            const dist = Math.sqrt(distSq);

            const force = attractions[p1.type][p2.type];

            // Attraction
            if (dist > REPULSION_RANGE && dist < 80) {
                const f = force * forceStrength / dist;
                fx += f * dx;
                fy += f * dy;
            }
            // Repulsion
            if (dist > 0 && dist < REPULSION_RANGE) {
                const f = -2.0 * forceStrength / dist;
                fx += f * dx;
                fy += f * dy;
            }
        }
        p1.vx += fx;
        p1.vy += fy;
    }

    // Movement & Friction
    for (let p of particles) {
        p.vx *= friction;
        p.vy *= friction;
        p.x += p.vx;
        p.y += p.vy;

        // Wrap Position
        if (p.x < 0) p.x += logicalWidth;
        if (p.x > logicalWidth) p.x -= logicalWidth;
        if (p.y < 0) p.y += logicalHeight;
        if (p.y > logicalHeight) p.y -= logicalHeight;
    }
}

function loop() {
    // Clear screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Particles
    for (let p of particles) {
        ctx.fillStyle = p.color;
        const px = p.x * scale;
        const py = p.y * scale;
        const size = Math.max(1, 4 * scale);
        ctx.fillRect(px, py, size, size);
    }

    updatePhysics();
    requestAnimationFrame(loop);
}

export function resetParticles() {
    particles = Array.from({ length: PARTICLE_COUNT }, createParticle);
}


export function initEngine(canvasElement: HTMLCanvasElement) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d')!;

    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        scale = Math.min(canvas.width, canvas.height) / 1000;
        logicalWidth = canvas.width / scale;
        logicalHeight = canvas.height / scale;
    };

    window.addEventListener('resize', resize);
    resize();

    resetParticles();
    loop();
}