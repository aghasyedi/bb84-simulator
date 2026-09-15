/* ==========================================================================
   Stage 8 — laboratory orchestrator
   Owns the tab bar and lazily initialises each lab the first time it is shown.
   ========================================================================== */
import { $ } from './stage8_lab_utils.js';
import { initPolarisationLab } from './stage8_polarisation.js';
import { initSourceLab } from './stage8_source.js';
import { initDetectorLab } from './stage8_detector.js';
import { initDecoyLab } from './stage8_decoy.js';
import { initFiniteLab } from './stage8_finite.js';
import { initMissionLab } from './stage8_mission.js';

const LABS = {
    'lab-polarisation': initPolarisationLab,
    'lab-source': initSourceLab,
    'lab-detector': initDetectorLab,
    'lab-decoy': initDecoyLab,
    'lab-finite': initFiniteLab,
    'lab-mission': initMissionLab
};

const started = {};

export function initStage8Labs() {
    const nav = $('ob-lab-nav');
    if (!nav) return;

    const panels = Object.keys(LABS).map((id) => $(id)).filter(Boolean);

    nav.addEventListener('click', (e) => {
        const btn = e.target.closest('.ob-lab-btn');
        if (!btn) return;
        const target = btn.dataset.lab;
        nav.querySelectorAll('.ob-lab-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
        panels.forEach((p) => { p.hidden = p.id !== target; });
        start(target);
        // keep the tab bar and the new lab's controls in view after the height change
        const labs = document.querySelector('.ob-labs');
        if (labs && typeof labs.scrollIntoView === 'function') {
            const r = labs.getBoundingClientRect();
            if (r.top < 0 || r.top > window.innerHeight - 80) {
                labs.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });

    start('lab-polarisation');
}

function start(id) {
    if (started[id] || !LABS[id]) return;
    started[id] = true;
    try {
        LABS[id]();
    } catch (err) {
        console.error('[Stage8] lab', id, 'failed to start:', err);
        started[id] = false;
    }
}
