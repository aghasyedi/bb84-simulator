import { state, emit, subscribe } from './state.js';
import { initStage3 } from './stages/stage3_simulation.js';
import { initStage4 } from './stages/stage4_sifting.js';
import { initStage5 } from './stages/stage5_qber.js';
import { initStage6 } from './stages/stage6_postprocessing.js';
import { initStage7 } from './stages/stage7_results.js';
import { initMacroController } from './macro_controller.js';
import { initMacroWindowManager } from './macro_window.js';

import { injectSandboxData } from './state.js';
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
    initSettings();
    initTheme();
    initMacroController();
    initMacroWindowManager();


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
    const advancedToggle = document.getElementById('advanced-mode-toggle');
    const expertToolbox = document.getElementById('expert-toolbox');

    if (advancedSlot && advancedToggle) {
        advancedSlot.addEventListener('click', () => {
            advancedToggle.checked = !advancedToggle.checked;
            updateAdvancedMode(advancedToggle.checked);
        });
        
        // Init state
        updateAdvancedMode(advancedToggle.checked);
    }

    function updateAdvancedMode(isActive) {
        state.advancedMode = isActive;
        emit('advancedModeChanged', state.advancedMode);
        
        if (isActive) {
            document.body.classList.add('mode-advanced');
            advancedSlot.classList.add('active');
            if (expertToolbox) expertToolbox.style.display = 'block';
        } else {
            document.body.classList.remove('mode-advanced');
            advancedSlot.classList.remove('active');
            if (expertToolbox) expertToolbox.style.display = 'none';
        }
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
