/* ==========================================================================
   Shared BB84 physical model — used by the decoy, finite-key and mission labs.
   Everything here is "textbook standard": yields, decoy bounds and GLLP /
   decoy key rates for a weak-coherent-pulse transmitter on a lossy channel.

   Parameter object p:  { mu, nu, eta, dark, ed, f }
     mu    signal intensity (mean photon number)
     nu    decoy  intensity
     eta   detector efficiency
     dark  Y0 — dark-count (background) probability per pulse, all detectors
     ed    intrinsic misalignment / optical error
     f     error-correction inefficiency (1.0 = Shannon limit)
   ========================================================================== */
import { h2, pois, clamp } from './stage8_lab_utils.js';

export const ALPHA = 0.2;   // dB per km of standard fibre
export const E0 = 0.5;      // error rate of a background (dark-count) event
export const Q_FACTOR = 0.5; // sifting factor, symmetric BB84

/** Overall transmittance at distance km. */
export function transmittance(p, km) {
    return p.eta * Math.pow(10, -(ALPHA * km) / 10);
}

/** Gain: probability that a pulse of intensity mu produces a click. */
export function gain(p, mu, etaT) {
    return p.dark + 1 - Math.exp(-mu * etaT);
}

/** QBER of a pulse of intensity mu. */
export function qberOf(p, mu, etaT) {
    const Q = gain(p, mu, etaT);
    if (Q <= 0) return 0;
    return (E0 * p.dark + p.ed * (1 - Math.exp(-mu * etaT))) / Q;
}

/** Yield of an n-photon pulse. */
export function yieldN(p, n, etaT) {
    return p.dark + 1 - Math.pow(1 - etaT, n);
}

/**
 * Two-decoy + vacuum lower bound on the single-photon yield
 * (Ma, Lo, Chen; Wang). Requires nu < mu.
 */
export function y1Lower(p, etaT, Qmu, Qnu) {
    const { mu, nu, dark } = p;
    if (nu >= mu) return 0;
    const denom = mu * nu - nu * nu;
    if (denom <= 0) return 0;
    const val = (mu / denom) * (
        Qnu * Math.exp(nu)
        - Qmu * Math.exp(mu) * (nu * nu) / (mu * mu)
        - ((mu * mu - nu * nu) / (mu * mu)) * dark
    );
    return Math.max(0, val);
}

/** Upper bound on the single-photon phase-error rate. */
export function e1Upper(p, etaT, y1, Qnu, Enu) {
    const { nu, dark } = p;
    if (y1 <= 0 || nu <= 0) return 0.5;
    return clamp((Enu * Qnu * Math.exp(nu) - E0 * dark) / (y1 * nu), 0, 0.5);
}

/** Share of Bob's detections that came from multi-photon pulses. */
export function taggedFraction(p, mu, etaT) {
    const Q = gain(p, mu, etaT);
    if (Q <= 0) return 1;
    const multi = Q - pois(0, mu) * yieldN(p, 0, etaT) - pois(1, mu) * yieldN(p, 1, etaT);
    return clamp(multi / Q, 0, 1);
}

/** Fraction of pulses containing two or more photons. */
export function multiPhotonProb(p, mu) {
    return Math.max(0, 1 - pois(0, mu) - pois(1, mu));
}

/**
 * Decoy-state key rate.
 * obs may override { Qmu, Emu, Qnu, Enu } — that is how finite-key
 * statistical fluctuations are injected.
 */
export function rateDecoy(p, etaT, obs = {}) {
    const Qmu = obs.Qmu != null ? obs.Qmu : gain(p, p.mu, etaT);
    const Emu = obs.Emu != null ? obs.Emu : qberOf(p, p.mu, etaT);
    const Qnu = obs.Qnu != null ? obs.Qnu : gain(p, p.nu, etaT);
    const Enu = obs.Enu != null ? obs.Enu : qberOf(p, p.nu, etaT);

    const y1 = y1Lower(p, etaT, Qmu, Qnu);
    const e1 = e1Upper(p, etaT, y1, Qnu, Enu);
    const Q1 = y1 * p.mu * Math.exp(-p.mu);
    const R = Q_FACTOR * (-p.f * Qmu * h2(Emu) + Q1 * (1 - h2(e1)));
    return { R: Math.max(0, R), Qmu, Emu, Qnu, Enu, y1, e1, Q1 };
}

