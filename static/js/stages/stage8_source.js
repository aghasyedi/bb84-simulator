/* ==========================================================================
   Lab 2 — Photon Source Laboratory
   Ideal / weak-coherent / decoy / thermal photon-number statistics, and why
   practical BB84 attenuates below one photon per pulse.
   ========================================================================== */
import {
    $, onSlider, onButtons, setActive, bars, statTable, table, note,
    pois, thermal, poissonSample, thermalSample, fpct, fgroup, clamp
} from './stage8_lab_utils.js';

const NMAX = 7;                       // highest photon number plotted
const state = { src: 'ideal', mu: 0.5, nu: 0.1, n: 50000, sim: null };
const FRAC = { signal: 0.7, decoy: 0.2, vacuum: 0.1 };

function theory(src, mu, n) {
    switch (src) {
        case 'ideal': return n === 1 ? 1 : 0;
        case 'thermal': return thermal(n, mu);
        case 'decoy':
        case 'wcp':
        default: return pois(n, mu);
    }
}

function sampleOne() {
    switch (state.src) {
        case 'ideal': return 1;
        case 'thermal': return thermalSample(state.mu);
        case 'decoy': {
            const r = Math.random();
            if (r < FRAC.vacuum) return 0;
            if (r < FRAC.vacuum + FRAC.decoy) return poissonSample(state.nu);
            return poissonSample(state.mu);
        }
        default: return poissonSample(state.mu);
    }
}

function runSim() {
    const n = state.n;
    const hist = new Array(NMAX + 1).fill(0);
    let multi = 0, nonEmpty = 0, total = 0;
    for (let i = 0; i < n; i++) {
        const k = sampleOne();
        hist[Math.min(k, NMAX)]++;
        total += k;
        if (k >= 1) nonEmpty++;
        if (k >= 2) multi++;
    }
    state.sim = {
        n, hist, multi, nonEmpty,
        mean: total / n,
        freq: hist.map((c) => c / n)
    };
}

