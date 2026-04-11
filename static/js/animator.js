/**
 * animator.js - Canvas based Photon Visualizations
 * Optimized for "Real Photon" aesthetics on Light Theme
 */

export class QuantumCanvas {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.particles = [];
        this.animationId = null;
        this.animationLoopRunning = false;
        this.onCompleteCallback = null;
        this.eveActive = false;
        this.config = {
            speedMultiplier: 1.0,
            showWaves: true
        };
    }

    resize() {
        if (!this.canvas) return;
        const container = this.canvas.parentElement;
        if (!container) return;
        this.canvas.width = container.clientWidth || 800;
        this.canvas.height = container.clientHeight || 300;
    }

    clear() {
        if (!this.ctx) return;
        // Deep Space Black (Transparent allows the Nexus background to show through)
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Subtle Quantum Grid (Neon Amber/Blue)
        this.ctx.strokeStyle = 'rgba(150, 73, 0, 0.08)';
        this.ctx.lineWidth = 0.5;
        const cellSize = 40;

        for (let x = 0; x < this.canvas.width; x += cellSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += cellSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawArrow(x, y, angle, length, color) {
        const rad = angle * Math.PI / 180;
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(rad);

        this.ctx.beginPath();
        this.ctx.moveTo(-length / 2, 0);
        this.ctx.lineTo(length / 2, 0);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2.5;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();

        // Arrow head (sharp clinical look)
        const arrowSize = 5;
        this.ctx.beginPath();
        this.ctx.moveTo(length / 2, 0);
        this.ctx.lineTo(length / 2 - arrowSize, -arrowSize / 1.5);
        this.ctx.lineTo(length / 2 - arrowSize, arrowSize / 1.5);
        this.ctx.fillStyle = color;
        this.ctx.fill();

        this.ctx.restore();
    }

    animateTransmission(photons, eveActive = false, onComplete) {
        if (!this.canvas) return;
        this.clear();
        this.particles = [];
        this.onCompleteCallback = onComplete;
        this.eveActive = eveActive;

        const visualLimit = Math.min(photons.length, 25);
        const spacing = this.canvas.height / (visualLimit + 1);

        for (let i = 0; i < visualLimit; i++) {
            this.particles.push({
                x: 0,
                y: spacing * (i + 1),
                angle: photons[i],
                speed: (2.0 + Math.random() * 1.5) * this.config.speedMultiplier,
                color: '#4cc9f0', // Electric Cyan
                pulse: Math.random() * Math.PI,
                intercepted: false
            });
        }

        this.play();
    }

    play() {
        if (!this.canvas || this.particles.length === 0) return;
        if (this.animationLoopRunning) return;
        this.animationLoopRunning = true;
        this.render();
    }

    pause() {
        this.animationLoopRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    step() {
        this.pause();
        this.advanceParticles();
        this.drawParticles();
    }

    advanceParticles() {
        let allDone = true;
        this.particles.forEach(p => {
            p.x += p.speed;
            p.pulse += 0.08;

            // "Real Photon" Wave Propagation
            if (this.config.showWaves) {
                const waveFreq = 0.08;
                const waveAmp = 14;
                p.waveOffset = Math.sin(p.x * waveFreq + p.pulse) * waveAmp;
            } else {
                p.waveOffset = 0;
            }

            // High-fidelity Interception (Eve)
            if (this.eveActive && p.x > this.canvas.width * 0.45 && p.x < this.canvas.width * 0.55 && !p.intercepted) {
                p.color = '#f72585'; // High-Energy Crimson
                p.intercepted = true;
            }

            if (p.x < this.canvas.width + 50) {
                allDone = false;
            }
        });
        return allDone;
    }

    drawParticles() {
        this.clear();
        this.particles.forEach(p => {
            const glowOpacity = 0.05 + Math.abs(Math.sin(p.pulse)) * 0.15;
            const sizeScale = 1.0 + Math.abs(Math.sin(p.pulse * 0.4)) * 0.25;

            // Soft Quantum Aura
            this.ctx.beginPath();
            const rgba = p.color === '#4cc9f0' ? `rgba(76, 201, 240, ${glowOpacity})` : `rgba(247, 37, 133, ${glowOpacity})`;
            this.ctx.fillStyle = rgba;
            this.ctx.arc(p.x, p.y + p.waveOffset, 22 * sizeScale, 0, Math.PI * 2);
            this.ctx.fill();

            // Core Photon Particle
            this.drawArrow(p.x, p.y + p.waveOffset, p.angle, 14, p.color);
        });
    }

    render() {
        if (!this.animationLoopRunning) return;

        let allDone = this.advanceParticles();
        this.drawParticles();

        if (!allDone) {
            this.animationId = requestAnimationFrame(() => this.render());
        } else {
            this.animationLoopRunning = false;
            if (this.onCompleteCallback) this.onCompleteCallback();
        }
    }
}
