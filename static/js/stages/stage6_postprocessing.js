/**
 * stage6_postprocessing.js - Logic for Error Correction & Privacy Amplification
 */
import { state, emit, subscribe } from '../state.js';
import { generateToeplitzMatrix, applyToeplitzHashing } from './stage_engine_utils.js';

let useLDPC = false;
let cascadeBlocks = [];
const BLOCK_SIZE = 4;

export function initStage6() {
    const toggle = document.getElementById('ec-protocol-toggle');
    const label = document.getElementById('ec-protocol-label');
    const descCascade = document.getElementById('ec-cascade-desc');
    const descLdpc = document.getElementById('ec-ldpc-desc');
    const btnEc = document.getElementById('btn-run-ec');
    const logEc = document.getElementById('ec-log');
    const btnPa = document.getElementById('btn-run-pa');

    const uiCascade = document.getElementById('cascade-interactive-ui');
    const uiBlocks = document.getElementById('cascade-blocks');

    // Dashboard Metrics
    const ppInputMetric = document.getElementById('pp-input-bits');
    const ppCorrectionMetric = document.getElementById('pp-correction-removed');
    const ppPrivacyMetric = document.getElementById('pp-privacy-removed');
    const ppFinalMetric = document.getElementById('pp-final-secret');

    if (toggle) {
        toggle.addEventListener('change', (e) => {
            useLDPC = e.target.checked;
            if (label) label.textContent = useLDPC ? 'Mode: LDPC (Syndrome Decoding)' : 'Mode: Cascade Protocol';
            if (descCascade) descCascade.style.display = useLDPC ? 'none' : 'block';
            if (descLdpc) descLdpc.style.display = useLDPC ? 'block' : 'none';
        });
    }

    if (btnEc) {
        btnEc.addEventListener('click', () => {
            if (state.workingKeyA.length === 0) {
                logEc.innerHTML = '<span style="color:var(--danger-red)">> Error: No working key available. Please complete Stage 5 first.</span>';
                return;
            }

            btnEc.disabled = true;

            // Set the input-bits dashboard card immediately when EC starts
            if (ppInputMetric) ppInputMetric.textContent = state.workingKeyA.length;

            if (useLDPC) {
                runLDPCAnimation(logEc, btnPa);
            } else {
                runCascadeBisectionAnimation(logEc, btnPa, uiCascade, uiBlocks);
            }
        });
    }

    // Note: btnCascadeStep handled inside CascadeProtocolHandler via transport controls

    if (btnPa) {
        btnPa.addEventListener('click', () => {
            if (state.workingKeyA.length === 0) return;

            btnPa.disabled = true;
            btnPa.textContent = 'Processing...';

            // Show UI
            const visualContainer = document.getElementById('pa-visual-container');
            if (visualContainer) visualContainer.style.display = 'flex';

            startPrivacyAmplificationAnimation(() => {
                btnPa.textContent = 'Amplification Complete';
                logEc.innerHTML += `<span style="color:var(--safe-green)">> Post-Processing Fully Complete.</span><br>`;

                // Update Final Metrics
                const removedInPA = state.bitsRemovedInPA || 0;
                const finalLen = state.finalSecretKey?.length || 0;
                const inputLen = state.workingKeyB?.length || 0;

                if (ppPrivacyMetric) ppPrivacyMetric.textContent = removedInPA;
                if (ppFinalMetric) ppFinalMetric.textContent = finalLen;

                // Update compression-factor subtext if the span exists
                const compressionEl = document.getElementById('pp-compression-factor');
                if (compressionEl && inputLen > 0) {
                    const ratio = ((finalLen / (inputLen + removedInPA)) * 100).toFixed(1);
                    compressionEl.textContent = `${ratio}% retained`;
                }

                emit('postProcessingComplete', state.finalSecretKey);
            });
        });
    }

    subscribe('protocolReset', () => {
        if (logEc) logEc.innerHTML = '';
        if (btnEc) {
            btnEc.disabled = false;
            btnEc.textContent = 'Start Error Correction';
        }
        if (btnPa) {
            btnPa.disabled = true;
            btnPa.textContent = 'Run Privacy Amplification';
            btnPa.style.background = 'var(--accent-neon-cyan)';
        }

        // Reset Dashboard
        if (ppInputMetric) ppInputMetric.textContent = '0';
        if (ppCorrectionMetric) ppCorrectionMetric.textContent = '0';
        if (ppPrivacyMetric) ppPrivacyMetric.textContent = '0';
        if (ppFinalMetric) ppFinalMetric.textContent = '0';
        const compressionEl = document.getElementById('pp-compression-factor');
        if (compressionEl) compressionEl.textContent = '';

        // Hide/Clear Animations
        const visualizer = document.getElementById('cascade-visualizer');
        const historyPanel = document.getElementById('cascade-history-panel');
        const uiCascade = document.getElementById('cascade-interactive-ui');
        const paVisualContainer = document.getElementById('pa-visual-container');

        if (visualizer) visualizer.style.display = 'none';
        if (historyPanel) historyPanel.style.display = 'none';
        if (uiCascade) uiCascade.style.display = 'none';
        if (paVisualContainer) paVisualContainer.style.display = 'none';

        const auditPa = document.getElementById('audit-stage-6-pa');
        if (auditPa) auditPa.remove();

        // Syndrome Reset
        const syndromeVal = document.getElementById('ldpc-syndrome-val');
        if (syndromeVal) {
            syndromeVal.textContent = '[?, ?, ?]';
            syndromeVal.style.color = 'var(--danger-red)';
        }
    });

    subscribe('stageChanged', (stageId) => {
        if (stageId === 'stage-6') {
            // Populate Input Bits Metric from Stage 5 results
            if (ppInputMetric) ppInputMetric.textContent = state.workingKeyA.length;
        }
    });
}

/**
 * Cascade Protocol Handler — Brassard & Salvail 1993
 *
 * Architecture: Two-phase design
 *   Phase 1 (Computation): Pure logic runs on a working copy of keyB.
 *                          Generates an ordered list of "events" (shuffle, scan, bisect, flip, backtrack).
 *   Phase 2 (Visualization): Events are replayed as DOM snapshots for step-by-step playback.
 */
class CascadeProtocolHandler {
    constructor(log, btnPa) {
        this.log = log;
        this.btnPa = btnPa;

        // UI elements
        this.visualizer = document.getElementById('cascade-visualizer');
        this.bisectArea = document.getElementById('cascade-bisect-area');
        this.statusTag = document.getElementById('cascade-status-tag');
        this.historyItems = document.getElementById('cascade-history-items');
        this.blocksGrid = document.getElementById('cascade-blocks');
        this.shuffleTracker = document.getElementById('cascade-shuffle-tracker');
        this.shuffleOverlayText = document.getElementById('shuffle-overlay-text');
        this.shuffleBitsContainer = document.getElementById('shuffle-bits-container');

        this.keyLen = state.workingKeyA.length;
        this.initialKeyA = [...state.workingKeyA]; // Snapshot for UI playback

        // Playback state
        this.snapshots = [];
        this.currentStep = 0;
        this.isPlaying = false;
        this.playInterval = null;
        this.passes = 4;

        // Bind transport controls
        this.btnPrev = document.getElementById('btn-cascade-prev');
        this.btnPlay = document.getElementById('btn-cascade-play');
        this.btnNext = document.getElementById('btn-cascade-next');
        this.btnFF = document.getElementById('btn-cascade-ff');

        if (this.btnPrev) this.btnPrev.addEventListener('click', () => { this.pauseAuto(); this.navigateStep(-1); });
        if (this.btnPlay) this.btnPlay.addEventListener('click', () => this.toggleAutoPlay());
        if (this.btnNext) this.btnNext.addEventListener('click', () => { this.pauseAuto(); this.navigateStep(1); });
        if (this.btnFF) this.btnFF.addEventListener('click', () => { this.pauseAuto(); this.fastForward(); });
    }

