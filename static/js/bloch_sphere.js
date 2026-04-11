/**
 * bloch_sphere.js - 3D Projected Bloch Sphere Animator
 */

export class BlochSphere {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if(!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        this.width = 150;
        this.height = 150;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        this.rotation = { x: 0.4, y: 0.5 }; // isometric-ish angles
        this.state = { theta: Math.PI / 4, phi: 0 }; // Initial qubit state
        this.frame = 0;
        
        this.colors = {
            primary: '#964900',  // Ambassador Amber
            secondary: '#c46200', // Light Amber
            muted: '#d0c4b8',    // UI Grey
            text: '#1a1a1a'      // Charcoal
        };

        this.start();
    }

    project(x, y, z) {
        // Simple rotation around Y and X axis
        const cosY = Math.cos(this.rotation.y);
        const sinY = Math.sin(this.rotation.y);
        const cosX = Math.cos(this.rotation.x);
        const sinX = Math.sin(this.rotation.x);

        // Rotation around Y
        let x1 = x * cosY - z * sinY;
        let z1 = x * sinY + z * cosY;

        // Rotation around X
        let y1 = y * cosX - z1 * sinX;
        let z2 = y * sinX + z1 * cosX;

        return {
            x: this.width/2 + x1 * (this.width*0.4),
            y: this.height/2 - y1 * (this.height*0.4),
            depth: z2
        };
    }

    drawCircle(radius, segments = 50, color = this.colors.muted, isEquator = false) {
        this.ctx.beginPath();
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            let x = radius * Math.cos(angle);
            let y = isEquator ? 0 : radius * Math.sin(angle);
            let z = isEquator ? radius * Math.sin(angle) : 0;
            
            const p = this.project(x, y, z);
            if (i === 0) this.ctx.moveTo(p.x, p.y);
            else this.ctx.lineTo(p.x, p.y);
        }
        this.ctx.strokeStyle = color;
        this.ctx.setLineDash(isEquator ? [2, 2] : []);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    drawAxes() {
        const labels = [
            { x: 0, y: 1.2, z: 0, text: '|0⟩' },
            { x: 0, y: -1.2, z: 0, text: '|1⟩' },
            { x: 1.2, y: 0, z: 0, text: '|+⟩' },
            { x: -1.2, y: 0, z: 0, text: '|-⟩' }
        ];

        // Z-axis (up/down)
        this.ctx.beginPath();
        let p1 = this.project(0, -1, 0);
        let p2 = this.project(0, 1, 0);
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.strokeStyle = this.colors.muted;
        this.ctx.stroke();

        this.ctx.font = '700 10px Outfit';
        this.ctx.fillStyle = this.colors.text;
        this.ctx.textAlign = 'center';
        
        labels.forEach(l => {
            const p = this.project(l.x, l.y, l.z);
            this.ctx.fillText(l.text, p.x, p.y + 4);
        });
    }

    drawStateVector() {
        // Precess phi over time
        this.state.phi += 0.02;
        
        const x = Math.sin(this.state.theta) * Math.cos(this.state.phi);
        const y = Math.cos(this.state.theta); // Using cos for vertical Z-up in Bloch notation
        const z = Math.sin(this.state.theta) * Math.sin(this.state.phi);

        const pOrigin = this.project(0, 0, 0);
        const pEnd = this.project(x, y, z);

        // Vector line
        this.ctx.beginPath();
        this.ctx.moveTo(pOrigin.x, pOrigin.y);
        this.ctx.lineTo(pEnd.x, pEnd.y);
        this.ctx.strokeStyle = this.colors.primary;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Tip
        this.ctx.beginPath();
        this.ctx.arc(pEnd.x, pEnd.y, 4, 0, Math.PI*2);
        this.ctx.fillStyle = this.colors.primary;
        this.ctx.fill();
        this.ctx.lineWidth = 1;
    }

    start() {
        const loop = () => {
            this.ctx.clearRect(0, 0, this.width, this.height);
            
            // Slow rotation for 3D effect
            this.rotation.y += 0.005;
            
            // Background circles
            this.drawCircle(1, 60, this.colors.muted);
            this.drawCircle(1, 60, this.colors.muted, true);
            
            this.drawAxes();
            this.drawStateVector();
            
            requestAnimationFrame(loop);
        };
        loop();
    }
}
