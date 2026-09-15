/* ==========================================================================
   Lab 3 — Detector Laboratory
   Monte-Carlo of a passive 4-detector BB84 receiver with efficiency, dark
   counts, dead time and the resulting QBER-vs-loss floor.
   ========================================================================== */
import {
    $, onSlider, bars, plot, statTable, note,
    poissonSample, fpct, fgroup, fsci, clamp
} from './stage8_lab_utils.js';

const state = {
    eta: 0.65, dark: 1e-5, dead: 50, clock: 100, mu: 0.5, loss: 10, ed: 0.015, n: 100000,
    sim: null
};

function simulate() {
    const { eta, dark, dead, clock, mu, loss, ed, n } = state;
    const etaTot = eta * Math.pow(10, -loss / 10);
    const periodNs = 1000 / clock;                     // ns between pulses
    const deadPulses = Math.round(dead / periodNs);
    const deadUntil = [-1, -1, -1, -1];

    const counts = [0, 0, 0, 0];
    let signalClicks = 0, darkClicks = 0, blockedByDead = 0, doubleClicks = 0, totalClicks = 0;
    let sifted = 0, errors = 0, deadEvents = 0;

    for (let i = 0; i < n; i++) {
        const aBit = Math.random() < 0.5 ? 0 : 1;
        const aBasis = Math.random() < 0.5 ? 0 : 1;      // 0 = Z, 1 = X
        const k = poissonSample(mu);
        const pDetect = k > 0 ? 1 - Math.pow(1 - etaTot, k) : 0;

        let sigDet = -1;
        if (Math.random() < pDetect) {
            let bit;
            if (aBasis === 1) {
                // X basis: Bob's HWP maps +45 -> H(port0), -45 -> V(port1)
                bit = aBit;
            } else {
                bit = aBit;
            }
            const bBasis = Math.random() < 0.5 ? 0 : 1;
            if (aBasis === bBasis) {
                if (Math.random() < ed) bit ^= 1;
            } else {
                bit = Math.random() < 0.5 ? 0 : 1;
            }
            sigDet = bBasis * 2 + bit;
            if (i <= deadUntil[sigDet]) { blockedByDead++; sigDet = -1; }
        }

        const fired = [];
        if (sigDet >= 0) fired.push({ d: sigDet, type: 'sig' });
        for (let d = 0; d < 4; d++) {
            if (d === sigDet) continue;
            if (i <= deadUntil[d]) continue;
            if (Math.random() < dark) fired.push({ d, type: 'dark' });
        }

        if (!fired.length) continue;
        totalClicks++;
        deadEvents += fired.length;
        if (fired.length > 1) doubleClicks++;

        const pick = fired.length === 1 ? fired[0] : fired[Math.floor(Math.random() * fired.length)];
        counts[pick.d]++;
        if (pick.type === 'sig') signalClicks++; else darkClicks++;
        fired.forEach((f) => { deadUntil[f.d] = i + deadPulses; });

        // sifting + QBER on single clicks (standard practice)
        if (fired.length === 1) {
            const bBasis = pick.d < 2 ? 0 : 1;
            if (bBasis === aBasis) {
                sifted++;
                const bBit = pick.d % 2;
                if (bBit !== aBit) errors++;
            }
        }
    }

    const maxRate = dead > 0 ? (1 / (dead * 1e-9)) : Infinity;
    state.sim = {
        n, counts, signalClicks, darkClicks, blockedByDead, doubleClicks, totalClicks,
        sifted, errors,
        qber: sifted > 0 ? errors / sifted : 0,
        darkFraction: totalClicks > 0 ? darkClicks / totalClicks : 0,
        maxRate, deadPulses, etaTot, periodNs
    };
    return state.sim;
}

function qberAnalytic(lossDb) {
    const { eta, dark, mu, ed } = state;
    const etaTot = eta * Math.pow(10, -lossDb / 10);
    const pSig = 1 - Math.exp(-mu * etaTot);
    const pDark = 4 * dark;                              // four detectors
    const denom = pSig + pDark;
    if (denom <= 0) return 0;
    return (ed * pSig + 0.5 * pDark) / denom;
}

function gainAnalytic(lossDb) {
    const { eta, dark, mu } = state;
    const etaTot = eta * Math.pow(10, -lossDb / 10);
    return (1 - Math.exp(-mu * etaTot)) + 4 * dark;
}

