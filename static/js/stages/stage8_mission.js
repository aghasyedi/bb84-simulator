/* ==========================================================================
   Lab 6 — End-to-End BB84 Mission
   A nine-step playable experiment: configure -> transmit -> sift -> QBER ->
   reconcile -> privacy amplification -> final key.
   ========================================================================== */
import {
    $, onSlider, statTable, note, h2, poissonSample, fpct, fgroup, fsci, clamp, esc
} from './stage8_lab_utils.js';
import { ALICE, BOB } from './stage8_optics.js';

const CHANNELS = [
    { v: 'fibre', label: 'Single-mode fibre \u2014 0.2 dB/km', fixed: 0, alpha: 0.2 },
    { v: 'bench', label: 'Laboratory bench \u2014 no fibre', fixed: 0, alpha: 0 },
    { v: 'freespace', label: 'Free-space / satellite \u2014 20 dB + 0.05 dB/km', fixed: 20, alpha: 0.05 }
];

const EVES = [
    { v: 'none', label: 'No eavesdropper' },
    { v: 'ir', label: 'Intercept\u2013resend (adds 25 % QBER)' },
    { v: 'bs', label: 'Beam-splitter tap (adds loss, no QBER)' },
    { v: 'pns', label: 'Photon-number splitting (invisible!)' }
];

const cfg = {
    source: 'a-4laser', detector: 'b-passive', channel: 'fibre', eve: 'none',
    mu: 0.5, n: 100000, eta: 0.65, ed: 0.015, km: 25, eveStr: 1.0
};

const m = {
    step: 1, done: [], running: false,
    raw: null, sifted: null, qber: null, ec: null, pa: null,
    aliceKey: null, bobKey: null
};

/* ------------------------------------------------------------------ setup */
function fillSelects() {
    const src = $('ms-source');
    if (src) {
        src.innerHTML = ALICE.map((a) => `<option value="${a.id}">${esc(a.chip)} \u2014 ${esc(a.name)}</option>`).join('');
        src.value = cfg.source;
        src.addEventListener('change', () => { cfg.source = src.value; resetMission('Alice source changed'); });
    }
    const det = $('ms-detector');
    if (det) {
        det.innerHTML = BOB.map((b) => `<option value="${b.id}">${esc(b.chip)} \u2014 ${esc(b.name)}</option>`).join('');
        det.value = cfg.detector;
        det.addEventListener('change', () => { cfg.detector = det.value; resetMission('Bob module changed'); });
    }
    const ch = $('ms-channel');
    if (ch) {
        ch.innerHTML = CHANNELS.map((c) => `<option value="${c.v}">${esc(c.label)}</option>`).join('');
        ch.value = cfg.channel;
        ch.addEventListener('change', () => { cfg.channel = ch.value; resetMission('Channel changed'); });
    }
    const ev = $('ms-eve');
    if (ev) {
        ev.innerHTML = EVES.map((e) => `<option value="${e.v}">${esc(e.label)}</option>`).join('');
        ev.value = cfg.eve;
        ev.addEventListener('change', () => { cfg.eve = ev.value; resetMission('Eve model changed'); });
    }
}

function channelLoss() {
    const c = CHANNELS.find((x) => x.v === cfg.channel) || CHANNELS[0];
    return c.fixed + c.alpha * cfg.km;
}

function etaTotal() {
    return cfg.eta * Math.pow(10, -channelLoss() / 10);
}

