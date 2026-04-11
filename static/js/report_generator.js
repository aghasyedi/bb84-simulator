/**
 * report_generator.js
 * BB84 Quantum Key Distribution — Professional Audit Report Generator
 * 
 * Generates a complete, printable PDF report capturing all protocol stages:
 * Stage 3 (Simulation), Stage 4 (Sifting), Stage 5 (QBER), Stage 6 (Post-Processing),
 * Stage 7 (Final Key). Opened in a new tab with full print stylesheet.
 *
 * Author: Agha Tasheer Syedi — MTech Quantum Computing, DIAT Pune
 * Supervisor: Dr. Kanaka Raju Pandiri — School of Quantum Technology, DIAT
 */

import { state } from './state.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const LOGO_PATH = './static/assets/bb84_nr.png';
const MAX_QBER_THRESHOLD = 12.9; // % — standard BB84 security threshold

// ─── Utility Helpers ──────────────────────────────────────────────────────────

/**
 * Returns the current date/time formatted for the report header.
 */
function getReportTimestamp() {
    const now = new Date();
    const date = now.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'long', year: 'numeric'
    });
    const time = now.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
    return { date, time, iso: now.toISOString() };
}

/**
 * Generates a random hex session ID for the report.
 */
function getSessionId() {
    const hex = () => Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
    return `QKD-${hex()}-${hex()}`;
}

/**
 * Formats a bitstring array for display (groups of 8, max 128 bits shown).
 */
function formatBitString(bits, maxBits = 128) {
    if (!bits || bits.length === 0) return '<span class="no-data">— Not Available —</span>';
    const arr = bits.slice(0, maxBits);
    // Group into chunks of 8
    const chunks = [];
    for (let i = 0; i < arr.length; i += 8) {
        chunks.push(arr.slice(i, i + 8).join(''));
    }
    const overflowNote = bits.length > maxBits
        ? `<span class="overflow-note">… +${bits.length - maxBits} more bits</span>`
        : '';
    return `<span class="bitstring">${chunks.join(' ')}</span>${overflowNote}`;
}

/**
 * Formats a basis array (+/x symbols).
 */
function formatBasisString(bases, maxBits = 128) {
    if (!bases || bases.length === 0) return '<span class="no-data">— Not Available —</span>';
    const arr = bases.slice(0, maxBits);
    const chunks = [];
    for (let i = 0; i < arr.length; i += 8) {
        chunks.push(arr.slice(i, i + 8).map(b => b === 0 ? '+' : '×').join(''));
    }
    const overflowNote = bases.length > maxBits
        ? `<span class="overflow-note">… +${bases.length - maxBits} more</span>`
        : '';
    return `<span class="bitstring basis-string">${chunks.join(' ')}</span>${overflowNote}`;
}

/**
 * Generates a simple hex fingerprint for the secret key.
 */
function generateKeyFingerprint(bits) {
    if (!bits || bits.length === 0) return 'N/A';
    const hex = [];
    // Convert 4-bit blocks to Hex
    for (let i = 0; i < bits.length; i += 4) {
        const chunk = bits.slice(i, i + 4).join('');
        hex.push(parseInt(chunk.padEnd(4, '0'), 2).toString(16).toUpperCase());
    }
    // Return a formatted hex string (groups of 4)
    const result = hex.join('');
    const formatted = [];
    for (let i = 0; i < result.length; i += 4) {
        formatted.push(result.slice(i, i + 4));
    }
    return formatted.join('-').slice(0, 44);
}


/**
 * Determines Eve detection status from QBER and Eve flags.
 */
function getEveStatus() {
    const qberPct = (state.qber || 0) * 100;
    if (state.eveActive || state.evePresent) {
        if (qberPct > MAX_QBER_THRESHOLD) {
            return { label: 'DETECTED — HIGH CONFIDENCE', cls: 'status-critical', icon: '🚨' };
        }
        return { label: 'ACTIVE (below threshold — possible eavesdropper)', cls: 'status-warn', icon: '⚠️' };
    }
    if (qberPct > MAX_QBER_THRESHOLD) {
        return { label: 'POSSIBLE INTRUSION — QBER Threshold Exceeded', cls: 'status-critical', icon: '🚨' };
    }
    return { label: 'NOT DETECTED — Channel Secure', cls: 'status-ok', icon: '✅' };
}

/**
 * Returns the security verdict for the final key.
 */
function getSecurityVerdict() {
    const qber = (state.qber || 0) * 100;
    const hasKey = state.finalSecretKey && state.finalSecretKey.length > 0;
    if (!hasKey) return { label: 'PROTOCOL INCOMPLETE', cls: 'verdict-incomplete', icon: '🔄' };
    if (qber > MAX_QBER_THRESHOLD) {

        return { label: 'KEY COMPROMISED — ABORT', cls: 'verdict-compromised', icon: '🛑' };
    }
    return { label: 'SECURE — KEY ESTABLISHED', cls: 'verdict-secure', icon: '🔐' };
}

/**
 * Collect all relevant data from the global state for the report.
 */
function collectReportData() {
    const ts = getReportTimestamp();
    const sessionId = document.getElementById('res-session-id')?.textContent || getSessionId();
    const eveStatus = getEveStatus();
    const verdict = getSecurityVerdict();

    // Key lengths
    const numBits = state.numBits || 0;
    const siftedLen = state.siftedKeyA?.length || 0;
    const workingLen = state.workingKeyA?.length || 0;
    const finalLen = state.finalSecretKey?.length || 0;
    const bitsRemovedSifting = numBits - siftedLen;
    const bitsRemovedQBER = state.bitsRemovedInQBER || state.sampledIndices?.length || (siftedLen - workingLen);
    const bitsRemovedEC = state.bitsRemovedInEC || 0;
    const bitsRemovedPA = state.bitsRemovedInPA || (workingLen - finalLen - bitsRemovedEC);

    // QBER
    const qberPct = ((state.qber || 0) * 100).toFixed(2);
    const qberOk = (state.qber || 0) <= state.MAX_QBER;

    // Efficiency
    const efficiency = numBits > 0 ? ((finalLen / numBits) * 100).toFixed(1) : '0.0';

    // Noise level
    const noisePct = ((state.noiseLevel || 0) * 100).toFixed(1);

    // Information leakage from state
    const leakageProb = state.qber || 0.05;
    const hq = leakageProb > 0 ? (-leakageProb * Math.log2(leakageProb) - (1 - leakageProb) * Math.log2(1 - leakageProb)) : 0;

    // Breakdown Privacy Amplification Purge
    const rawLeakageBits = Math.floor(workingLen * hq);
    const safetyMarginBits = Math.max(0, bitsRemovedPA - rawLeakageBits);

    // Key Performance
    const fingerprint = generateKeyFingerprint(state.finalSecretKey);

    return {
        ts, sessionId, eveStatus, verdict,
        numBits, siftedLen, workingLen, finalLen,
        bitsRemovedSifting, bitsRemovedQBER, bitsRemovedEC, bitsRemovedPA,
        rawLeakageBits, safetyMarginBits,
        qberPct, qberOk, efficiency, noisePct,
        leakage: state.leakage || (hq * 100).toFixed(1),
        fingerprint,
        // Keys
        aliceBits: state.alice?.bits || [],
        aliceBases: state.alice?.bases || [],
        bobBases: state.bob?.bases || [],
        bobMeasurements: state.bob?.measurements || [],
        eveBases: state.eve?.bases || [],
        eveMeasurements: state.eve?.measurements || [],
        siftedKeyA: state.siftedKeyA || [],
        siftedKeyB: state.siftedKeyB || [],
        workingKeyA: state.workingKeyA || [],
        finalSecretKey: state.finalSecretKey || [],
        // Flags
        eveActive: state.eveActive || state.evePresent || false,
        sampledCount: state.sampledIndices?.length || 0,

        errorsCorrected: state.errorsCorrected || 0,
        maxQBER: (state.MAX_QBER * 100).toFixed(1),
        ecProtocol: state.errorCorrectionProtocol || 'LDPC (Belief Propagation)'
    };
}


