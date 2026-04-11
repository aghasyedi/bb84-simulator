/**
 * stage4_sifting.js - Logic for the Sifting Stage (Redesigned)
 */
import { state, subscribe, emit } from '../state.js';
import { performSifting, BASIS_RECT, BASIS_DIAG } from '../quantum_engine.js';

let siftingInterval = null;
let currentBitIndex = 0;
let isSiftingPaused = false;
let simulationSpeed = 1.0;

export function initStage4() {
    const btnSift = document.getElementById('btn-sift');
    const btnReset = document.getElementById('btn-sift-reset');
    const btnPlay = document.getElementById('btn-sift-play');
    const btnPause = document.getElementById('btn-sift-pause');
    const btnStep = document.getElementById('btn-sift-step');
    const btnSkip = document.getElementById('btn-sift-skip');
    const speedInput = document.getElementById('sifting-speed');
    const speedVal = document.getElementById('sifting-speed-val');
    const siftingControls = document.getElementById('sifting-controls');

    // Canvas setup
    const canvas = document.getElementById('sifting-canvas');
    let ctx = null;
    if (canvas) {
        ctx = canvas.getContext('2d');
        resizeCanvas(canvas);
        window.addEventListener('resize', () => resizeCanvas(canvas));
    }

    if (btnSift) {
        btnSift.addEventListener('click', () => {
            if (!state.alice || state.alice.bits.length === 0 || !state.bob || state.bob.measurements.length === 0) {
                alert("Please complete Stage 3 (Quantum Transmission) first.");
                return;
            }

            // Prepare state
            performSifting();

            // UI Transition
            btnSift.style.display = 'none';
            if (siftingControls) siftingControls.style.display = 'flex';
            const finalKeyDisplay = document.getElementById('sift-final-key-display');
            if (finalKeyDisplay) finalKeyDisplay.style.display = 'none';

            startSiftingSimulation(ctx);
        });
    }

    if (btnReset) {
        btnReset.addEventListener('click', resetSifting);
    }

    if (btnPause) {
        btnPause.addEventListener('click', () => {
            isSiftingPaused = true;
            btnPause.style.display = 'none';
            btnPlay.style.display = 'flex';
        });
    }

    if (btnPlay) {
        btnPlay.addEventListener('click', () => {
            isSiftingPaused = false;
            btnPause.style.display = 'flex';
            btnPlay.style.display = 'none';
            runSiftingStep(ctx);
        });
    }

    if (btnStep) {
        btnStep.addEventListener('click', () => {
            isSiftingPaused = true;
            btnPause.style.display = 'none';
            btnPlay.style.display = 'flex';
            runSiftingStep(ctx, true);
        });
    }

    if (btnSkip) {
        btnSkip.addEventListener('click', () => {
            isSiftingPaused = false;
            finishSiftingInstantly(ctx);
        });
    }

    if (speedInput) {
        speedInput.addEventListener('input', (e) => {
            simulationSpeed = parseFloat(e.target.value);
            if (speedVal) speedVal.textContent = simulationSpeed.toFixed(1) + 'x';
        });
    }

    subscribe('protocolReset', resetSifting);
}

function resizeCanvas(canvas) {
    const parent = canvas.parentElement;
    if (!parent) return;
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
}

