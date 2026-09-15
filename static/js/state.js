/**
 * state.js - Global App State for BB84 Protocol
 */

export const state = {
    // Stage navigation
    currentStage: 'stage-1',

    // Simulator config
    numBits: 128,
    aliceManualMode: false,
    aliceManualBits: '0101101011',
    aliceManualBases: '+x+x+x+x+x',
    bobManualMode: false,
    bobManualBases: '+x+x+x+x+x',
    evePresent: false,
    noiseLevel: 0.0,
    playbackState: 'paused', // play, paused
    currentAnimIndex: 0,
    alice: {
        bits: [],
        bases: [], // 0 for Rectilinear (+), 1 for Diagonal (x)
        photons: [] // Visual representation
    },
    bob: {
        bases: [], // 0 for +, 1 for x
        measurements: [], // Resulting 0s or 1s
    },

    // Eve's presence
    eveActive: false,
    eve: {
        bases: [],
        measurements: []
    },

    // Processed output
    siftedKeyA: [],
    siftedKeyB: [],
    matches: [], // Array of indices where bases matched
    errors: [], // Indices in sifted key where bits differ (due to Eve/Noise)

    // Stage 5 & 6 new structures
    sampledIndices: [], // Indices of sifted key sacrificed for QBER
    workingKeyA: [], // Sifted key minus sampled bits
    workingKeyB: [],

    // Detailed Bit Retention Tracking
    bitsRemovedInSifting: 0,
    errorsCorrected: 0,
    bitsRemovedInEC: 0,
    bitsRemovedInPA: 0,
    leakage: 0,
    retentionRatio: 0,
    finalSecretKey: [],

    // Advanced Mode state
    advancedMode: false,
    customQBER: null,
    customNoise: null,

    qber: 0.0,
    MAX_QBER: 0.129,

    // Set when the sampled QBER breaches MAX_QBER: the key is treated as
    // compromised, the working keys are dropped and stages 6/7 refuse to run.
    protocolAborted: false
};

// ... existing state functions ...

/**
 * Expert Toolbox Data Injector
 */
export function injectToolboxData(options = {}) {
    const { noise, bits } = options;

    // Channel noise is a physical channel property, so it maps straight onto the
    // noise level the transmission stage already uses. (QBER is *measured* from
    // the run, never injected, so there is deliberately no qber option here.)
    if (noise !== undefined) {
        const pct = Number(noise);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
            return { ok: false, reason: 'Noise must be a percentage between 0 and 100.' };
        }
        state.customNoise = pct;
        state.noiseLevel = pct / 100;
    }

    if (bits && bits.length > 0) {
        const clean = String(bits).replace(/[^01]/g, '');
        if (clean.length === 0) {
            return { ok: false, reason: 'Bit string must contain only 0s and 1s.' };
        }

        const binBits = clean.split('').map(Number);
        const len = binBits.length;

        state.alice.bits = binBits;
        state.alice.bases = Array.from({ length: len }, () => (Math.random() < 0.5 ? 0 : 1));
        state.numBits = len;

        // Keep the rendered polarisation angles in sync with the injected stream.
        // Basis 0 = rectilinear (0 -> 0deg, 1 -> 90deg), 1 = diagonal (45/135).
        state.alice.photons = binBits.map((bit, i) =>
            state.alice.bases[i] === 0 ? (bit === 0 ? 0 : 90) : (bit === 0 ? 45 : 135));

        // Everything downstream of Alice is now stale
        resetProtocolState();
        emit('alicePrepared', state.alice);

        return { ok: true, length: len, ignored: String(bits).length - clean.length };
    }

    return { ok: true };
}


// Simple event emitter to decouple UI updates
const listeners = {};

export function subscribe(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
    console.debug(`[STATE] New subscriber for: ${event}`);
}

export function emit(event, data) {
    console.debug(`[STATE] Emitting ${event}`, data);
    if (listeners[event]) {
        listeners[event].forEach(cb => cb(data));
    }
}

/**
 * Sandbox Data Injector for Advanced Mode
 */
export function injectSandboxData(level = 'sifted') {
    const len = 128;
    if (level === 'simulation') {
        state.alice.bits = Array.from({ length: len }, () => Math.round(Math.random()));
        state.alice.bases = Array.from({ length: len }, () => Math.round(Math.random()));
        state.numBits = len;
        emit('alicePrepared', state.alice);
    } else if (level === 'sifted') {
        state.siftedKeyA = Array.from({ length: len }, () => Math.round(Math.random()));
        // Bob's key has some errors (e.g. 15% QBER)
        state.siftedKeyB = state.siftedKeyA.map(bit => Math.random() < 0.15 ? 1 - bit : bit);
        state.workingKeyA = [...state.siftedKeyA];
        state.workingKeyB = [...state.siftedKeyB];
        state.qber = 0.15;
        emit('siftingComplete', { alice: state.siftedKeyA, bob: state.siftedKeyB });
    } else if (level === 'reconciled') {
        state.finalSecretKey = Array.from({ length: 16 }, () => Math.round(Math.random()));
        emit('postProcessingComplete', state.finalSecretKey);
    }
}

/**
 * Global Reset: Wipes all downstream data for a fresh run
 */
export function resetProtocolState() {
    // Clear Bob's data
    state.bob.bases = [];
    state.bob.measurements = [];

    // Clear Eve's data
    state.eve.bases = [];
    state.eve.measurements = [];

    // Clear Post-Processing data
    state.siftedKeyA = [];
    state.siftedKeyB = [];
    state.matches = [];
    state.errors = [];
    state.sampledIndices = [];
    state.workingKeyA = [];
    state.workingKeyB = [];
    state.qber = 0.0;
    state.errorsCorrected = 0;
    state.finalSecretKey = [];
    state.automationStep = 0;
    state.protocolAborted = false;

    // Bit-retention bookkeeping (otherwise these leak into the next run)
    state.bitsRemovedInSifting = 0;
    state.bitsRemovedInQBER = 0;
    state.bitsRemovedInEC = 0;
    state.bitsRemovedInPA = 0;
    state.leakage = 0;
    state.retentionRatio = 0;
    state.reconciledKeyA = [];
    state.reconciledKeyB = [];

    emit('protocolReset');
}