/* ------------------------------------------------------------- monte carlo */
function runPhotons() {
    const N = Math.round(cfg.n);
    const etaT = etaTotal();
    const alice = ALICE.find((a) => a.id === cfg.source) || ALICE[0];
    const ideal = alice.id === 'a-spdc';
    const eve = cfg.eve;
    const s = cfg.eveStr;

    let sent = 0, clicks = 0, blockedByEve = 0, doubleClicks = 0;
    let eveKnows = 0, eveSamples = 0;
    const events = [];   // { aBit, aBasis, bBasis, det, eveHas }

    for (let i = 0; i < N; i++) {
        sent++;
        let aBit = Math.random() < 0.5 ? 0 : 1;
        const aBasis = Math.random() < 0.5 ? 0 : 1;   // 0 = Z, 1 = X
        let n = ideal ? 1 : poissonSample(cfg.mu);
        let lossless = false;                          // Eve compensates the channel
        let eveHas = false;                            // Eve holds a copy this pulse

        /* ---- Eve ---- */
        if (eve === 'ir' && Math.random() < s) {
            const eBasis = Math.random() < 0.5 ? 0 : 1;
            if (eBasis !== aBasis) aBit = Math.random() < 0.5 ? 0 : 1;
            n = 1;                                     // resends a fresh single photon
            eveHas = true;
            eveSamples++;
        } else if (eve === 'bs' && Math.random() < s) {
            const tap = 0.5;
            let eveGot = 0, left = 0;
            for (let k = 0; k < n; k++) {
                if (Math.random() < tap) eveGot++; else left++;
            }
            n = left;
            if (eveGot > 0) { eveHas = true; eveSamples++; }
        } else if (eve === 'pns' && Math.random() < s) {
            if (n >= 2) {
                n = 1;
                lossless = true;                        // Eve owns a perfect line
                eveHas = true;
                eveSamples++;
            } else {
                blockedByEve++;
                n = 0;
            }
        }

        if (n <= 0) continue;

        /* ---- Bob ---- */
        const etaEff = lossless ? cfg.eta : etaT;
        const pDet = 1 - Math.pow(1 - etaEff, n);
        const bBasis = Math.random() < 0.5 ? 0 : 1;
        const fired = [];

        if (Math.random() < pDet) {
            let bit = aBit;
            if (aBasis !== bBasis) bit = Math.random() < 0.5 ? 0 : 1;
            if (Math.random() < cfg.ed) bit ^= 1;      // optical misalignment
            fired.push({ d: bBasis * 2 + bit, type: 'sig' });
        }
        const darkPer = 1e-5;
        for (let d = 0; d < 4; d++) {
            if (fired.some((f) => f.d === d)) continue;
            if (Math.random() < darkPer) fired.push({ d, type: 'dark' });
        }
        if (!fired.length) continue;

        clicks++;
        if (fired.length > 1) doubleClicks++;
        const pick = fired.length === 1 ? fired[0] : fired[Math.floor(Math.random() * fired.length)];
        // Eve only learns the bit once the bases are revealed and Bob really detected it
        if (eveHas && bBasis === aBasis) eveKnows++;
        events.push({ aBit, aBasis, bBasis, det: pick.d, type: pick.type });
    }

    m.raw = { N: sent, clicks, blockedByEve, doubleClicks, events, eveKnows, eveSamples, etaT };
    return m.raw;
}

