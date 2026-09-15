/* ==========================================================================
   Lab 5 — Finite-Key Analysis
   How statistical uncertainty and the eps-composition overhead eat a key
   when the block is 10^3 pulses instead of infinity.
   ========================================================================== */
import {
    $, onSlider, onButtons, setActive, plot, statTable, table, note,
    fpct, fgroup, fsci, h2
} from './stage8_lab_utils.js';
import {
    transmittance, gain, qberOf, rateDecoy, rateFinite, minPulsesFor
} from './stage8_qkd_model.js';

const state = {
    N: 1e4, eps: 1e-9, km: 50, mu: 0.5, nu: 0.1, eta: 0.65, dark: 1e-5, ed: 0.015, f: 1.16
};

const GRID = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9];

/* ----------------------------------------------------------------- render */
function render() {
    const etaT = transmittance(state, state.km);
    const inf = rateDecoy(state, etaT);
    const fin = rateFinite(state, etaT, state.N, state.eps);

    /* --- rate vs block length --- */
    const pts = [];
    for (let e = 2; e <= 10; e += 0.05) {
        const N = Math.pow(10, e);
        pts.push([Math.log10(N), rateFinite(state, etaT, N, state.eps).R]);
    }
    const ptsInf = [];
    for (let e = 2; e <= 10; e += 0.5) ptsInf.push([e, inf.R]);

    const plotHost = $('fk-plot');
    if (plotHost) {
        plotHost.innerHTML = plot({
            w: 620, h: 280,
            xMin: 2, xMax: 10, yMin: 0, yMax: Math.max(inf.R * 1.25, 1e-4),
            xTicks: [2, 3, 4, 5, 6, 7, 8, 9, 10],
            series: [
                { points: ptsInf, color: 'var(--text-muted)', width: 1.4, dash: '6 4' },
                { points: pts, color: 'var(--safe-green)', width: 2.6, fill: true, fillOpacity: 0.10 }
            ],
            markers: fin.R > 0
                ? [{ x: Math.log10(state.N), y: fin.R, color: 'var(--accent-neon-blue)', label: fsci(fin.R, 2) }]
                : [],
            fmtX: (v) => '10^' + v,
            fmtY: (v) => fsci(v, 1),
            xLabel: 'pulses sent  N',
            yLabel: 'secure key rate (bits / pulse)'
        });
    }

    const legendHost = $('fk-legend');
    if (legendHost) {
        legendHost.innerHTML =
            `<span class="ob-legend-item"><i class="ob-sw" style="background:var(--safe-green);border-color:var(--safe-green)"></i>finite-key rate R(N)</span>` +
            `<span class="ob-legend-item"><i class="ob-sw" style="background:var(--text-muted);border-color:var(--text-muted)"></i>asymptotic limit R(\u221E)</span>` +
            `<span class="ob-legend-item"><i class="ob-sw" style="background:transparent"></i>\u03B5 = ${fsci(state.eps, 0)}</span>`;
    }

    /* --- uncertainty panel --- */
    const statsHost = $('fk-stats');
    if (statsHost) {
        const penalty = inf.R > 0 ? (1 - fin.R / inf.R) : 0;
        statsHost.innerHTML = statTable([
            ['Pulses sent  N', fgroup(state.N)],
            ['Detections  N\u00B7Q\u03BC', fgroup(state.N * gain(state, state.mu, etaT))],
            ['Sifted bits  m', fgroup(fin.m), 'good'],
            ['\u03B5 (secrecy / correctness)', fsci(state.eps, 0)],
            ['Gain uncertainty  \u03B4Q', fsci(fin.dQ, 2)],
            ['QBER uncertainty  \u03B4E', fsci(fin.dE, 2) + '  (' + fpct(fin.dE, 3) + ')'],
            ['Decoy QBER uncertainty  \u03B4E\u03BD', fsci(fin.dEnu, 2)],
            ['Worst-case QBER used', fpct(fin.Emu, 3)],
            ['\u03B5-overhead', fsci(fin.overhead, 2) + ' bit/pulse'],
            ['Asymptotic rate  R(\u221E)', fsci(inf.R, 3), 'good'],
            ['Finite rate  R(N)', fsci(fin.R, 3), fin.R > 0 ? 'good' : 'bad'],
            ['Penalty vs asymptotic', fpct(Math.max(0, penalty), 1), penalty > 0.5 ? 'bad' : 'good']
        ]);
    }

    /* --- sweep table --- */
    const minN = minPulsesFor(state, etaT, state.eps);
    const rows = GRID.map((N) => {
        const r = rateFinite(state, etaT, N, state.eps);
        const pen = inf.R > 0 ? (1 - r.R / inf.R) : 0;
        return [
            '10^' + Math.round(Math.log10(N)),
            fgroup(r.m),
            fsci(r.dE, 1),
            fsci(r.Rinf, 3),
            fsci(r.R, 3),
            fpct(Math.max(0, pen), 1),
            { v: r.R > 0 ? 'SECURE' : 'no key', tone: r.R > 0 ? 'good' : 'bad' }
        ];
    });

    const tableHost = $('fk-table');
    if (tableHost) {
        tableHost.innerHTML = table(
            ['N', 'sifted bits m', '\u03B4E (QBER)', 'R(\u221E)', 'R(N)', 'penalty', 'status'],
            rows,
            { align: ['left', 'right', 'right', 'right', 'right', 'right', 'center'] }
        ) + note(
            `<b>Minimum block length.</b> At this distance and with \u03B5 = ${fsci(state.eps, 0)} you need
             <b>${minN === null ? 'more than 10\u00B9\u00B2' : fsci(minN, 2) + ' (' + fgroup(minN) + ')'}</b> pulses
             before a positive key can be distilled at all. Below that the statistical uncertainty alone
             (\u03B4E = \u221A(ln(1/\u03B5)/2m)) is larger than the margin the protocol has.
             <br><br>
             <b>Why it matters.</b> A QKD link running at 100 MHz over a 5-minute satellite pass sends ~3\u00D710\u00B9\u00B0
             pulses — comfortably finite-key safe. A proof-of-principle demo with 10\u2074 pulses is not, no matter how
             low its QBER looks.`, minN && state.N < minN ? 'warn' : 'info');
    }
}

/* ------------------------------------------------------------------- init */
export function initFiniteLab() {
    if (!$('fk-plot')) return;

    onSlider('fk-eps', 'v-fk-eps', (v) => fsci(Math.pow(10, v), 0), (v) => { state.eps = Math.pow(10, v); render(); });
    onSlider('fk-km', 'v-fk-km', (v) => v.toFixed(0) + ' km', (v) => { state.km = v; render(); });
    onSlider('fk-mu', 'v-fk-mu', (v) => v.toFixed(2), (v) => { state.mu = v; render(); });
    onSlider('fk-nu', 'v-fk-nu', (v) => v.toFixed(2), (v) => { state.nu = v; render(); });
    onSlider('fk-eta', 'v-fk-eta', (v) => (v * 100).toFixed(0) + ' %', (v) => { state.eta = v; render(); });
    onSlider('fk-dark', 'v-fk-dark', (v) => fsci(Math.pow(10, v), 1), (v) => { state.dark = Math.pow(10, v); render(); });
    onSlider('fk-ed', 'v-fk-ed', (v) => (v * 100).toFixed(1) + ' %', (v) => { state.ed = v; render(); });

    onButtons('fk-n-btns', (d, btn) => {
        setActive('fk-n-btns', btn);
        state.N = parseFloat(d.n);
        render();
    });

    render();
}
