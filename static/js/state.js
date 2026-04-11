/**
 * state.js - Global App State for BB84 Protocol
 */

export const state = {
    // Stage navigation
    currentStage: 'stage-1',
    advancedMode: false,

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
    MAX_QBER: 0.129
};

// ... existing state functions ...

/**
 * Expert Toolbox Data Injector
 */
export function injectToolboxData(options = {}) {
    const { qber, noise, bits } = options;

    if (qber !== undefined) state.customQBER = qber / 100;
    if (noise !== undefined) state.customNoise = noise;

    if (bits && bits.length > 0) {
        const binBits = bits.split('').map(b => parseInt(b));
        const len = binBits.length;
        state.alice.bits = binBits;
        state.alice.bases = Array.from({ length: len }, () => Math.round(Math.random()));
        state.numBits = len;

        // Reset subsequent stages
        state.bob.bases = [];
        state.bob.measurements = [];
        state.eve.bases = [];
        state.eve.measurements = [];
        state.siftedKeyA = [];
        state.siftedKeyB = [];

        emit('alicePrepared', state.alice);
        console.log(`[TOOLBOX] Injected ${len} custom bits.`);
    }
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

    emit('protocolReset');
}
