/**
 * polarization_animator.js - Waveform Collapse Animation
 */

export class PolarizationAnimator {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        this.width = 300;
        this.height = 120;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.frame = 0;
        this.phase = 'superposition'; // superposition, collapse
        this.collapseResult = 0; // 0 or 90

        this.colors = {
            primary: '#964900',  // Ambassador Amber
            secondary: '#c46200', // Light Amber
            muted: '#d0c4b8',    // UI Grey
            text: '#1a1a1a'      // Charcoal
        };

        this.start();
    }

    drawWave(xStart, width, angle, opacity = 1.0) {
        const centerY = this.height / 2;
        const amplitude = 15;
        const frequency = 0.15;
        const rad = angle * Math.PI / 180;

        this.ctx.beginPath();
        for (let x = 0; x <= width; x++) {
            const offset = Math.sin(x * frequency - this.frame * 0.1) * amplitude;

            // Project the 1D oscillation into the 2D plane based on polarization angle
            const screenX = xStart + x;
            const screenY = centerY + offset * Math.sin(rad);
            // Note: Simplification for visual clarity, purely shows oscillation direction

            if (x === 0) this.ctx.moveTo(screenX, screenY);
            else this.ctx.lineTo(screenX, screenY);
        }

        this.ctx.strokeStyle = this.colors.primary;
        this.ctx.globalAlpha = opacity;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
    }

    drawFilter(x) {
        const centerY = this.height / 2;
        const size = 30;

        // Draw the "+" filter
        this.ctx.beginPath();
        this.ctx.moveTo(x, centerY - size);
        this.ctx.lineTo(x, centerY + size);
        this.ctx.moveTo(x - 5, centerY);
        this.ctx.lineTo(x + 5, centerY);
        this.ctx.strokeStyle = this.colors.muted;
        this.ctx.setLineDash([2, 1]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Label
        this.ctx.font = '800 10px Outfit';
        this.ctx.fillStyle = this.colors.muted;
        this.ctx.fillText('+ BASIS', x, centerY - size - 5);
    }

    drawLabels() {
        this.ctx.font = '700 9px Outfit';
        this.ctx.fillStyle = this.colors.text;
        this.ctx.textAlign = 'center';

        if (this.phase === 'superposition') {
            this.ctx.fillText('DIAGONAL (+45°)', 60, 20);
        } else {
            this.ctx.fillText(this.collapseResult === 0 ? 'HORIZONTAL (0°)' : 'VERTICAL (90°)', 240, 20);
            this.ctx.fillStyle = this.colors.secondary;
            this.ctx.fillText('COLLAPSED!', 150, 100);
        }
    }

    start() {
        const loop = () => {
            this.ctx.clearRect(0, 0, this.width, this.height);
            this.frame++;

            const filterX = this.width / 2;

            // Supervision Wave (Left)
            this.drawWave(10, filterX - 20, 45);

            // Filter in the middle
            this.drawFilter(filterX);

            // Collapse Decision every ~3 seconds
            if (this.frame % 180 === 0) {
                this.phase = 'collapse';
                this.collapseResult = Math.random() < 0.5 ? 0 : 90;
            } else if (this.frame % 180 === 120) {
                this.phase = 'superposition';
            }

            // Right side
            if (this.phase === 'collapse') {
                this.drawWave(filterX + 10, this.width - filterX - 20, this.collapseResult);
            } else {
                // Fade out placeholder
                this.ctx.globalAlpha = 0.2;
                this.drawWave(filterX + 10, this.width - filterX - 20, 45, 0.2);
                this.ctx.globalAlpha = 1.0;
            }

            this.drawLabels();
            requestAnimationFrame(loop);
        };
        loop();
    }
}
