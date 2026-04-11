/**
 * stage_engine_utils.js - Ported cryptographic utilities for BB84 Post-Processing
 * Ported from backend/lib/crypto_engine.py to remove Python dependency.
 */

/**
 * Generates an n x m Toeplitz matrix from a seed array of length n + m - 1.
 * @param {Array<number>} seed - Binary seed array
 * @param {number} n - Output rows (compressed length)
 * @param {number} m - Output columns (original length)
 * @returns {Array<Array<number>>} n x m binary matrix
 */
export function generateToeplitzMatrix(seed, n, m) {
    if (seed.length < n + m - 1) {
        throw new Error(`Seed must be at least length n + m - 1 (${n + m - 1}). Got ${seed.length}`);
    }

    const T = [];
    for (let i = 0; i < n; i++) {
        const row = [];
        for (let j = 0; j < m; j++) {
            // T[i, j] = seed[i - j + m - 1]
            row.push(seed[i - j + m - 1]);
        }
        T.push(row);
    }
    return T;
}

/**
 * Applies Toeplitz hashing (Matrix-Vector multiplication modulo 2).
 * @param {Array<number>} key - Original binary key vector
 * @param {Array<Array<number>>} T - Toeplitz matrix (n x m)
 * @returns {Array<number>} Compressed binary key (length n)
 */
export function applyToeplitzHashing(key, T) {
    const result = [];
    const n = T.length;
    const m = T[0].length;

    for (let i = 0; i < n; i++) {
        let bit = 0;
        for (let j = 0; j < m; j++) {
            // Sum(T[i,j] * key[j]) mod 2
            bit ^= (T[i][j] & key[j]);
        }
        result.push(bit);
    }
    return result;
}