function resetSifting() {
    clearTimeout(siftingInterval);
    currentBitIndex = 0;
    isSiftingPaused = false;

    // UI Reset
    const btnSift = document.getElementById('btn-sift');
    const siftingControls = document.getElementById('sifting-controls');
    if (btnSift) btnSift.style.display = 'block';
    if (siftingControls) siftingControls.style.display = 'none';

    const timeline = document.getElementById('sifting-timeline');
    if (timeline) {
        timeline.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; color: var(--text-muted); gap: 1rem;">
                <div style="font-size: 2rem; opacity: 0.3;">📋</div>
                <p style="font-size: 0.85rem; font-weight: 500;">Awaiting sifting protocol initialization...</p>
            </div>
        `;
    }

    const countEl = document.getElementById('sift-total-count');
    const siftedEl = document.getElementById('sift-summary-sifted');
    const removedEl = document.getElementById('sift-summary-removed');
    const effEl = document.getElementById('sift-summary-efficiency');
    const finalDisplay = document.getElementById('sift-final-key-display');

    if (countEl) countEl.textContent = '0';
    if (siftedEl) siftedEl.textContent = '0';
    if (removedEl) removedEl.textContent = '0';
    if (effEl) effEl.textContent = '0%';
    if (finalDisplay) finalDisplay.style.display = 'none';

    // Clear operators
    const aBasis = document.getElementById('alice-current-basis');
    const aBit = document.getElementById('alice-current-bit');
    const bBasis = document.getElementById('bob-current-basis');
    const bBit = document.getElementById('bob-current-bit');

    if (aBasis) aBasis.textContent = '-';
    if (aBit) aBit.textContent = '-';
    if (bBasis) bBasis.textContent = '-';
    if (bBit) bBit.textContent = '-';

    const canvas = document.getElementById('sifting-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function startSiftingSimulation(ctx) {
    currentBitIndex = 0;
    const timeline = document.getElementById('sifting-timeline');
    if (timeline) timeline.innerHTML = ''; // Clear initial message
    runSiftingStep(ctx);
}

function runSiftingStep(ctx, isSingleStep = false) {
    if (!state.alice || currentBitIndex >= state.numBits) {
        finishSifting();
        return;
    }

    if (isSiftingPaused && !isSingleStep) return;

    processBitStep(ctx, currentBitIndex);
    currentBitIndex++;

    if (!isSingleStep && !isSiftingPaused) {
        const delay = Math.max(50, 800 / simulationSpeed);
        siftingInterval = setTimeout(() => runSiftingStep(ctx), delay);
    }
}

function finishSiftingInstantly(ctx) {
    clearTimeout(siftingInterval);
    while (currentBitIndex < state.numBits) {
        processBitStep(ctx, currentBitIndex, true); // true = skip animation
        currentBitIndex++;
    }
    finishSifting();
}

function processBitStep(ctx, index, skipAnim = false) {
    const aliceBasis = state.alice.bases[index];
    const bobBasis = state.bob.bases[index];
    const isMatch = aliceBasis === bobBasis;

    // Update Operator Displays
    const aBasisStr = aliceBasis === BASIS_RECT ? '+' : '×';
    const bBasisStr = bobBasis === BASIS_RECT ? '+' : '×';

    const aBasisEl = document.getElementById('alice-current-basis');
    const aBitEl = document.getElementById('alice-current-bit');
    const bBasisEl = document.getElementById('bob-current-basis');
    const bBitEl = document.getElementById('bob-current-bit');

    if (aBasisEl) aBasisEl.textContent = aBasisStr;
    if (aBitEl) aBitEl.textContent = state.alice.bits[index];
    if (bBasisEl) bBasisEl.textContent = bBasisStr;
    if (bBitEl) bBitEl.textContent = state.bob.measurements[index];

    // Update Status Hub
    const statusHub = document.getElementById('sifting-match-indicator');
    const statusText = document.getElementById('sifting-match-status');
    if (statusHub) {
        statusHub.textContent = isMatch ? '✅' : '❌';
        statusHub.style.borderColor = isMatch ? 'var(--safe-green)' : 'var(--danger-red)';
        statusHub.style.background = isMatch ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)';
    }
    if (statusText) {
        statusText.textContent = isMatch ? 'MATCH' : 'MISMATCH';
        statusText.style.color = isMatch ? 'var(--safe-green)' : 'var(--danger-red)';
    }

    // Animate Canvas
    if (!skipAnim) {
        animateComparison(ctx, aliceBasis, bobBasis, isMatch);
    }

    // Add Auditor Card
    addAuditorCard(index, aBasisStr, bBasisStr, isMatch);

    // Update Metrics
    updateSiftingMetrics(index + 1);
}

function updateSiftingMetrics(totalProcessed) {
    const kept = document.querySelectorAll('.sift-auditor-card.matched').length;
    const countEl = document.getElementById('sift-total-count');
    const siftedEl = document.getElementById('sift-summary-sifted');
    const removedEl = document.getElementById('sift-summary-removed');
    const effEl = document.getElementById('sift-summary-efficiency');

    if (countEl) countEl.textContent = totalProcessed;
    if (siftedEl) siftedEl.textContent = kept;

    const removedCount = totalProcessed - kept;
    if (removedEl) removedEl.textContent = removedCount;
    state.bitsRemovedInSifting = removedCount;

    if (effEl) effEl.textContent = ((kept / totalProcessed) * 100).toFixed(1) + '%';
}

function animateComparison(ctx, aBase, bBase, isMatch) {
    if (!ctx) return;
    
    // Force sync dimensions
    const w = ctx.canvas.width = ctx.canvas.offsetWidth;
    const h = ctx.canvas.height = ctx.canvas.offsetHeight;

    const startTime = performance.now();
    const duration = 600 / simulationSpeed;

    function draw() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1.0);

        ctx.clearRect(0, 0, w, h);

        const centerX = w / 2;
        const centerY = h / 2;

        // Primary Pulse
        ctx.beginPath();
        const color = isMatch ? '76, 175, 80' : '244, 67, 54'; // Safe Green vs Danger Red
        
        // Dynamic radial gradient: expands and fades
        const radius = Math.min(w, h) * 0.4 * progress + 10;
        const grad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, radius);
        
        // Start bright and fade to transparent
        grad.addColorStop(0, `rgba(${color}, ${0.7 * (1 - progress)})`);
        grad.addColorStop(0.5, `rgba(${color}, ${0.2 * (1 - progress)})`);
        grad.addColorStop(1, `rgba(${color}, 0)`);

        ctx.fillStyle = grad;
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Subtle core flash
        if (progress < 0.3) {
            ctx.beginPath();
            ctx.fillStyle = `rgba(${color}, ${0.5 * (1 - (progress / 0.3))})`;
            ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
            ctx.fill();
        }

        if (progress < 1.0) {
            requestAnimationFrame(draw);
        }
    }
    draw();
}

function addAuditorCard(index, aBasis, bBasis, isMatch) {
    const container = document.getElementById('sifting-timeline');
    if (!container) return;
    const card = document.createElement('div');
    card.className = `sift-auditor-card ${isMatch ? 'matched' : 'mismatched'}`;

    card.innerHTML = `
        <div class="card-header">BIT #${index + 1}</div>
        <div class="card-body">
            <div class="basis-row">
                <span class="basis-label">Alice</span>
                <span class="basis-val" style="color: var(--accent-neon-blue);">${aBasis}</span>
            </div>
            <div style="height: 1px; width: 20px; background: #eee;"></div>
            <div class="basis-row">
                <span class="basis-label">Bob</span>
                <span class="basis-val" style="color: var(--accent-neon-cyan);">${bBasis}</span>
            </div>
            ${isMatch ? `<div class="res-bit">${state.alice.bits[index]}</div>` : ''}
        </div>
    `;

    container.appendChild(card);

    // Auto-scroll
    setTimeout(() => {
        card.classList.add('show');
        container.scrollLeft = container.scrollWidth;
    }, 10);
}

function finishSifting() {
    clearTimeout(siftingInterval);
    const keyDisplay = document.getElementById('sift-final-key-display');
    const keyStr = document.getElementById('sift-summary-key-string');

    if (keyDisplay && keyStr && state.siftedKeyA) {
        keyDisplay.style.display = 'flex';
        keyStr.textContent = state.siftedKeyA.join('');
    }

    // Reset status hub
    const statusHub = document.getElementById('sifting-match-indicator');
    const statusText = document.getElementById('sifting-match-status');
    if (statusHub) statusHub.textContent = '🔒';
    if (statusText) {
        statusText.textContent = 'COMPLETE';
        statusText.style.color = 'var(--text-muted)';
    }

    emit('siftingComplete', { length: state.siftedKeyA ? state.siftedKeyA.length : 0 });
}
