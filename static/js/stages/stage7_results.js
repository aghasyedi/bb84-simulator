/**
 * stage7_results.js - Final security audit dashboard
 */
import { state, subscribe } from '../state.js';
import { generateAuditReport } from '../report_generator.js';

export function initStage7() {
    console.debug("[STAGE-7] Initializing Results Dashboard...");

    const refreshDashboard = () => {
        console.debug("[STAGE-7] Refreshing dashboard data...", state);
        
        const finalDisplay = document.getElementById('final-key-display');
        const resInit = document.getElementById('res-initial');
        const resSifted = document.getElementById('res-sifted');
        const resReconciled = document.getElementById('res-reconciled');
        const resFinLen = document.getElementById('res-final-len');
        const resFinLenTag = document.getElementById('res-final-len-tag');
        
        const resQber = document.getElementById('res-qber');
        const resQberStatus = document.getElementById('res-qber-status');
        const resEfficiency = document.getElementById('res-efficiency');
        
        const secIndicator = document.getElementById('final-security-indicator');
        const sealIcon = document.getElementById('seal-icon');
        const sealText = document.querySelector('.seal-text');
        const btnExport = document.getElementById('btn-export-key');

        if(!finalDisplay) return;

        // 1. Final Key Display
        if(state.finalSecretKey && state.finalSecretKey.length > 0) {
            finalDisplay.textContent = state.finalSecretKey.join('');
            finalDisplay.style.color = "#00ff88"; // Neon green for success
            if(resFinLenTag) resFinLenTag.textContent = `${state.finalSecretKey.length} BITS`;
        } else {
            finalDisplay.textContent = state.siftedKeyA.length > 0 ? 
                'Awaiting Privacy Amplification...' : 'Protocol has not been initiated.';
            finalDisplay.style.color = "var(--text-muted)";
            if(resFinLenTag) resFinLenTag.textContent = '0 BITS';
        }

        // 2. Metrics Population
        const initial = state.numBits || 0;
        const sifted = state.siftedKeyA.length || 0;
        const reconciled = state.reconciledKeyA ? state.reconciledKeyA.length : sifted; // Fallback to sifted if not run
        const finalKeyLen = state.finalSecretKey ? state.finalSecretKey.length : 0;

        if(resInit) resInit.textContent = initial;
        if(resSifted) resSifted.textContent = sifted;
        if(resReconciled) resReconciled.textContent = reconciled;
        if(resFinLen) resFinLen.textContent = finalKeyLen;

        // 3. Efficiency & QBER
        if(resQber) resQber.textContent = (state.qber * 100).toFixed(2) + '%';
        
        const maxQberPercent = (state.MAX_QBER * 100).toFixed(1) + '%';
        const isSecure = state.qber <= state.MAX_QBER;

        if(resQberStatus) {
            if(isSecure) {
                resQberStatus.textContent = `✔ Below ${maxQberPercent} Threshold`;
                resQberStatus.style.color = "var(--safe-green)";
            } else {
                resQberStatus.textContent = "✖ High Risk - Key Compromised";
                resQberStatus.style.color = "var(--danger-red)";
            }
        }

        if(resEfficiency) {
            const eff = initial > 0 ? (finalKeyLen / initial) * 100 : 0;
            resEfficiency.textContent = eff.toFixed(1) + '%';
        }

        // 4. Security Audit Logic
        if(state.finalSecretKey.length > 0) {
            if(isSecure) {
                if(secIndicator) {
                    secIndicator.textContent = "SECURE";
                    secIndicator.style.background = "rgba(46, 125, 50, 0.2)";
                    secIndicator.style.color = "var(--safe-green)";
                }
                if(sealIcon) sealIcon.textContent = "🔒";
                if(sealText) sealText.textContent = "VERIFIED";
                if(btnExport) btnExport.style.display = "inline-block";
            } else {
                if(secIndicator) {
                    secIndicator.textContent = "COMPROMISED";
                    secIndicator.style.background = "rgba(192, 57, 43, 0.2)";
                    secIndicator.style.color = "var(--danger-red)";
                }
                if(sealIcon) sealIcon.textContent = "⚠️";
                if(sealText) sealText.textContent = "ABORTED";
                if(btnExport) btnExport.style.display = "none";
                finalDisplay.style.color = "var(--danger-red)";
            }
        }

        updateEntropyPipeline(initial, sifted, reconciled, finalKeyLen);
    };

    const updateEntropyPipeline = (raw, sifted, ec, final) => {
        const pipeRaw = document.getElementById('pipe-fill-raw');
        const pipeSifted = document.getElementById('pipe-fill-sifted');
        const pipeEc = document.getElementById('pipe-fill-ec');
        const pipePa = document.getElementById('pipe-fill-pa');

        if (!pipeRaw) return;

        // Values
        document.getElementById('pipe-val-raw').textContent = `${raw} BITS`;
        document.getElementById('pipe-val-sifted').textContent = `${sifted} BITS`;
        document.getElementById('pipe-val-ec').textContent = `${ec} BITS`;
        document.getElementById('pipe-val-pa').textContent = `${final} BITS`;

        // Percentages (relative to Raw 100%)
        const pRaw = 100;
        const pSifted = raw > 0 ? (sifted / raw) * 100 : 0;
        const pEc = raw > 0 ? (ec / raw) * 100 : 0;
        const pPa = raw > 0 ? (final / raw) * 100 : 0;

        pipeRaw.style.height = `${pRaw}%`;
        pipeSifted.style.height = `${pSifted}%`;
        pipeEc.style.height = `${pEc}%`;
        pipePa.style.height = `${pPa}%`;

        // Loss Calculations
        const siftLoss = raw > 0 ? ((raw - sifted) / raw * 100).toFixed(0) : 0;
        const ecLoss = sifted > 0 ? ((sifted - ec) / sifted * 100).toFixed(0) : 0;
        const paLoss = ec > 0 ? ((ec - final) / ec * 100).toFixed(0) : 0;

        document.getElementById('pipe-loss-sifting').textContent = `-${siftLoss}%`;
        document.getElementById('pipe-loss-ec').textContent = `-${ecLoss}%`;
        document.getElementById('pipe-loss-pa').textContent = `-${paLoss}%`;

        // Visibility
        pipeSifted.parentElement.parentElement.classList.toggle('active', sifted > 0);
        pipeEc.parentElement.parentElement.classList.toggle('active', ec > 0 && ec !== sifted);
        pipePa.parentElement.parentElement.classList.toggle('active', final > 0);
    };


    // Subscriptions
    subscribe('postProcessingComplete', refreshDashboard);
    subscribe('stageChanged', (stageId) => {
        if(stageId === 'stage-7') refreshDashboard();
    });
    subscribe('protocolReset', refreshDashboard);
    
    // Copy Key Logic
    const btnExport = document.getElementById('btn-export-key');
    if(btnExport) {
        btnExport.addEventListener('click', () => {
            if(state.finalSecretKey && state.finalSecretKey.length > 0) {
                const keyStr = state.finalSecretKey.join('');
                navigator.clipboard.writeText(keyStr).then(() => {
                    const originalText = btnExport.textContent;
                    btnExport.textContent = "✓ Key Copied!";
                    setTimeout(() => { btnExport.textContent = originalText; }, 2000);
                });
            }
        });
    }

    // Export Audit Report Button
    const btnAuditReport = document.getElementById('btn-audit-report');
    if(btnAuditReport) {
        btnAuditReport.addEventListener('click', () => {
            const originalText = btnAuditReport.innerHTML;
            btnAuditReport.innerHTML = '⏳ &nbsp;Generating Report...';
            btnAuditReport.disabled = true;

            // Small delay to let the UI update before opening the window
            setTimeout(() => {
                try {
                    generateAuditReport();
                } catch(err) {
                    console.error('[REPORT] Error generating report:', err);
                    alert('Failed to generate report. Please check browser console for details.');
                } finally {
                    btnAuditReport.innerHTML = originalText;
                    btnAuditReport.disabled = false;
                }
            }, 80);
        });
    }

    // Initial Trigger
    if(state.currentStage === 'stage-7') refreshDashboard();
}