    // Safety check for UI elements
    updateUI(element, content, isHTML = false) {
        if (!element) return;
        if (isHTML) element.innerHTML = content;
        else element.textContent = content;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 1: PURE COMPUTATION
    // Operates on `workingKey` (a mutable copy of Bob's key).
    // Produces `this.events[]` — an ordered log of every algorithmic step.
    // ─────────────────────────────────────────────────────────────────────────

    runComputation() {
        const keyA = state.workingKeyA; // Alice's key — reference only, never modified
        const keyB = [...state.workingKeyB]; // Working mutable copy of Bob's key
        const n = keyA.length;
        const Q = Math.max(state.qber || 0.05, 0.01);
        // Force larger blocks for visual UI limits to prevent massive purges
        const k1 = n <= 64 ? 8 : Math.max(4, Math.floor(0.73 / Q));

        const events = [];   // Ordered event log
        const permutations = []; // permutations[i] = index array for pass i+1
        const correctedSet = new Set(); // global indices corrected so far
        let parityLeak = 0; // Tracks total parity bits shared
        const bitExposure = new Array(n).fill(0); // Tracks how many times each bit was 'checked'

        // Fisher-Yates shuffle
        const shuffle = (len) => {
            const arr = Array.from({ length: len }, (_, i) => i);
            for (let i = len - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        };

        // Parity of a set of indices into keyB
        const parityB = (indices) => indices.reduce((p, i) => p ^ keyB[i], 0);
        const parityA = (indices) => indices.reduce((p, i) => p ^ keyA[i], 0);

        // Binary bisection — finds ONE error in `indices` (guaranteed odd-error block)
        // Returns the global index of the found error.
        const binary = (indices, passIdx) => {
            let lo = 0, hi = indices.length - 1;
            const steps = [];
            while (lo < hi) {
                const mid = Math.floor((lo + hi) / 2);
                const left = indices.slice(lo, mid + 1);
                const right = indices.slice(mid + 1, hi + 1);
                const pL_A = parityA(left);
                const pL_B = parityB(left);
                // TRACKING: Every bit in the checked 'left' range is exposed
                left.forEach(idx => bitExposure[idx]++);

                steps.push({ lo, hi, mid, leftMismatch: (pL_A !== pL_B), snapshot: keyB.slice() });
                if (pL_A !== pL_B) { hi = mid; } else { lo = mid + 1; }
            }
            return { errorGlobalIdx: indices[lo], steps };
        };

        // Recursive backtracking — called after every bit flip
        const backtrack = (flippedGlobalIdx, fromPass) => {
            for (let j = 0; j < fromPass; j++) {
                const perm = permutations[j];
                if (!perm) continue;
                const blockSize = k1 * Math.pow(2, j);
                const posInPerm = perm.indexOf(flippedGlobalIdx);
                if (posInPerm === -1) continue;
                const blockStart = Math.floor(posInPerm / blockSize) * blockSize;
                const blockIndices = perm.slice(blockStart, blockStart + blockSize);
                const pA = parityA(blockIndices);
                const pB = parityB(blockIndices);
                const blockNum = Math.floor(posInPerm / blockSize) + 1;

                if (pA !== pB) {
                    // Exposed a hidden even-error pair — bisect recursively
                    events.push({ type: 'BACKTRACK_BISECT', pass: j + 1, blockNum, blockIndices, snapshot: keyB.slice() });
                    const { errorGlobalIdx, steps } = binary(blockIndices, j + 1);
                    parityLeak += steps.length;
                    events.push({ type: 'BISECT_STEPS', pass: j + 1, blockIndices, steps });

                    // Flip the bit
                    const oldVal = keyB[errorGlobalIdx];
                    keyB[errorGlobalIdx] = keyA[errorGlobalIdx];
                    correctedSet.add(errorGlobalIdx);
                    events.push({ type: 'FLIP', pass: j + 1, globalIdx: errorGlobalIdx, oldVal, newVal: keyB[errorGlobalIdx], snapshot: keyB.slice(), correctedSet: new Set(correctedSet), source: 'BACKTRACK' });

                    // Recurse: this flip may expose more hidden errors in earlier passes
                    backtrack(errorGlobalIdx, j + 1);
                } else {
                    events.push({ type: 'BACKTRACK_OK', pass: j + 1, blockNum, blockIndices });
                }
            }
        };

        // Pass 1: identity permutation; Passes 2+: random permutations
        let totalPasses = n <= 64 ? 2 : 4;
        for (let p = 0; p < totalPasses; p++) {
            const perm = p === 0 ? Array.from({ length: n }, (_, i) => i) : shuffle(n);
            permutations.push(perm);
            const passNum = p + 1;
            const blockSize = k1 * Math.pow(2, p);

            // Build blocks
            const blocks = [];
            for (let offset = 0; offset < n; offset += blockSize) {
                const indices = perm.slice(offset, offset + blockSize);
                blocks.push({ indices, parityA: parityA(indices), parityB: parityB(indices) });
            }

            // Shuffle event
            if (p > 0) {
                events.push({ type: 'SHUFFLE', fromPass: passNum - 1, toPass: passNum, perm, snapshot: keyB.slice() });
            }

            events.push({ type: 'PASS_START', pass: passNum, blockSize, blocks: blocks.map(b => ({ ...b })), snapshot: keyB.slice() });
            parityLeak += blocks.length; // Pass scan reveals 1 parity per block

            // TRACKING: Every bit in every block is exposed during initial scan
            perm.forEach(idx => bitExposure[idx]++);

            // Scan for mismatch blocks
            for (let bi = 0; bi < blocks.length; bi++) {
                const blk = blocks[bi];
                blk.parityB = parityB(blk.indices); // Recompute live
                if (blk.parityA === blk.parityB) continue; // No error (or even errors)

                events.push({ type: 'BISECT_START', pass: passNum, blockNum: bi + 1, blockIndices: blk.indices, snapshot: keyB.slice() });

                const { errorGlobalIdx, steps } = binary(blk.indices, passNum);
                parityLeak += steps.length; // Each bisection step is 1 parity check
                events.push({ type: 'BISECT_STEPS', pass: passNum, blockIndices: blk.indices, steps });

                // Flip
                const oldVal = keyB[errorGlobalIdx];
                keyB[errorGlobalIdx] = keyA[errorGlobalIdx];
                correctedSet.add(errorGlobalIdx);
                events.push({ type: 'FLIP', pass: passNum, globalIdx: errorGlobalIdx, oldVal, newVal: keyB[errorGlobalIdx], snapshot: keyB.slice(), correctedSet: new Set(correctedSet), source: 'FORWARD' });

                // Cascade backtracking to earlier passes
                if (passNum > 1) {
                    backtrack(errorGlobalIdx, passNum - 1);
                }
            }

            // After all 4 passes, extend if keys still differ
            if (p === totalPasses - 1 && keyA.join('') !== keyB.join('')) {
                totalPasses++;
                if (totalPasses > 8) {
                    events.push({ type: 'MAX_PASSES_REACHED', snapshot: keyB.slice() });
                    break;
                }
                permutations.push(shuffle(n)); // Pre-generate next pass perm
            }
        }

        // --- SECURITY PURGE: Discard bits to account for the leaked information ---
        // --- SECURITY PURGE: Discard bits to account for the leaked information ---
        const originalLen = keyB.length;

        // Demo concession: Cap the leak at 25% for small keys to preserve the UI
        let effectiveLeak = parityLeak;
        if (originalLen <= 64) {
            effectiveLeak = Math.min(parityLeak, Math.floor(originalLen * 0.25));
        }

        const safeLen = Math.max(1, originalLen - effectiveLeak);

        // Target the bits with the highest exposure
        const rankedIndices = Array.from({ length: originalLen }, (_, i) => i)
            .sort((a, b) => bitExposure[b] - bitExposure[a]);

        const purgedIndicesSet = new Set(rankedIndices.slice(0, effectiveLeak));

        this.bitsRemovedInEC = effectiveLeak;
        state.bitsRemovedInEC = effectiveLeak;
        const ppCorrectionMetric = document.getElementById('pp-correction-removed');
        if (ppCorrectionMetric) ppCorrectionMetric.textContent = effectiveLeak;

        events.push({
            type: 'SECURITY_PURGE',
            leakage: effectiveLeak, // Ensure the event logs the capped leak
            originalLen: originalLen,
            safeLen: safeLen,
            purgedIndices: Array.from(purgedIndicesSet),
            snapshotBefore: keyB.slice()
        });

        // Construct the new keys by filtering out the purged indices (maintaining original order)
        const purgedKeyB = [];
        const purgedKeyA = [];
        for (let i = 0; i < originalLen; i++) {
            if (!purgedIndicesSet.has(i)) {
                purgedKeyB.push(keyB[i]);
                purgedKeyA.push(keyA[i]);
            }
        }

        keyB.length = 0;
        purgedKeyB.forEach(b => keyB.push(b));

        events.push({ type: 'DONE', snapshot: keyB.slice(), correctedSet: new Set(correctedSet), totalErrors: correctedSet.size, finalLen: safeLen });

        // Commit the final corrected keys to state (Both Alice and Bob must discard leaked bits)
        state.workingKeyA = [...purgedKeyA];
        state.workingKeyB = [...keyB];
        state.reconciledKeyA = [...keyB]; // Update for dashboard
        state.reconciledKeyB = [...keyB]; // Update for dashboard
        state.errorsCorrected = correctedSet.size;

        return { events, correctedSet, finalKeyB: keyB };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 2: BUILD DOM SNAPSHOTS FROM EVENTS
    // ─────────────────────────────────────────────────────────────────────────

    buildSnapshots(events, correctedSet) {
        // Reset all DOM to baseline
        this.snapshots = [];
        this.historyHtml = '';
        this.logHtml = `> Cascade Protocol: pure computation complete, replaying ${events.length} events...<br>`;
        this.passes = 4;

        let currentBlocksHtml = '';
        let bisectHtml = '';
        let currentPass = 1;

        const saveSnap = (label, keyB, statusText, statusBg, statusColor, showUi, shuffleDisp, shuffleHtml) => {
            // Update pass tabs HTML
            let tabsHtml = '';
            const tabsCont = document.querySelector('.cascade-iteration-tabs');
            // We'll just update class states at render time, so no need to snapshot HTML

            this.snapshots.push({
                label, statusText, statusBg, statusColor,
                pass: currentPass,
                bisectAreaHtml: bisectHtml,
                blocksContainerHtml: currentBlocksHtml,
                historyItemsHtml: this.historyHtml,
                logHtml: this.logHtml,
                shuffleTrackerDisplay: shuffleDisp || 'none',
                shuffleTrackerHtml: shuffleHtml || '',
                interactiveUiDisplay: showUi ? 'block' : 'none',
                workingKeyB: [...keyB]
            });
        };

        const renderBlocksHtml = (blockDefs, liveKey) => {
            const keyA = this.initialKeyA;
            return blockDefs.map((blk, i) => {
                const liveBitsB = blk.indices.map(idx => liveKey[idx]).join('');
                const liveBitsA = blk.indices.map(idx => keyA[idx]).join('');
                const liveP_B = blk.indices.map(idx => liveKey[idx]).reduce((a, b) => a ^ b, 0);
                const hasErr = liveP_B !== blk.parityA;
                return `<div class="cascade-block ${hasErr ? 'has-error' : ''}">
                    <header>BLOCK ${i + 1}</header>
                    <div class="bits" style="display:flex;flex-direction:column;font-size:0.8rem;gap:2px;word-break:break-all;overflow-wrap:anywhere;">
                        <div><span style="color:var(--accent-neon-blue);font-weight:bold;">A:</span> ${liveBitsA}</div>
                        <div><span style="color:var(--accent-neon-cyan);font-weight:bold;">B:</span> ${liveBitsB}</div>
                    </div>
                    <div class="parity-info" style="color:${hasErr ? 'var(--danger-red)' : 'var(--safe-green)'}">
                        P: ${liveP_B} ${hasErr ? '&ne;' : '='} ${blk.parityA}
                    </div>
                </div>`;
            }).join('');
        };

        const buildBisectStepsHtml = (blockIndices, steps, liveKey, label) => {
            let html = `<div style="display:flex;flex-direction:column;gap:8px;align-items:center;padding:20px;border:1px solid var(--border-color);border-radius:8px;background:#fcfcfc;overflow-x:auto;">
        <div style="color:var(--accent-neon-blue);font-weight:800;text-transform:uppercase;margin-bottom:15px;letter-spacing:1px;">${label}</div>`;

            // Helper: Draws the connected bit boxes
            const renderArray = (indices, snap, highlight) => {
                // If it's the final bisection step isolating 1 bit, colour it red. Otherwise yellow for active.
                const isFinalError = (indices.length === 1 && highlight);
                const bg = isFinalError ? '#e74c3c' : (highlight ? '#f1c40f' : '#fff');
                const txtColor = isFinalError ? '#fff' : '#000';

                const cells = indices.map((idx, i) => {
                    // Include index labels under the bits on the first parent block for clarity
                    const indexLabel = `<div style="position:absolute; bottom:-16px; font-size:0.5rem; color:#888;">${idx}</div>`;
                    return `<div style="position:relative; display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border:1px solid #333; margin-right:-1px; background:${bg}; color:${txtColor}; font-weight:bold; font-size:14px; font-family:monospace; z-index:1;">
                ${snap[idx]}
                ${indices.length === blockIndices.length ? indexLabel : ''} 
            </div>`;
                }).join('');
                return `<div style="display:flex; margin-bottom: 5px;">${cells}</div>`;
            };

            // Helper: Calculates parities for the annotations
            // Helper: Calculates parities for the annotations
            const getParityData = (indices, snap) => {
                const pB = indices.reduce((p, i) => p ^ snap[i], 0);

                // FIX: Use the frozen reference key, NOT the globally mutated state
                const pA = indices.reduce((p, i) => p ^ this.referenceKeyA[i], 0);

                const isMismatch = pA !== pB;
                return { pB, pA, isMismatch };
            };

            // Helpers: Render the text blocks on the sides
            const renderLeftInfo = (data) => `
        <div style="font-family:monospace; font-size:0.65rem; color:#555; text-align:right; margin-right:12px; line-height:1.3;">
            <div>Current Parity = ${data.pB}</div>
            <div>Correct Parity = ${data.pA}</div>
            <div style="color:${data.isMismatch ? '#e74c3c' : '#27ae60'}; font-weight:bold;">Error Parity = ${data.isMismatch ? 'Odd' : 'Even'}</div>
        </div>`;

            const renderRightInfo = (data) => `
        <div style="font-family:monospace; font-size:0.65rem; color:#555; text-align:left; margin-left:12px; line-height:1.3;">
            <div>Current Parity = ${data.pB}</div>
            <div>Correct Parity = ${data.pA}</div>
            <div style="color:${data.isMismatch ? '#e74c3c' : '#27ae60'}; font-weight:bold;">Error Parity = ${data.isMismatch ? 'Odd' : 'Even'}</div>
        </div>`;

            steps.forEach((step, index) => {
                const leftIndices = blockIndices.slice(step.lo, step.mid + 1);
                const rightIndices = blockIndices.slice(step.mid + 1, step.hi + 1);

                // Render the top-level parent block (Only for the very first split)
                if (index === 0) {
                    const parentIndices = blockIndices.slice(step.lo, step.hi + 1);
                    const pData = getParityData(parentIndices, step.snapshot);
                    html += `<div style="display:flex; align-items:center; margin-bottom: 5px;">
                ${renderLeftInfo(pData)}
                ${renderArray(parentIndices, step.snapshot, true)}
            </div>`;
                }

                // Draw the split arrows
                html += `<div style="display:flex; justify-content:center; gap:40px; color:#aaa; font-size:1.2rem; margin-top:-5px; margin-bottom:5px;">
            <div>↙</div>
            <div>↘</div>
        </div>`;

                const leftData = getParityData(leftIndices, step.snapshot);
                const rightData = getParityData(rightIndices, step.snapshot);

                // Algorithm path logic: if left mismatched, go left. Else, go right.
                const goLeft = step.leftMismatch;

                html += `<div style="display:flex; justify-content:center; gap:30px; width:100%;">`;

                // Left Sub-Block (Ghosted if inactive)
                html += `<div style="display:flex; align-items:center; opacity: ${goLeft ? '1' : '0.25'}; filter: ${goLeft ? 'none' : 'grayscale(100%)'}; transition: all 0.3s;">
            ${renderLeftInfo(leftData)}
            ${renderArray(leftIndices, step.snapshot, goLeft)}
        </div>`;

                // Right Sub-Block (Ghosted if inactive)
                html += `<div style="display:flex; align-items:center; opacity: ${!goLeft ? '1' : '0.25'}; filter: ${!goLeft ? 'none' : 'grayscale(100%)'}; transition: all 0.3s;">
            ${renderArray(rightIndices, step.snapshot, !goLeft)}
            ${renderRightInfo(rightData)}
        </div>`;

                html += `</div>`;
            });

            html += `</div>`;
            return html;
        };
        let currentPassBlocks = [];

        // Initial snapshot
        saveSnap('Initialization', [...state.workingKeyB], 'STANDBY', 'rgba(150,73,0,0.1)', 'var(--accent-neon-blue)', false, 'none', '');

        for (const ev of events) {
            if (ev.type === 'SHUFFLE') {
                currentPass = ev.toPass;
                if (ev.toPass > this.passes) this.passes = ev.toPass;
                this.updatePassTabs();

                // Spinning shuffle frame
                const count = Math.min(ev.perm.length, 24);
                const spins = Array.from({ length: count }, () =>
                    `<div class="bit-box animated-shuffle" style="width:24px;height:24px;font-size:0.8rem;">${Math.random() > 0.5 ? 1 : 0}</div>`
                ).join('');
                const shuffleSpinHtml = `<div id="shuffle-overlay-text" style="font-weight:800;color:var(--accent-neon-blue);letter-spacing:1px;">SHUFFLING KEY FOR PASS ${ev.toPass}…</div>
                    <div id="shuffle-bits-container" style="display:flex;flex-wrap:wrap;justify-content:center;gap:5px;margin-top:15px;">${spins}</div>`;
                saveSnap(`Shuffle Pass ${ev.toPass}`, ev.snapshot, `SHUFFLING → PASS ${ev.toPass}`, 'rgba(150,73,0,0.1)', 'var(--accent-neon-blue)', false, 'flex', shuffleSpinHtml);

                // Settled permutation frame
                const settled = ev.perm.slice(0, count).map(idx =>
                    `<div class="bit-box" style="width:24px;height:24px;font-size:0.8rem;color:var(--accent-neon-blue);border-color:var(--accent-neon-blue);">${ev.snapshot[idx]}</div>`
                ).join('');
                const shuffleDoneHtml = `<div id="shuffle-overlay-text" style="font-weight:800;color:var(--safe-green);letter-spacing:1px;">PERMUTATION &pi;<sub>${ev.toPass}</sub> READY</div>
                    <div id="shuffle-bits-container" style="display:flex;flex-wrap:wrap;justify-content:center;gap:5px;margin-top:15px;">${settled}</div>`;
                saveSnap(`Permutation π${ev.toPass} Ready`, ev.snapshot, `PASS ${ev.toPass}: READY`, 'rgba(150,73,0,0.1)', 'var(--accent-neon-blue)', false, 'flex', shuffleDoneHtml);

            } else if (ev.type === 'PASS_START') {
                currentPass = ev.pass;
                if (ev.pass > this.passes) this.passes = ev.pass;
                this.updatePassTabs();
                currentPassBlocks = ev.blocks;
                currentBlocksHtml = renderBlocksHtml(ev.blocks, ev.snapshot);
                bisectHtml = `<div style="margin:15px 0 25px;padding-bottom:15px;border-bottom:1px solid var(--border-color);text-align:center;">
                    <strong style="text-transform:uppercase;font-size:0.8rem;letter-spacing:1px;">Pass ${ev.pass} — Block Size ${ev.blockSize}</strong>
                    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:5px;margin-top:10px;">
                        ${ev.snapshot.slice(0, 24).map(b => `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border:1px solid #ccc;border-radius:2px;font-family:monospace;font-size:0.7rem;">${b}</span>`).join('')}
                        ${ev.snapshot.length > 24 ? '<span style="font-family:monospace;color:var(--text-muted)">…</span>' : ''}
                    </div>
                </div>`;
                this.logHtml += `> Pass ${ev.pass}: block size ${ev.blockSize} — scanning ${ev.blocks.length} blocks…<br>`;
                saveSnap(`Pass ${ev.pass} Start`, ev.snapshot, `PASS ${ev.pass}: SCANNING`, 'rgba(150,73,0,0.1)', 'var(--accent-neon-blue)', true, 'none', '');

            } else if (ev.type === 'BISECT_START' || ev.type === 'BACKTRACK_BISECT') {
                const label = ev.type === 'BACKTRACK_BISECT'
                    ? `⤷ Backtrack: Block ${ev.blockNum} in Pass ${ev.pass}`
                    : `Bisecting Block ${ev.blockNum} in Pass ${ev.pass}`;
                this.logHtml += `<span style="color:var(--accent-neon-blue);font-size:0.8rem;">> ${label} (size ${ev.blockIndices.length})</span><br>`;
                bisectHtml = buildBisectStepsHtml(ev.blockIndices, [], ev.snapshot, label);
                currentBlocksHtml = renderBlocksHtml(currentPassBlocks, ev.snapshot);
                saveSnap(label, ev.snapshot, `PASS ${ev.pass}: BISECTING`, 'rgba(150,73,0,0.1)', 'var(--accent-neon-blue)', true, 'none', '');

            } else if (ev.type === 'BISECT_STEPS') {
                // Build progressive bisect step snapshots
                const label = `Bisecting (Pass ${ev.pass})`;
                for (let s = 1; s <= ev.steps.length; s++) {
                    const stepsHtml = buildBisectStepsHtml(ev.blockIndices, ev.steps.slice(0, s), ev.steps[0].snapshot, label);
                    bisectHtml = stepsHtml;
                    saveSnap(`Bisect step ${s}/${ev.steps.length}`, ev.steps[0].snapshot, `PASS ${ev.pass}: BISECTING`, 'rgba(150,73,0,0.1)', 'var(--accent-neon-blue)', true, 'none', '');
                }

            } else if (ev.type === 'FLIP') {
                const tag = ev.source === 'BACKTRACK' ? 'BACKTRACK' : `Pass ${ev.pass}`;
                this.logHtml += `<span style="color:var(--safe-green);">> ERROR LOCATED: BIT ${ev.globalIdx} FLIPPED (${ev.oldVal} → ${ev.newVal}) [${tag}]</span><br>`;
                this.historyHtml += `<div class="history-item">
                    <div style="font-weight:800;color:var(--danger-red);font-size:0.75rem;">ERROR LOCATED</div>
                    <div style="font-family:monospace;font-size:0.85rem;">BIT ${ev.globalIdx} FLIPPED: ${ev.oldVal} → ${ev.newVal}</div>
                    <div style="text-align:right;font-size:0.7rem;color:var(--safe-green);font-weight:800;">CORRECTED ✓</div>
                </div>`;

                // Add "ERROR LOCATED" box at end of bisect
                bisectHtml += `<div class="bisect-box fixing" style="margin:10px auto;">
                    <small style="color:var(--danger-red);font-weight:bold;">ERROR LOCATED:</small>
                    Bit ${ev.globalIdx} flipped
                </div>`;

                // Rerender blocks with updated key
                currentBlocksHtml = renderBlocksHtml(currentPassBlocks, ev.snapshot);
                saveSnap(`BIT ${ev.globalIdx} FLIPPED`, ev.snapshot, `PASS ${ev.pass}: ERROR LOCATED`, 'rgba(192,57,43,0.1)', 'var(--danger-red)', true, 'none', '');

            } else if (ev.type === 'BACKTRACK_OK') {
                this.logHtml += `<span style="color:var(--text-muted);font-size:0.75rem;">&nbsp;&nbsp;↳ Block ${ev.blockNum} Pass ${ev.pass}: parity OK.</span><br>`;

            } else if (ev.type === 'MAX_PASSES_REACHED') {
                this.logHtml += `<span style="color:var(--danger-red);">> Max 8 passes reached. Residual errors likely too sparse to detect (even-count blocks).</span><br>`;
                saveSnap('Max Passes Reached', ev.snapshot, 'MAX PASSES REACHED', 'rgba(192,57,43,0.1)', 'var(--danger-red)', true, 'none', '');

            } else if (ev.type === 'SECURITY_PURGE') {
                this.logHtml += `<br><span style="color:var(--danger-red); font-weight:800;">[SECURITY ALERT] Targeted Parity Information Leak Detected</span><br>`;
                this.logHtml += `<span style="color:var(--text-muted); font-size:0.85rem;">Bits involved in numerous parity checks are now "tainted." To restore secrecy, we are rejecting the <b>${ev.leakage} most-exposed bits</b>.</span><br>`;

                const purgedSet = new Set(ev.purgedIndices);
                const purgeVis = ev.snapshotBefore.map((bit, idx) => {
                    const isLeaked = purgedSet.has(idx);
                    return `<span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; margin:2px; border:1px solid ${isLeaked ? 'var(--danger-red)' : '#ccc'}; border-radius:3px; background:${isLeaked ? 'rgba(192,57,43,0.1)' : '#fff'}; color:${isLeaked ? 'var(--danger-red)' : '#333'}; font-family:monospace; font-size:0.75rem; text-decoration: ${isLeaked ? 'line-through' : 'none'}; opacity: ${isLeaked ? '0.5' : '1'};">${bit}</span>`;
                }).join('');

                bisectHtml = `<div style="margin:25px 0; padding:15px; border:2px solid var(--danger-red); border-radius:6px; background: rgba(192,57,43,0.02); text-align:center;">
                    <strong style="color:var(--danger-red); text-transform:uppercase; font-size:1rem; letter-spacing:1px; display:block; margin-bottom:5px;">! Targeted Security Purge</strong>
                    <small style="color:var(--text-muted); font-size:0.7rem; display:block; margin-bottom:12px;">Discarding ${ev.leakage} bits that Alice and Bob publicly checked most often.</small>
                    <div style="display:flex; flex-wrap:wrap; justify-content:center; max-width:600px; margin:0 auto;">
                        ${purgeVis}
                    </div>
                </div>
                
                <div class="bit-audit-card" style="margin-top:20px; border-top-color: var(--danger-red);">
                    <div class="audit-header" style="color:var(--danger-red);">STAGE 6: SECRECY ADJUSTMENT (CASCADE)</div>
                    <div class="audit-row"><span>Corrected Bits Entering:</span> <span class="audit-val">${ev.originalLen}</span></div>
                    <div class="audit-row"><span>Bits Removed (Tainted/Leaked):</span> <span class="audit-val removed">-${ev.leakage}</span></div>
                    <div class="audit-row highlight"><span style="color:var(--danger-red)">Remaining Safe Bits:</span> <span class="audit-val" style="color:var(--danger-red)">${ev.safeLen}</span></div>
                </div>`;
                saveSnap('Security Purge', ev.snapshotBefore, 'SECURITY PURGE', 'rgba(192,57,43,0.1)', 'var(--danger-red)', true, 'none', '');

            } else if (ev.type === 'DONE') {
                const finalKeyVis = ev.snapshot.map((bit, idx) => {
                    const isCorrected = ev.correctedSet.has(idx);
                    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin:2px;border:1px solid ${isCorrected ? '#2e7d32' : '#ccc'};border-radius:3px;background:${isCorrected ? 'rgba(46,125,50,0.15)' : '#fff'};color:${isCorrected ? '#2e7d32' : '#333'};font-family:monospace;font-size:0.75rem;font-weight:${isCorrected ? '800' : '400'};">${bit}</span>`;
                }).join('');

                const keyMatch = state.workingKeyA.join('') === ev.snapshot.join('');
                bisectHtml = `<div style="margin:25px 0;padding:15px;border:2px solid var(--safe-green);border-radius:6px;background:rgba(46,125,50,0.02);text-align:center;">
                    <strong style="color:var(--safe-green);text-transform:uppercase;font-size:1rem;letter-spacing:1px;display:block;margin-bottom:5px;">✓ Final Corrected Key</strong>
                    <small style="color:var(--text-muted);font-size:0.7rem;display:block;margin-bottom:12px;">Green = corrected by Cascade (${ev.totalErrors} bits) — ${keyMatch ? 'Keys fully match Alice ✓' : 'Note: high QBER may leave residual errors'}</small>
                    <div style="display:flex;flex-wrap:wrap;justify-content:center;max-width:600px;margin:0 auto;">${finalKeyVis}</div>
                </div>`;
                this.logHtml += `<br><span style="color:var(--safe-green);">> Cascade complete. ${ev.totalErrors} bits corrected. ${keyMatch ? 'Keys fully reconciled! ✓' : 'Best-effort reconciliation.'}</span><br>`;
                saveSnap('Reconciliation Complete', ev.snapshot, 'RECONCILIATION COMPLETE', 'rgba(46,125,50,0.2)', 'var(--safe-green)', true, 'none', '');
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ENTRY POINT
    // ─────────────────────────────────────────────────────────────────────────

    start() {
        // FIX: Capture an immutable reference of Alice's original key before the purge alters it
        this.referenceKeyA = [...state.workingKeyA];

        // Reset UI
        if (this.visualizer) this.visualizer.style.display = 'block';
        if (this.visualizer) this.visualizer.style.opacity = '0';
        const ctrlDiv = document.getElementById('cascade-controls');
        if (ctrlDiv) ctrlDiv.style.display = 'flex';
        if (this.bisectArea) this.bisectArea.innerHTML = '';
        if (this.historyItems) this.historyItems.innerHTML = '';
        this.log.innerHTML = '> Running Cascade computation…<br>';

        // Phase 1: Run the full protocol computation synchronously
        const { events, correctedSet } = this.runComputation();

        // Phase 2: Convert events to snapshots
        this.buildSnapshots(events, correctedSet);
        if (this.btnPa) this.btnPa.disabled = true;

        // Show first snapshot
        if (this.visualizer) this.visualizer.style.opacity = '1';
        this.renderSnapshot(0);

        // Auto-play
        this.toggleAutoPlay();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PLAYBACK & CONTROLS
    // ─────────────────────────────────────────────────────────────────────────

    renderSnapshot(index) {
        if (index < 0 || index >= this.snapshots.length) return;
        this.currentStep = index;
        const snap = this.snapshots[index];

        if (this.statusTag) {
            this.statusTag.textContent = snap.statusText;
            this.statusTag.style.background = snap.statusBg;
            this.statusTag.style.color = snap.statusColor;
        }
        if (this.bisectArea) this.bisectArea.innerHTML = snap.bisectAreaHtml;
        if (this.blocksGrid) this.blocksGrid.innerHTML = snap.blocksContainerHtml;
        if (this.historyItems) {
            this.historyItems.innerHTML = snap.historyItemsHtml;
            const panel = document.getElementById('cascade-history-panel');
            if (panel) {
                panel.style.display = snap.historyItemsHtml ? 'block' : 'none';
                panel.scrollTop = panel.scrollHeight;
            }
        }
        if (this.shuffleTracker) {
            this.shuffleTracker.innerHTML = snap.shuffleTrackerHtml;
            this.shuffleTracker.style.display = snap.shuffleTrackerDisplay;
        }
        const uiContainer = document.getElementById('cascade-interactive-ui');
        if (uiContainer) uiContainer.style.display = snap.interactiveUiDisplay;

        // Log
        this.log.innerHTML = snap.logHtml;
        this.log.scrollTop = this.log.scrollHeight;

        // Restore working key for this moment in time
        state.workingKeyB = [...snap.workingKeyB];

        // Update pass tabs
        this.updatePassTabs(snap.pass);
        this.updateControls();
    }

    updatePassTabs(activePass) {
        const active = activePass ?? this.currentStep < this.snapshots.length ? this.snapshots[this.currentStep]?.pass : 1;
        const tabsCont = document.querySelector('.cascade-iteration-tabs');
        if (!tabsCont) return;
        for (let i = 1; i <= this.passes; i++) {
            let tab = document.getElementById(`tab-pass-${i}`);
            if (!tab) {
                tab = document.createElement('div');
                tab.className = 'iteration-tab';
                tab.id = `tab-pass-${i}`;
                tab.textContent = `Pass ${i}`;
                tabsCont.appendChild(tab);
            }
            tab.classList.remove('active', 'completed');
            if (i === active) tab.classList.add('active');
            else if (i < active) tab.classList.add('completed');
        }
    }

    navigateStep(dir) {
        const newStep = Math.max(0, Math.min(this.currentStep + dir, this.snapshots.length - 1));
        this.renderSnapshot(newStep);
    }

    fastForward() { this.renderSnapshot(this.snapshots.length - 1); }

    toggleAutoPlay() {
        if (this.isPlaying) {
            this.pauseAuto();
        } else {
            this.isPlaying = true;
            this.updateControls();
            this.playInterval = setInterval(() => {
                if (this.currentStep >= this.snapshots.length - 1) {
                    this.pauseAuto();
                } else {
                    this.navigateStep(1);
                }
            }, 700);
        }
    }

    pauseAuto() {
        this.isPlaying = false;
        if (this.playInterval) clearInterval(this.playInterval);
        this.updateControls();
    }

    updateControls() {
        const atEnd = this.currentStep === this.snapshots.length - 1;
        const atStart = this.currentStep === 0;
        if (this.btnPrev) this.btnPrev.disabled = atStart;
        if (this.btnNext) this.btnNext.disabled = atEnd;
        if (this.btnFF) this.btnFF.disabled = atEnd;
        if (this.btnPlay) {
            this.btnPlay.disabled = atEnd;
            this.btnPlay.innerHTML = this.isPlaying ? '&#10074;&#10074;' : '&#9658;';
        }
        if (this.btnPa) this.btnPa.disabled = !atEnd;
    }
}

function runCascadeBisectionAnimation(log, btnPa) {
    const handler = new CascadeProtocolHandler(log, btnPa);
    handler.start();
}




/**
 * LDPC Tanner Graph Animator — Pedagogically Correct Bipartite Graph
 *
 * Layout:  Variable Nodes (circles) — TOP ROW
 *          Check Nodes   (squares)  — BOTTOM ROW
 *
 * Connections follow a real irregular LDPC parity-check matrix H where:
 *   - Each check node (row of H) checks exactly 3-4 variable nodes
 *   - Each variable node participates in exactly 2 checks (column weight 2)
 *
 * Animation phases:
 *   0 — Initialization  : draw graph, colour VNs by bit value, all CNs pending
 *   1 — Syndrome calc   : CNs light up based on XOR parity, faulty CNs go red
 *   2 — Belief prop     : animated pulses travel from CNs → VNs and back
 *   3 — Error correction: suspected error VNs flip, syndromes go green
 *   4 — Verification    : all constraints satisfied
 */
class LDPCAnimator {
    constructor(canvas, log, btnPa) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.log = log;
        this.btnPa = btnPa;
        this.narrator = document.getElementById('ldpc-narrator-text');
        this.phases = document.querySelectorAll('#ldpc-phase-tracker .phase');
        this.syndromeVal = document.getElementById('ldpc-syndrome-val');
        this.historyItems = document.getElementById('ldpc-history-items');
        this.historyPanel = document.getElementById('ldpc-history-panel');

        // ── Site-matched amber palette ──────────────────────────────────────────
        this.C = {
            bg: '#1a0d00',        // very dark warm brown — canvas bg
            grid: 'rgba(255,180,60,0.04)',
            vn_ok: '#964900',        // amber primary — correct VN
            vn_err: '#c0392b',        // danger red    — error VN
            vn_fixed: '#2e7d32',        // safe green    — corrected VN
            vn_pend: '#5a3a1a',        // dim brown     — pending VN
            cn_ok: '#2e7d32',        // green — satisfied CN
            cn_err: '#c0392b',        // red   — unsatisfied CN
            cn_pend: '#4a3000',        // dark amber — pending CN
            edge_ok: 'rgba(150,73,0,0.25)',
            edge_err: 'rgba(192,57,43,0.55)',
            edge_hi: '#c46200',
            pulse_v2c: '#c46200',       // VN→CN message
            pulse_c2v: '#f5c842',       // CN→VN belief
            text: '#ffc87a',
            textDim: 'rgba(255,200,100,0.35)',
            label_vn: '#ffaa55',
            label_cn: '#f5c842',
            white: '#ffffff',
        };

        // ── Dimensions ──────────────────────────────────────────────────────────
        this.W = 820;
        this.H = 440;
        this.canvas.width = this.W;
        this.canvas.height = this.H;

        // ── State ───────────────────────────────────────────────────────────────
        this.frame = 0;
        this.currentPhaseIdx = -1;
        this.isPaused = false;
        this.isFinished = false;
        this.hoveredNode = null;

        // ── Graph nodes & edges (set in setupGraph) ──────────────────────────
        this.VN = [];  // variable nodes
        this.CN = [];  // check nodes
        this.edges = []; // { v, c, pulses:[] }

        // ── Pulse pool ───────────────────────────────────────────────────────
        this.pulses = []; // { x,y, tx,ty, t,speed, color, size }

        this.setupGraph();
        this.initEvents();
        this.initControls();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GRAPH SETUP — Real LDPC parity structure
    // ──────────────────────────────────────────────────────────────────────────

    setupGraph() {
        let keyA = state.workingKeyA;
        let keyB = state.workingKeyB;
        let isPlaceholder = false;

        if (!keyA || keyA.length === 0) {
            keyA = [1, 0, 1, 1, 0, 1, 0, 1];
            keyB = [1, 1, 1, 0, 0, 1, 0, 1]; // errors at idx 1, 3
            isPlaceholder = true;
        }

        // Cap at 8 VNs for readability — if more bits, sample evenly
        const N = Math.min(keyA.length, 8);
        const bitsA = Array.from({ length: N }, (_, i) =>
            keyA[Math.floor(i * keyA.length / N)]);
        const bitsB = Array.from({ length: N }, (_, i) =>
            keyB[Math.floor(i * keyB.length / N)]);

        // ── Real irregular LDPC H matrix (3 check nodes, column weight 2) ──
        // Each row is a check node; 1 means that CN checks that VN.
        // Row weight ≈ N/2, col weight = 2 — both guaranteed below.
        //
        // H is built so that every VN appears in exactly 2 rows:
        //   VN0→C0,C1  VN1→C0,C2  VN2→C1,C2  VN3→C0,C1
        //   VN4→C1,C2  VN5→C0,C2  VN6→C0,C1  VN7→C1,C2
        //                   (wraps for N<8)

        const K = 3; // number of check nodes
        // Each VN is connected to exactly 2 out of 3 check nodes:
        const vnCheckMap = [
            [0, 1], [0, 2], [1, 2], [0, 1],
            [1, 2], [0, 2], [0, 1], [1, 2],
        ];

        // ── Layout ───────────────────────────────────────────────────────────
        // VNs: evenly spaced along top row
        // CNs: evenly spaced along bottom row, centred horizontally
        const padX = 80, padY = 90;
        const vnY = padY;
        const cnY = this.H - padY;
        const vnSpacing = (this.W - 2 * padX) / (N - 1 || 1);
        const cnSpacing = (this.W - 2 * padX) / (K - 1 || 1);

        for (let i = 0; i < N; i++) {
            this.VN.push({
                idx: i,
                x: padX + i * vnSpacing,
                y: vnY,
                val: bitsA[i],
                isError: bitsA[i] !== bitsB[i],
                r: 16,
                state: 'pending',  // pending | ok | err | fixed
            });
        }

        for (let j = 0; j < K; j++) {
            this.CN.push({
                idx: j,
                x: padX + j * cnSpacing,
                y: cnY,
                half: 14,
                state: 'pending',   // pending | ok | err | satisfied
                syndrome: 0,
            });
        }

        // ── Build edge list ───────────────────────────────────────────────
        for (let i = 0; i < N; i++) {
            const checks = vnCheckMap[i] || [i % K, (i + 1) % K];
            for (const j of checks) {
                // Only add if not already present (avoids duplicates at wrap)
                if (!this.edges.find(e => e.v === i && e.c === j)) {
                    this.edges.push({ v: i, c: j, pulses: [], highlighted: false });
                }
            }
        }

        // ── Compute ground-truth syndromes (parity, mod 2) ──────────────
        for (const cn of this.CN) {
            const connectedVN = this.edges
                .filter(e => e.c === cn.idx)
                .map(e => bitsA[e.v]);
            cn.syndrome = connectedVN.reduce((acc, b) => (acc + b) % 2, 0);
        }

        // ── Build H matrix display ────────────────────────────────────────
        const matrixEl = document.getElementById('ldpc-h-matrix');
        if (matrixEl) {
            let html = '';
            for (let j = 0; j < K; j++) {
                const row = [];
                for (let i = 0; i < N; i++) {
                    const has = this.edges.some(e => e.v === i && e.c === j);
                    row.push(has
                        ? `<span style="color:var(--accent-neon-blue);font-weight:800;">1</span>`
                        : `<span style="color:var(--text-muted);opacity:0.4;">0</span>`);
                }
                html += `[${row.join(' ')}]<br>`;
            }
            matrixEl.innerHTML = html;
        }

        if (isPlaceholder && this.log) {
            this.log.innerHTML += `<span style="color:var(--text-muted)">> No simulation data. Showing placeholder LDPC graph.</span><br>`;
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // EVENTS
    // ──────────────────────────────────────────────────────────────────────────

    initEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            const r = this.canvas.getBoundingClientRect();
            const mx = (e.clientX - r.left) * (this.W / r.width);
            const my = (e.clientY - r.top) * (this.H / r.height);
            this.hoveredNode = null;
            for (const v of this.VN) {
                if (Math.hypot(v.x - mx, v.y - my) < v.r + 6) {
                    this.hoveredNode = { kind: 'v', node: v }; break;
                }
            }
            if (!this.hoveredNode) {
                for (const c of this.CN) {
                    if (Math.abs(c.x - mx) < c.half + 6 && Math.abs(c.y - my) < c.half + 6) {
                        this.hoveredNode = { kind: 'c', node: c }; break;
                    }
                }
            }
        });
        this.canvas.addEventListener('mouseleave', () => { this.hoveredNode = null; });
    }

    initControls() {
        const btnPrev = document.getElementById('btn-ldpc-prev');
        const btnNext = document.getElementById('btn-ldpc-next');
        const btnPause = document.getElementById('btn-ldpc-pause');

        if (btnPrev) btnPrev.onclick = (e) => { e.preventDefault(); this.jumpToPhase(this.currentPhaseIdx - 1); };
        if (btnNext) btnNext.onclick = (e) => { e.preventDefault(); this.jumpToPhase(this.currentPhaseIdx + 1); };
        if (btnPause) btnPause.onclick = (e) => {
            e.preventDefault();
            this.isPaused = !this.isPaused;
            btnPause.textContent = this.isPaused ? '▶' : '⏸';
        };
    }

    jumpToPhase(idx) {
        if (idx < 0 || idx > 4) return;
        // Phase start frames
        const starts = [0, 60, 130, 230, 330];
        this.frame = starts[Math.min(idx, starts.length - 1)];
        if (this.frame <= 380) this.isFinished = false;
        this.pulses = [];
        this.setPhase(idx);
        this.render();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PHASE MANAGEMENT
    // ──────────────────────────────────────────────────────────────────────────

    setPhase(idx) {
        if (this.currentPhaseIdx === idx) return;
        this.currentPhaseIdx = idx;

        if (this.phases) {
            this.phases.forEach((p, i) => p.classList.toggle('active', i === idx));
        }

        const msgs = [
            'Initializing Tanner graph — all nodes pending',
            'Computing syndrome S = H·y (mod 2)',
            'Belief propagation: CNs send messages to VNs',
            'Error localization: flipping suspected bits',
            'Verification — all parity constraints satisfied',
        ];

        if (this.narrator) this.narrator.textContent = `PHASE ${idx + 1}: ${msgs[idx]}`;
        this.addHistory(`Phase ${idx + 1}: ${msgs[idx]}`);
    }

    addHistory(msg, cls = 'info') {
        if (!this.historyItems) return;
        if (this.historyPanel) this.historyPanel.style.display = 'block';
        const el = document.createElement('div');
        el.className = `ldpc-log-entry ${cls}`;
        el.textContent = `> ${msg}`;
        this.historyItems.appendChild(el);
        this.historyItems.scrollTop = this.historyItems.scrollHeight;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ANIMATION LOOP
    // ──────────────────────────────────────────────────────────────────────────

    async start() {
        this.setPhase(0);
        this.animLoop();
    }

    animLoop() {
        if (!this.isPaused) {
            const f = this.frame;

            // ── Phase 0: Initialization (f 0-59) ──────────────────────────
            if (f === 0) {
                this.setPhase(0);
                // Apply valid states to VNs
                this.VN.forEach(v => { v.state = 'pending'; });
                this.CN.forEach(c => { c.state = 'pending'; });
            }
            if (f === 30) {
                // VNs reveal their bit values
                this.VN.forEach(v => { v.state = v.isError ? 'err' : 'ok'; });
            }

            // ── Phase 1: Syndrome calculation (f 60-129) ──────────────────
            if (f === 60) {
                this.setPhase(1);
                if (this.log) this.log.innerHTML += `> Computing syndrome S = H·y (mod 2)…<br>`;
            }
            if (f >= 60 && f < 130) {
                // Progressively illuminate CNs based on syndrome
                const progress = (f - 60) / 70;
                this.CN.forEach((c, ci) => {
                    if (ci / this.CN.length <= progress) {
                        c.state = c.syndrome !== 0 ? 'err' : 'ok';
                    }
                });
            }
            if (f === 90) {
                const syndromeArr = this.CN.map(c => c.syndrome);
                const display = `[${syndromeArr.join(', ')}]`;
                if (this.syndromeVal) {
                    this.syndromeVal.textContent = display;
                    this.syndromeVal.style.color = syndromeArr.some(s => s !== 0)
                        ? 'var(--danger-red)' : 'var(--safe-green)';
                }
                if (this.log) this.log.innerHTML += `> Syndrome: ${display}<br>`;
                this.addHistory(`Syndrome S = ${display}`, syndromeArr.some(s => s !== 0) ? 'error' : 'info');
            }

            // ── Phase 2: Belief propagation (f 130-229) ───────────────────
            if (f === 130) {
                this.setPhase(2);
                if (this.log) this.log.innerHTML += `> Belief propagation: check nodes sending messages to variable nodes…<br>`;
            }
            // Spawn pulses periodically: CNs → VNs (belief messages)
            if (f >= 130 && f < 230 && f % 8 === 0) {
                for (const e of this.edges) {
                    const cn = this.CN[e.c];
                    const vn = this.VN[e.v];
                    if (cn.state === 'err') {
                        // Error CN sends belief pulse toward VN
                        this.spawnPulse(cn.x, cn.y, vn.x, vn.y, this.C.pulse_c2v, 3.5);
                    } else {
                        this.spawnPulse(cn.x, cn.y, vn.x, vn.y, this.C.pulse_v2c, 2.5);
                    }
                }
            }
            // Also VN→CN pulses (variable passback)
            if (f >= 155 && f < 230 && f % 12 === 0) {
                for (const e of this.edges) {
                    const cn = this.CN[e.c];
                    const vn = this.VN[e.v];
                    this.spawnPulse(vn.x, vn.y, cn.x, cn.y, this.C.pulse_v2c, 2.0);
                }
            }

            // ── Phase 3: Error correction (f 230-329) ─────────────────────
            if (f === 230) {
                this.setPhase(3);
                if (this.log) this.log.innerHTML += `> Localizing and correcting error bits…<br>`;
            }
            if (f === 260) {
                // Flip the error VNs
                this.VN.forEach(v => {
                    if (v.isError) {
                        v.state = 'fixed';
                        this.addHistory(`Bit ${v.idx} corrected (${v.val} → ${v.val ^ 1})`, 'info');
                        if (this.log) this.log.innerHTML +=
                            `<span style="color:var(--safe-green)">> BIT ${v.idx} FLIPPED (${v.val}→${v.val ^ 1})</span><br>`;
                    }
                });
            }

            // ── Phase 4: Verification (f 330+) ────────────────────────────
            if (f === 330) {
                this.setPhase(4);
                this.CN.forEach(c => { c.state = 'ok'; });
                if (this.syndromeVal) {
                    this.syndromeVal.textContent = `[${this.CN.map(() => 0).join(', ')}]`;
                    this.syndromeVal.style.color = 'var(--safe-green)';
                }
                if (this.log) this.log.innerHTML += `<span style="color:var(--safe-green)">> Syndrome cleared: [0,0,0] — all parity constraints satisfied.</span><br>`;
                this.addHistory('Syndrome S = [0,0,0] — all constraints satisfied.', 'success');
            }

            if (f >= 380 && !this.isFinished) {
                this.finalize();
            }

            // Tick pulses
            this.pulses = this.pulses.filter(p => p.t < 1);
            for (const p of this.pulses) p.t += p.speed / 60;

            this.render();
            if (f <= 400) this.frame++;
        }
        requestAnimationFrame(() => this.animLoop());
    }

    spawnPulse(sx, sy, tx, ty, color, speed) {
        this.pulses.push({ sx, sy, tx, ty, t: 0, speed, color });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RENDERING
    // ──────────────────────────────────────────────────────────────────────────

    render() {
        const ctx = this.ctx;
        const W = this.W, H = this.H;

        // ── Background ──────────────────────────────────────────────────────
        ctx.fillStyle = this.C.bg;
        ctx.fillRect(0, 0, W, H);

        // Subtle grid
        ctx.strokeStyle = this.C.grid;
        ctx.lineWidth = 1;
        for (let gx = 0; gx < W; gx += 40) {
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
        }
        for (let gy = 0; gy < H; gy += 40) {
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
        }

        // ── Row labels ──────────────────────────────────────────────────────
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = this.C.label_vn;
        ctx.fillText('VARIABLE NODES  v₀…vₙ', 14, 26);

        ctx.fillStyle = this.C.label_cn;
        ctx.textAlign = 'left';
        ctx.fillText('CHECK NODES  c₀…cₖ', 14, H - 18);

        // Equation
        ctx.font = 'italic bold 15px serif';
        ctx.fillStyle = 'rgba(255,180,60,0.18)';
        ctx.textAlign = 'center';
        ctx.fillText('H · v ≡ 0  (mod 2)', W / 2, H / 2);

        // ── Determine hover highlights ────────────────────────────────────
        const hovV = this.hoveredNode?.kind === 'v' ? this.hoveredNode.node.idx : null;
        const hovC = this.hoveredNode?.kind === 'c' ? this.hoveredNode.node.idx : null;

        // ── Draw edges (cubic Bezier for elegance) ───────────────────────
        for (const e of this.edges) {
            const v = this.VN[e.v];
            const c = this.CN[e.c];
            const isHi = (hovV === e.v || hovC === e.c);

            // Control points: bow outward for visual clarity
            const mx = (v.x + c.x) / 2;
            const my = (v.y + c.y) / 2;
            const bow = (e.v % 2 === 0 ? 1 : -1) * 40;
            const cp1x = mx + bow, cp1y = my;
            const cp2x = mx + bow, cp2y = my;

            ctx.beginPath();
            ctx.moveTo(v.x, v.y + v.r);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, c.x, c.y - c.half);

            if (isHi) {
                ctx.strokeStyle = this.C.edge_hi;
                ctx.lineWidth = 2.5;
                ctx.globalAlpha = 0.9;
            } else if (v.isError && this.frame > 50 && this.frame < 260) {
                ctx.strokeStyle = this.C.edge_err;
                ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.7;
            } else {
                ctx.strokeStyle = this.C.edge_ok;
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.6;
            }
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Edge label: fraction along edge for identification
            if (isHi) {
                const tx = v.x + (c.x - v.x) * 0.5;
                const ty = v.y + (c.y - v.y) * 0.5 + (bow > 0 ? -14 : 14);
                ctx.font = '9px Inter';
                ctx.fillStyle = this.C.edge_hi;
                ctx.textAlign = 'center';
                ctx.fillText(`v${e.v}↔c${e.c}`, tx, ty);
            }
        }

        // ── Draw belief-propagation pulse dots ───────────────────────────
        for (const p of this.pulses) {
            const t = this.easeInOut(p.t);
            const px = p.sx + (p.tx - p.sx) * t;
            const py = p.sy + (p.ty - p.sy) * t;

            ctx.beginPath();
            ctx.arc(px, py, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 8;
            ctx.shadowColor = p.color;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // ── Draw Variable Nodes ──────────────────────────────────────────
        for (const v of this.VN) {
            const isHiV = hovV === v.idx;
            let fillColor;
            switch (v.state) {
                case 'ok': fillColor = this.C.vn_ok; break;
                case 'err': fillColor = this.C.vn_err; break;
                case 'fixed': fillColor = this.C.vn_fixed; break;
                default: fillColor = this.C.vn_pend;
            }

            // Outer glow for hovered or error
            if (isHiV || v.state === 'err') {
                ctx.shadowBlur = isHiV ? 22 : 14;
                ctx.shadowColor = fillColor;
            }

            ctx.beginPath();
            ctx.arc(v.x, v.y, v.r, 0, Math.PI * 2);
            ctx.fillStyle = fillColor;
            ctx.fill();

            // Border ring
            ctx.strokeStyle = isHiV
                ? this.C.C?.white ?? '#fff'
                : 'rgba(255,255,255,0.15)';
            ctx.lineWidth = isHiV ? 2 : 1;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Bit value label
            ctx.fillStyle = '#fff';
            ctx.font = `bold 12px 'JetBrains Mono', monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(v.val, v.x, v.y);

            // Node index below
            ctx.fillStyle = this.C.textDim;
            ctx.font = '9px Inter, sans-serif';
            ctx.textBaseline = 'top';
            ctx.fillText(`v${v.idx}`, v.x, v.y + v.r + 4);

            // Error marker (↯) above node during error phase
            if (v.state === 'err' && this.frame >= 60 && this.frame < 260) {
                ctx.fillStyle = this.C.vn_err;
                ctx.font = 'bold 11px Inter';
                ctx.textBaseline = 'bottom';
                ctx.fillText('⚡', v.x, v.y - v.r - 2);
            }
            // Fixed marker above node
            if (v.state === 'fixed') {
                ctx.fillStyle = this.C.vn_fixed;
                ctx.font = 'bold 11px Inter';
                ctx.textBaseline = 'bottom';
                ctx.fillText('✓', v.x, v.y - v.r - 2);
            }

            ctx.textBaseline = 'alphabetic';
        }

        // ── Draw Check Nodes ─────────────────────────────────────────────
        for (const c of this.CN) {
            const isHiC = hovC === c.idx;
            let fillColor;
            switch (c.state) {
                case 'ok':
                case 'satisfied': fillColor = this.C.cn_ok; break;
                case 'err': fillColor = this.C.cn_err; break;
                default: fillColor = this.C.cn_pend;
            }

            if (isHiC || c.state === 'err') {
                ctx.shadowBlur = isHiC ? 22 : 14;
                ctx.shadowColor = fillColor;
            }

            const hs = c.half;
            // Draw square with rounded corners manually (rotateDRect)
            this._roundRect(ctx, c.x - hs, c.y - hs, hs * 2, hs * 2, 5);
            ctx.fillStyle = fillColor;
            ctx.fill();
            ctx.strokeStyle = isHiC ? '#fff' : 'rgba(255,255,255,0.1)';
            ctx.lineWidth = isHiC ? 2 : 1;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Label inside
            ctx.fillStyle = '#fff';
            ctx.font = `bold 10px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`c${c.idx}`, c.x, c.y);

            // Syndrome toggle label above
            ctx.fillStyle = c.state === 'err' ? this.C.vn_err : this.C.cn_ok;
            ctx.font = '9px Inter';
            ctx.textBaseline = 'bottom';
            ctx.fillText(
                this.frame >= 90 ? (c.syndrome !== 0 ? 'S≠0' : 'S=0') : '',
                c.x, c.y - hs - 3
            );
            ctx.textBaseline = 'alphabetic';
        }

        // ── Info overlay at bottom ───────────────────────────────────────
        const phaseNames = [
            'Init', 'Syndrome Calc', 'Belief Propagation', 'Error Correction', 'Verification'
        ];
        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,180,60,0.3)';
        ctx.textAlign = 'right';
        const pname = phaseNames[this.currentPhaseIdx] ?? '';
        ctx.fillText(`Phase ${this.currentPhaseIdx + 1}: ${pname}  |  Frame: ${this.frame}`, W - 12, H - 8);
        ctx.textAlign = 'left';
    }

    // Utility: ease in-out for pulse animation
    easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    // Utility: canvas rounded rect
    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FINALIZE
    // ──────────────────────────────────────────────────────────────────────────

    finalize() {
        if (this.isFinished) return;
        let corrected = 0;
        if (state.workingKeyA?.length > 0) {
            for (let i = 0; i < state.workingKeyB.length; i++) {
                if (state.workingKeyA[i] !== state.workingKeyB[i]) {
                    state.workingKeyB[i] = state.workingKeyA[i];
                    corrected++;
                }
            }
        }
        state.errorsCorrected = corrected;
        if (this.syndromeVal) {
            this.syndromeVal.textContent = `[${this.CN.map(() => 0).join(', ')}]`;
            this.syndromeVal.style.color = 'var(--safe-green)';
        }
        if (this.log) {
            this.log.innerHTML += `> LDPC Decoding Complete. ${corrected} bit(s) corrected. All syndromes satisfied.<br>`;
        }
        this.addHistory(`LDPC complete — ${corrected} bit(s) corrected.`, 'success');
        if (this.btnPa) this.btnPa.disabled = false;
        this.isFinished = true;
    }
}

function runLDPCAnimation(log, btnPa) {
    const canvas = document.getElementById('ldpc-tanner-canvas');
    if (!canvas) return;
    const animator = new LDPCAnimator(canvas, log, btnPa);
    animator.start();
}

function startPrivacyAmplificationAnimation(onComplete) {
    const inputVecEl = document.getElementById('pa-input-vector');
    const matrixEl = document.getElementById('pa-matrix');
    const resultVecEl = document.getElementById('pa-result-vector');
    const logEc = document.getElementById('ec-log');

    // UI elements for the Entropy Pipeline
    const pipeContainer = document.getElementById('entropy-pipeline');
    const pipeInput = document.getElementById('pipe-input-bits');
    const pipeLeakage = document.getElementById('pipe-leakage');
    const pipeFinal = document.getElementById('pipe-final-bits');
    const fillLeak = document.getElementById('fill-leakage');
    const fillFinal = document.getElementById('fill-final');
    const compRatioEl = document.getElementById('comp-ratio-val');
    const infoLossEl = document.getElementById('info-loss-val');

    const n = state.workingKeyB.length;

    // REFINED MATH: Shannon Entropy based compression
    // m = n * (1 - H(Q)) where H(Q) is the binary entropy of QBER
    const q = state.qber || 0.05;
    const hq = q > 0 ? (-q * Math.log2(q) - (1 - q) * Math.log2(1 - q)) : 0;

    // We add a safety margin (e.g. 1.2x) to account for finite key effects and LDPC residue
    const securityParameter = 1.15;
    const leakageFactor = Math.min(0.9, hq * securityParameter);
    const m = Math.max(8, Math.floor(n * (1 - leakageFactor)));

    state.leakage = (leakageFactor * 100).toFixed(1);
    state.bitsRemovedInPA = n - m;

    // Show Pipeline
    if (pipeContainer) {
        pipeContainer.style.display = 'block';
        pipeInput.textContent = n;
        pipeLeakage.textContent = `-${n - m}`;
        pipeFinal.textContent = m;

        // Animate fills
        setTimeout(() => {
            if (fillLeak) fillLeak.style.width = `${((n - m) / n) * 100}%`;
            if (fillFinal) fillFinal.style.width = `${(m / n) * 100}%`;
            if (compRatioEl) compRatioEl.textContent = `${(m / n).toFixed(2)}x`;
            if (infoLossEl) infoLossEl.textContent = `${state.leakage}%`;
        }, 100);
    }

    // Limits for visualization
    const visualN = Math.min(n, 12);
    const visualM = Math.min(m, 8);

    const seed = Array.from({ length: n + m - 1 }, () => Math.random() < 0.5 ? 1 : 0);
    const T = generateToeplitzMatrix(seed, m, n);
    const hashedKey = applyToeplitzHashing(state.workingKeyB, T);

    // Clear and build initial UI
    if (inputVecEl) {
        inputVecEl.innerHTML = '';
        for (let i = 0; i < visualN; i++) {
            const bit = document.createElement('div');
            bit.className = 'vector-bit';
            bit.textContent = state.workingKeyB[i];
            inputVecEl.appendChild(bit);
        }
        if (n > visualN) inputVecEl.innerHTML += `<div style="color:var(--text-muted); font-size: 0.8rem; margin-left: 5px;">…</div>`;
    }

    if (matrixEl) {
        matrixEl.innerHTML = '';
        matrixEl.style.gridTemplateColumns = `repeat(${visualN}, 18px)`;
        for (let r = 0; r < visualM; r++) {
            for (let c = 0; c < visualN; c++) {
                const cell = document.createElement('div');
                cell.className = 'matrix-cell';
                cell.id = `pa-cell-${r}-${c}`;
                const val = T[r][c];
                cell.textContent = val;
                if (val === 1) {
                    cell.style.color = "var(--accent-neon-blue)";
                    cell.style.fontWeight = "bold";
                } else {
                    cell.style.color = "rgba(150, 73, 0, 0.2)";
                }
                matrixEl.appendChild(cell);
            }
        }
    }

    if (resultVecEl) resultVecEl.innerHTML = '';

    state.finalSecretKey = [];
    let currentRow = 0;

    const processRow = () => {
        if (currentRow >= visualM) {
            for (let i = state.finalSecretKey.length; i < m; i++) {
                state.finalSecretKey.push(hashedKey[i]);
            }
            logEc.innerHTML += `<span style="color:var(--safe-green)">> Secrecy Capacity Restored: Keys compressed from ${n} to ${m} bits (Leakage: ${state.leakage}%).</span><br>`;

            if (onComplete) onComplete();

            const ppPrivacyMetric = document.getElementById('pp-privacy-removed');
            if (ppPrivacyMetric) ppPrivacyMetric.textContent = n - m;

            // Updated Audit Summary
            const auditId = 'audit-stage-6-pa';
            let auditEl = document.getElementById(auditId);
            if (!auditEl) {
                auditEl = document.createElement('div');
                auditEl.id = auditId;
                auditEl.className = 'bit-audit-card';
                auditEl.style.marginTop = '20px';
                auditEl.style.borderTopColor = 'var(--accent-neon-cyan)';
                logEc.appendChild(auditEl);
            }
            auditEl.innerHTML = `
                <div class="audit-header" style="color:var(--accent-neon-cyan);">STAGE 6: ENTROPY RETENTION PIPELINE</div>
                <div class="audit-row"><span>Safe Bits (Post-Error Correction):</span> <span class="audit-val">${n}</span></div>
                <div class="audit-row"><span>Estimated Information Leakage (IQ):</span> <span class="audit-val removed">${state.leakage}%</span></div>
                <div class="audit-row"><span>Privacy Purge (Hashing Loss):</span> <span class="audit-val removed">-${n - m} Bits</span></div>
                <div class="audit-row highlight" style="border-color: var(--accent-neon-cyan); color: var(--accent-neon-cyan);">
                    <span>Final Information-Theoretic Secret Key:</span> <span class="audit-val">${m} BITS</span>
                </div>
            `;
            return;
        }

        for (let c = 0; c < visualN; c++) {
            const cell = document.getElementById(`pa-cell-${currentRow}-${c}`);
            if (cell) cell.style.background = 'rgba(0, 240, 255, 0.1)';
        }

        setTimeout(() => {
            let resBit = hashedKey[currentRow];
            state.finalSecretKey.push(resBit);

            const bitEl = document.createElement('div');
            bitEl.className = 'result-bit';
            bitEl.textContent = resBit;
            bitEl.style.color = 'var(--clr-paper)';
            if (resultVecEl) resultVecEl.appendChild(bitEl);

            for (let c = 0; c < visualN; c++) {
                const cell = document.getElementById(`pa-cell-${currentRow}-${c}`);
                if (cell) cell.style.background = 'transparent';
            }

            currentRow++;
            setTimeout(processRow, 200);
        }, 300);
    };

    logEc.innerHTML += `>   rsal Hash Space (Toeplitz) to eliminate partial overlaps...<br>`;
    setTimeout(processRow, 800);
}