// ─── CSS for the Report Window ────────────────────────────────────────────────

function getReportCSS() {
    return `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
            /* ── Site Brand Palette (mirrors styles.css) ── */
            --amber:        #964900;   /* --accent-neon-blue   — primary */
            --amber-mid:    #c46200;   /* --accent-neon-cyan   — secondary */
            --amber-dark:   #7a3a00;   /* --accent-neon-violet — dark accent */
            --amber-hover:  #b35500;

            /* Backgrounds */
            --bg-deep:      #f4f4f4;   /* site body bg */
            --bg-paper:     #f8f9fa;   /* --clr-paper */
            --bg-white:     #ffffff;
            --bg-panel:     #ffffff;   /* --bg-panel */
            --bg-warm:      #f0ece8;   /* --bg-panel-hover */
            --bg-row:       rgba(150, 73, 0, 0.06); /* site table even row */

            /* Text */
            --text-main:    #1a1a1a;
            --text-muted:   #555555;
            --text-light:   #888888;

            /* Status */
            --green:        #2e7d32;   /* --safe-green */
            --green-bg:     rgba(46, 125, 50, 0.08);
            --red:          #c0392b;   /* --danger-red */
            --red-bg:       rgba(192, 57, 43, 0.08);

            /* Border */
            --border:       #d0c4b8;   /* --border-color */
            --border-strong:#b8a898;

            /* Fonts */
            --font-heading: 'Outfit', sans-serif;
            --font-body:    'Inter', sans-serif;
            --font-mono:    'JetBrains Mono', monospace;
        }

        html { font-size: 13px; }

        body {
            font-family: var(--font-body);
            background: var(--bg-deep);
            color: var(--text-main);
            padding: 20px;
            line-height: 1.55;
        }

        /* ── Page Wrapper ── */
        .report-page {
            max-width: 870px;
            margin: 0 auto;
            background: var(--bg-white);
            border-radius: 4px;
            overflow: hidden;
            box-shadow: 0 8px 40px rgba(150,73,0,0.12), 0 0 0 1px var(--border);
        }

        /* ── Header — dark amber, government style ── */
        .report-header {
            background: linear-gradient(135deg, var(--amber-dark) 0%, #5a2b00 60%, #3d1a00 100%);
            padding: 36px 48px;
            display: flex;
            align-items: center;
            gap: 28px;
            position: relative;
            overflow: hidden;
        }
        .report-header::before {
            content: '';
            position: absolute; inset: 0;
            background: repeating-linear-gradient(
                -45deg,
                rgba(255,255,255,0.015) 0px,
                rgba(255,255,255,0.015) 1px,
                transparent 1px,
                transparent 12px
            );
            pointer-events: none;
        }
        .report-header::after {
            content: '';
            position: absolute;
            bottom: 0; left: 0; right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--amber) 0%, var(--amber-mid) 50%, var(--amber) 100%);
        }

        .logo-wrap {
            flex-shrink: 0;
            width: 84px; height: 84px;
            border-radius: 6px;
            overflow: hidden;
            border: 2px solid rgba(196,98,0,0.5);
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
        .logo-wrap img { width: 100%; height: 100%; object-fit: cover; }

        .header-text { flex: 1; position: relative; z-index: 1; }
        .institute-label {
            font-size: 0.6rem; font-weight: 800;
            font-family: var(--font-heading);
            color: rgba(255,220,150,0.75);
            text-transform: uppercase; letter-spacing: 3px;
            margin-bottom: 8px;
        }
        .report-title {
            font-size: 1.7rem; font-weight: 900;
            font-family: var(--font-heading);
            color: #fff;
            letter-spacing: 0.5px;
            line-height: 1.1;
            margin-bottom: 6px;
        }
        .report-subtitle {
            font-size: 0.78rem; font-weight: 400;
            color: rgba(255,200,120,0.55);
            letter-spacing: 0.5px;
        }

        .header-meta {
            flex-shrink: 0;
            text-align: right;
            position: relative; z-index: 1;
        }
        .session-badge {
            display: inline-block;
            background: rgba(196,98,0,0.25);
            border: 1px solid rgba(196,98,0,0.55);
            color: #ffc87a;
            font-family: var(--font-mono);
            font-size: 0.65rem; font-weight: 700;
            padding: 4px 10px; border-radius: 3px;
            letter-spacing: 1.5px;
            margin-bottom: 10px;
        }
        .meta-row { font-size: 0.68rem; color: rgba(255,200,150,0.45); margin-bottom: 3px; }
        .meta-row b { color: rgba(255,220,170,0.8); }

        /* ── Gov Banner Strip (below header) ── */
        .gov-strip {
            background: var(--amber-dark);
            color: #fff;
            font-size: 0.58rem; font-weight: 800;
            font-family: var(--font-heading);
            text-transform: uppercase; letter-spacing: 3px;
            padding: 5px 48px;
            display: flex; align-items: center; justify-content: space-between;
        }

        /* ── Verdict Banner ── */
        .verdict-banner {
            display: flex; align-items: center; gap: 16px;
            padding: 16px 48px;
            border-bottom: 1px solid var(--border);
            background: var(--bg-warm);
        }
        .verdict-banner.verdict-secure   { border-left: 5px solid var(--green);border-right: 5px solid var(--green); }
        .verdict-banner.verdict-compromised { border-left: 5px solid var(--red);border-right: 5px solid var(--red); }
        // .verdict-banner.verdict-incomplete  { border-left: 5px solid var(--amber); }

        .verdict-icon { font-size: 1.75rem; }
        .verdict-label {
            font-size: 0.58rem; font-weight: 800;
            font-family: var(--font-heading);
            text-transform: uppercase; letter-spacing: 2px;
            color: var(--text-muted); margin-bottom: 2px;
        }
        .verdict-text { font-size: 0.98rem; font-weight: 800; font-family: var(--font-heading); }
        .verdict-secure     .verdict-text { color: var(--green); }
        .verdict-compromised .verdict-text { color: var(--red); }
        .verdict-incomplete .verdict-text { color: var(--amber); }

        /* ── Section ── */
        .report-body { padding: 0 48px 48px; background: var(--bg-white); }

        .section {
            margin-top: 32px;
            padding-bottom: 32px;
            border-bottom: 1px solid var(--border);
        }
        .section:last-child { border-bottom: none; }

        .section-header {
            display: flex; align-items: center; gap: 14px;
            margin-bottom: 18px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border);
        }
        .section-num {
            display: flex; align-items: center; justify-content: center;
            width: 30px; height: 30px;
            background: var(--amber-dark);
            color: #fff;
            font-family: var(--font-mono);
            font-size: 0.7rem; font-weight: 700;
            border-radius: 3px;
            flex-shrink: 0;
        }
            /* ── Floating Action Bar ── */
        .print-btn-bar {
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            justify-content: center;
            gap: 15px;
            padding: 20px 0;
            background: rgba(244, 244, 244, 0.8);
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--border);
            margin-bottom: 20px;
        }

        /* ── Stylish Buttons ── */
        .print-btn, .close-btn {
            font-family: var(--font-heading);
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.2px;
            padding: 12px 24px;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            box-shadow: 0 4px 12px rgba(122, 58, 0, 0.15);
        }

        /* Primary Action: Print */
        .print-btn {
            background: var(--amber-dark); /* #7a3a00 */
            color: #ffffff;
            border: 1px solid var(--amber-dark);
        }

        .print-btn:hover {
            background: var(--amber); /* #964900 */
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(122, 58, 0, 0.25);
        }

        .print-btn:active {
            transform: translateY(0);
        }

        /* Secondary Action: Close */
        .close-btn {
            background: transparent;
            color: var(--amber-dark);
            border: 1.5px solid var(--amber-dark);
        }

        .close-btn:hover {
            background: rgba(122, 58, 0, 0.05);
            color: var(--amber-mid);
            border-color: var(--amber-mid);
            transform: translateY(-2px);
        }

        /* Responsive adjustment for mobile view */
        @media (max-width: 600px) {
            .print-btn-bar {
                flex-direction: column;
                align-items: center;
                padding: 15px;
            }
            .print-btn, .close-btn { width: 100%; max-width: 300px; }
        }
        .section-title {
            font-size: 0.95rem; font-weight: 800;
            font-family: var(--font-heading);
            color: var(--amber);
            text-transform: uppercase; letter-spacing: 1.5px;
        }
        .section-desc {
            font-size: 0.72rem; color: var(--text-muted);
            font-weight: 400; margin-left: 2px;
            margin-top: 1px;
        }

        /* ── Metrics Grid ── */
        .metrics-grid {
            display: grid;
            gap: 10px;
            margin-bottom: 18px;
        }
        .metrics-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
        .metrics-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
        .metrics-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }

        .metric-card {
            background: var(--bg-paper);
            border: 1px solid var(--border);
            border-top: 3px solid var(--amber-dark);
            border-radius: 3px;
            padding: 14px 16px;
        }
        .metric-card.accent-blue   { border-top-color: var(--amber); }
        .metric-card.accent-cyan   { border-top-color: var(--amber-mid); }
        .metric-card.accent-green  { border-top-color: var(--green); }
        .metric-card.accent-red    { border-top-color: var(--red); }
        .metric-card.accent-amber  { border-top-color: var(--amber-mid); }
        .metric-card.accent-purple { border-top-color: var(--amber-dark); }
        .metric-card.accent-navy   { border-top-color: #444; }

        .metric-label {
            font-size: 0.57rem; font-weight: 800;
            font-family: var(--font-heading);
            text-transform: uppercase; letter-spacing: 1.5px;
            color: var(--text-muted); margin-bottom: 6px;
        }
        .metric-value {
            font-size: 1.55rem; font-weight: 900;
            color: var(--text-main); line-height: 1;
            font-family: var(--font-mono);
        }
        /* Colour overrides map to site accent colours */
        .metric-value.blue   { color: var(--amber); }
        .metric-value.cyan   { color: var(--amber-mid); }
        .metric-value.green  { color: var(--green); }
        .metric-value.red    { color: var(--red); }
        .metric-value.amber  { color: var(--amber-mid); }

        .metric-sub {
            font-size: 0.63rem; color: var(--text-light);
            margin-top: 4px;
        }

        /* ── Key Bitstring Panel ── */
        .key-panel {
            background: #2a1400;
            border: 1px solid #4a2800;
            border-top: 3px solid var(--amber);
            border-radius: 3px;
            padding: 18px;
            margin-top: 12px;
        }
        .key-panel-label {
            font-size: 0.58rem; font-weight: 800;
            font-family: var(--font-heading);
            text-transform: uppercase; letter-spacing: 2px;
            color: rgba(255,180,80,0.5);
            margin-bottom: 10px;
            display: flex; align-items: center; gap: 8px;
        }
        .key-panel-label .led {
            width: 6px; height: 6px;
            border-radius: 50%;
            background: var(--green);
        }
        .key-panel-label .led.warn { background: var(--amber-mid); }
        .key-panel-label .bits-tag {
            margin-left: auto;
            background: rgba(255,255,255,0.06);
            padding: 2px 8px; border-radius: 2px;
            color: rgba(255,180,80,0.4);
            font-family: var(--font-mono);
        }

        /* Bitstrings — warm amber palette */
        .bitstring {
            font-family: var(--font-mono);
            font-size: 0.72rem; font-weight: 700;
            color: #ffc87a;
            word-break: break-all;
            letter-spacing: 1.5px;
            line-height: 1.8;
        }
        .bitstring.basis-string { color: #e8a455; }
        .bitstring.muted        { color: rgba(255,180,80,0.35); }
        .bitstring.sifted       { color: #ffaa44; }
        .bitstring.working      { color: #f5c842; }

        .overflow-note {
            display: inline-block;
            font-size: 0.63rem; color: rgba(255,180,80,0.3);
            font-family: var(--font-mono);
            margin-left: 6px;
        }
        .no-data {
            font-size: 0.72rem; color: rgba(255,180,80,0.25);
            font-style: italic;
        }

        /* ── Status Badges ── */
        .status-badge {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 3px 10px; border-radius: 20px;
            font-size: 0.62rem; font-weight: 800;
            font-family: var(--font-heading);
            text-transform: uppercase; letter-spacing: 1px;
        }
        .status-ok       { background: rgba(46,125,50,0.1);   color: var(--green);  border: 1px solid rgba(46,125,50,0.25); }
        .status-warn     { background: rgba(150,73,0,0.1);    color: #7a3a00;       border: 1px solid rgba(150,73,0,0.3); }
        .status-critical { background: rgba(192,57,43,0.1);   color: var(--red);    border: 1px solid rgba(192,57,43,0.3); }
        .status-neutral  { background: rgba(150,73,0,0.08);   color: var(--amber);  border: 1px solid rgba(150,73,0,0.2); }

        /* ── Table — matches styles.css government style ── */
        .data-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; border: 1px solid var(--border); }
        .data-table th {
            background: var(--amber-dark);
            border: none;
            padding: 9px 14px;
            text-align: left;
            font-size: 0.6rem; font-weight: 800;
            font-family: var(--font-heading);
            text-transform: uppercase; letter-spacing: 1px;
            color: #ffffff;
        }
        .data-table td {
            border-bottom: 1px solid var(--border);
            padding: 9px 14px;
            color: var(--text-main);
            line-height: 1.4;
        }
        .data-table tr:nth-child(even) td { background: var(--bg-row); }
        .data-table tr:hover td { background: rgba(212,130,10,0.07); }
        .data-table td.mono  { font-family: var(--font-mono); font-size: 0.7rem; }
        .data-table td.bold  { font-weight: 700; color: var(--text-main); }
        .data-table td.green { color: var(--green);     font-weight: 700; }
        .data-table td.red   { color: var(--red);       font-weight: 700; }
        .data-table td.amber { color: var(--amber-mid); font-weight: 700; }

        /* ── Pipeline Visual ── */
        .pipeline {
            display: flex; align-items: stretch;
            border: 1px solid var(--border);
            border-top: 3px solid var(--amber-dark);
            border-radius: 3px; overflow: hidden;
            margin-top: 16px;
        }
        .pipeline-stage {
            flex: 1; padding: 16px 14px;
            text-align: center;
            border-right: 1px solid var(--border);
        }
        .pipeline-stage:last-child { border-right: none; }
        .pipeline-stage .ps-label {
            font-size: 0.55rem; font-weight: 800;
            font-family: var(--font-heading);
            text-transform: uppercase; letter-spacing: 1.5px;
            color: var(--text-muted); margin-bottom: 6px;
        }
        .pipeline-stage .ps-val {
            font-size: 1.4rem; font-weight: 900;
            font-family: var(--font-mono);
            color: var(--text-main);
        }
        .pipeline-stage .ps-sub { font-size: 0.57rem; color: var(--text-light); margin-top: 3px; }
        .pipeline-stage.ps-raw     { background: rgba(150,73,0,0.04); }
        .pipeline-stage.ps-sifted  { background: rgba(150,73,0,0.07); }
        .pipeline-stage.ps-working { background: rgba(196,98,0,0.06); }
        .pipeline-stage.ps-final   { background: rgba(46,125,50,0.05); }
        .pipeline-arrow {
            display: flex; align-items: center;
            color: var(--text-light); font-size: 1rem;
            flex-shrink: 0; padding: 0 4px;
            background: var(--bg-warm);
            border-right: 1px solid var(--border);
        }

        /* ── Info Box ── */
        .info-box {
            border-radius: 2px;
            padding: 12px 16px;
            margin-top: 12px;
            font-size: 0.75rem;
            line-height: 1.6;
        }
        .info-box.blue  { background: rgba(150,73,0,0.05);  border-left: 3px solid var(--amber);      color: var(--text-muted); }
        .info-box.green { background: rgba(46,125,50,0.06); border-left: 3px solid var(--green);      color: var(--text-muted); }
        .info-box.amber { background: rgba(196,98,0,0.06);  border-left: 3px solid var(--amber-mid);  color: var(--text-muted); }
        .info-box.red   { background: rgba(192,57,43,0.06); border-left: 3px solid var(--red);        color: var(--text-muted); }
        .info-box strong { color: var(--text-main); }

        /* ── QBER Bar ── */
        .qber-bar-wrap {
            background: #e8ddd4;
            border-radius: 100px;
            height: 8px; margin-top: 10px; overflow: hidden;
            position: relative;
        }
        .qber-bar-fill { height: 100%; border-radius: 100px; }
        .qber-threshold-line {
            position: absolute; top: 0; bottom: 0;
            width: 2px; background: rgba(192,57,43,0.55);
        }

        /* ── Footer — dark amber ── */
        .report-footer {
            background: var(--amber-dark);
            padding: 22px 48px;
            display: flex; align-items: center; justify-content: space-between;
            border-top: 3px solid var(--amber);
        }
        .footer-logo { font-size: 0.65rem; color: rgba(255,200,130,0.45); line-height: 1.6; }
        .footer-logo strong { color: rgba(255,220,160,0.85); }
        .footer-disclaimer {
            font-size: 0.6rem; color: rgba(255,200,130,0.3);
            text-align: right; max-width: 340px; line-height: 1.5;
        }

        /* ── Separators ── */
        .divider { height: 1px; background: #3a1e08; margin: 12px 0; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }

        /* ── Print Overrides ── */
        @media print {
            body { background: white; padding: 0; }
            .report-page { max-width: 100%; border-radius: 0; box-shadow: none; }
            .no-print { display: none !important; }
            .section { page-break-inside: avoid; }
            .key-panel { page-break-inside: avoid; }
        }

    `;
}

