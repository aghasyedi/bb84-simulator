/* ==========================================================================
   Lab 4 — Decoy-State BB84
   Standard (GLLP / tagged) BB84 vs 2-decoy + vacuum BB84.
   ========================================================================== */
import {
    $, onSlider, onButtons, setActive, plot, bars, statTable, table, note,
    fpct, fgroup, fsci, pois
} from './stage8_lab_utils.js';
import {
    ALPHA, transmittance, gain, qberOf, y1Lower, e1Upper,
    taggedFraction, multiPhotonProb, rateDecoy, rateStandard, maxDistance
} from './stage8_qkd_model.js';

const state = {
    mode: 'decoy', mu: 0.5, nu: 0.1, km: 50, eta: 0.65,
    dark: 1e-5, ed: 0.015, f: 1.16, n: 1e9
};

/* ----------------------------------------------------------------- render */
function render() {
    const etaT = transmittance(state, state.km);
    const dec = rateDecoy(state, etaT);
    const std = rateStandard(state, etaT);
    const showDecoy = state.mode !== 'std';
    const showStd = state.mode !== 'decoy';

    /* --- key rate vs fibre length --- */
    const ptsDecoy = [], ptsStd = [];
    for (let km = 0; km <= 300; km += 1) {
        const e = transmittance(state, km);
        ptsDecoy.push([km, rateDecoy(state, e).R]);
        ptsStd.push([km, rateStandard(state, e).R]);
    }
    const series = [];
    if (showStd) series.push({ points: ptsStd, color: 'var(--danger-red)', width: 2.2, dash: '6 4' });
    if (showDecoy) series.push({ points: ptsDecoy, color: 'var(--safe-green)', width: 2.6 });

    const cur = state.mode === 'std' ? std.R : dec.R;
    const markers = [];
    if (cur > 0) markers.push({ x: state.km, y: cur, color: 'var(--accent-neon-blue)', label: fsci(cur, 2) + ' bit/pulse' });

    const plotHost = $('dec-plot');
    if (plotHost) {
        plotHost.innerHTML = plot({
            w: 620, h: 290,
            logY: true, yMin: 1e-13, yMax: 1e-1, xMin: 0, xMax: 300,
            xTicks: [0, 50, 100, 150, 200, 250, 300],
            series, markers,
            fmtX: (v) => String(v),
            fmtY: (v) => '1e' + Math.round(Math.log10(v)),
            xLabel: 'fibre length (km)',
            yLabel: 'secure key rate (bits / pulse)'
        });
    }

    const legendHost = $('dec-legend');
    if (legendHost) {
        const items = [];
        if (showDecoy) items.push(['var(--safe-green)', 'decoy-state BB84']);
        if (showStd) items.push(['var(--danger-red)', 'standard BB84 (no decoy)']);
        legendHost.innerHTML = items.map(([c, l]) =>
            `<span class="ob-legend-item"><i class="ob-sw" style="background:${c};border-color:${c}"></i>${l}</span>`
        ).join('') + `<span class="ob-legend-item"><i class="ob-sw" style="background:transparent"></i>${ALPHA} dB/km \u00B7 \u03B7 = ${(state.eta * 100).toFixed(0)} %</span>`;
    }

    /* --- photon-number distribution --- */
    const labels = ['0', '1', '2', '3', '4', '5', '6+'];
    const muVals = labels.map((_, k) => pois(k, state.mu));
    const nuVals = labels.map((_, k) => pois(k, state.nu));
    const distHost = $('dec-dist');
    if (distHost) {
        distHost.innerHTML = bars({
            w: 620, h: 240,
            labels,
            series: [
                { name: 'signal \u03BC', color: 'var(--accent-neon-blue)', values: muVals },
                { name: 'decoy \u03BD', color: 'var(--accent-neon-cyan)', values: nuVals }
            ],
            yMax: Math.max(...muVals) * 1.15,
            showValues: true,
            fmtV: (v) => v.toFixed(3),
            xLabel: 'photon number n',
            yLabel: 'P(n)'
        });
    }

    /* --- PNS exposure --- */
    const delta = taggedFraction(state, state.mu, etaT);
    const pMulti = multiPhotonProb(state, state.mu);
    const pnsHost = $('dec-pns');
    if (pnsHost) {
        pnsHost.innerHTML = note(
            `<b>Photon-number splitting.</b> ${fpct(pMulti)} of Alice's pulses contain two or more photons, and
             ${fpct(delta)} of everything Bob detects came from such a pulse. Eve can split those, keep one copy and
             forward the other with <em>zero</em> added error.
             <br><br>
             <b>Without decoys</b> Alice and Bob cannot tell a one-photon pulse from a two-photon pulse, so they must
             assume the worst and sacrifice the whole tagged fraction
             (\u0394 = ${fpct(Math.min(1, std.delta || 0))}) — the rate collapses.
             <br>
             <b>With decoys</b> the extra intensity settings supply two more equations, so Y\u2081 and e\u2081 are
             <em>bounded by the data itself</em>: Y\u2081 \u2265 ${fsci(dec.y1, 3)}, e\u2081 \u2264 ${fpct(dec.e1, 2)}.
             Eve can no longer hide the extra loss her attack needs.`
            , (std.delta || 0) > 0.1 ? 'warn' : 'info');
    }

    /* --- parameter readout --- */
    const dMax = maxDistance(state, rateDecoy);
    const sMax = maxDistance(state, rateStandard);
    const rows = [];
    if (showDecoy) {
        rows.push([
            'Decoy-state BB84',
            fsci(dec.Qmu, 3), fpct(dec.Emu, 2), fsci(dec.y1, 3), fpct(dec.e1, 2),
            fpct(delta, 2), fsci(dec.R, 3), fgroup(dec.R * state.n),
            { v: dMax.toFixed(0) + ' km', tone: 'good' }
        ]);
    }
    if (showStd) {
        rows.push([
            'Standard BB84',
            fsci(std.Qmu, 3), fpct(std.Emu, 2), '\u2014', fpct(std.e1, 2),
            fpct(std.delta, 2), fsci(std.R, 3), fgroup(std.R * state.n),
            { v: sMax.toFixed(0) + ' km', tone: 'bad' }
        ]);
    }

    const tableHost = $('dec-table');
    if (tableHost) {
        const gainRatio = showStd && std.R > 0 ? (dec.R / std.R) : null;
        tableHost.innerHTML = table(
            ['Variant', 'Q\u03BC (gain)', 'E\u03BC (QBER)', 'Y\u2081 bound', 'e\u2081 bound', 'tagged \u0394',
                'R (bit/pulse)', 'key bits (N = ' + fsci(state.n, 0) + ')', 'max reach'],
            rows,
            { align: ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'] }
        ) + statTable([
            ['Operating point', state.km + ' km \u00B7 ' + (ALPHA * state.km).toFixed(1) + ' dB'],
            ['Overall transmittance \u03B7\u209C\u2080\u209C', fsci(etaT, 3)],
            ['Decoy gain Q\u03BD', fsci(gain(state, state.nu, etaT), 3)],
            ['Decoy QBER E\u03BD', fpct(qberOf(state, state.nu, etaT), 2)],
            ['Vacuum gain Q\u2080 = Y\u2080', fsci(state.dark, 3)],
            ['Improvement from decoys', gainRatio
                ? gainRatio.toFixed(1) + '\u00D7 rate \u00B7 +' + (dMax - sMax).toFixed(0) + ' km reach'
                : (showStd ? '\u221E \u2014 standard BB84 yields no key here' : '\u2014')]
        ]) + note(
            `Model: yields Y\u2099 = Y\u2080 + 1 \u2212 (1\u2212\u03B7)\u207F with Y\u2080 the background probability and
             e\u2080 = \u00BD; two-decoy-plus-vacuum bounds after Ma&ndash;Lo&ndash;Chen and Wang:
             Y\u2081 \u2265 \u03BC/(\u03BC\u03BD\u2212\u03BD\u00B2)\u00B7[Q\u03BD e^\u03BD \u2212 Q\u03BC e^\u03BC \u03BD\u00B2/\u03BC\u00B2
             \u2212 ((\u03BC\u00B2\u2212\u03BD\u00B2)/\u03BC\u00B2) Y\u2080], and
             e\u2081 \u2264 (E\u03BD Q\u03BD e^\u03BD \u2212 e\u2080 Y\u2080)/(Y\u2081 \u03BD).
             Rates: R = \u00BD{\u2212f Q\u03BC h(E\u03BC) + Y\u2081\u03BCe^{\u2212\u03BC}[1 \u2212 h(e\u2081)]} for decoys,
             and the conservative tagged bound \u0394 = P(n\u22652)/Q\u03BC for standard BB84.`, 'info');
    }
}

/* ------------------------------------------------------------------- init */
export function initDecoyLab() {
    if (!$('dec-plot')) return;

    onSlider('dec-mu', 'v-dec-mu', (v) => v.toFixed(2), (v) => {
        state.mu = v;
        if (state.nu >= v - 0.01) {
            const nuSlider = $('dec-nu');
            if (nuSlider) {
                nuSlider.value = String(Math.max(0.01, v / 5));
                state.nu = parseFloat(nuSlider.value);
                const out = $('v-dec-nu');
                if (out) out.textContent = state.nu.toFixed(2);
            }
        }
        render();
    });
    onSlider('dec-nu', 'v-dec-nu', (v) => v.toFixed(2), (v) => { state.nu = v; render(); });
    onSlider('dec-km', 'v-dec-km', (v) => v.toFixed(0) + ' km', (v) => { state.km = v; render(); });
    onSlider('dec-eta', 'v-dec-eta', (v) => (v * 100).toFixed(0) + ' %', (v) => { state.eta = v; render(); });
    onSlider('dec-dark', 'v-dec-dark', (v) => fsci(Math.pow(10, v), 1), (v) => { state.dark = Math.pow(10, v); render(); });
    onSlider('dec-ed', 'v-dec-ed', (v) => (v * 100).toFixed(1) + ' %', (v) => { state.ed = v; render(); });
    onSlider('dec-f', 'v-dec-f', (v) => v.toFixed(2), (v) => { state.f = v; render(); });
    onSlider('dec-n', 'v-dec-n', (v) => fsci(Math.pow(10, v), 1), (v) => { state.n = Math.pow(10, v); render(); });

    onButtons('dec-mode-btns', (d, btn) => {
        setActive('dec-mode-btns', btn);
        state.mode = d.mode;
        render();
    });

    render();
}
