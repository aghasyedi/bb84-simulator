/* ==========================================================================
   Lab 1 — Polarisation Laboratory
   Field visualiser + Malus' law + single-photon measurement statistics.
   ========================================================================== */
import { $, onSlider, onButtons, setActive, plot, probBar, statTable, clamp, fpct, fgroup, D2R } from './stage8_lab_utils.js';

const state = { theta: 0, phi: 0, n: 1000, anim: true, fire: null, t: 0 };

let ctx = null;
let canvas = null;
let dpr = 1;
let themeKey = '';
let colours = {};

function readColours() {
    const key = document.body.getAttribute('data-theme') || 'day';
    if (key === themeKey) return;
    themeKey = key;
    const cs = getComputedStyle(document.body);
    const g = (n, f) => (cs.getPropertyValue(n) || f).trim() || f;
    colours = {
        text: g('--text-main', '#1a1a1a'),
        muted: g('--text-muted', '#555'),
        accent: g('--accent-neon-blue', '#964900'),
        cyan: g('--accent-neon-cyan', '#c46200'),
        violet: g('--accent-neon-violet', '#7a3a00'),
        green: g('--safe-green', '#2e7d32'),
        red: g('--danger-red', '#c0392b'),
        border: g('--border-color', '#d0c4b8'),
        panel: g('--bg-panel', '#fff')
    };
}

let lastW = 0;

function sizeCanvas() {
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width || 0);
    const h = 280;
    // the panel can be hidden (width 0) — keep the previous buffer in that case
    if (w < 40) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
    lastW = w;
    return true;
}

/* ------------------------------------------------------------- rendering */
function draw() {
    if (!ctx || !canvas) return;
    readColours();
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const th = state.theta * D2R;
    const ph = state.phi * D2R;
    const A = 44;
    const cy = 128;
    const x0 = 30;
    const xP = 250;          // polariser position
    const xEnd = 430;
    const lam = 110;
    const k = (2 * Math.PI) / lam;
    const ampOut = Math.abs(Math.cos(th - ph));

    /* ---- side view: propagation ---- */
    ctx.strokeStyle = colours.border;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x0, cy);
    ctx.lineTo(xEnd, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // incident wave
    drawWave(x0, xP, cy, A, k, state.t, colours.accent, 1);
    // transmitted wave
    drawWave(xP + 10, xEnd, cy, A * ampOut, k, state.t, colours.cyan, 1);

    // polariser plate
    ctx.save();
    ctx.translate(xP, cy);
    const pg = ctx.createLinearGradient(-7, -60, 7, 60);
    pg.addColorStop(0, colours.violet);
    pg.addColorStop(1, colours.accent);
    ctx.fillStyle = pg;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-4, -58, 8, 116);
    ctx.globalAlpha = 1;
    // grating lines at the transmission angle, drawn in projection
    ctx.strokeStyle = colours.panel;
    ctx.lineWidth = 1.4;
    const proj = Math.cos(ph);       // projected spacing of the slits
    for (let y = -52; y <= 52; y += 8) {
        ctx.beginPath();
        ctx.moveTo(-4, y);
        ctx.lineTo(4, y + 6 * (1 - Math.abs(proj)) * Math.sign(Math.sin(ph) || 1));
        ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = colours.muted;
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('POLARISER', xP, cy + 78);
    ctx.fillText('E\u2080', x0 + 60, cy - A - 14);
    ctx.fillStyle = colours.cyan;
    ctx.fillText('E\u2080\u00B7cos(\u03B8\u2212\u03C6)', (xP + xEnd) / 2 + 10, cy - A * ampOut - 14);

    ctx.fillStyle = colours.text;
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText('SIDE VIEW \u2014 along the beam', (x0 + xEnd) / 2, 20);

    /* ---- end-on view ---- */
    const ox = 560;
    const oy = 128;
    const R = 74;
    ctx.save();
    ctx.translate(ox, oy);

    ctx.strokeStyle = colours.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();

    // axes guides
    ctx.strokeStyle = colours.border;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(-R, 0); ctx.lineTo(R, 0);
    ctx.moveTo(0, -R); ctx.lineTo(0, R);
    ctx.stroke();
    ctx.setLineDash([]);

    // analyser transmission axis
    ctx.strokeStyle = colours.cyan;
    ctx.lineWidth = 2.5;
    const ax = Math.sin(ph) * R * 0.92, ay = -Math.cos(ph) * R * 0.92;
    ctx.beginPath();
    ctx.moveTo(-ax, -ay); ctx.lineTo(ax, ay);
    ctx.stroke();

    const osc = Math.cos(state.t * 2);

    // incident E vector (at angle theta, measured from H = horizontal)
    const ix = Math.cos(th) * R * 0.78 * osc;
    const iy = -Math.sin(th) * R * 0.78 * osc;
    arrow(0, 0, ix, iy, colours.accent, 2.6);

    // projection onto the analyser axis
    const projLen = Math.cos(th - ph) * R * 0.78 * osc;
    const px = Math.sin(ph) * projLen;
    const py = -Math.cos(ph) * projLen;
    arrow(0, 0, px, py, colours.green, 3.4);

    // rejected component
    const rejLen = Math.sin(th - ph) * R * 0.78 * osc;
    const rx = -Math.sin(ph + Math.PI / 2) * rejLen;
    const ry = Math.cos(ph + Math.PI / 2) * rejLen;
    if (Math.abs(rejLen) > 1.5) {
        ctx.globalAlpha = 0.4;
        arrow(0, 0, rx, ry, colours.red, 2);
        ctx.globalAlpha = 1;
    }

    ctx.restore();

    // angle arc
    ctx.strokeStyle = colours.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ox, oy, 26, -Math.PI / 2, -Math.PI / 2 + th, th < 0);
    ctx.stroke();

    ctx.fillStyle = colours.text;
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('END-ON VIEW \u2014 polarisation plane', ox, 20);
    ctx.fillStyle = colours.accent;
    ctx.fillText('\u03B8 = ' + state.theta + '\u00B0', ox, h - 26);
    ctx.fillStyle = colours.cyan;
    ctx.fillText('\u03C6 = ' + state.phi + '\u00B0', ox, h - 12);
    ctx.fillStyle = colours.muted;
    ctx.font = '600 9px "JetBrains Mono", monospace';
    ctx.fillText('green = transmitted \u00B7 red = rejected', ox, h - 40);
}

