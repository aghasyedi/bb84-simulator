/**
 * stage5_qber.js - Logic for QBER evaluation (Redesigned)
 */
import { state, subscribe, emit } from '../state.js';

export function initStage5() {
    const btnSample = document.getElementById('btn-sample-qber');
    const qberResultsContainer = document.getElementById('qber-results-container');
    const qberDisplay = document.getElementById('qber-display');
    const qberStatus = document.getElementById('qber-status');
    const qberBarFill = document.getElementById('qber-bar-fill');
    
    // Metrics
    const poolMetric = document.getElementById('qber-total-pool');
    const sacrificedMetric = document.getElementById('qber-sacrificed-count');
    const errorMetric = document.getElementById('qber-error-count');

    // Manual Sampling Controls
    const manualToggle = document.getElementById('manual-qber-toggle');
    const manualPanel = document.getElementById('manual-qber-panel');
    const manualContainer = document.getElementById('manual-qber-interaction');
    const countInput = document.getElementById('input-manual-sample-count');
    const counterDisplay = document.getElementById('manual-selected-counter');
    const btnAutoPick = document.getElementById('btn-random-pick-manual');
    const btnFinalizeManual = document.getElementById('btn-finalize-manual-qber');
    const btnResetManual = document.getElementById('btn-reset-manual-qber');

    let manualSampledIndices = [];

    const calculateResults = (sampledIndices) => {
        state.sampledIndices = sampledIndices;
        let errors = 0;
        
        // Ledger Lane Containers
        const lane1 = document.getElementById('audit-lane-1-bits');
        const lane2 = document.getElementById('audit-lane-2-bits');
        const lane3 = document.getElementById('audit-lane-3-bits');

        if (lane1) lane1.innerHTML = '';
        if (lane2) lane2.innerHTML = '';
        if (lane3) lane3.innerHTML = '';

        state.workingKeyA = [];
        state.workingKeyB = [];

        // 1. PHASE 1 & 2: Grid-Aligned Mapping
        for (let i = 0; i < state.siftedKeyA.length; i++) {
            const valA = state.siftedKeyA[i];
            const valB = state.siftedKeyB[i];
            const isSampled = state.sampledIndices.includes(i);
            const isMismatch = isSampled && (valA !== valB);
            if (isMismatch) errors++;

            // Render Lane 1 (Initial Pool)
            if (lane1) {
                const slot = document.createElement('div');
                slot.className = 'bit-slot';
                const bit = document.createElement('div');
                bit.className = `bit-box-classic ${isSampled ? 'sacrificed' : 'retained'}`;
                bit.textContent = valA;
                slot.appendChild(bit);
                lane1.appendChild(slot);
            }

            // Render Lane 2 (Sacrifice Operations)
            if (lane2) {
                const slot = document.createElement('div');
                slot.className = 'bit-slot';
                if (isSampled) {
                    const comp = document.createElement('div');
                    comp.className = 'bit-box-comparison';
                    comp.innerHTML = `
                        <div class="comp-part alice">${valA}</div>
                        <div class="comp-part bob">${valB}</div>
                    `;
                    if (valA !== valB) {
                        const x = document.createElement('div');
                        x.className = 'comp-mismatch';
                        x.textContent = '×';
                        slot.appendChild(x);
                    }
                    slot.appendChild(comp);
                }
                lane2.appendChild(slot);
            }

            // Populate working keys for survivor bits
            if (!isSampled) {
                state.workingKeyA.push(valA);
                state.workingKeyB.push(valB);
            }
        }

        // 2. PHASE 3: Compact Survivor Key
        if (lane3) {
            state.workingKeyA.forEach((bitVal, idx) => {
                const slot = document.createElement('div');
                slot.className = 'bit-slot';
                slot.style.border = 'none'; // Clean look for final key
                const bit = document.createElement('div');
                bit.className = 'bit-box-classic retained';
                bit.textContent = bitVal;
                slot.appendChild(bit);
                lane3.appendChild(slot);
            });
        }

        // Update Metrics
        const count = sampledIndices.length;
        state.bitsRemovedInQBER = count;
        state.qber = count > 0 ? errors / count : 0;
        
        const ledgerPoolEl = document.getElementById('qber-total-pool-ledger');
        if (ledgerPoolEl) ledgerPoolEl.textContent = state.siftedKeyA.length;

        if (sacrificedMetric) sacrificedMetric.textContent = count;
        if (errorMetric) errorMetric.textContent = errors;
        
        if (qberResultsContainer) qberResultsContainer.style.display = 'block';
        const qberPercentVal = state.qber * 100;
        if (qberDisplay) qberDisplay.textContent = qberPercentVal.toFixed(1) + '%';

        if (state.qber > state.MAX_QBER) {
            if (qberBarFill) qberBarFill.style.background = 'var(--danger-red)';
            if (qberDisplay) qberDisplay.style.color = 'var(--danger-red)';
            if (qberStatus) qberStatus.innerHTML = '<span style="color:var(--danger-red)">CRITICAL: EVE DETECTED</span>';
        } else {
            const isNoisy = state.qber > 0;
            if (qberBarFill) qberBarFill.style.background = isNoisy ? '#f59e0b' : 'var(--safe-green)';
            if (qberDisplay) qberDisplay.style.color = isNoisy ? '#f59e0b' : 'var(--safe-green)';
            if (qberStatus) qberStatus.innerHTML = isNoisy ? 
                '<span style="color:#f59e0b">NOISY: WITHIN TOLERANCE</span>' : 
                '<span style="color:var(--safe-green)">SECURE: NO ERRORS</span>';
        }

        if (qberBarFill) {
            setTimeout(() => { qberBarFill.style.width = Math.min(qberPercentVal, 100) + '%'; }, 50);
        }
        
        emit('qberCalculated', { qber: state.qber, finalLength: state.workingKeyA.length });
    };

    const updateCounter = () => {
        const count = manualSampledIndices.length;
        if (counterDisplay) counterDisplay.textContent = `${count} BIT${count === 1 ? '' : 'S'} SELECTED`;
        if (btnFinalizeManual) btnFinalizeManual.style.display = count > 0 ? 'inline-block' : 'none';
    };

    const renderManualBits = () => {
        if (!manualContainer) return;
        manualContainer.innerHTML = '';

        state.siftedKeyA.forEach((bit, i) => {
            const bx = document.createElement('div');
            bx.className = 'bit-box';
            bx.style.cssText = `
                width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
                cursor: pointer; transition: all 0.2s ease; border-radius: 6px; border: 1px solid var(--border-color);
                font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 0.8rem;
            `;
            bx.textContent = bit;

            if (manualSampledIndices.includes(i)) {
                bx.style.background = 'var(--accent-neon-violet)';
                bx.style.color = '#fff';
                bx.style.borderColor = 'var(--accent-neon-violet)';
                bx.style.transform = 'scale(1.1)';
            } else {
                bx.style.background = '#fff';
                bx.style.color = '#333';
            }

            bx.addEventListener('click', () => {
                if (manualSampledIndices.includes(i)) {
                    manualSampledIndices = manualSampledIndices.filter(idx => idx !== i);
                } else {
                    manualSampledIndices.push(i);
                }
                renderManualBits();
                updateCounter();
            });
            manualContainer.appendChild(bx);
        });
    };

    const handleAutoPick = () => {
        const targetCount = Math.min(parseInt(countInput.value) || 0, state.siftedKeyA.length);
        manualSampledIndices = [];
        let pool = Array.from({ length: state.siftedKeyA.length }, (_, i) => i);
        pool.sort(() => 0.5 - Math.random());
        manualSampledIndices = pool.slice(0, targetCount);
        renderManualBits();
        updateCounter();
    };

    if (manualToggle) {
        manualToggle.addEventListener('change', (e) => {
            const active = e.target.checked;
            if (manualPanel) manualPanel.style.display = active ? 'block' : 'none';
            if (btnSample) btnSample.disabled = active;
            if (active) renderManualBits();
        });
    }

    if (btnAutoPick) btnAutoPick.addEventListener('click', handleAutoPick);
    if (btnResetManual) btnResetManual.addEventListener('click', () => {
        manualSampledIndices = [];
        renderManualBits();
        updateCounter();
    });

    if (btnFinalizeManual) {
        btnFinalizeManual.addEventListener('click', () => {
            calculateResults(manualSampledIndices);
            btnFinalizeManual.disabled = true;
            if (manualToggle) manualToggle.disabled = true;
            if (manualContainer) manualContainer.style.pointerEvents = 'none';
        });
    }

    if (btnSample) {
        btnSample.addEventListener('click', () => {
            if (!state.siftedKeyA || state.siftedKeyA.length === 0) {
                alert("Please complete the Sifting stage first.");
                return;
            }
            const numSampleInfo = Math.max(2, Math.floor(state.siftedKeyA.length * 0.25));
            let availableIndices = Array.from({ length: state.siftedKeyA.length }, (_, i) => i);
            availableIndices.sort(() => 0.5 - Math.random());
            calculateResults(availableIndices.slice(0, numSampleInfo));
            btnSample.disabled = true;
            if (manualToggle) manualToggle.disabled = true;
        });
    }

    subscribe('stageChanged', (stageId) => {
        if (stageId === 'stage-5') {
            const hasSifted = state.siftedKeyA && state.siftedKeyA.length > 0;
            const alreadySampled = state.sampledIndices && state.sampledIndices.length > 0;
            
            if (poolMetric) poolMetric.textContent = hasSifted ? state.siftedKeyA.length : '0';
            if (btnSample) btnSample.disabled = !hasSifted || alreadySampled;
            
            if (manualToggle) {
                manualToggle.disabled = !hasSifted || alreadySampled;
                if (!alreadySampled && manualToggle.checked) renderManualBits();
            }
        }
    });

    subscribe('protocolReset', () => {
        if (qberResultsContainer) qberResultsContainer.style.display = 'none';
        if (qberDisplay) { 
            qberDisplay.textContent = '0.0%';
            qberDisplay.style.color = 'var(--accent-neon-blue)';
        }
        if (qberStatus) qberStatus.innerHTML = '';
        if (btnSample) btnSample.disabled = false;
        if (manualToggle) {
            manualToggle.disabled = false;
            manualToggle.checked = false;
            if (manualPanel) manualPanel.style.display = 'none';
        }
        if (btnFinalizeManual) {
            btnFinalizeManual.disabled = false;
            btnFinalizeManual.style.display = 'none';
        }
        manualSampledIndices = [];
        if (manualContainer) {
            manualContainer.style.pointerEvents = 'auto';
            manualContainer.innerHTML = '';
        }
        if (counterDisplay) counterDisplay.textContent = '0 BITS SELECTED';
        if (qberBarFill) {
            qberBarFill.style.width = '0%';
            qberBarFill.style.background = 'var(--safe-green)';
        }
        if (poolMetric) poolMetric.textContent = '0';
        if (sacrificedMetric) sacrificedMetric.textContent = '0';
        if (errorMetric) errorMetric.textContent = '0';
        
        const ledgerPoolEl = document.getElementById('qber-total-pool-ledger');
        if (ledgerPoolEl) ledgerPoolEl.textContent = '0';

        const l1 = document.getElementById('audit-lane-1-bits');
        const l2 = document.getElementById('audit-lane-2-bits');
        const l3 = document.getElementById('audit-lane-3-bits');
        if (l1) l1.innerHTML = '';
        if (l2) l2.innerHTML = '';
        if (l3) l3.innerHTML = '';
    });
}
