/**
 * macro_controller.js - Coordination for BB84 Advanced Automation (Turbo Mode)
 */
import { state, emit, subscribe } from './state.js';

export function initMacroController() {
    const btn1 = document.getElementById('macro-step-1');
    const btn2 = document.getElementById('macro-step-2');
    const btn3 = document.getElementById('macro-step-3');
    const progressBar = document.getElementById('macro-progress-bar');

    if (!btn1 || !btn2 || !btn3) return;

    // --- MACRO 1: INFRASTRUCTURE ---
    btn1.addEventListener('click', async (e) => {
        if (state.automationStep >= 1 || btn1.classList.contains('active')) return;
        
        console.log("[MACRO] Initiating Step 1: Infrastructure");
        btn1.classList.add('active');
        const sub1 = btn1.querySelector('.m-sub');
        if (sub1) sub1.textContent = 'Transmitting Photons...';
        
        // 1. Shift to Stage 3
        window.navigateToStage('stage-3');

        // 2. Clear state and trigger
        setTimeout(() => {
            const aliceBtn = document.getElementById('btn-alice-prep');
            if (aliceBtn) aliceBtn.click();

            setTimeout(() => {
                const bobBtn = document.getElementById('btn-bob-measure');
                if (bobBtn) bobBtn.click();
                completeStep(1, 'Infrastructure Complete');
            }, 1000); // 1s for Alice animation
        }, 500); // 500ms for stage render
    });

    // --- MACRO 2: RECONCILIATION ---
    btn2.addEventListener('click', (e) => {
        if (state.automationStep < 1 || state.automationStep >= 2 || btn2.classList.contains('active')) return;

        console.log("[MACRO] Initiating Step 2: Reconciliation");
        btn2.classList.add('active');
        const sub2 = btn2.querySelector('.m-sub');
        if (sub2) sub2.textContent = 'Auditing Channel...';

        // 1. Start at Stage 4
        window.navigateToStage('stage-4');

        setTimeout(() => {
            const siftBtn = document.getElementById('btn-sift');
            if (siftBtn) siftBtn.click();

            setTimeout(() => {
                const skipBtn = document.getElementById('btn-sift-skip');
                if (skipBtn) skipBtn.click();

                // 2. Jump to Stage 5 for QBER
                setTimeout(() => {
                    window.navigateToStage('stage-5');
                    
                    setTimeout(() => {
                        const sampleBtn = document.getElementById('btn-sample-qber');
                        if (sampleBtn) sampleBtn.click();
                        completeStep(2, 'Reconciliation Verified');
                    }, 600);
                }, 1000);
            }, 800);
        }, 500);
    });

    // --- MACRO 3: CRYPTOGRAPHY ---
    btn3.addEventListener('click', (e) => {
        if (state.automationStep < 2 || state.automationStep >= 3 || btn3.classList.contains('active')) return;

        console.log("[MACRO] Initiating Step 3: Cryptography");
        btn3.classList.add('active');
        const sub3 = btn3.querySelector('.m-sub');
        if (sub3) sub3.textContent = 'Generating Secure Key...';

        // 1. Shift to Stage 6
        window.navigateToStage('stage-6');

        setTimeout(() => {
            const ecBtn = document.getElementById('btn-run-ec');
            if (ecBtn) ecBtn.click();

            const checkPA = setInterval(() => {
                const paBtn = document.getElementById('btn-run-pa');
                if (paBtn && !paBtn.disabled) {
                    clearInterval(checkPA);
                    paBtn.click();
                    
                    // 2. Jump to final results
                    setTimeout(() => {
                        window.navigateToStage('stage-7');
                        completeStep(3, 'Protocol Finalized');
                    }, 2000);
                }
            }, 1000);
        }, 800);
    });

    function completeStep(step, statusMsg) {
        state.automationStep = step;
        const btn = document.getElementById(`macro-step-${step}`);
        const nextBtn = document.getElementById(`macro-step-${step + 1}`);

        if (btn) {
            btn.classList.remove('active');
            btn.classList.add('complete');
            const sub = btn.querySelector('.m-sub');
            if (sub) sub.textContent = statusMsg || 'Completed ✔';
        }

        if (nextBtn) {
            nextBtn.disabled = false;
            const nextSub = nextBtn.querySelector('.m-sub');
            if (nextSub) nextSub.textContent = 'Ready to execute';
        }

        if (progressBar) {
            progressBar.style.width = `${(step / 3) * 100}%`;
        }
    }

    // Reset listener
    subscribe('protocolReset', () => {
        state.automationStep = 0;
        const subs = [
            'Transmission (Alice ↔ Bob)',
            'Sifting & QBER Audit',
            'EC (Cascade) & Privacy Purge'
        ];
        [btn1, btn2, btn3].forEach((b, i) => {
            b.classList.remove('active', 'complete');
            b.disabled = i > 0;
            const sub = b.querySelector('.m-sub');
            if (sub) sub.textContent = i === 0 ? 'Ready to execute' : subs[i];
        });
        if (progressBar) progressBar.style.width = '0%';
    });
}
