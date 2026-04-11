/**
 * welcome_animator.js - Quantum Flux & Entanglement Hero Animation
 */

export class WelcomeAnimator {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if(!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.particles = [];
        this.frame = 0;
        this.mouse = { x: -1000, y: -1000 };
        
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.mouse.x = -1000;
            this.mouse.y = -1000;
        });
        
        this.colors = {
            primary: '#0f172a',    // Midnight Navy
            secondary: '#b59a5b',  // Scientific Gold
            accent: '#cbd5e1',     // Soft Slate
            bg: '#f8f9fa',         // Parchment (matches --clr-paper)
            glow: 'rgba(181, 154, 91, 0.2)',
            link: 'rgba(15, 23, 42, 0.05)'
        };

        this.initParticles();
        this.start();
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
    }

    initParticles() {
        const count = window.innerWidth < 768 ? 30 : 60;
        this.particles = [];
        for (let i = 0; i < count; i++) {
            this.particles.push(this.createParticle());
        }
    }

    createParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            size: 2 + Math.random() * 3,
            angle: [0, 45, 90, 135][Math.floor(Math.random() * 4)],
            baseOpacity: 0.3 + Math.random() * 0.5,
            direction: Math.random() > 0.5 ? 1 : -1,
            pulsePhase: Math.random() * Math.PI * 2
        };
    }

    drawPhoton(p, opacityMult) {
        const ctx = this.ctx;
        const rad = p.angle * Math.PI / 180;
        
        // Dynamic size and opacity based on pulse
        const pulse = Math.sin(this.frame * 0.05 + p.pulsePhase);
        const currentSize = p.size + pulse * 1.5;
        const currentOpacity = p.baseOpacity * opacityMult * (0.8 + 0.2 * pulse);
        const len = currentSize * 5;
        
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(rad);
        
        // Glowing Halo
        ctx.beginPath();
        ctx.arc(0, 0, currentSize * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = this.colors.glow;
        ctx.globalAlpha = currentOpacity * 0.5;
        ctx.fill();

        // Photon Core
        ctx.beginPath();
        ctx.arc(0, 0, currentSize, 0, Math.PI * 2);
        ctx.fillStyle = this.colors.primary;
        ctx.globalAlpha = currentOpacity;
        ctx.fill();
        
        // Polarization Axis (Line)
        ctx.beginPath();
        ctx.moveTo(-len/1.5, 0);
        ctx.lineTo(len/1.5, 0);
        ctx.strokeStyle = this.colors.secondary;
        ctx.lineWidth = 2;
        ctx.globalAlpha = currentOpacity;
        ctx.stroke();
        
        ctx.restore();
    }

    drawConnections() {
        const ctx = this.ctx;
        const maxDist = 150;
        
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const p1 = this.particles[i];
                const p2 = this.particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distSq = dx*dx + dy*dy;
                
                if (distSq < maxDist * maxDist) {
                    const dist = Math.sqrt(distSq);
                    const opacity = 1 - (dist / maxDist);
                    
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    
                    // Mouse interaction
                    const dMouse1 = Math.hypot(p1.x - this.mouse.x, p1.y - this.mouse.y);
                    const dMouse2 = Math.hypot(p2.x - this.mouse.x, p2.y - this.mouse.y);
                    let strokeColor = this.colors.link;
                    let lineAlpha = opacity * 0.4;
                    
                    if (dMouse1 < 180 || dMouse2 < 180) {
                        strokeColor = this.colors.accent;
                        lineAlpha = opacity * 0.9;
                    }
                    
                    ctx.strokeStyle = strokeColor;
                    ctx.globalAlpha = lineAlpha;
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    // Animate Quantum States moving along the lines randomly
                    if (Math.random() < 0.005) {
                        p1.ketToken = {
                            target: p2,
                            progress: 0,
                            state: ['|0⟩', '|1⟩', '|+⟩', '|-⟩'][Math.floor(Math.random() * 4)]
                        };
                    }
                }
            }
        }
        ctx.globalAlpha = 1.0;
    }

    drawKetTokens() {
        const ctx = this.ctx;
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        this.particles.forEach(p => {
            if (p.ketToken) {
                p.ketToken.progress += 0.02;
                if (p.ketToken.progress >= 1) {
                    p.ketToken = null;
                    return;
                }
                const tx = p.x + (p.ketToken.target.x - p.x) * p.ketToken.progress;
                const ty = p.y + (p.ketToken.target.y - p.y) * p.ketToken.progress;
                
                ctx.fillStyle = this.colors.accent;
                ctx.globalAlpha = Math.sin(p.ketToken.progress * Math.PI);
                ctx.fillText(p.ketToken.state, tx, ty - 10);
            }
        });
        ctx.globalAlpha = 1.0;
    }

    start() {
        const loop = () => {
            // Smooth motion blur fade
            this.ctx.fillStyle = this.colors.bg;
            this.ctx.globalAlpha = 0.25;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.globalAlpha = 1.0;

            this.drawConnections();

            this.particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.angle += 0.8 * p.direction;

                const dx = p.x - this.mouse.x;
                const dy = p.y - this.mouse.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                let opacityMult = 1.0;
                
                if (dist < 180) {
                    p.x += (dx / dist) * 2;
                    p.y += (dy / dist) * 2;
                    opacityMult = 1.8;
                }

                if (p.x < -50) p.x = this.canvas.width + 50;
                if (p.x > this.canvas.width + 50) p.x = -50;
                if (p.y < -50) p.y = this.canvas.height + 50;
                if (p.y > this.canvas.height + 50) p.y = -50;

                this.drawPhoton(p, Math.min(opacityMult, 2.5));
            });

            this.drawKetTokens();

            this.frame++;
            requestAnimationFrame(loop);
        };
        loop();
    }
}
