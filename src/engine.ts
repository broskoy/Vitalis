import { State } from './state';

export type Particle = {
    x: number; y: number;
    vx: number; vy: number;
    color: string; type: number;
};

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const PARTICLE_COUNT = 1000;
const REPULSION_RANGE = 20;
const CELL_SIZE = 80;

let particles: Particle[] = [];
let ctx: CanvasRenderingContext2D;
let canvas: HTMLCanvasElement;

// Camera state
export let cameraX = WORLD_WIDTH / 2;
export let cameraY = WORLD_HEIGHT / 2;
export let zoom = 1.0;

function createParticle(): Particle {
    const type = Math.floor(Math.random() * 4);
    const colors = ["#FF0000", "#00FFFF", "#00FF00", "#FFFF00"];
    return {
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        vx: 0, vy: 0,
        color: colors[type],
        type: type
    };
}

function updatePhysics() {
    const friction = State.friction;
    const forceStrength = State.forceStrength;
    const attractions = State.attractions;

    const cols = Math.ceil(WORLD_WIDTH / CELL_SIZE);
    const rows = Math.ceil(WORLD_HEIGHT / CELL_SIZE);

    // 1. Clear and populate Spatial Grid
    const grid: Particle[][][] = Array.from({ length: cols }, () => Array.from({ length: rows }, () => []));
    
    for (let p of particles) {
        let col = Math.floor(p.x / CELL_SIZE);
        let row = Math.floor(p.y / CELL_SIZE);
        
        // Safety bounds
        if (col < 0) col = 0; if (col >= cols) col = cols - 1;
        if (row < 0) row = 0; if (row >= rows) row = rows - 1;
        
        grid[col][row].push(p);
    }

    // 2. Compute forces using neighborhood
    for (let p1 of particles) {
        let fx = 0, fy = 0;
        
        const col = Math.floor(p1.x / CELL_SIZE);
        const row = Math.floor(p1.y / CELL_SIZE);

        // Check the 3x3 neighborhood, wrapping around the edges
        for (let xOff = -1; xOff <= 1; xOff++) {
            for (let yOff = -1; yOff <= 1; yOff++) {
                let nCol = (col + xOff + cols) % cols;
                let nRow = (row + yOff + rows) % rows;
                
                const cellParticles = grid[nCol][nRow];
                for (let p2 of cellParticles) {
                    if (p1 === p2) continue;

                    let dx = p2.x - p1.x;
                    let dy = p2.y - p1.y;

                    // Toroidal Wrap mapping for distances
                    if (dx > WORLD_WIDTH * 0.5) dx -= WORLD_WIDTH;
                    if (dx < -WORLD_WIDTH * 0.5) dx += WORLD_WIDTH;
                    if (dy > WORLD_HEIGHT * 0.5) dy -= WORLD_HEIGHT;
                    if (dy < -WORLD_HEIGHT * 0.5) dy += WORLD_HEIGHT;

                    const distSq = dx * dx + dy * dy;
                    if (distSq > 6400) continue; // 80^2

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
            }
        }
        p1.vx += fx;
        p1.vy += fy;
    }

    // 3. Apply Velocity, Friction, and World Wrap
    for (let p of particles) {
        p.vx *= friction;
        p.vy *= friction;
        p.x += p.vx;
        p.y += p.vy;

        // Wrap Position
        if (p.x < 0) p.x += WORLD_WIDTH;
        if (p.x >= WORLD_WIDTH) p.x -= WORLD_WIDTH;
        if (p.y < 0) p.y += WORLD_HEIGHT;
        if (p.y >= WORLD_HEIGHT) p.y -= WORLD_HEIGHT;
    }
}

function loop() {
    // Clear screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Particles using Camera
    for (let p of particles) {
        ctx.fillStyle = p.color;
        
        // Map World Coordinates to Screen Coordinates
        const screenX = (p.x - cameraX) * zoom + canvas.width / 2;
        const screenY = (p.y - cameraY) * zoom + canvas.height / 2;
        
        const size = Math.max(1, 4 * zoom);
        
        // Frustum culling (only draw what's on screen)
        if (screenX >= -size && screenX <= canvas.width && screenY >= -size && screenY <= canvas.height) {
            ctx.fillRect(screenX, screenY, size, size);
        }
    }

    updatePhysics();
    requestAnimationFrame(loop);
}

export function resetParticles() {
    particles = Array.from({ length: PARTICLE_COUNT }, createParticle);
}

function setupControls() {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let initialPinchDist = 0;

    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        cameraX -= dx / zoom;
        cameraY -= dy / zoom;
        lastX = e.clientX;
        lastY = e.clientY;
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        
        // Scale the zoom based on the actual scroll amount (deltaY)
        // This makes smooth-scrolling touchpads feel buttery smooth instead of chaotic
        const zoomMultiplier = Math.exp(e.deltaY * -0.002);
        const newZoom = zoom * zoomMultiplier;
        
        const mx = e.clientX - canvas.width / 2;
        const my = e.clientY - canvas.height / 2;
        
        const worldX = (mx / zoom) + cameraX;
        const worldY = (my / zoom) + cameraY;
        
        zoom = newZoom;
        
        cameraX = worldX - mx / zoom;
        cameraY = worldY - my / zoom;
    }, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialPinchDist = Math.sqrt(dx * dx + dy * dy);
        }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) {
            isDragging = false;
        } else if (e.touches.length === 1) {
            isDragging = true;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
        }
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault(); 
        
        if (e.touches.length === 1 && isDragging) {
            const dx = e.touches[0].clientX - lastX;
            const dy = e.touches[0].clientY - lastY;
            cameraX -= dx / zoom;
            cameraY -= dy / zoom;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const ratio = distance / initialPinchDist;
            
            const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            
            const mx = cx - canvas.width / 2;
            const my = cy - canvas.height / 2;
            
            const worldX = (mx / zoom) + cameraX;
            const worldY = (my / zoom) + cameraY;
            
            zoom = zoom * ratio;
            cameraX = worldX - mx / zoom;
            cameraY = worldY - my / zoom;
            
            initialPinchDist = distance;
        }
    }, { passive: false });
}

export function initEngine(canvasElement: HTMLCanvasElement) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d')!;

    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();
    setupControls();

    resetParticles();
    loop();
}