/* ------------------------------------------------------------------- steps */
const STEPS = [
    {
        n: 1, title: 'Configure Alice', run: () => {
            const a = ALICE.find((x) => x.id === cfg.source) || ALICE[0];
            log(`<b>ALICE</b> \u2014 source module <span class="t-accent">${esc(a.name)}</span>`);
            log(`&nbsp;&nbsp;\u03BC = ${cfg.mu.toFixed(2)} photons/pulse \u00B7 N = ${fgroup(cfg.n)} pulses \u00B7 tag ${esc(a.tag)}`);
            return statTable([
                ['Source module', esc(a.chip)],
                ['Mean photon number \u03BC', cfg.mu.toFixed(2)],
                ['Pulses to send', fgroup(cfg.n)],
                ['Encoding', a.id === 'a-spdc' ? 'entangled pair (BBM92)' : 'polarisation, 4 states']
            ]);
        }
    },
    {
        n: 2, title: 'Configure bench', run: () => {
            const b = BOB.find((x) => x.id === cfg.detector) || BOB[0];
            log(`<b>BENCH</b> \u2014 receiver <span class="t-accent">${esc(b.name)}</span>`);
            log(`&nbsp;&nbsp;\u03B7 = ${(cfg.eta * 100).toFixed(0)} % \u00B7 e_d = ${(cfg.ed * 100).toFixed(1)} % \u00B7 tag ${esc(b.tag)}`);
            return statTable([
                ['Detection module', esc(b.chip)],
                ['Detector efficiency \u03B7', (cfg.eta * 100).toFixed(0) + ' %'],
                ['Intrinsic misalignment e_d', fpct(cfg.ed, 1)],
                ['Detectors', b.specs && b.specs[0] ? b.specs[0][1] : '\u2014']
            ]);
        }
    },
    {
        n: 3, title: 'Configure channel', run: () => {
            const c = CHANNELS.find((x) => x.v === cfg.channel) || CHANNELS[0];
            const L = channelLoss();
            log(`<b>CHANNEL</b> \u2014 ${esc(c.label)}`);
            log(`&nbsp;&nbsp;length ${cfg.km} km \u2192 loss ${L.toFixed(2)} dB \u00B7 total transmittance ${fsci(etaTotal(), 3)}`);
            return statTable([
                ['Medium', esc(c.label)],
                ['Length', cfg.km + ' km'],
                ['Channel loss', L.toFixed(2) + ' dB'],
                ['Total transmittance', fsci(etaTotal(), 3)]
            ]);
        }
    },
    {
        n: 4, title: 'Configure Eve', run: () => {
            const e = EVES.find((x) => x.v === cfg.eve) || EVES[0];
            log(`<b>EVE</b> \u2014 ${esc(e.label)} at ${(cfg.eveStr * 100).toFixed(0)} % strength`);
            if (cfg.eve === 'pns') log(`&nbsp;&nbsp;<span class="t-warn">she will leave the QBER untouched \u2014 only decoy states can reveal her</span>`);
            if (cfg.eve === 'bs') log(`&nbsp;&nbsp;<span class="t-warn">she adds loss, not errors \u2014 watch the count rate</span>`);
            return statTable([
                ['Attack model', esc(e.label)],
                ['Strength', (cfg.eveStr * 100).toFixed(0) + ' %'],
                ['Expected QBER signature', cfg.eve === 'ir' ? '25 % \u00D7 strength' : (cfg.eve === 'none' ? 'none' : 'none (loss only)')],
                ['Detectable by', cfg.eve === 'ir' ? 'QBER monitoring' : (cfg.eve === 'none' ? '\u2014' : 'decoy-state analysis')]
            ]);
        }
    },
    {
        n: 5, title: 'Run photons', run: () => {
            const t0 = performance.now();
            const r = runPhotons();
            const ms = (performance.now() - t0).toFixed(0);
            log(`<b>TRANSMISSION</b> \u2014 ${fgroup(r.N)} pulses in ${ms} ms`);
            log(`&nbsp;&nbsp;${fgroup(r.clicks)} detector clicks \u00B7 ${fgroup(r.doubleClicks)} double clicks` +
                (r.blockedByEve ? ` \u00B7 <span class="t-warn">${fgroup(r.blockedByEve)} pulses vanished</span>` : ''));
            return statTable([
                ['Pulses sent', fgroup(r.N)],
                ['Detector clicks', fgroup(r.clicks), 'good'],
                ['Click probability', fpct(r.clicks / Math.max(1, r.N), 3)],
                ['Double clicks', fgroup(r.doubleClicks)],
                ['Eve-touched pulses', fgroup(r.eveSamples), r.eveSamples ? 'bad' : 'good']
            ]);
        }
    },
    {
        n: 6, title: 'Sift', run: () => {
            if (!m.raw) return note('Run the photons first.', 'warn');
            const aBits = [], bBits = [];
            let discarded = 0;
            m.raw.events.forEach((e) => {
                if (e.aBasis !== e.bBasis) { discarded++; return; }
                aBits.push(e.aBit);
                bBits.push(e.det % 2);
            });
            m.sifted = { aBits, bBits, discarded };
            m.aliceKey = aBits;
            m.bobKey = bBits;
            const frac = aBits.length / Math.max(1, m.raw.N);
            log(`<b>SIFTING</b> \u2014 kept ${fgroup(aBits.length)} of ${fgroup(m.raw.clicks)} clicks (${fpct(frac, 2)} of pulses)`);
            log(`&nbsp;&nbsp;${fgroup(discarded)} discarded because the bases did not match`);
            return statTable([
                ['Clicks before sifting', fgroup(m.raw.clicks)],
                ['Basis mismatch discarded', fgroup(discarded)],
                ['Sifted key length', fgroup(aBits.length), 'good'],
                ['Sifting efficiency', fpct(aBits.length / Math.max(1, m.raw.N), 3)]
            ]);
        }
    },
    {
        n: 7, title: 'QBER', run: () => {
            if (!m.sifted) return note('Sift the key first.', 'warn');
            const { aBits, bBits } = m.sifted;
            const nS = aBits.length;
            if (!nS) return note('No sifted bits \u2014 increase the pulse count or shorten the channel.', 'warn');
            // sample half for the QBER estimate (the usual public comparison)
            const sample = Math.max(1, Math.floor(nS / 2));
            let err = 0;
            for (let i = 0; i < sample; i++) {
                const j = Math.floor(Math.random() * nS);
                if (aBits[j] !== bBits[j]) err++;
            }
            const Q = err / sample;
            const delta = Math.sqrt(Math.log(1 / 1e-9) / (2 * sample));
            const qUpper = Math.min(0.5, Q + delta);
            m.qber = { Q, delta, qUpper, sample, nS };
            const secure = qUpper < 0.11;
            log(`<b>QBER</b> \u2014 ${fpct(Q, 2)} on a ${fgroup(sample)}-bit sample (\u00B1${fpct(delta, 3)})`);
            log(secure
                ? `&nbsp;&nbsp;<span class="t-good">below the 11 % Shor\u2013Preskill bound \u2014 channel is usable</span>`
                : `&nbsp;&nbsp;<span class="t-warn">above the 11 % bound \u2014 abort the session</span>`);
            if (cfg.eve === 'pns') {
                log(`&nbsp;&nbsp;<span class="t-warn">note: the QBER looks clean because PNS adds no errors at all</span>`);
            }
            const out = statTable([
                ['Sample size', fgroup(sample)],
                ['Errors found', fgroup(err)],
                ['Measured QBER', fpct(Q, 2), Q < 0.11 ? 'good' : 'bad'],
                ['Statistical margin \u03B4', fpct(delta, 3)],
                ['Worst-case QBER', fpct(qUpper, 2), qUpper < 0.11 ? 'good' : 'bad'],
                ['Verdict', qUpper < 0.11 ? 'SECURE \u2014 proceed' : 'ABORT \u2014 Eve or a broken link', qUpper < 0.11 ? 'good' : 'bad']
            ]);
            if (!secure) m.aborted = true;
            return out;
        }
    },
    {
        n: 8, title: 'Reconcile', run: () => {
            if (!m.qber) return note('Measure the QBER first.', 'warn');
            const nS = m.sifted.aBits.length;
            const Q = m.qber.qUpper;
            const f = 1.16;
            // Cascade: 4 passes, disclosed bits approach n*h(Q)
            const passes = [];
            let disclosed = 0;
            let remaining = nS;
            let err = Math.max(Q, 1e-6);
            for (let p = 1; p <= 4; p++) {
                const block = Math.max(2, Math.round(0.73 / Math.max(err, 1e-4)));
                const cost = Math.ceil(nS / Math.max(2, block));
                disclosed += cost;
                err = err * err * 3;   // Cascade roughly squares the residual error
                passes.push({ p, block, cost });
                if (err < 1e-9) break;
            }
            const shannon = Math.ceil(f * h2(Math.max(Q, 1e-6)) * nS);
            disclosed = Math.max(disclosed, shannon);
            m.ec = { disclosed, passes, remaining: Math.max(0, nS - disclosed), f };
            log(`<b>RECONCILIATION</b> \u2014 Cascade, ${passes.length} passes`);
            log(`&nbsp;&nbsp;${fgroup(disclosed)} bits disclosed (${fpct(disclosed / Math.max(1, nS), 1)}) \u00B7 ${fgroup(Math.max(0, nS - disclosed))} bits left`);
            return statTable([
                ['Input bits', fgroup(nS)],
                ['Cascade passes', String(passes.length)],
                ['Bits disclosed to Bob', fgroup(disclosed), 'bad'],
                ['Shannon bound f\u00B7h(Q)\u00B7n', fgroup(shannon)],
                ['Bits remaining', fgroup(Math.max(0, nS - disclosed)), 'good'],
                ['Reconciled key', 'Alice = Bob (errors removed)']
            ]) + note('Cascade works by comparing parity on shuffled blocks and bisecting; each pass roughly squares the ' +
                'remaining error rate. The disclosed parities are public, so they must be removed again during privacy ' +
                'amplification.', 'info');
        }
    },
    {
        n: 9, title: 'Privacy amplification', run: () => {
            if (!m.ec) return note('Reconcile first.', 'warn');
            const nS = m.sifted.aBits.length;
            const Q = m.qber.qUpper;
            const after = m.ec.remaining;
            // Shor-Preskill style: sacrifice h(Q) for Eve's side information
            const leakEve = Math.ceil(h2(Math.min(0.5, Q)) * nS);
            const finite = Math.ceil(2 * Math.log2(1 / 1e-9)) + 64;
            // Eve's side information: every bit she holds a copy of must be paid for
            const knownFrac = clamp(m.raw.eveKnows / Math.max(1, nS), 0, 1);
            const eveInfo = Math.ceil(knownFrac * nS);
            const finalLen = Math.max(0, Math.floor(after - leakEve - finite - eveInfo));

            const key = universalHash(m.aliceKey, finalLen);
            m.pa = { leakEve, finite, finalLen, key };

            log(`<b>PRIVACY AMPLIFICATION</b> \u2014 Toeplitz universal hash`);
            log(`&nbsp;&nbsp;${fgroup(after)} \u2192 ${fgroup(finalLen)} secret bits (${fpct(finalLen / Math.max(1, nS), 2)} of the sifted key)`);

            let out = statTable([
                ['Reconciled bits', fgroup(after)],
                ['Removed for Eve h(Q)\u00B7n', fgroup(leakEve), 'bad'],
                ['Removed for Eve\u2019s known bits', fgroup(eveInfo) + '  (' + fpct(knownFrac, 1) + ')', eveInfo > 0 ? 'bad' : 'good'],
                ['Finite-key overhead', fgroup(finite) + ' bits'],
                ['Final key length', fgroup(finalLen), finalLen > 0 ? 'good' : 'bad'],
                ['Overall efficiency', fpct(finalLen / Math.max(1, m.raw.N), 4)]
            ]);

            if (cfg.eve === 'pns' && m.raw.eveKnows > 0) {
                out += note(`<b>Eve is still there.</b> Her PNS attack added <em>no</em> errors, so this QBER-based
                    estimate is blind to her \u2014 she silently holds ${fpct(knownFrac, 1)} of the sifted bits, which is
                    why the distilled key collapsed to ${fgroup(finalLen)} bits. Run this same link with
                    <b>decoy states</b> (Lab 4) and the extra loss her attack needs becomes visible.`, 'warn');
            }
            if (finalLen === 0) {
                out += note('No secret key survives. Shorten the channel, lower the QBER, or send more pulses.', 'warn');
            }

            const keyCard = $('ms-key-card');
            const keyHost = $('ms-key');
            if (keyCard && keyHost) {
                keyCard.hidden = finalLen === 0;
                if (finalLen > 0) {
                    const preview = key.slice(0, 2048);
                    keyHost.innerHTML =
                        `<div class="ob-key-stream">${preview}${finalLen > preview.length ? ' <span class="ob-key-more">\u2026 +' + fgroup(finalLen - preview.length) + ' more bits</span>' : ''}</div>` +
                        `<div class="ob-key-meta">${fgroup(finalLen)} bits \u00B7 ${(finalLen / 8).toFixed(0)} bytes \u00B7 ready for ChaCha20-Poly1305</div>`;
                }
            }
            return out;
        }
    }
];