/* ---------------------------------------------------------------- render */
function render() {
    if (!state.sim) runSim();
    const { mu, nu, src } = state;
    const sim = state.sim;

    const labels = [];
    for (let k = 0; k <= NMAX; k++) labels.push(k === NMAX ? '7+' : String(k));

    const series = [];
    if (src === 'decoy') {
        series.push({ name: 'theory \u03BC (signal)', color: 'var(--accent-neon-blue)', values: labels.map((_, k) => pois(k, mu)) });
        series.push({ name: 'theory \u03BD (decoy)', color: 'var(--accent-neon-cyan)', values: labels.map((_, k) => pois(k, nu)) });
    } else {
        series.push({ name: 'theory', color: 'var(--accent-neon-blue)', values: labels.map((_, k) => theory(src, mu, k)) });
    }
    series.push({ name: 'measured', color: 'var(--safe-green)', values: sim.freq, opacity: 0.75 });

    const chartHost = $('src-chart');
    if (chartHost) {
        chartHost.innerHTML = bars({
            w: 620, h: 250,
            labels, series,
            yMax: Math.max(0.12, ...series.flatMap((s) => s.values)) * 1.12,
            xLabel: 'photon number n in one pulse',
            yLabel: 'probability P(n)',
            showValues: false
        });
    }

    const legendHost = $('src-legend');
    if (legendHost) {
        legendHost.innerHTML = series.map((s) =>
            `<span class="ob-legend-item"><i class="ob-sw" style="background:${s.color};border-color:${s.color}"></i>${s.name}</span>`
        ).join('') + `<span class="ob-legend-item"><i class="ob-sw" style="background:transparent"></i>N = ${fgroup(state.n)} pulses</span>`;
    }

    // statistics
    const p0 = theory(src, mu, 0);
    const p1 = theory(src, mu, 1);
    const pMulti = src === 'ideal' ? 0 : Math.max(0, 1 - p0 - p1);
    const pMultiThermal = src === 'thermal' ? Math.max(0, 1 - p0 - p1) : pMulti;
    const ge1 = Math.max(1e-12, 1 - p0);
    const tagFraction = pMultiThermal / ge1;

    const statsHost = $('src-stats');
    if (statsHost) {
        statsHost.innerHTML = statTable([
            ['Mean photon number \u03BC', src === 'ideal' ? '1.000 (exact)' : mu.toFixed(3)],
            ['P(0) \u2014 empty pulses', fpct(p0)],
            ['P(1) \u2014 single photons', fpct(p1)],
            ['P(\u2265 2) \u2014 multi-photon', fpct(pMultiThermal), pMultiThermal > 0.05 ? 'bad' : 'good'],
            ['P(\u2265 2 | \u2265 1) \u2014 PNS-tagged', fpct(tagFraction), tagFraction > 0.15 ? 'bad' : 'good'],
            ['Measured multi-photon pulses', fgroup(sim.multi) + ' / ' + fgroup(sim.n)],
            ['Measured mean n', sim.mean.toFixed(4)]
        ]);
    }

    const noteHost = $('src-note');
    if (noteHost) {
        noteHost.innerHTML = note(
            `<b>What this means.</b> Only <b>P(1)</b> pulses carry a genuinely indivisible qubit.
             Every pulse with n \u2265 2 hands Eve a spare copy she can keep without disturbing the one she forwards —
             the <b>photon-number-splitting (PNS)</b> attack. Attenuating to \u03BC \u2248 0.5 makes multi-photon
             pulses rare (${fpct(pMultiThermal)} here) at the cost of throwing away ${fpct(p0)} of the pulses as empty.
             The way out of that trade-off is <b>decoy states</b>: by randomly re-labelling the intensity, Alice and Bob
             can detect the extra loss Eve must introduce, and use a much larger \u03BC safely.`,
            tagFraction > 0.15 ? 'warn' : 'info'
        );
    }

    // comparison table
    const rows = [
        ['Ideal single-photon', '0.000 %', '100.000 %', '0.000 %', '0.000 %', { v: 'immune', tone: 'good' }],
        ...[0.1, 0.3, 0.5, 1.0].map((m) => {
            const a = pois(0, m), b = pois(1, m), c = Math.max(0, 1 - a - b);
            return [
                'WCP  \u03BC = ' + m.toFixed(1),
                fpct(a, 2), fpct(b, 2), fpct(c, 2), fpct(c / Math.max(1e-12, 1 - a), 2),
                { v: c > 0.09 ? 'needs decoys' : 'low risk', tone: c > 0.09 ? 'bad' : 'good' }
            ];
        }),
        [
            'Thermal  \u03BC = ' + mu.toFixed(2),
            fpct(thermal(0, mu), 2), fpct(thermal(1, mu), 2), fpct(Math.max(0, 1 - thermal(0, mu) - thermal(1, mu)), 2),
            fpct(Math.max(0, 1 - thermal(0, mu) - thermal(1, mu)) / Math.max(1e-12, 1 - thermal(0, mu)), 2),
            { v: 'bunched \u2014 worst', tone: 'bad' }
        ]
    ];
    const cmpHost = $('src-compare');
    if (cmpHost) {
        cmpHost.innerHTML = table(
            ['Source', 'P(0)', 'P(1)', 'P(\u2265 2)', 'P(\u2265 2 \u2223 \u2265 1)', 'PNS status'],
            rows,
            { align: ['left', 'right', 'right', 'right', 'right', 'center'] }
        ) + note(`A coherent (laser) source is Poissonian; thermal light is <b>bunched</b>, so it carries even more
                  multi-photon pulses for the same mean — which is exactly why QKD transmitters use a laser, never a
                  lamp, and then attenuate it hard.`);
    }
}

/* ------------------------------------------------------------------ init */
export function initSourceLab() {
    if (!$('src-chart')) return;

    onSlider('src-mu', 'v-src-mu', (v) => v.toFixed(2), (v) => { state.mu = v; state.sim = null; render(); });
    onSlider('src-nu', 'v-src-nu', (v) => v.toFixed(2), (v) => { state.nu = v; state.sim = null; render(); });
    onSlider('src-n', 'v-src-n', (v) => fgroup(v), (v) => { state.n = v; state.sim = null; });

    onButtons('src-type-btns', (d, btn) => {
        setActive('src-type-btns', btn);
        state.src = d.src;
        state.sim = null;
        render();
    });

    const runBtn = $('src-run');
    if (runBtn) runBtn.addEventListener('click', () => { runSim(); render(); });

    render();
}