/**
 * Standard BB84 with no decoys: the conservative "tagged" (GLLP) bound,
 * where every multi-photon pulse is assumed to be fully known to Eve.
 */
export function rateStandard(p, etaT, obs = {}) {
    const Qmu = obs.Qmu != null ? obs.Qmu : gain(p, p.mu, etaT);
    const Emu = obs.Emu != null ? obs.Emu : qberOf(p, p.mu, etaT);
    const pMulti = multiPhotonProb(p, p.mu);
    const Q1L = Math.max(0, Qmu - pMulti);
    const e1U = Q1L > 0 ? clamp((Emu * Qmu - E0 * p.dark) / Q1L, 0, 0.5) : 0.5;
    const R = Q_FACTOR * (-p.f * Qmu * h2(Emu) + Q1L * (1 - h2(e1U)));
    return {
        R: Math.max(0, R), Qmu, Emu, Q1: Q1L, e1: e1U,
        delta: pMulti / Math.max(Qmu, 1e-12)
    };
}

/**
 * Finite-statistics key rate.
 *  1. Every observed rate is pushed to its pessimistic end of a Hoeffding
 *     confidence interval of width delta = sqrt( ln(1/eps) / (2 n) ).
 *  2. An eps-composition overhead of [ log2(2/eps_cor) + 2 log2(2/eps_sec) ]
 *     bits is subtracted from the whole block.
 */
export function rateFinite(p, etaT, N, eps) {
    const Qmu = gain(p, p.mu, etaT);
    const Qnu = gain(p, p.nu, etaT);
    const m = Math.max(1, N * Q_FACTOR * Qmu);       // sifted bits
    const mNu = Math.max(1, N * Q_FACTOR * Qnu);

    const dQ = Math.sqrt(Math.log(1 / eps) / (2 * N));
    const dE = Math.sqrt(Math.log(1 / eps) / (2 * m));
    const dEnu = Math.sqrt(Math.log(1 / eps) / (2 * mNu));

    const obs = {
        Qmu: Math.max(0, Qmu - dQ),
        Qnu: Math.max(0, Qnu - dQ),
        Emu: Math.min(0.5, qberOf(p, p.mu, etaT) + dE),
        Enu: Math.min(0.5, qberOf(p, p.nu, etaT) + dEnu)
    };

    const fluct = rateDecoy(p, etaT, obs);
    const overhead = (Math.log2(2 / eps) + 2 * Math.log2(2 / eps)) / N;
    const R = Math.max(0, fluct.R - overhead);
    const inf = rateDecoy(p, etaT);

    return {
        R, Rinf: inf.R, Rfluct: fluct.R, overhead,
        dQ, dE, dEnu, m, mNu, sifted: m,
        y1: fluct.y1, e1: fluct.e1,
        Qmu: obs.Qmu, Emu: obs.Emu, Qnu: obs.Qnu, Enu: obs.Enu
    };
}

/** Smallest N (power of ten grid + bisection) giving a positive key. */
export function minPulsesFor(p, etaT, eps) {
    let lo = 1e2, hi = 1e12;
    if (rateFinite(p, etaT, hi, eps).R <= 0) return null;
    for (let i = 0; i < 60; i++) {
        const mid = Math.sqrt(lo * hi);
        if (rateFinite(p, etaT, mid, eps).R > 0) hi = mid; else lo = mid;
    }
    return hi;
}

/** Longest fibre (km) with a positive rate. */
export function maxDistance(p, rateFn, floor = 1e-14) {
    let best = 0;
    for (let km = 0; km <= 400; km += 0.5) {
        if (rateFn(p, transmittance(p, km)).R > floor) best = km;
    }
    return best;
}
