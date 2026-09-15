/* ==========================================================================
   Stage 8 — shared helpers for the physics laboratories
   Math, sampling and a small dependency-free SVG charting kit.
   ========================================================================== */

export const D2R = Math.PI / 180;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Binary entropy, in bits. */
export function h2(p) {
    if (p <= 0 || p >= 1) return 0;
    return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
}

/** Poisson probability mass. */
export function pois(n, mu) {
    if (mu <= 0) return n === 0 ? 1 : 0;
    let lf = 0;
    for (let i = 2; i <= n; i++) lf += Math.log(i);
    return Math.exp(-mu + n * Math.log(mu) - lf);
}

/** Thermal (geometric / Bose-Einstein) photon-number distribution. */
export function thermal(n, mu) {
    if (mu <= 0) return n === 0 ? 1 : 0;
    const x = mu / (1 + mu);
    return (1 / (1 + mu)) * Math.pow(x, n);
}

/** Knuth sampler for Poisson(mu). */
export function poissonSample(mu) {
    if (mu <= 0) return 0;
    if (mu > 30) {
        // normal approximation is fine at this scale and much faster
        return Math.max(0, Math.round(mu + Math.sqrt(mu) * gauss()));
    }
    const L = Math.exp(-mu);
    let k = 0;
    let p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
}

/** Thermal sampler: geometric distribution on n >= 0. */
export function thermalSample(mu) {
    if (mu <= 0) return 0;
    const p = 1 / (1 + mu);
    return Math.floor(Math.log(1 - Math.random()) / Math.log(1 - p));
}

/** Box-Muller standard normal. */
export function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Binomial sample via normal approximation when n is large. */
export function binomial(n, p) {
    if (p <= 0 || n <= 0) return 0;
    if (p >= 1) return n;
    if (n * p > 20 && n * (1 - p) > 20) {
        const v = Math.round(n * p + Math.sqrt(n * p * (1 - p)) * gauss());
        return clamp(v, 0, n);
    }
    let c = 0;
    for (let i = 0; i < n; i++) if (Math.random() < p) c++;
    return c;
}

/* ------------------------------------------------------------ formatting */
export function fnum(v, digits = 3) {
    if (!isFinite(v)) return '\u2014';
    if (v !== 0 && (Math.abs(v) < 1e-3 || Math.abs(v) >= 1e5)) {
        return v.toExponential(2).replace('e', '\u00D710^').replace('\u00D710^+', '\u00D710^');
    }
    return v.toFixed(digits);
}

export function fpct(v, digits = 2) {
    if (!isFinite(v)) return '\u2014';
    if (v !== 0 && Math.abs(v) < 1e-4) return v.toExponential(1);
    return (v * 100).toFixed(digits) + ' %';
}

export function fsci(v, digits = 2) {
    if (!isFinite(v)) return '\u2014';
    if (v === 0) return '0';
    return v.toExponential(digits);
}

export function fgroup(v) {
    return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
}

export const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ------------------------------------------------------------------ dom */
export const $ = (id) => document.getElementById(id);

export function onSlider(id, outId, format, onChange) {
    const input = $(id);
    const out = outId ? $(outId) : null;
    if (!input) return;
    const fire = () => {
        const v = parseFloat(input.value);
        if (out) out.textContent = format ? format(v) : String(v);
        if (onChange) onChange(v);
    };
    input.addEventListener('input', fire);
    return fire;
}

/** Click delegation: fires fn(dataset, button) for any button inside root. */
export function onButtons(rootId, fn) {
    const root = $(rootId);
    if (!root) return;
    root.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn || !root.contains(btn)) return;
        fn(btn.dataset, btn);
    });
}

export function setActive(rootId, btn) {
    const root = $(rootId);
    if (!root) return;
    root.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === btn));
}

/* --------------------------------------------------------------- charts */
const AXIS = 'var(--border-color)';
const GRID = 'var(--border-color)';

/**
 * Generic SVG line/scatter plot.
 * series: [{ points:[[x,y]...], color, width, dash, fill (area under curve), name }]
 * markers: [{ x, y, color, label }]
 */
