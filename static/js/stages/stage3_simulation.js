/**
 * stage3_simulation.js - UI Binding for the Refined Simulation Stage
 */
import { state, emit, subscribe, resetProtocolState } from '../state.js';
import { alicePrepare, transmitAndMeasure, BASIS_RECT } from '../quantum_engine.js';
import { QuantumCanvas } from '../animator.js';

let quantumCanvas = null;

export function initStage3() {
    const btnAlicePrep = document.getElementById('btn-alice-prep');
    const btnBobMeasure = document.getElementById('btn-bob-measure');
    const eveToggle = document.getElementById('eve-toggle');

    // UI Elements
    const logAlice = document.getElementById('log-alice');
    const logBob = document.getElementById('log-bob');
    const statusAlice = document.getElementById('status-alice');
    const statusBob = document.getElementById('status-bob');
    const inputNumBits = document.getElementById('input-num-bits');

    // Bitstream Monitor Rows
    const rowAliceBits = document.getElementById('row-alice-bits');
    const rowAliceBases = document.getElementById('row-alice-bases');
    const rowBobBases = document.getElementById('row-bob-bases');
    const rowBobBits = document.getElementById('row-bob-bits');

    // Customization Controls
    const speedSlider = document.getElementById('anim-speed-slider');
    const speedVal = document.getElementById('anim-speed-val');
    const waveToggle = document.getElementById('photon-wave-toggle');
    const noiseSlider = document.getElementById('noise-slider');
    const noiseVal = document.getElementById('noise-val');
    const manualQberInput = document.getElementById('input-manual-qber');

    // Transport
    const btnPlay = document.getElementById('btn-anim-play');
    const btnPause = document.getElementById('btn-anim-pause');
    const btnStep = document.getElementById('btn-anim-step');
    const canvasGlow = document.getElementById('canvas-glow');

    quantumCanvas = new QuantumCanvas('quantum-canvas');

    const addLog = (el, msg, type = 'info') => {
        if (!el) return;
        const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const line = document.createElement('div');
        line.style.borderLeft = type === 'warn' ? '2px solid var(--danger-red)' : '2px solid transparent';
        line.style.paddingLeft = '5px';
        line.style.marginBottom = '2px';
        line.textContent = `[${time}] ${msg}`;
        el.prepend(line);
        if (el.childNodes.length > 20) el.removeChild(el.lastChild);
    };

    const setStatus = (alice, bob) => {
        if (statusAlice) {
            statusAlice.className = `status-badge ${alice}`;
            statusAlice.textContent = alice.toUpperCase();
        }
        if (statusBob) {
            statusBob.className = `status-badge ${bob}`;
            statusBob.textContent = bob.toUpperCase();
        }

        // Update LED Indicators
        const ledAlice = document.getElementById('led-alice');
        const ledBob = document.getElementById('led-bob');
        if (ledAlice) ledAlice.className = `led-indicator ${alice !== 'idle' ? 'led-active' : ''}`;
        if (ledBob) ledBob.className = `led-indicator ${bob !== 'idle' ? 'led-active' : ''}`;

        // Update Channel Nexus Status
        const chanStatus = document.getElementById('channel-status');
        if (chanStatus) {
            if (alice === 'sending' || bob === 'receiving') {
                chanStatus.textContent = 'STATUS: ACTIVE TRANSMISSION';
                chanStatus.style.color = 'var(--accent-neon-blue)';
            } else {
                chanStatus.textContent = 'STATUS: STANDBY';
                chanStatus.style.color = 'rgba(255,255,255,0.4)';
            }
        }
    };

    const renderMonitorRow = (container, data, type = 'bit') => {
        if (!container) return;
        // Keep the label, clear the rest
        const label = container.querySelector('.matrix-label');
        container.innerHTML = '';
        if (label) container.appendChild(label);

        data.forEach(val => {
            const span = document.createElement('span');
            span.className = `bit-cell type-${type === 'basis' ? 'basis' : 'bit'}`;
            span.textContent = type === 'basis' ? (val === BASIS_RECT ? '+' : 'x') : val;
            container.appendChild(span);
        });
    };

    // Subscribe to State Changes
    subscribe('alicePrepared', (aliceState) => {
        const bitStat = document.getElementById('stat-alice-bits');
        const basisStat = document.getElementById('stat-alice-bases');
        if (bitStat) bitStat.textContent = aliceState.bits.length;
        if (basisStat) basisStat.textContent = aliceState.bases.length;

        renderMonitorRow(rowAliceBits, aliceState.bits, 'bit');
        renderMonitorRow(rowAliceBases, aliceState.bases, 'basis');

        addLog(logAlice, `STREAM READY: ${aliceState.bits.length} photons prepared.`);
        setStatus('sending', 'idle');

        // Reset Bob
        rowBobBits.innerHTML = '<span class="matrix-label">Bob Measured</span>';
        rowBobBases.innerHTML = '<span class="matrix-label">Bob Bases</span>';
        document.getElementById('stat-bob-bits').textContent = '0';
        document.getElementById('stat-bob-bases').textContent = '0';
        btnBobMeasure.disabled = false;

        if (quantumCanvas) quantumCanvas.clear();
    });

    subscribe('measurementComplete', (res) => {
        document.getElementById('stat-bob-bits').textContent = res.bob.measurements.length;
        document.getElementById('stat-bob-bases').textContent = res.bob.bases.length;

        renderMonitorRow(rowBobBits, res.bob.measurements, 'bit');
        renderMonitorRow(rowBobBases, res.bob.bases, 'basis');

        addLog(logBob, `SUCCESS: Detected ${res.bob.measurements.length} pulses.`);
        setStatus('idle', 'idle');
        if (canvasGlow) canvasGlow.classList.remove('active');

        btnBobMeasure.disabled = true;
    });

    subscribe('protocolReset', () => {
        document.getElementById('stat-alice-bits').textContent = '0';
        document.getElementById('stat-alice-bases').textContent = '0';
        document.getElementById('stat-bob-bits').textContent = '0';
        document.getElementById('stat-bob-bases').textContent = '0';
        if (logAlice) logAlice.innerHTML = 'System reset...';
        if (logBob) logBob.innerHTML = 'Standing by...';
        setStatus('idle', 'idle');
        if (quantumCanvas) quantumCanvas.clear();
    });

    // Customization Listeners
    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (speedVal) speedVal.textContent = val.toFixed(1) + 'x';
            if (quantumCanvas) quantumCanvas.config.speedMultiplier = val;
        });
    }

    if (waveToggle) {
        waveToggle.addEventListener('change', (e) => {
            if (quantumCanvas) quantumCanvas.config.showWaves = e.target.checked;
        });
    }

    // Event Listeners
    if (btnAlicePrep) {
        btnAlicePrep.addEventListener('click', () => {
            resetProtocolState();
            if (inputNumBits) {
                let val = parseInt(inputNumBits.value);
                state.numBits = Math.max(10, Math.min(1000, val));
                inputNumBits.value = state.numBits;
            }
            alicePrepare();
        });
    }

    if (btnBobMeasure) {
        btnBobMeasure.addEventListener('click', () => {
            btnBobMeasure.disabled = true;
            btnAlicePrep.disabled = true;
            setStatus('sending', 'receiving');
            if (canvasGlow) canvasGlow.classList.add('active');

            addLog(logAlice, "TRANSMITTING: Firing photon stream...");
            addLog(logBob, "LISTENING: Sensors aligned to fiber.");

            quantumCanvas.animateTransmission(state.alice.photons, state.eveActive, () => {
                transmitAndMeasure();
                btnAlicePrep.disabled = false;
                btnPlay.disabled = true;
                btnPause.disabled = true;
                btnStep.disabled = true;
            });

            btnPause.disabled = false;
        });
    }

    if (eveToggle) {
        eveToggle.addEventListener('change', (e) => {
            state.eveActive = e.target.checked;
            addLog(logAlice, state.eveActive ? "ALARM: Channel impedance change detected!" : "INFO: Perimeter secured.", state.eveActive ? 'warn' : 'info');
        });
    }

    if (noiseSlider) {
        noiseSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            if (noiseVal) noiseVal.textContent = val + '%';
            if (manualQberInput) manualQberInput.value = val;
            state.noiseLevel = parseFloat(val) / 100.0;
        });
    }

    // Manual Modes
    const aManualToggle = document.getElementById('alice-manual-toggle');
    const bManualToggle = document.getElementById('bob-manual-toggle');

    if (aManualToggle) {
        aManualToggle.addEventListener('change', (e) => {
            state.aliceManualMode = e.target.checked;
            document.getElementById('alice-manual-panel').style.display = e.target.checked ? 'block' : 'none';
        });
    }
    if (bManualToggle) {
        bManualToggle.addEventListener('change', (e) => {
            state.bobManualMode = e.target.checked;
            const panel = document.getElementById('bob-manual-panel');
            if (panel) panel.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    // Manual Input State Sync
    const inputAliceBits = document.getElementById('input-alice-manual-bits');
    const inputAliceBases = document.getElementById('input-alice-manual-bases');
    const inputBobBases = document.getElementById('input-bob-manual-bases');

    if (inputAliceBits) inputAliceBits.addEventListener('input', (e) => state.aliceManualBits = e.target.value);
    if (inputAliceBases) inputAliceBases.addEventListener('input', (e) => state.aliceManualBases = e.target.value);
    if (inputBobBases) inputBobBases.addEventListener('input', (e) => state.bobManualBases = e.target.value);

    // Transport Bindings
    if (btnPlay) {
        btnPlay.addEventListener('click', () => {
            quantumCanvas.play();
            btnPlay.disabled = true;
            btnPause.disabled = false;
            btnStep.disabled = true;
        });
    }

    if (btnPause) {
        btnPause.addEventListener('click', () => {
            quantumCanvas.pause();
            btnPlay.disabled = false;
            btnPause.disabled = true;
            btnStep.disabled = false;
        });
    }

    if (btnStep) {
        btnStep.addEventListener('click', () => {
            quantumCanvas.step();
        });
    }

    subscribe('advancedModeChanged', (isAdvanced) => {
        const manualQberContainer = document.getElementById('manual-qber-container');
        if (manualQberContainer) {
            manualQberContainer.style.display = isAdvanced ? 'block' : 'none';
        }
    });
}
