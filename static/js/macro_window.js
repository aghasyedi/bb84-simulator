/**
 * macro_window.js - Window management for premium Turbo Automation (Movable Glassmorphism)
 *
 * Contract:
 *  - window.toggleTurboWindow()        -> toggles
 *  - window.toggleTurboWindow(true)    -> open
 *  - window.toggleTurboWindow(false)   -> close
 *  (the header "x" button calls it with no argument)
 *
 * The panel is ALWAYS kept fully inside the viewport: on open, while dragging,
 * on window resize and on scroll. It is anchored to the Advanced button in the
 * sidebar rather than to raw cursor coordinates, so it can never be spawned
 * half off-screen.
 */
import { subscribe } from './state.js';

const MARGIN = 12;

export function initMacroWindowManager() {
    const windowEl = document.getElementById('turbo-window');
    const headerEl = document.getElementById('turbo-window-header');
    const anchorEl = document.getElementById('btn-toggle-turbo');

    if (!windowEl || !headerEl) return;

    let hasPosition = false;

    const isOpen = () => windowEl.style.display === 'block';

    /** Clamp a desired top-left position so the whole panel stays on screen. */
    const clamp = (x, y) => {
        const w = windowEl.offsetWidth;
        const h = windowEl.offsetHeight;
        const maxX = Math.max(MARGIN, window.innerWidth - w - MARGIN);
        const maxY = Math.max(MARGIN, window.innerHeight - h - MARGIN);
        return {
            x: Math.round(Math.min(Math.max(x, MARGIN), maxX)),
            y: Math.round(Math.min(Math.max(y, MARGIN), maxY))
        };
    };

    const placeAt = (x, y) => {
        const p = clamp(x, y);
        windowEl.style.left = `${p.x}px`;
        windowEl.style.top = `${p.y}px`;
        windowEl.style.right = 'auto';
        windowEl.style.bottom = 'auto';
        // Explicit left/top — drop the CSS centring transform.
        windowEl.style.transform = 'none';
        hasPosition = true;
    };

    /** Open next to the Advanced toggle, vertically aligned to it. */
    const placeNearAnchor = () => {
        if (anchorEl) {
            const r = anchorEl.getBoundingClientRect();
            placeAt(r.right + MARGIN, r.top - 8);
        } else {
            placeAt(
                (window.innerWidth - windowEl.offsetWidth) / 2,
                (window.innerHeight - windowEl.offsetHeight) / 2
            );
        }
    };

    /** Re-clamp the current position (resize / scroll / reopen). */
    const keepInsideViewport = () => {
        if (!isOpen()) return;
        if (!hasPosition) {
            placeNearAnchor();
            return;
        }
        const r = windowEl.getBoundingClientRect();
        placeAt(r.left, r.top);
    };

    window.toggleTurboWindow = (forceOpen) => {
        const open = typeof forceOpen === 'boolean' ? forceOpen : !isOpen();

        if (!open) {
            windowEl.style.display = 'none';
            return;
        }

        windowEl.style.display = 'block';
        keepInsideViewport();

        // Restart the appear animation on every open.
        windowEl.style.animation = 'none';
        void windowEl.offsetWidth;
        windowEl.style.animation = '';
    };

    // --- Dragging (pointer events so it also works with touch / pen) ---
    let drag = null;

    headerEl.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 && event.pointerType === 'mouse') return;
        // Don't start a drag from the close button.
        if (event.target.closest('.header-close')) return;

        const rect = windowEl.getBoundingClientRect();
        drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
        headerEl.style.cursor = 'grabbing';
        try { headerEl.setPointerCapture(event.pointerId); } catch (e) { /* no-op */ }
        event.preventDefault();
    });

    headerEl.addEventListener('pointermove', (event) => {
        if (!drag) return;
        placeAt(event.clientX - drag.dx, event.clientY - drag.dy);
    });

    const endDrag = (event) => {
        if (!drag) return;
        drag = null;
        headerEl.style.cursor = 'grab';
        try { headerEl.releasePointerCapture(event.pointerId); } catch (e) { /* no-op */ }
    };
    headerEl.addEventListener('pointerup', endDrag);
    headerEl.addEventListener('pointercancel', endDrag);

    // Never let a resize or scroll strand the panel off-screen.
    window.addEventListener('resize', keepInsideViewport);
    window.addEventListener('scroll', keepInsideViewport, true);

    // Escape closes the panel.
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isOpen()) windowEl.style.display = 'none';
    });

    subscribe('protocolReset', () => {
        // Panel intentionally stays open; macro_controller.js resets its internals.
        keepInsideViewport();
    });
}