/* Simulated universal hash: random linear mixing of 64-bit words, then truncate. */
function universalHash(bits, outLen) {
    if (outLen <= 0) return '';
    const src = bits.join('');
    if (!src.length) return '0'.repeat(outLen);
    let res = '';
    while (res.length < outLen) {
        let acc = 0;
        for (let t = 0; t < 8; t++) {
            const start = Math.floor(Math.random() * src.length);
            const word = src.slice(start, start + 64);
            for (let i = 0; i < word.length; i++) acc ^= (word.charCodeAt(i) - 48) << (i % 32);
        }
        let chunk = '';
        for (let i = 0; i < 64; i++) chunk += ((acc >>> (i % 30)) ^ (Math.random() < 0.5 ? 1 : 0)) & 1;
        res += chunk;
    }
    return res.slice(0, outLen);
}

/* --------------------------------------------------------------------- ui */
function log(html) {
    const host = $('ms-log');
    if (!host) return;
    const line = document.createElement('div');
    line.className = 'ob-term-line';
    line.innerHTML = html;
    host.appendChild(line);
    host.scrollTop = host.scrollHeight;
}

function renderSteps() {
    const host = $('ms-steps');
    if (!host) return;
    [...host.children].forEach((li) => {
        const n = parseInt(li.dataset.step, 10);
        li.classList.toggle('is-done', m.done.includes(n));
        li.classList.toggle('is-current', n === m.step && !m.done.includes(n));
    });
}

