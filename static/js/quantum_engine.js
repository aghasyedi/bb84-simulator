/**
 * quantum_engine.js - Core BB84 Simulation Logic
 */
import { state, emit } from './state.js';

// Constants
export const BASIS_RECT = 0; // + cross
export const BASIS_DIAG = 1; // x diagonal

export function generateRandomBitString(length) {
    return Array.from({length}, () => Math.random() < 0.5 ? 0 : 1);
}

export function generateRandomBases(length) {
    return Array.from({length}, () => Math.random() < 0.5 ? BASIS_RECT : BASIS_DIAG);
}

/**
 * Alice prepares quantum states based on bits and bases
 * Rectilinear: 0 -> 0°, 1 -> 90°
 * Diagonal: 0 -> 45°, 1 -> 135°
 */
export function alicePrepare() {
    if (state.aliceManualMode) {
        // Parse manual strings
        const bits = state.aliceManualBits.split('').map(b => parseInt(b) || 0);
        const bases = state.aliceManualBases.split('').map(b => b === 'x' ? BASIS_DIAG : BASIS_RECT);
        
        // Ensure they match length and sync numBits
        const commonLen = Math.min(bits.length, bases.length);
        state.alice.bits = bits.slice(0, commonLen);
        state.alice.bases = bases.slice(0, commonLen);
        state.numBits = commonLen;
    } else {
        // Standard random generation
        state.alice.bits = generateRandomBitString(state.numBits);
        state.alice.bases = generateRandomBases(state.numBits);
    }
    
    // Derived polarization angles for rendering intuition
    state.alice.photons = state.alice.bits.map((bit, i) => {
        let basis = state.alice.bases[i];
        if (basis === BASIS_RECT) return bit === 0 ? 0 : 90;
        else return bit === 0 ? 45 : 135;
    });
    
    emit('alicePrepared', state.alice);
}

/**
 * Simulates a quantum measurement given a photon's prepared state and a measurement basis
 */
function measurePhoton(preparedBit, preparedBasis, measurementBasis) {
    if (preparedBasis === measurementBasis) {
        // Deterministic: basis match
        return preparedBit;
    } else {
        // Probabilistic collapse: basis mismatch
        return Math.random() < 0.5 ? 0 : 1;
    }
}

/**
 * Run transmission across the channel.
 * Eve intercepts if active. Bob measures.
 */
export function transmitAndMeasure() {
    if (state.bobManualMode) {
        state.bob.bases = state.bobManualBases.split('').map(b => b === 'x' ? BASIS_DIAG : BASIS_RECT);
        // Pad with random if manual is shorter
        if (state.bob.bases.length < state.numBits) {
             const extra = generateRandomBases(state.numBits - state.bob.bases.length);
             state.bob.bases = [...state.bob.bases, ...extra];
        }
        state.bob.bases = state.bob.bases.slice(0, state.numBits);
    } else {
        state.bob.bases = generateRandomBases(state.numBits);
    }
    
    state.bob.measurements = [];
    
    if (state.eveActive) {
        state.eve.bases = generateRandomBases(state.numBits);
        state.eve.measurements = [];
    }

    for (let i = 0; i < state.numBits; i++) {
        let currentBit = state.alice.bits[i];
        let currentBasis = state.alice.bases[i];
        
        // Eve intercepts and measures (forces collapse!)
        if (state.eveActive) {
            let eveBasis = state.eve.bases[i];
            let eveResult = measurePhoton(currentBit, currentBasis, eveBasis);
            state.eve.measurements.push(eveResult);
            
            // Eve *resends* what she measured in HER basis. 
            // The photon state collapses to Eve's basis.
            currentBit = eveResult;
            currentBasis = eveBasis; 
        }
        
        // Bob measures what he receives
        let bobBasis = state.bob.bases[i];
        let bobResult = measurePhoton(currentBit, currentBasis, bobBasis);
        
        // Implements Stage 3 Noise feature (Natural error rate)
        if(Math.random() < state.noiseLevel) {
            bobResult = bobResult === 0 ? 1 : 0;
        }
        
        state.bob.measurements.push(bobResult);
    }
    
    emit('measurementComplete', { bob: state.bob, eve: state.eve });
}

/**
 * Perform basis sifting over public channel
 */
export function performSifting() {
    state.matches = [];
    state.siftedKeyA = [];
    state.siftedKeyB = [];
    state.errors = [];
    
    for (let i = 0; i < state.numBits; i++) {
        // Alice and Bob compare bases publicly
        if (state.alice.bases[i] === state.bob.bases[i]) {
            state.matches.push(i);
            state.siftedKeyA.push(state.alice.bits[i]);
            state.siftedKeyB.push(state.bob.measurements[i]);
            
            // Log discrepancy caused by Eve or noise
            if (state.alice.bits[i] !== state.bob.measurements[i]) {
                state.errors.push(state.siftedKeyA.length - 1); // Index in sifted key
            }
        }
    }
    
    // Calculate QBER
    state.qber = state.siftedKeyA.length > 0 
        ? state.errors.length / state.siftedKeyA.length 
        : 0;
        
    emit('siftingComplete', { matches: state.matches, qber: state.qber });
}
