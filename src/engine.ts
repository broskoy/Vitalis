import { State } from './state';

export type Particle = {
    x: number; y: number;
    vx: number; vy: number;
    color: string; type: number;
};

let particles: Particle[] = [];
let ctx: CanvasRenderingContext2D;
let width = 0;
let height = 0;

const PARTICLE_COUNT = 1000;
const REPULSION_RANGE = 20;

function createParticle(): Particle {
    const type = Math.floor(Math.random() * 4);
    const colors = ["#FF0000", "#00FFFF", "#00FF00", "#FFFF00"];
    return {
        x: Math.random() * width,
        y: Math.random() * height,
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
            if (dx > width * 0.5) dx -= width;
            if (dx < -width * 0.5) dx += width;
            if (dy > height * 0.5) dy -= height;
            if (dy < -height * 0.5) dy += height;

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
        if (p.x < 0) p.x += width;
        if (p.x > width) p.x -= width;
        if (p.y < 0) p.y += height;
        if (p.y > height) p.y -= height;
    }
}

function loop() {
    // Clear screen
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, width, height);

    // Draw Particles
    for (let p of particles) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
    }

    updatePhysics();
    requestAnimationFrame(loop);
}

export function resetParticles() {
    particles = Array.from({ length: PARTICLE_COUNT }, createParticle);
}


export function initEngine(canvasElement: HTMLCanvasElement) {
    ctx = canvasElement.getContext('2d')!;

    const resize = () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvasElement.width = width;
        canvasElement.height = height;
    };

    window.addEventListener('resize', resize);
    resize();

    resetParticles();
    loop();
}