function resetMission(reason) {
    m.step = 1; m.done = []; m.raw = null; m.sifted = null; m.qber = null; m.ec = null; m.pa = null; m.aborted = false;
    const logHost = $('ms-log');
    if (logHost) logHost.innerHTML = '';
    const resHost = $('ms-results');
    if (resHost) resHost.innerHTML = `<div class="ob-empty">Mission armed. Press <b>RUN STEP</b> or <b>RUN FULL MISSION</b>.</div>`;
    const keyCard = $('ms-key-card');
    if (keyCard) keyCard.hidden = true;
    if (reason) log(`<span class="t-muted">\u21BB ${esc(reason)} \u2014 mission reset</span>`);
    renderSteps();
}

function runStep() {
    if (m.step > STEPS.length) return false;
    const st = STEPS[m.step - 1];
    let out;
    try {
        out = st.run();
    } catch (err) {
        out = note('Step failed: ' + err.message, 'warn');
    }
    const host = $('ms-results');
    if (host) host.innerHTML = out || '';
    m.done.push(st.n);
    m.step++;
    renderSteps();
    if (m.aborted && st.n === 7) {
        log(`&nbsp;&nbsp;<span class="t-warn">session aborted by the 11 % rule \u2014 later steps are informational</span>`);
    }
    return true;
}

