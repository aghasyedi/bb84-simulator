/**
 * macro_window.js - Window management for premium Turbo Automation (Movable Glassmorphism)
 */
import { state, subscribe } from './state.js';

export function initMacroWindowManager() {
    const windowEl = document.getElementById('turbo-window');
    const headerEl = document.getElementById('turbo-window-header');
    const toggleBtn = document.getElementById('btn-toggle-turbo');

    if (!windowEl || !headerEl || !toggleBtn) return;

    // --- Toggle Logic ---
    window.toggleTurboWindow = (e) => {
        const isHidden = windowEl.style.display === 'none';
        
        if (isHidden) {
            // Position near click if event exists
            if (e && e.clientX) {
                let x = e.clientX + 20;
                let y = e.clientY - 100;

                // Boundary checks
                const margin = 10;
                if (x + 320 > window.innerWidth) x = window.innerWidth - 330;
                if (y + 400 > window.innerHeight) y = window.innerHeight - 410;
                if (y < margin) y = margin;
                if (x < margin) x = margin;

                windowEl.style.left = `${x}px`;
                windowEl.style.top = `${y}px`;
                windowEl.style.transform = 'none'; // Remove the center-transform
            }
            
            windowEl.style.display = 'block';
            windowEl.style.animation = 'window-appear 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
        } else {
            windowEl.style.display = 'none';
        }
    };

    toggleBtn.addEventListener('click', (e) => window.toggleTurboWindow(e));

    // --- Draggable Logic (Apple Style) ---
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    headerEl.addEventListener('mousedown', (e) => {
        isDragging = true;
        // Calculate offset from top-left of window
        const rect = windowEl.getBoundingClientRect();
        offset.x = e.clientX - rect.left;
        offset.y = e.clientY - rect.top;
        
        headerEl.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        let x = e.clientX - offset.x;
        let y = e.clientY - offset.y;

        // Boundary constraints (Keep window partially in view)
        const margin = 10;
        x = Math.max(margin, Math.min(x, window.innerWidth - windowEl.offsetWidth - margin));
        y = Math.max(margin, Math.min(y, window.innerHeight - windowEl.offsetHeight - margin));

        windowEl.style.left = `${x}px`;
        windowEl.style.top = `${y}px`;
        windowEl.style.bottom = 'auto';
        windowEl.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        headerEl.style.cursor = 'grab';
    });

    // Handle Reset UI
    subscribe('protocolReset', () => {
        // Option to hide window on reset or keep it open? 
        // We'll keep it open but update the internal macro controller (handled in macro_controller.js)
    });
}
