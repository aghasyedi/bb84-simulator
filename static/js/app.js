import { state, emit, subscribe } from './state.js';
import { initStage3 } from './stages/stage3_simulation.js';
import { initStage4 } from './stages/stage4_sifting.js';
import { initStage5 } from './stages/stage5_qber.js';
import { initStage6 } from './stages/stage6_postprocessing.js';
import { initStage7 } from './stages/stage7_results.js';
import { initStage8 } from './stages/stage8_optics.js';
import { initStage8Labs } from './stages/stage8_labs.js';
import { initMacroController } from './macro_controller.js';
import { initMacroWindowManager } from './macro_window.js';

import { injectSandboxData, injectToolboxData } from './state.js';
import { BlochSphere } from './bloch_sphere.js';
import { PolarizationAnimator } from './polarization_animator.js';
import { WelcomeAnimator } from './welcome_animator.js';

window.injectSandbox = (level) => {
    injectSandboxData(level);
};

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log("BB84 Simulator Initializing...");

    // Theory Animations
    const welcomeCanvas = document.getElementById('welcome-hero-canvas');
    if (welcomeCanvas) new WelcomeAnimator('welcome-hero-canvas');

    const blochCanvas = document.getElementById('bloch-canvas');
    if (blochCanvas) new BlochSphere('bloch-canvas');

    const polarizationCanvas = document.getElementById('polarization-canvas');
    if (polarizationCanvas) new PolarizationAnimator('polarization-canvas');

    initNavigation();
    initStage3();
    initStage4();
    initStage5();
    initStage6();
    initStage7();
    initStage8();
    initStage8Labs();
    // Macro window manager first: Advanced mode drives the floating panel.
    initMacroWindowManager();
    initSettings();
    initExpertToolbox();
    initTheme();
    initMacroController();


    // Listen for global protocol reset
    subscribe('protocolReset', () => {
        showToast("Simulation Reset: Ready for new Photon Stream");
    });

    // Initial Math Render for the welcome stage
    const activeStage = document.querySelector('.stage-container.active');
    if (activeStage) {
        renderMathForElement(activeStage);
    }
});

function showToast(message, duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

function initNavigation() {
    const navItems = document.querySelectorAll('#stage-nav li');
    const stages = document.querySelectorAll('.stage-container');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetId = item.getAttribute('data-target');

            // Update Active Class on Nav
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Update Active Stage
            stages.forEach(stage => {
                if (stage.id === targetId) {
                    stage.classList.add('active');
                } else {
                    stage.classList.remove('active');
                }
            });

            // Update State
            state.currentStage = targetId;
            emit('stageChanged', targetId);

            // Re-render KaTeX if available
            const stageEl = document.getElementById(targetId);
            if (stageEl) {
                renderMathForElement(stageEl);
            }

            // Trigger formula animations
            const formulas = stageEl.querySelectorAll('.formula-container');
            formulas.forEach((f, index) => {
                f.classList.remove('animate');
                // Stagger animations
                setTimeout(() => {
                    f.classList.add('animate');
                }, index * 200);
            });
        });
    });
}

/**
 * Global Navigation Helper
 * Programmatically switches to a target stage
 */
window.navigateToStage = (stageId) => {
    const navItem = document.querySelector(`li[data-target="${stageId}"]`);
    if (navItem) {
        navItem.click();
    } else {
        console.warn(`[NAV] Target stage ${stageId} not found in navigation.`);
    }
};

/**
 * Shared Math Rendering Utility
 */
function renderMathForElement(element) {
    if (window.renderMathInElement && element) {
        window.renderMathInElement(element, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
        });
    }
}