export function plot(o) {
    const w = o.w || 640;
    const h = o.h || 280;
    const m = o.margin || { t: 14, r: 16, b: 38, l: 58 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    const xMin = o.xMin != null ? o.xMin : 0;
    const xMax = o.xMax != null ? o.xMax : 1;
    const yMin = o.yMin != null ? o.yMin : 0;
    const yMax = o.yMax != null ? o.yMax : 1;
    const logY = !!o.logY;
    const floor = o.yFloor || 1e-14;
    const ly = (v) => Math.log10(Math.max(v, floor));

    const sx = (x) => m.l + ((x - xMin) / (xMax - xMin || 1)) * iw;
    const sy = (y) => {
        const t = logY
            ? (ly(y) - ly(yMin)) / (ly(yMax) - ly(yMin) || 1)
            : (y - yMin) / (yMax - yMin || 1);
        return m.t + ih - clamp(t, 0, 1) * ih;
    };

    let s = `<svg class="ob-chart" viewBox="0 0 ${w} ${h}" role="img">`;

    /* horizontal grid + y ticks */
    const yTicks = o.yTicks || autoTicks(logY ? ly(yMin) : yMin, logY ? ly(yMax) : yMax, logY);
    yTicks.forEach((t) => {
        const val = logY ? Math.pow(10, t) : t;
        const y = sy(val);
        s += `<line class="ob-grid" x1="${m.l}" y1="${y}" x2="${m.l + iw}" y2="${y}" stroke="${GRID}"/>`;
        s += `<text class="ob-tick" x="${m.l - 8}" y="${y + 3.5}" text-anchor="end">${esc(o.fmtY ? o.fmtY(val) : (logY ? fsci(val, 0) : val.toFixed(2)))}</text>`;
    });

    /* vertical grid + x ticks */
    const xTicks = o.xTicks || autoTicks(xMin, xMax, false, 6);
    xTicks.forEach((t) => {
        const x = sx(t);
        s += `<line class="ob-grid" x1="${x}" y1="${m.t}" x2="${x}" y2="${m.t + ih}" stroke="${GRID}" opacity="0.5"/>`;
        s += `<text class="ob-tick" x="${x}" y="${m.t + ih + 16}" text-anchor="middle">${esc(o.fmtX ? o.fmtX(t) : String(round(t, 2)))}</text>`;
    });

    /* frame */
    s += `<rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="none" stroke="${AXIS}"/>`;

    /* shaded bands */
    (o.bands || []).forEach((b) => {
        const x1 = sx(b.from), x2 = sx(b.to);
        s += `<rect x="${Math.min(x1, x2)}" y="${m.t}" width="${Math.abs(x2 - x1)}" height="${ih}" fill="${b.color}" opacity="${b.opacity || 0.12}"/>`;
        if (b.label) s += `<text class="ob-band-label" x="${(x1 + x2) / 2}" y="${m.t + 13}" text-anchor="middle" fill="${b.textColor || 'var(--text-muted)'}">${esc(b.label)}</text>`;
    });

    /* series */
    (o.series || []).forEach((se) => {
        const pts = se.points.filter((p) => isFinite(p[1]) && (logY ? p[1] > 0 : true));
        if (!pts.length) return;
        if (se.fill) {
            const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0])} ${sy(p[1])}`).join(' ') +
                ` L${sx(pts[pts.length - 1][0])} ${sy(yMin)} L${sx(pts[0][0])} ${sy(yMin)} Z`;
            s += `<path d="${d}" fill="${se.color}" opacity="${se.fillOpacity || 0.12}"/>`;
        }
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0])} ${sy(p[1])}`).join(' ');
        s += `<path d="${d}" fill="none" stroke="${se.color}" stroke-width="${se.width || 2}" stroke-linejoin="round"${se.dash ? ` stroke-dasharray="${se.dash}"` : ''}/>`;
    });

    /* markers on top */
    (o.markers || []).forEach((mk) => {
        const x = sx(mk.x), y = sy(mk.y);
        s += `<line x1="${x}" y1="${m.t}" x2="${x}" y2="${m.t + ih}" stroke="${mk.color}" stroke-width="1" stroke-dasharray="3 3" opacity="0.55"/>`;
        s += `<circle cx="${x}" cy="${y}" r="5" fill="${mk.color}" stroke="var(--bg-panel)" stroke-width="1.5"/>`;
        if (mk.label) {
            const right = x > m.l + iw * 0.72;
            s += `<text class="ob-marker-label" x="${right ? x - 8 : x + 8}" y="${y - 8}" text-anchor="${right ? 'end' : 'start'}" fill="${mk.color}">${esc(mk.label)}</text>`;
        }
    });

    /* axis titles */
    if (o.xLabel) s += `<text class="ob-axis-label" x="${m.l + iw / 2}" y="${h - 4}" text-anchor="middle">${esc(o.xLabel)}</text>`;
    if (o.yLabel) s += `<text class="ob-axis-label" x="12" y="${m.t + ih / 2}" text-anchor="middle" transform="rotate(-90 12 ${m.t + ih / 2})">${esc(o.yLabel)}</text>`;

    s += `</svg>`;
    return s;
}

/**
 * Grouped / single bar chart.
 * series: [{ name, color, values: [numbers] }]; labels: [strings]
 */