/* ------------------------------------------------------------------- init */
export function initMissionLab() {
    if (!$('ms-steps')) return;
    fillSelects();

    onSlider('ms-mu', 'v-ms-mu', (v) => v.toFixed(2), (v) => { cfg.mu = v; resetMission('\u03BC changed'); });
    onSlider('ms-n', 'v-ms-n', (v) => fgroup(v), (v) => { cfg.n = v; resetMission('pulse count changed'); });
    onSlider('ms-eta', 'v-ms-eta', (v) => (v * 100).toFixed(0) + ' %', (v) => { cfg.eta = v; resetMission('\u03B7 changed'); });
    onSlider('ms-ed', 'v-ms-ed', (v) => (v * 100).toFixed(1) + ' %', (v) => { cfg.ed = v; resetMission('e_d changed'); });
    onSlider('ms-km', 'v-ms-km', (v) => v.toFixed(0) + ' km', (v) => { cfg.km = v; resetMission('length changed'); });
    onSlider('ms-evestr', 'v-ms-eve', (v) => v.toFixed(0) + ' %', (v) => { cfg.eveStr = v / 100; resetMission('attack strength changed'); });

    const stepBtn = $('ms-step');
    if (stepBtn) stepBtn.addEventListener('click', () => {
        if (m.step > STEPS.length) resetMission('restarting');
        runStep();
    });

    const allBtn = $('ms-all');
    if (allBtn) {
        allBtn.addEventListener('click', () => {
            if (m.step > STEPS.length) resetMission('restarting');
            const tick = () => {
                if (m.step > STEPS.length) return;
                runStep();
                setTimeout(tick, 160);
            };
            tick();
        });
    }

    const resetBtn = $('ms-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => resetMission('operator reset'));

    resetMission();
}