function initSettings() {
    const advancedSlot = document.getElementById('btn-toggle-turbo');
    const expertToolbox = document.getElementById('expert-toolbox');

    if (!advancedSlot) return;

    // Single source of truth for Advanced mode: the button itself.
    function updateAdvancedMode(isActive) {
        state.advancedMode = isActive;

        advancedSlot.setAttribute('aria-checked', isActive ? 'true' : 'false');
        advancedSlot.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        advancedSlot.classList.toggle('active', isActive);
        advancedSlot.title = isActive
            ? 'Advanced mode is ON — hide the Expert Toolbox'
            : 'Advanced mode — reveals the Expert Toolbox';

        const stateLabel = advancedSlot.querySelector('.utility-state');
        if (stateLabel) stateLabel.textContent = isActive ? 'On' : 'Off';

        document.body.classList.toggle('mode-advanced', isActive);
        if (expertToolbox) expertToolbox.style.display = isActive ? 'block' : 'none';

        emit('advancedModeChanged', state.advancedMode);

        // Keep the floating accelerator panel locked to Advanced mode so the
        // two can never desync when it is dismissed with its own close button.
        if (typeof window.toggleTurboWindow === 'function') {
            window.toggleTurboWindow(isActive);
        }
    }

    advancedSlot.addEventListener('click', () => updateAdvancedMode(!state.advancedMode));

    // Init state
    updateAdvancedMode(false);
}

/**
 * Expert Toolbox (Advanced mode).
 * Lets you drive the run directly: inject a known Alice bit string, or set the
 * physical channel noise. QBER is deliberately absent — it is an outcome you
 * measure from the run, not a knob you can set.
 */
function initExpertToolbox() {
    const bitsInput = document.getElementById('toolbox-bits');
    const noiseInput = document.getElementById('toolbox-noise');
    const statusEl = document.getElementById('toolbox-status');
    const btnBits = document.getElementById('btn-toolbox-inject-bits');
    const btnNoise = document.getElementById('btn-toolbox-apply-noise');

    const report = (msg, ok = true) => {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.style.color = ok ? 'var(--safe-green)' : 'var(--danger-red)';
    };

    if (btnBits && bitsInput) {
        btnBits.addEventListener('click', () => {
            const res = injectToolboxData({ bits: bitsInput.value });
            if (!res.ok) { report(res.reason, false); return; }
            const stripped = res.ignored > 0 ? ` (${res.ignored} non-binary char(s) stripped)` : '';
            report(`Injected ${res.length} photons, bases randomised.${stripped}`);
        });
    }

    if (btnNoise && noiseInput) {
        btnNoise.addEventListener('click', () => {
            const res = injectToolboxData({ noise: noiseInput.value });
            if (!res.ok) { report(res.reason, false); return; }

            // Keep the Stage 3 slider in sync so the two controls never disagree
            const slider = document.getElementById('noise-slider');
            if (slider) {
                slider.value = String(state.noiseLevel * 100);
                slider.dispatchEvent(new Event('input'));
            }
            report(`Channel noise set to ${(state.noiseLevel * 100).toFixed(0)}%.`);
        });
    }
}

function initTheme() {
    const themeSlot = document.getElementById('theme-mode-slot');
    const themeIcon = document.getElementById('theme-icon');
    const themeLabel = document.getElementById('theme-label');

    // Load saved theme
    const savedTheme = localStorage.getItem('bb84-theme') || 'day';
    applyTheme(savedTheme);

    if (themeSlot) {
        themeSlot.addEventListener('click', () => {
            const currentTheme = document.body.getAttribute('data-theme') === 'night' ? 'day' : 'night';
            applyTheme(currentTheme);
        });
    }

    function applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('bb84-theme', theme);
        emit('themeChanged', theme);

        if (theme === 'night') {
            if (themeIcon) themeIcon.textContent = '☀️';
            if (themeLabel) themeLabel.textContent = 'Day';
            themeSlot.classList.add('active');
        } else {
            if (themeIcon) themeIcon.textContent = '🌙';
            if (themeLabel) themeLabel.textContent = 'Night';
            themeSlot.classList.remove('active');
        }
    }
}

/**
 * Navigational Jump to Appendix
 * Switches stage and scrolls to specific section
 */
window.jumpToAppendix = (sectionId) => {
    const navItem = document.querySelector('li[data-target="stage-appendix"]');
    if (navItem) navItem.click(); // Trigger the standard navigation logic

    // Slight delay to ensure content is visible before scrolling
    setTimeout(() => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Add a brief highlight effect
            section.style.transition = 'background-color 0.5s';
            const originalBg = section.style.backgroundColor;
            section.style.backgroundColor = 'rgba(150, 73, 0, 0.1)';
            setTimeout(() => {
                section.style.backgroundColor = originalBg;
            }, 1000);
        }
    }, 100);
};