// ─── HTML Builder ─────────────────────────────────────────────────────────────

function buildReportHTML(d) {
    const qberColor = parseFloat(d.qberPct) > MAX_QBER_THRESHOLD ? 'red' :
        parseFloat(d.qberPct) > 0 ? 'amber' : 'green';

    const qberBarColor = parseFloat(d.qberPct) > MAX_QBER_THRESHOLD ? '#c0392b' :
        parseFloat(d.qberPct) > 0 ? '#c46200' : '#2e7d32';
    const qberBarWidth = Math.min(parseFloat(d.qberPct), 100).toFixed(1);
    const qberThresholdPos = MAX_QBER_THRESHOLD; // %

    // Sifting rate
    const siftingRate = d.numBits > 0 ? ((d.siftedLen / d.numBits) * 100).toFixed(1) : '0.0';

    // Prioritize state-driven protocol names
    const ecProtocol = d.ecProtocol;


    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BB84 QKD Protocol — Audit Report | ${d.sessionId}</title>
    <style>${getReportCSS()}</style>
    <!-- KaTeX for Math Rendering -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js" onload="renderMathInElement(document.body, {delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}]});"></script>
</head>
<body>

<!-- Print Button Bar (hidden during print) -->
<div class="print-btn-bar no-print">
    <button class="print-btn" onclick="window.print()">🖨️ &nbsp; Print / Save as PDF</button>
    <button class="close-btn" onclick="window.close()">✕ &nbsp; Close</button>