/* ---------------------------------------------------------------- render */
function render() {
    const s = simulate();

    const chartHost = $('det-chart');
    if (chartHost) {
        const labels = ['D0  (H)', 'D1  (V)', 'D+  (+45\u00B0)', 'D\u2212  (\u221245\u00B0)'];
        chartHost.innerHTML = bars({
            w: 600, h: 230,
            labels,
            series: [{ name: 'clicks', color: 'var(--accent-neon-blue)', values: s.counts }],
            yMax: Math.max(1, ...s.counts) * 1.15,
            showValues: true,
            fmtV: (v) => fgroup(v),
            xLabel: 'detector',
            yLabel: 'clicks'
        });
    }

    const tableHost = $('det-table');
    if (tableHost) {
        tableHost.innerHTML = statTable([
            ['Pulses simulated', fgroup(s.n)],
            ['Overall system efficiency \u03B7\u209C\u2080\u209C', fsci(s.etaTot, 3)],
            ['Total clicks', fgroup(s.totalClicks), 'good'],
            ['\u2192 from signal photons', fgroup(s.signalClicks) + '  (' + fpct(s.signalClicks / Math.max(1, s.totalClicks), 1) + ')'],
            ['\u2192 from dark counts', fgroup(s.darkClicks) + '  (' + fpct(s.darkFraction, 1) + ')', s.darkFraction > 0.1 ? 'bad' : 'good'],
            ['Signals lost to dead time', fgroup(s.blockedByDead), s.blockedByDead > 0 ? 'bad' : 'good'],
            ['Double clicks', fgroup(s.doubleClicks)],
            ['Dead time in pulses', s.deadPulses + ' pulse' + (s.deadPulses === 1 ? '' : 's')],
            ['Saturation count rate', s.maxRate === Infinity ? '\u2014' : fsci(s.maxRate, 3) + ' Hz'],
            ['Sifted bits', fgroup(s.sifted), 'good'],
            ['Measured QBER', fpct(s.qber, 2), s.qber > 0.11 ? 'bad' : 'good']
        ]);
    }

    const qHost = $('det-qber');
    if (qHost) {
        const pts = [], gain = [];
        for (let l = 0; l <= 50; l += 0.5) {
            pts.push([l, qberAnalytic(l)]);
            gain.push([l, gainAnalytic(l)]);
        }
        const cur = qberAnalytic(state.loss);
        qHost.innerHTML = plot({
            w: 600, h: 250,
            xMin: 0, xMax: 50, yMin: 0, yMax: 0.55,
            xTicks: [0, 10, 20, 30, 40, 50],
            yTicks: [0, 0.11, 0.2, 0.3, 0.4, 0.5],
            series: [
                { points: pts, color: 'var(--danger-red)', width: 2.4 },
                { points: [[0, 0.11], [50, 0.11]], color: 'var(--safe-green)', width: 1.4, dash: '5 4' }
            ],
            markers: [{ x: state.loss, y: cur, color: 'var(--accent-neon-blue)' }],
            bands: [{ from: 0, to: 50, color: 'transparent' }],
            fmtX: (v) => v + ' dB',
            fmtY: (v) => v.toFixed(2),
            xLabel: 'channel loss (dB)',
            yLabel: 'QBER'
        });
    }

    const noteHost = $('det-note');
    if (noteHost) {
        // find where the analytic QBER crosses 11 %
        let cross = null;
        for (let l = 0; l <= 80; l += 0.5) {
            if (qberAnalytic(l) > 0.11) { cross = l; break; }
        }
        noteHost.innerHTML = note(
            `<b>The dark-count floor.</b> Signal clicks fall as 10<sup>\u2212L/10</sup> but dark counts do not.
             Once the signal drops near the dark-count rate, roughly half of all clicks are pure noise and half of
             <em>those</em> land in the wrong detector — so the QBER saturates at 50 %.
             At your current settings the link crosses the 11 % abort threshold at about
             <b>${cross === null ? '> 80 dB' : cross.toFixed(1) + ' dB'}</b>
             (${cross === null ? '\u2014' : (cross / 0.2).toFixed(0) + ' km of fibre at 0.2 dB/km'}).
             Current operating point: <b>${fpct(qberAnalytic(state.loss), 2)}</b> QBER at ${state.loss.toFixed(1)} dB.`,
            qberAnalytic(state.loss) > 0.11 ? 'warn' : 'info'
        );
    }
}

/* ------------------------------------------------------------------ init */
export function initDetectorLab() {
    if (!$('det-chart')) return;

    onSlider('det-eta', 'v-det-eta', (v) => (v * 100).toFixed(0) + ' %', (v) => { state.eta = v; render(); });
    onSlider('det-dark', 'v-det-dark', (v) => fsci(Math.pow(10, v), 1), (v) => { state.dark = Math.pow(10, v); render(); });
    onSlider('det-dead', 'v-det-dead', (v) => v.toFixed(0) + ' ns', (v) => { state.dead = v; render(); });
    onSlider('det-clock', 'v-det-clock', (v) => v.toFixed(0) + ' MHz', (v) => { state.clock = v; render(); });
    onSlider('det-mu', 'v-det-mu', (v) => v.toFixed(2), (v) => { state.mu = v; render(); });
    onSlider('det-loss', 'v-det-loss', (v) => v.toFixed(1) + ' dB', (v) => { state.loss = v; render(); });
    onSlider('det-ed', 'v-det-ed', (v) => (v * 100).toFixed(1) + ' %', (v) => { state.ed = v; render(); });
    onSlider('det-n', 'v-det-n', (v) => fgroup(v), (v) => { state.n = v; render(); });

    const run = $('det-run');
    if (run) run.addEventListener('click', render);

    render();
}