function arrow(x, y, dx, dy, colour, lw) {
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
    const ang = Math.atan2(dy, dx);
    const hs = 5 + lw;
    ctx.beginPath();
    ctx.moveTo(x + dx, y + dy);
    ctx.lineTo(x + dx - hs * Math.cos(ang - 0.4), y + dy - hs * Math.sin(ang - 0.4));
    ctx.lineTo(x + dx - hs * Math.cos(ang + 0.4), y + dy - hs * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fill();
}

function drawWave(xa, xb, cy, A, k, t, colour, lw) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = lw || 1.6;
    ctx.beginPath();
    for (let x = xa; x <= xb; x += 2) {
        const y = cy - A * Math.cos(k * x - t);
        if (x === xa) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // field arrows
    ctx.lineWidth = 1.2;
    for (let x = xa + 6; x <= xb; x += 26) {
        const u = Math.cos(k * x - t);
        const y = cy - A * u;
        ctx.beginPath();
        ctx.moveTo(x, cy);
        ctx.lineTo(x, y);
        ctx.stroke();
        if (Math.abs(u) > 0.18) {
            ctx.beginPath();
            ctx.arc(x, y, 2.2, 0, Math.PI * 2);
            ctx.fillStyle = colour;
            ctx.fill();
        }
    }
}

/* -------------------------------------------------------------- readouts */
function pTransmit() {
    return Math.cos((state.theta - state.phi) * D2R) ** 2;
}

function renderReadouts() {
    const p = pTransmit();
    const amp = Math.abs(Math.cos((state.theta - state.phi) * D2R));
    const host = $('pol-readouts');
    if (host) {
        host.innerHTML = statTable([
            ['Amplitude ratio  E/E\u2080', amp.toFixed(4)],
            ['Intensity ratio  I/I\u2080', p.toFixed(4)],
            ['Angle difference  \u03B8\u2212\u03C6', (((state.theta - state.phi) % 360 + 360) % 360).toFixed(0) + '\u00B0'],
            ['Extinction at \u0394 = 90\u00B0', 'I \u2192 0']
        ]);
    }

    const probs = $('pol-probs');
    if (probs) {
        const th = state.theta * D2R;
        const pH = Math.cos(th) ** 2;
        const pPlus = Math.cos(th - Math.PI / 4) ** 2;
        probs.innerHTML =
            `<div class="ob-prob-title">Measurement probabilities for this state</div>` +
            probBar('Z basis \u2192 H  (bit 0)', pH, 'var(--ob-pbs)') +
            probBar('Z basis \u2192 V  (bit 1)', 1 - pH, 'var(--ob-mod)') +
            probBar('X basis \u2192 +45\u00B0 (bit 0)', pPlus, 'var(--ob-optic)') +
            probBar('X basis \u2192 \u221245\u00B0 (bit 1)', 1 - pPlus, 'var(--ob-cryo)') +
            `<div class="ob-prob-title" style="margin-top:0.9rem;">Through the analyser at \u03C6 = ${state.phi}\u00B0</div>` +
            probBar('transmitted', p, 'var(--safe-green)') +
            probBar('absorbed', 1 - p, 'var(--danger-red)');
    }

    renderMalus();
}

function renderMalus() {
    const host = $('pol-malus');
    if (!host) return;
    const pts = [];
    for (let f = 0; f <= 180; f += 1) {
        pts.push([f, Math.cos((state.theta - f) * D2R) ** 2]);
    }
    const p = pTransmit();
    host.innerHTML = plot({
        w: 560, h: 240,
        xMin: 0, xMax: 180, yMin: 0, yMax: 1.05,
        xTicks: [0, 45, 90, 135, 180],
        yTicks: [0, 0.25, 0.5, 0.75, 1],
        series: [{ points: pts, color: 'var(--accent-neon-cyan)', width: 2.2 }],
        markers: [{ x: state.phi, y: p, color: 'var(--accent-neon-blue)' }],
        bands: [
            { from: 0, to: 180, color: 'transparent' }
        ],
        fmtX: (v) => v + '\u00B0',
        fmtY: (v) => v.toFixed(2),
        xLabel: 'analyser angle \u03C6',
        yLabel: 'transmission probability'
    });
}

function renderFire() {
    const host = $('pol-readouts');
    if (!host || !state.fire) return;
    const { n, hits } = state.fire;
    const p = pTransmit();
    const measured = hits / n;
    const sigma = Math.sqrt(Math.max(p * (1 - p), 1e-12) / n);
    const dev = (measured - p) / sigma;
    host.innerHTML = statTable([
        ['Photons fired', fgroup(n), 'plain'],
        ['Detected (transmitted)', fgroup(hits), 'good'],
        ['Blocked', fgroup(n - hits), 'bad'],
        ['Measured probability', measured.toFixed(4), 'plain'],
        ['Malus prediction', p.toFixed(4), 'plain'],
        ['Deviation', (dev >= 0 ? '+' : '') + dev.toFixed(2) + ' \u03C3', Math.abs(dev) < 3 ? 'good' : 'bad']
    ]) + `<div class="ob-note">A single photon does not \u201Csplit\u201D. Each one either passes whole or is absorbed
       whole; Malus' law only sets the <em>probability</em>. The scatter above is shot noise: \u03C3 = \u221A(p(1\u2212p)/N).</div>`;
}

/* ------------------------------------------------------------------- init */
export function initPolarisationLab() {
    canvas = $('pol-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);

    onSlider('pol-theta', 'v-pol-theta', (v) => v + '\u00B0', (v) => {
        state.theta = v; state.fire = null; renderReadouts();
    });
    onSlider('pol-phi', 'v-pol-phi', (v) => v + '\u00B0', (v) => {
        state.phi = v; state.fire = null; renderReadouts();
    });
    onSlider('pol-n', 'v-pol-n', (v) => fgroup(v), (v) => { state.n = v; });

    onButtons('pol-state-btns', (d, btn) => {
        setActive('pol-state-btns', btn);
        const s = $('pol-theta');
        s.value = d.theta;
        s.dispatchEvent(new Event('input'));
    });
    onButtons('pol-phi-btns', (d, btn) => {
        setActive('pol-phi-btns', btn);
        const s = $('pol-phi');
        s.value = d.phi;
        s.dispatchEvent(new Event('input'));
    });

    const animBox = $('pol-anim');
    if (animBox) animBox.addEventListener('change', () => { state.anim = animBox.checked; });

    const fireBtn = $('pol-fire');
    if (fireBtn) {
        fireBtn.addEventListener('click', () => {
            const n = state.n;
            const p = pTransmit();
            let hits = 0;
            for (let i = 0; i < n; i++) if (Math.random() < p) hits++;
            state.fire = { n, hits };
            renderFire();
        });
    }

    renderReadouts();

    let last = performance.now();
    const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const visible = canvas.offsetParent !== null;
        if (visible) {
            // re-measure if the column was resized while this tab was hidden
            const cw = Math.round(canvas.getBoundingClientRect().width || 0);
            if (cw >= 40 && Math.abs(cw - lastW) > 1) sizeCanvas();
            if (state.anim) state.t += dt * 3.2;
            draw();
        }
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
}