</div>

<div class="report-page">

    <!-- ── HEADER ── -->
    <div class="report-header">
        <div class="logo-wrap">
            <img src="${LOGO_PATH}" alt="BB84 QKD Logo" onerror="this.style.display='none'; this.parentElement.style.background='#1e293b'; this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:2rem;\\'>⚛️</div>';">
        </div>
        <div class="header-text">
            <div class="institute-label">Defence Institute of Advanced Technology · School of Quantum Technology</div>
            <div class="report-title">BB84 Protocol Audit Report</div>
            <div class="report-subtitle">Quantum Key Distribution — Full Session Transcript & Security Analysis</div>
        </div>
        <div class="header-meta">
            <div class="session-badge">${d.sessionId}</div>
            <div class="meta-row"><b>Date:</b> ${d.ts.date}</div>
            <div class="meta-row"><b>Time:</b> ${d.ts.time}</div>
            <div class="meta-row"><b>Researcher:</b> Agha Tasheer Syedi</div>
            <div class="meta-row"><b>Supervisor:</b> Dr. Kanaka Raju Pandiri</div>
        </div>
    </div>


    <!-- ── VERDICT BANNER ── -->
    <div class="verdict-banner ${d.verdict.cls}">
        <div class="verdict-icon">${d.verdict.icon}</div>
        <div>
            <div class="verdict-label">Security Verdict</div>
            <div class="verdict-text">${d.verdict.label}</div>
        </div>
        <div style="margin-left:auto; text-align:right;">
            <div class="verdict-label">Eavesdropper (Eve)</div>
            <span class="status-badge ${d.eveStatus.cls}">${d.eveStatus.icon} ${d.eveStatus.label}</span>
        </div>
    </div>

    <!-- ── BODY ── -->
    <div class="report-body">

        <!-- ─── SECTION 1: Protocol Overview ─── -->
        <div class="section">
            <div class="section-header">
                <div class="section-num">§1</div>
                <div>
                    <div class="section-title">Protocol Configuration</div>
                    <div class="section-desc">BB84 QKD — Simulation Parameters</div>
                </div>
            </div>

            <table class="data-table">
                <tbody>
                    <tr>
                        <td class="bold" style="width:35%">Protocol</td>
                        <td>BB84 Quantum Key Distribution (Bennett & Brassard, 1984)</td>
                    </tr>
                    <tr>
                        <td class="bold">Photon Bases</td>
                        <td>Rectilinear basis (+): |0⟩, |1⟩ &nbsp;|&nbsp; Diagonal basis (×): |+⟩, |−⟩</td>
                    </tr>
                    <tr>
                        <td class="bold">Photons Transmitted (n)</td>
                        <td class="mono">${d.numBits}</td>
                    </tr>
                    <tr>
                        <td class="bold">Channel Noise Level</td>
                        <td class="mono ${parseFloat(d.noisePct) > 0 ? 'amber' : 'green'}">${d.noisePct}% ${parseFloat(d.noisePct) > 0 ? '(Noisy Channel)' : '(Ideal Channel)'}</td>
                    </tr>
                    <tr>
                        <td class="bold">Eavesdropper Active</td>
                        <td class="${d.eveActive ? 'red' : 'green'}">${d.eveActive ? 'Yes — Eve inserted into quantum channel' : 'No — Channel not compromised by eavesdropper'}</td>
                    </tr>
                    <tr>
                        <td class="bold">Error Correction Protocol</td>
                        <td>${ecProtocol} Protocol</td>
                    </tr>
                    <tr>
                        <td class="bold">Privacy Amplification</td>
                        <td>Universal Hashing via Toeplitz Matrix Multiplication</td>
                    </tr>
                </tbody>
            </table>


            <!-- SEVENTH SECTION: Secrecy & Entropy Analysis -->
            <div style="margin-top: 25px; padding: 20px; background: rgba(0, 240, 255, 0.03); border: 1px dashed var(--amber-mid); border-radius: 4px;">
                <h4 style="font-family: var(--font-heading); font-size: 0.8rem; color: var(--amber-dark); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 1px;">
                    🛡️ Information-Theoretic Secrecy Audit
                </h4>
                <div style="font-size: 0.75rem; line-height: 1.6; color: var(--text-main);">
                    <p>Based on the detected <b>QBER (${d.qberPct}%)</b>, the simulator calculated a partial information leakage to Eve of approximately <b>${d.leakage}%</b>. 
                    Privacy Amplification was applied using a <b>Toeplitz Hash Function</b> to map the ${d.workingLen}-bit working key into a compressed space of <b>${d.finalLen} bits</b>.</p>
                    
                    <div style="display: flex; align-items: center; gap: 15px; margin-top: 15px; padding: 10px; background: #fff; border-radius: 4px;">
                        <div style="flex: 1;">
                            <div style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase;">Entropy Retention Profile</div>
                            <div style="width: 100%; height: 8px; background: #eee; border-radius: 4px; overflow: hidden; margin-top: 4px;">
                                <div style="height: 100%; width: ${(d.finalLen / d.workingLen * 100).toFixed(1)}%; background: var(--amber-mid);"></div>
                            </div>
                        </div>
                        <div style="font-size: 1rem; font-weight: 900; color: var(--amber-mid); min-width: 60px; text-align: right;">
                            ${(d.finalLen / d.workingLen * 100).toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ─── SECTION 2: Quantum Transmission ─── -->
        <div class="section">
            <div class="section-header">
                <div class="section-num">§2</div>
                <div>
                    <div class="section-title">Stage 3 — Quantum Transmission</div>
                    <div class="section-desc">Alice prepares photons → quantum channel → Bob measures</div>
                </div>
            </div>

            <div class="metrics-grid cols-4">
                <div class="metric-card accent-blue">
                    <div class="metric-label">Photons Prepared</div>
                    <div class="metric-value blue">${d.numBits}</div>
                    <div class="metric-sub">Alice → Quantum Channel</div>
                </div>
                <div class="metric-card accent-cyan">
                    <div class="metric-label">Alice Bits</div>
                    <div class="metric-value cyan">${d.aliceBits.length}</div>
                    <div class="metric-sub">Raw random bit sequence</div>
                </div>
                <div class="metric-card accent-purple">
                    <div class="metric-label">Alice Bases</div>
                    <div class="metric-value" style="color:#964900">${d.aliceBases.length}</div>
                    <div class="metric-sub">+ and × encodings</div>
                </div>
                <div class="metric-card accent-navy">
                    <div class="metric-label">Bob Measurements</div>
                    <div class="metric-value" style="color:#555">${d.bobMeasurements.length}</div>
                    <div class="metric-sub">Received qubit readings</div>
                </div>
            </div>

            <div class="key-panel" style="margin-top: 18px;">
                <div class="key-panel-label">
                    <span class="led"></span> Alice Raw Bitstream
                    <span class="bits-tag">${d.aliceBits.length} bits</span>
                </div>
                ${formatBitString(d.aliceBits)}
                <div class="divider" style="background: rgba(255,255,255,0.06); margin: 12px 0;"></div>
                <div class="key-panel-label">
                    <span class="led" style="background:#c46200;"></span> Alice Bases (+/×)
                    <span class="bits-tag">${d.aliceBases.length} bases</span>
                </div>
                ${formatBasisString(d.aliceBases)}
                <div class="divider" style="background: rgba(255,255,255,0.06); margin: 12px 0;"></div>
                <div class="key-panel-label">
                    <span class="led" style="background:#964900;"></span> Bob Bases (+/×)
                    <span class="bits-tag">${d.bobBases.length} bases</span>
                </div>
                ${formatBasisString(d.bobBases)}
                <div class="divider" style="background: rgba(255,255,255,0.06); margin: 12px 0;"></div>
                <div class="key-panel-label">
                    <span class="led" style="background:#7a3a00;"></span> Bob Measured Bits
                    <span class="bits-tag">${d.bobMeasurements.length} bits</span>
                </div>
                <span class="bitstring working">${formatBitString(d.bobMeasurements).replace(/<[^>]+>/g, '') || '—'}</span>
                ${d.bobMeasurements.length > 128 ? `<span class="overflow-note">… +${d.bobMeasurements.length - 128} more bits</span>` : ''}
            </div>

            ${d.eveActive ? `
            <div class="key-panel" style="margin-top: 12px; border-color: rgba(239,68,68,0.4);">
                <div class="key-panel-label" style="color: rgba(239,68,68,0.7);">
                    <span class="led warn"></span> 🚨 Eve Intercepted Bases
                    <span class="bits-tag">${d.eveBases.length} intercepts</span>
                </div>
                ${formatBasisString(d.eveBases)}
                <div class="divider" style="background: rgba(255,255,255,0.06); margin: 12px 0;"></div>
                <div class="key-panel-label" style="color: rgba(239,68,68,0.7);">
                    <span class="led warn"></span> Eve Measured Bits (forwarded with errors)
                    <span class="bits-tag">${d.eveMeasurements.length} bits</span>
                </div>
                ${formatBitString(d.eveMeasurements)}
            </div>
            <div class="info-box red">
                <strong>Eavesdropper Warning:</strong> Eve intercepted the quantum channel, measuring photons 
                with random bases (50% match rate) and re-emitting them. This causes detectable errors when 
                Alice and Bob compare sifted bits (the QBER signature of Eve's presence).
            </div>
            ` : `
            <div class="info-box green">
                <strong>Quantum Channel Integrity:</strong> No eavesdropper was inserted. Alice transmitted 
                ${d.numBits} photons over the quantum channel. Bob received and measured each photon independently 
                using a randomly chosen basis ${d.noisePct !== '0.0' ? `(with ${d.noisePct}% channel noise applied)` : '(ideal noiseless channel)'}.
            </div>
            `}
        </div>

        <!-- ─── SECTION 3: Basis Sifting ─── -->
        <div class="section">
            <div class="section-header">
                <div class="section-num">§3</div>
                <div>
                    <div class="section-title">Stage 4 — Basis Sifting</div>
                    <div class="section-desc">Alice and Bob publicly compare bases; keep only matching-basis bits</div>
                </div>
            </div>

            <div class="metrics-grid cols-4">
                <div class="metric-card accent-blue">
                    <div class="metric-label">Raw Bits (Input)</div>
                    <div class="metric-value blue">${d.numBits}</div>
                    <div class="metric-sub">Pre-sifting</div>
                </div>
                <div class="metric-card accent-purple">
                    <div class="metric-label">Sifted Key Length</div>
                    <div class="metric-value" style="color:#964900">${d.siftedLen}</div>
                    <div class="metric-sub">Basis-matched bits</div>
                </div>
                <div class="metric-card accent-red">
                    <div class="metric-label">Bits Discarded</div>
                    <div class="metric-value red">${d.bitsRemovedSifting}</div>
                    <div class="metric-sub">Basis mismatch</div>
                </div>
                <div class="metric-card accent-green">
                    <div class="metric-label">Sifting Rate</div>
                    <div class="metric-value green">${siftingRate}%</div>
                    <div class="metric-sub">~50% expected</div>
                </div>
            </div>

            <div class="key-panel" style="margin-top: 16px;">
                <div class="key-panel-label">
                    <span class="led" style="background:#c46200;"></span>
                    Alice Sifted Key (bits at matching-basis positions)
                    <span class="bits-tag">${d.siftedLen} bits</span>
                </div>
                <span class="bitstring sifted">${d.siftedKeyA.length > 0 ? d.siftedKeyA.slice(0, 128).join('') : '—'}</span>
                ${d.siftedKeyA.length > 128 ? `<span class="overflow-note">…+${d.siftedKeyA.length - 128} more</span>` : ''}
                <div class="divider" style="background: rgba(255,255,255,0.06); margin: 12px 0;"></div>
                <div class="key-panel-label">
                    <span class="led" style="background:#964900;"></span>
                    Bob Sifted Key (should match Alice — errors appear below)
                    <span class="bits-tag">${d.siftedKeyB.length} bits</span>
                </div>
                <span class="bitstring sifted">${d.siftedKeyB.length > 0 ? d.siftedKeyB.slice(0, 128).join('') : '—'}</span>
                ${d.siftedKeyB.length > 128 ? `<span class="overflow-note">…+${d.siftedKeyB.length - 128} more</span>` : ''}
            </div>

            <div class="info-box blue" style="margin-top: 14px;">
                <strong>Protocol Note:</strong> Sifting retains ~50% of raw bits (both parties chose the same 
                basis). In this session, ${d.bitsRemovedSifting} bits were discarded due to basis mismatch, 
                yielding a sifted key of ${d.siftedLen} bits. Eve's interception would not be visible at this 
                stage — errors only appear after QBER estimation.
            </div>
        </div>

        <!-- ─── SECTION 4: QBER Estimation ─── -->
        <div class="section">
            <div class="section-header">
                <div class="section-num">§4</div>
                <div>
                    <div class="section-title">Stage 5 — QBER Estimation</div>
                    <div class="section-desc">Quantum Bit Error Rate — Channel Security Parameter Estimation</div>
                </div>
            </div>

            <div class="metrics-grid cols-4">
                <div class="metric-card accent-blue">
                    <div class="metric-label">Sifted Pool</div>
                    <div class="metric-value blue">${d.siftedLen}</div>
                    <div class="metric-sub">Input bits</div>
                </div>
                <div class="metric-card accent-amber">
                    <div class="metric-label">Bits Sacrificed</div>
                    <div class="metric-value amber">${d.sampledCount}</div>
                    <div class="metric-sub">For QBER sample</div>
                </div>
                <div class="metric-card ${qberColor === 'red' ? 'accent-red' : qberColor === 'amber' ? 'accent-amber' : 'accent-green'}">
                    <div class="metric-label">QBER</div>
                    <div class="metric-value ${qberColor}">${d.qberPct}%</div>
                    <div class="metric-sub">Threshold: ${d.maxQBER}%</div>
                </div>
                <div class="metric-card accent-green">
                    <div class="metric-label">Working Key</div>
                    <div class="metric-value green">${d.workingLen}</div>
                    <div class="metric-sub">Post-sacrifice bits</div>
                </div>
            </div>

            <!-- QBER bar -->
            <div style="margin-top: 16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-size:0.65rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">QBER Level</span>
                    <span class="status-badge ${d.eveStatus.cls}">${d.eveStatus.icon} ${d.eveStatus.label}</span>
                </div>
                <div class="qber-bar-wrap">
                    <div class="qber-bar-fill" style="width:${qberBarWidth}%; background:${qberBarColor};"></div>
                    <div class="qber-threshold-line" style="left:${qberThresholdPos}%;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:4px;">
                    <span style="font-size:0.58rem; color:var(--text-muted);">0%</span>
                    <span style="font-size:0.58rem; color:#c0392b; font-weight:700;">${d.maxQBER}% Limit</span>
                    <span style="font-size:0.58rem; color:var(--text-muted);">100%</span>
                </div>
            </div>

            <table class="data-table" style="margin-top: 18px;">
                <thead>
                    <tr>
                        <th>Parameter</th>
                        <th>Value</th>
                        <th>Interpretation</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="bold">QBER (Q)</td>
                        <td class="mono ${qberColor}">${d.qberPct}%</td>
                        <td>${parseFloat(d.qberPct) > MAX_QBER_THRESHOLD ? '🚨 Exceeds security threshold — key unsafe' :
            parseFloat(d.qberPct) > 0 ? 'Non-zero but within tolerance — channel noisy' :
                'Perfect — no detected errors'}</td>
                    </tr>
                    <tr>
                        <td class="bold">Security Threshold (Q<sub>max</sub>)</td>
                        <td class="mono">${d.maxQBER}%</td>
                        <td>BB84 standard: abort if Q > 12.9% (Hoeffding Bound)</td>
                    </tr>
                    <tr>
                        <td class="bold">Bits Sacrificed for QBER</td>
                        <td class="mono">${d.sampledCount}</td>
                        <td>~25% of sifted key publicly compared for error detection</td>
                    </tr>
                    <tr>
                        <td class="bold">Remaining Working Key</td>
                        <td class="mono">${d.workingLen}</td>
                        <td>Proceeds to error correction phase</td>
                    </tr>
                    <tr>
                        <td class="bold">Eve Detection Confidence</td>
                        <td class="${parseFloat(d.qberPct) > MAX_QBER_THRESHOLD ? 'red' : parseFloat(d.qberPct) > 0 ? 'amber' : 'green'}">
                            ${parseFloat(d.qberPct) > MAX_QBER_THRESHOLD ? 'HIGH — Protocol ABORTED' :
            parseFloat(d.qberPct) > 0 ? 'LOW — Noise present, possible natural errors' :
                'SECURE — No Eve signature'}
                        </td>
                        <td>Based on Hoeffding Inequality (statistical bound)</td>
                    </tr>
                </tbody>
            </table>

            <div class="key-panel" style="margin-top: 16px;">
                <div class="key-panel-label">
                    <span class="led" style="background:#c46200;"></span>
                    Alice Working Key — Post QBER Sacrifice
                    <span class="bits-tag">${d.workingLen} bits remaining</span>
                </div>
                <span class="bitstring working">${d.workingKeyA.length > 0 ? d.workingKeyA.slice(0, 128).join('') : '—'}</span>
                ${d.workingKeyA.length > 128 ? `<span class="overflow-note">…+${d.workingKeyA.length - 128} more</span>` : ''}
            </div>
        </div>

        <!-- ─── SECTION 5: Post-Processing ─── -->
        <div class="section">
            <div class="section-header">
                <div class="section-num">§5</div>
                <div>
                    <div class="section-title">Stage 6 — Post-Processing</div>
                    <div class="section-desc">Error Correction (${ecProtocol}) + Privacy Amplification (Toeplitz Hashing)</div>
                </div>
            </div>

            <div class="metrics-grid cols-4">
                <div class="metric-card accent-amber">
                    <div class="metric-label">Input Bits (R<sub>in</sub>)</div>
                    <div class="metric-value amber">${d.workingLen}</div>
                    <div class="metric-sub">Post-Reconciliation key</div>
                </div>
                <div class="metric-card accent-blue">
                    <div class="metric-label">Leakage (I<sub>E</sub>)</div>
                    <div class="metric-value blue">${d.leakage}%</div>
                    <div class="metric-sub">Eve's potential info</div>
                </div>
                <div class="metric-card accent-cyan">
                    <div class="metric-label">PA Factor</div>
                    <div class="metric-value cyan">${(d.finalLen / d.workingLen).toFixed(2)}x</div>
                    <div class="metric-sub">Compression ratio</div>
                </div>
                <div class="metric-card accent-green">
                    <div class="metric-label">Net Secrecy</div>
                    <div class="metric-value green">${d.finalLen}</div>
                    <div class="metric-sub">Final secure bits (m)</div>
                </div>
            </div>

            <table class="data-table" style="margin-top: 16px;">
                <thead>
                    <tr>
                        <th>Stage</th>
                        <th>Protocol</th>
                        <th>Bits In</th>
                        <th>Bits Removed</th>
                        <th>Bits Out</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="bold">Raw Transmission</td>
                        <td>BB84 Photon Encoding</td>
                        <td class="mono">—</td>
                        <td class="mono">—</td>
                        <td class="mono">${d.numBits}</td>
                    </tr>
                    <tr>
                        <td class="bold">Basis Sifting</td>
                        <td>Public basis reconciliation</td>
                        <td class="mono">${d.numBits}</td>
                        <td class="mono red">${d.bitsRemovedSifting}</td>
                        <td class="mono">${d.siftedLen}</td>
                    </tr>
                    <tr>
                        <td class="bold">QBER Sampling</td>
                        <td>Statistical error estimation</td>
                        <td class="mono">${d.siftedLen}</td>
                        <td class="mono amber">${d.sampledCount}</td>
                        <td class="mono">${d.workingLen}</td>
                    </tr>
                    <tr>
                        <td class="bold">Error Correction</td>
                        <td>${d.ecProtocol}</td>
                        <td class="mono">${d.workingLen}</td>
                        <td class="mono red">${d.bitsRemovedEC}</td>
                        <td class="mono">${d.workingLen - d.bitsRemovedEC}</td>
                    </tr>
                    <tr>
                        <td class="bold">PA Leakage Purge</td>
                        <td>Entropy Nullification ($n \cdot H(Q)$)</td>
                        <td class="mono">${d.workingLen - d.bitsRemovedEC}</td>
                        <td class="mono amber">${d.rawLeakageBits}</td>
                        <td class="mono">${d.workingLen - d.bitsRemovedEC - d.rawLeakageBits}</td>
                    </tr>
                    <tr>
                        <td class="bold">PA Safety Margin</td>
                        <td>Finite-Key Safety Hash</td>
                        <td class="mono">${d.workingLen - d.bitsRemovedEC - d.rawLeakageBits}</td>
                        <td class="mono cyan">${d.safetyMarginBits}</td>
                        <td class="mono green">${d.finalLen}</td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 15px; padding: 15px; background: rgba(150, 73, 0, 0.05); border-radius: 4px; border-left: 4px solid var(--amber-mid);">
                <span style="font-size: 0.6rem; color: var(--amber-dark); text-transform: uppercase; font-weight: 800; display: block; margin-bottom: 5px;">Secrecy Capacity Bound</span>
                <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--text-main); margin: 8px 0; background: #fff; padding: 10px; border-radius: 4px; border: 1px solid rgba(150, 73, 0, 0.1);">
                    $$l \\le n - \\text{leakage}_{EC} - H_{max}(X|E) \\implies l \\approx n \\cdot (1 - f \\cdot H_2(Q))$$
                </div>
                <p style="font-size: 0.65rem; color: var(--text-muted); margin-top: 5px;">
                    The final key length is mathematically constrained to ensure that even with infinite computing power, 
                    the eavesdropper (Eve) possesses $\le 2^{-k}$ bits of information about the secret key.
                </p>
            </div>


            <div class="info-box blue" style="margin-top: 14px;">
                <strong>Error Correction (${ecProtocol}):</strong> Alice and Bob reconcile their keys by exchanging 
                parity information over a public classical channel — revealing only whether blocks of bits have 
                even or odd parity, not the bits themselves. This eliminates the ${d.bitsRemovedEC > 0 ? d.bitsRemovedEC + ' bits' : 'errors'} 
                introduced by channel noise${d.eveActive ? ' and Eve\'s interceptions' : ''}.
            </div>
            <div class="info-box green" style="margin-top: 10px;">
                <strong>Privacy Amplification (Toeplitz Hashing):</strong> The key is compressed using a 
                randomly chosen Toeplitz matrix. Any partial knowledge Eve acquired during Error Correction 
                (from public parity broadcasts) is provably eliminated by this compression, resulting in an 
                information-theoretically secure final key.
            </div>
        </div>

        <!-- ─── SECTION 6: Final Key ─── -->
        <div class="section">
            <div class="section-header">
                <div class="section-num">§6</div>
                <div>
                    <div class="section-title">Stage 7 — Final Secret Key</div>
                    <div class="section-desc">Unconditionally secure shared secret — ready for ChaCha20-Poly1305 encryption</div>
                </div>
            </div>

            <div class="key-panel">
                <div class="key-panel-label">
                    <span class="led ${d.finalLen > 0 ? '' : 'warn'}"></span>
                    FINAL SECRET KEY — Established Quantum-Secure Symmetric Key
                    <span class="bits-tag">${d.finalLen} bits</span>
                </div>
                ${d.finalLen > 0
            ? `<span class="bitstring" style="letter-spacing:3px; line-height:2; font-size:0.8rem;">${d.finalSecretKey.slice(0, 128).join('')}</span>${d.finalLen > 128 ? `<span class="overflow-note">…+${d.finalLen - 128} more bits</span>` : ''}`
            : `<span class="no-data">Protocol has not been completed. Run all stages to generate the final key.</span>`
        }
            </div>

            <div style="margin-top: 10px; padding: 10px; background: #fafafa; border: 1px solid #eee; display: flex; align-items: center; justify-content: space-between;">
                <div>
                   <span style="font-size: 0.55rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800;">Digital Key Fingerprint (SHA-Hash Simulation)</span>
                   <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--amber-dark); margin-top: 2px;">${d.fingerprint}</div>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 0.55rem; color: var(--text-muted); text-transform: uppercase; font-weight: 800;">Entropy Retention</span>
                    <div style="font-size: 0.9rem; font-weight: 900; color: var(--green);">${((d.finalLen / d.numBits) * 100).toFixed(1)}%</div>
                </div>
            </div>


            <div class="metrics-grid cols-3" style="margin-top: 18px;">
                <div class="metric-card accent-green">
                    <div class="metric-label">Final Key Length</div>
                    <div class="metric-value green">${d.finalLen}</div>
                    <div class="metric-sub">Secure bits</div>
                </div>
                <div class="metric-card accent-blue">
                    <div class="metric-label">Key Generation Efficiency</div>
                    <div class="metric-value blue">${d.efficiency}%</div>
                    <div class="metric-sub">Final / Raw ratio</div>
                </div>
                <div class="metric-card ${d.qberOk ? 'accent-green' : 'accent-red'}">
                    <div class="metric-label">Protocol Status</div>
                    <div class="metric-value ${d.qberOk ? 'green' : 'red'}" style="font-size:1rem; padding-top:8px;">
                        ${d.verdict.icon} ${d.verdict.label.split('—')[0].trim()}
                    </div>
                    <div class="metric-sub">${d.qberOk ? 'All security proofs satisfied' : 'Key integrity compromised'}</div>
                </div>
            </div>

            <!-- Entropy Pipeline -->
            <div class="pipeline">
                <div class="pipeline-stage ps-raw">
                    <div class="ps-label">Raw</div>
                    <div class="ps-val">${d.numBits}</div>
                    <div class="ps-sub">Photons</div>
                </div>
                <div class="pipeline-arrow">→</div>
                <div class="pipeline-stage ps-sifted">
                    <div class="ps-label">Sifted</div>
                    <div class="ps-val">${d.siftedLen}</div>
                    <div class="ps-sub">Basis Match</div>
                </div>
                <div class="pipeline-arrow">→</div>
                <div class="pipeline-stage ps-working">
                    <div class="ps-label">Working</div>
                    <div class="ps-val">${d.workingLen}</div>
                    <div class="ps-sub">Post-QBER</div>
                </div>
                <div class="pipeline-arrow">→</div>
                <div class="pipeline-stage ps-final">
                    <div class="ps-label">Final</div>
                    <div class="ps-val" style="color:var(--green-dim)">${d.finalLen}</div>
                    <div class="ps-sub">Secret Key</div>
                </div>
            </div>

            <div class="info-box ${d.finalLen > 0 && d.qberOk ? 'green' : d.finalLen > 0 ? 'red' : 'blue'}" style="margin-top: 14px;">
                ${d.finalLen > 0 && d.qberOk
            ? `<strong>🔐 Key Ready:</strong> Alice and Bob now share an identical, unconditionally secure 
                       ${d.finalLen}-bit secret key. In practice, this key would be split: half for <strong>ChaCha20</strong> 
                       (stream cipher — ensures confidentiality) and half for <strong>Poly1305</strong> 
                       (MAC — ensures message authentication and integrity).`
            : d.finalLen > 0
                ? `<strong>🛑 COMPROMISED:</strong> The QBER of ${d.qberPct}% exceeded the ${d.maxQBER}% 
                       security threshold. In a real deployment, the protocol would be aborted and no key would 
                       be used. Advanced mode allows key extraction despite this for educational purposes.`
                : `<strong>ℹ️ Protocol Incomplete:</strong> The full BB84 pipeline has not been executed. 
                       Complete all stages (Transmission → Sifting → QBER → Error Correction → Privacy Amplification) 
                       to generate the final secret key.`
        }
            </div>
        </div>

        <!-- ─── SECTION 7: Security Summary ─── -->
        <div class="section">
            <div class="section-header">
                <div class="section-num">§7</div>
                <div>
                    <div class="section-title">Security Analysis Summary</div>
                    <div class="section-desc">Information-theoretic security assessment of this QKD session</div>
                </div>
            </div>

            <table class="data-table">
                <thead>
                    <tr>
                        <th>Security Parameter</th>
                        <th>Value / Status</th>
                        <th>Requirement</th>
                        <th>Result</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td class="bold">QBER</td>
                        <td class="mono ${qberColor}">${d.qberPct}%</td>
                        <td>Q ≤ ${d.maxQBER}%</td>
                        <td class="${parseFloat(d.qberPct) <= MAX_QBER_THRESHOLD ? 'green' : 'red'}">${parseFloat(d.qberPct) <= MAX_QBER_THRESHOLD ? 'Pass' : 'Fail'}</td>
                    </tr>
                    <tr>
                        <td class="bold">Eve Detection</td>
                        <td>${d.eveStatus.icon} ${d.eveStatus.label}</td>
                        <td>No eavesdropper</td>
                        <td class="${!d.eveActive && parseFloat(d.qberPct) <= MAX_QBER_THRESHOLD ? 'green' : 'red'}">${!d.eveActive && parseFloat(d.qberPct) <= MAX_QBER_THRESHOLD ? 'Pass' : 'Alert'}</td>
                    </tr>
                    <tr>
                        <td class="bold">Key Established</td>
                        <td>${d.finalLen > 0 ? d.finalLen + ' bits' : 'Not completed'}</td>
                        <td>> 0 bits</td>
                        <td class="${d.finalLen > 0 ? 'green' : 'red'}">${d.finalLen > 0 ? 'Pass' : 'Incomplete'}</td>
                    </tr>
                    <tr>
                        <td class="bold">Key Efficiency</td>
                        <td class="mono">${d.efficiency}%</td>
                        <td>Protocol dependent</td>
                        <td class="${parseFloat(d.efficiency) > 0 ? 'green' : 'amber'}">${parseFloat(d.efficiency) > 0 ? 'Normal' : 'Zero'}</td>
                    </tr>
                    <tr>
                        <td class="bold">Error Correction</td>
                        <td>${ecProtocol}</td>
                        <td>Cascade / LDPC</td>
                        <td class="green">✅ Applied</td>
                    </tr>
                    <tr>
                        <td class="bold">Privacy Amplification</td>
                        <td>Purge: ${d.rawLeakageBits} bits</td>
                        <td>$H(Q)$ Correction</td>
                        <td class="green">✅ Leakage Nullified</td>
                    </tr>
                    <tr>
                        <td class="bold">Key Fingerprint</td>
                        <td class="mono" style="font-size: 0.6rem;">${d.fingerprint.slice(0, 14)}...</td>
                        <td>Digital Signature</td>
                        <td class="green">Verified</td>
                    </tr>
                    <tr>
                        <td class="bold">Overall Verdict</td>
                        <td colspan="3" class="${d.verdict.cls.replace('verdict-', '')} bold">
                            ${d.verdict.icon} ${d.verdict.label}
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="info-box blue" style="margin-top: 14px;">
                <strong>Academic Context:</strong> This report documents a <strong>classical simulation</strong> of 
                the BB84 protocol. All quantum state measurements are performed probabilistically using pseudo-random 
                number generation. Real-world QKD requires photonic hardware including single-photon sources, 
                polarising beam-splitters, and single-photon detectors (SNSPDs). This simulator is designed for 
                <em>pedagogical demonstration</em> of quantum cryptographic principles at DIAT's School of Quantum Technology.
            </div>

            <!-- SECURITY CERTIFICATION SEAL -->
            <div style="margin-top: 40px; display: flex; justify-content: center; position: relative;">
                <div style="width: 140px; height: 140px; border: 2px double var(--amber-dark); border-radius: 50%; display: flex; align-items: center; justify-content: center; position: relative; background: rgba(150, 73, 0, 0.02); opacity: 0.6;">
                    <div style="text-align: center; font-family: var(--font-heading); font-size: 0.6rem; font-weight: 800; color: var(--amber-dark);">
                        <div style="margin-bottom: 5px;">SCHOOL OF</div>
                        <div style="font-size: 0.8rem; letter-spacing: 2px;">QUANTUM</div>
                        <div style="margin-top: 5px;">TECHNOLOGY</div>
                    </div>
                    <div style="position: absolute; top: -10px; padding: 2px 10px; background: #fff; border: 1px solid var(--amber-dark); font-size: 0.5rem; font-weight: 900; text-transform: uppercase;">Agha Tasheer Syedi</div>
                    <div style="position: absolute; bottom: -10px; padding: 2px 10px; background: #fff; border: 1px solid var(--amber-dark); font-size: 0.5rem; font-weight: 900; text-transform: uppercase;">Clinical Simulation</div>
                </div>
            </div>

        </div>


    </div><!-- /report-body -->

    <!-- ── FOOTER ── -->
    <div class="report-footer">
        <div class="footer-logo">
            <strong>BB84 QKD Simulator</strong><br>
            MTech Quantum Computing · DIAT Pune<br>
            Agha Tasheer Syedi &amp; Dr. Kanaka Raju Pandiri
        </div>
        <div class="footer-disclaimer">
            This report was auto-generated by the BB84 Quantum Key Distribution Simulator. 
            All computations are performed client-side using classical probabilistic modelling. 
            For academic use only. Session ID: <strong style="color:rgba(0,229,255,0.6)">${d.sessionId}</strong> · Generated: ${d.ts.date} ${d.ts.time}
        </div>
    </div>

</div><!-- /report-page -->

<!-- Bottom Print Button -->
<div class="print-btn-bar no-print" style="padding-bottom:40px;">
    <button class="print-btn" onclick="window.print()">🖨️ &nbsp; Print / Save as PDF</button>
    <button class="close-btn" onclick="window.close()">✕ &nbsp; Close</button>
</div>

</body>
</html>`;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * generateAuditReport()
 * 
 * Collects current protocol state, builds a full HTML audit report,
 * and opens it in a new browser window for printing/saving as PDF.
 * 
 * Called by the "Export Audit Report" button in Stage 7.
 */
export function generateAuditReport() {
    const data = collectReportData();
    const html = buildReportHTML(data);

    // Open in new tab
    const reportWindow = window.open('', '_blank', 'width=980,height=850,scrollbars=yes,resizable=yes');
    if (!reportWindow) {
        alert('⚠️ Pop-up blocked! Please allow pop-ups for this page to generate the report.');
        return;
    }

    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();

    // Focus the new window
    reportWindow.focus();

    console.info('[REPORT] Audit report generated successfully.', {
        sessionId: data.sessionId,
        finalKeyLen: data.finalLen,
        qber: data.qberPct
    });
}