export function bars(o) {
    const w = o.w || 640;
    const h = o.h || 250;
    const m = o.margin || { t: 14, r: 14, b: 38, l: 50 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    const labels = o.labels || [];
    const series = o.series || [];
    const yMax = o.yMax != null ? o.yMax : Math.max(0.001, ...series.flatMap((s) => s.values));
    const sy = (v) => m.t + ih - clamp(v / yMax, 0, 1) * ih;

    let s = `<svg class="ob-chart" viewBox="0 0 ${w} ${h}" role="img">`;
    const ticks = autoTicks(0, yMax, false, 5);
    ticks.forEach((t) => {
        const y = sy(t);
        s += `<line class="ob-grid" x1="${m.l}" y1="${y}" x2="${m.l + iw}" y2="${y}" stroke="${GRID}"/>`;
        s += `<text class="ob-tick" x="${m.l - 8}" y="${y + 3.5}" text-anchor="end">${esc(o.fmtY ? o.fmtY(t) : t.toFixed(2))}</text>`;
    });

    const groupW = iw / Math.max(1, labels.length);
    const nS = Math.max(1, series.length);
    const barW = Math.min(o.barMax || 34, (groupW * 0.72) / nS);

    labels.forEach((lab, i) => {
        const gx = m.l + i * groupW + groupW / 2;
        series.forEach((se, j) => {
            const v = se.values[i] || 0;
            const x = gx - (nS * barW) / 2 + j * barW;
            const y = sy(v);
            s += `<rect x="${x + 1}" y="${y}" width="${barW - 2}" height="${Math.max(0, m.t + ih - y)}" fill="${se.color}" opacity="${se.opacity || 0.9}" rx="2"/>`;
            if (o.showValues && v > 0) {
                s += `<text class="ob-bar-value" x="${x + barW / 2}" y="${y - 4}" text-anchor="middle">${esc(o.fmtV ? o.fmtV(v) : v.toFixed(3))}</text>`;
            }
        });
        s += `<text class="ob-tick" x="${gx}" y="${m.t + ih + 16}" text-anchor="middle">${esc(lab)}</text>`;
    });

    s += `<line x1="${m.l}" y1="${m.t + ih}" x2="${m.l + iw}" y2="${m.t + ih}" stroke="${AXIS}"/>`;
    if (o.xLabel) s += `<text class="ob-axis-label" x="${m.l + iw / 2}" y="${h - 4}" text-anchor="middle">${esc(o.xLabel)}</text>`;
    if (o.yLabel) s += `<text class="ob-axis-label" x="12" y="${m.t + ih / 2}" text-anchor="middle" transform="rotate(-90 12 ${m.t + ih / 2})">${esc(o.yLabel)}</text>`;
    s += `</svg>`;
    return s;
}

function autoTicks(a, b, isLog, count = 5) {
    const out = [];
    if (isLog) {
        const lo = Math.floor(a), hi = Math.ceil(b);
        for (let e = lo; e <= hi; e++) out.push(e);
        return out;
    }
    if (b === a) return [a];
    const raw = (b - a) / count;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
    const start = Math.ceil(a / step) * step;
    for (let v = start; v <= b + step * 1e-6; v += step) out.push(round(v, 6));
    return out;
}

function round(v, d) {
    const p = Math.pow(10, d);
    return Math.round(v * p) / p;
}

/* --------------------------------------------------------- small widgets */
/** Key/value rows used by nearly every readout panel. */
export function statTable(rows) {
    return `<div class="ob-stats">${rows.map(([k, v, tone]) =>
        `<div class="ob-stat${tone ? ' ob-stat-' + tone : ''}"><span class="ob-stat-k">${k}</span><span class="ob-stat-v">${v}</span></div>`
    ).join('')}</div>`;
}

/** HTML data table from a matrix. */
export function table(head, rows, opts = {}) {
    const align = opts.align || [];
    return `<table class="ob-table${opts.compact ? ' ob-table-compact' : ''}"><thead><tr>${
        head.map((h, i) => `<th${align[i] ? ' style="text-align:' + align[i] + '"' : ''}>${h}</th>`).join('')
    }</tr></thead><tbody>${
        rows.map((r) => `<tr>${r.map((c, i) =>
            `<td${align[i] ? ' style="text-align:' + align[i] + '"' : ''}${typeof c === 'object' && c.tone ? ' class="ob-td-' + c.tone + '"' : ''}>${typeof c === 'object' ? c.v : c}</td>`
        ).join('')}</tr>`).join('')
    }</tbody></table>`;
}

/** Horizontal probability bar. */
export function probBar(label, p, color) {
    return `<div class="ob-prob">
        <span class="ob-prob-label">${label}</span>
        <span class="ob-prob-track"><span class="ob-prob-fill" style="width:${(clamp(p, 0, 1) * 100).toFixed(2)}%; background:${color}"></span></span>
        <span class="ob-prob-val">${fpct(p)}</span>
    </div>`;
}

export function note(html, tone) {
    return `<div class="ob-note${tone ? ' ob-note-' + tone : ''}">${html}</div>`;
}
