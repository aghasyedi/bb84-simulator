/* ==========================================================================
   Stage 8 — Optical Bench
   A physical, component-level drawing of a BB84 setup.
   Alice (transmitter) and Bob (receiver) are each selectable from a library
   of real hardware implementations; the bench SVG is generated from data.
   ========================================================================== */

/* ---------------------------------------------------------------- geometry */
const W = 940;
const CX = 470;
const PAD = 14;
const UNIT_W = 430;
const UNIT_H = 62;
const LANE_H = 54;
const GAP = 14;
const ENTRY = 26;
const TITLE_H = 20;
const MERGE_GAP = 26;
const SPLIT_TAIL = 14;

const MINUS = '\u2212';
const DEG = '\u00B0';

const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const stackH = (n) => (n <= 0 ? 0 : n * LANE_H + (n - 1) * GAP);

function laneWidth(n) {
    const avail = W - (PAD + 12) * 2;
    const cap = n <= 2 ? 300 : (n === 3 ? 244 : 202);
    return Math.min(cap, Math.floor((avail - (n - 1) * 18) / n));
}

function rowHeight(r) {
    if (r.t === 'unit') return ENTRY + (r.h || UNIT_H) + 10;
    const lanes = r.lanes || r.branches || [];
    let m = 0;
    lanes.forEach((l) => { m = Math.max(m, stackH((l.boxes || []).length)); });
    return ENTRY + TITLE_H + m + (r.t === 'fan' ? MERGE_GAP : SPLIT_TAIL);
}

function zoneHeight(mod) {
    return 52 + mod.rows.reduce((a, r) => a + rowHeight(r), 0) + 18;
}

/* --------------------------------------------------------------- primitives */
function drawBox(x, y, w, h, b) {
    const kind = b.kind || 'optic';
    const isDet = kind === 'det' || kind === 'cryo';
    let s = `<g class="ob-node ob-k-${kind}">`;
    s += `<rect class="ob-box" x="${x}" y="${y}" width="${w}" height="${h}" rx="9"/>`;

    const lines = b.sub ? String(b.sub).split('|') : [];
    const cy = y + h / 2;

    if (isDet) {
        s += `<circle class="ob-det-glyph" cx="${x + 24}" cy="${cy}" r="9.5"/>`;
        s += `<circle class="ob-det-core" cx="${x + 24}" cy="${cy}" r="3.4"/>`;
    }

    const tx = isDet ? x + 44 : x + w / 2;
    const anchor = isDet ? 'start' : 'middle';
    const room = isDet ? w - 96 : w - 28;

    let ly;
    if (lines.length === 0) ly = cy + 4;
    else if (lines.length === 1) ly = cy - 3;
    else ly = cy - 4 - (lines.length - 1) * 6;

    s += `<text class="ob-box-label" x="${tx}" y="${ly}" text-anchor="${anchor}">${esc(fit(b.label, room))}</text>`;
    lines.forEach((ln, i) => {
        s += `<text class="ob-box-sub" x="${tx}" y="${ly + 14 + i * 12}" text-anchor="${anchor}">${esc(fit(ln, room))}</text>`;
    });

    if (isDet && b.bit != null) {
        s += `<circle class="ob-bit" cx="${x + w - 28}" cy="${cy}" r="12.5"/>`;
        s += `<text class="ob-bit-text" x="${x + w - 28}" y="${cy + 4.5}" text-anchor="middle">${esc(b.bit)}</text>`;
    }
    s += `</g>`;
    return s;
}

/* crude character-budget fit so labels never spill out of a box */
function fit(text, px) {
    const max = Math.max(6, Math.floor(px / 6.1));
    const t = String(text);
    return t.length <= max ? t : t.slice(0, Math.max(4, max - 1)) + '\u2026';
}

function drawRows(rows, y0, out) {
    rows.forEach((r) => {
        if (r.t === 'unit') {
            const w = r.w || UNIT_W;
            const h = r.h || UNIT_H;
            out.push(`<path class="ob-wire" d="M${CX} ${y0} L${CX} ${y0 + ENTRY}"/>`);
            out.push(drawBox(CX - w / 2, y0 + ENTRY, w, h, r));
            y0 = y0 + ENTRY + h + 10;
            return;
        }

        const lanes = r.lanes || r.branches || [];
        const n = lanes.length;
        const lw = laneWidth(n);
        const total = n * lw + (n - 1) * 18;
        const x0 = (W - total) / 2;

        out.push(`<path class="ob-wire" d="M${CX} ${y0} L${CX} ${y0 + ENTRY}"/>`);
        const nodeY = y0 + ENTRY;
        const topY = nodeY + TITLE_H;

        const centres = [];
        const bottoms = [];
        lanes.forEach((lane, i) => {
            const cxi = x0 + i * (lw + 18) + lw / 2;
            out.push(`<text class="ob-lane-title" x="${cxi}" y="${nodeY + 10}" text-anchor="middle">${esc(lane.title || '')}</text>`);
            out.push(`<path class="ob-wire" d="M${CX} ${nodeY} C ${CX} ${nodeY + 16}, ${cxi} ${topY - 16}, ${cxi} ${topY}"/>`);
            let by = topY;
            (lane.boxes || []).forEach((b) => {
                out.push(drawBox(cxi - lw / 2, by, lw, LANE_H, b));
                by += LANE_H + GAP;
            });
            centres.push(cxi);
            bottoms.push(by - GAP);
        });

        const maxBottom = Math.max.apply(null, bottoms);
        if (r.t === 'fan') {
            const mergeY = maxBottom + MERGE_GAP;
            centres.forEach((cxi, i) => {
                out.push(`<path class="ob-wire" d="M${cxi} ${bottoms[i]} C ${cxi} ${bottoms[i] + 16}, ${CX} ${mergeY - 18}, ${CX} ${mergeY}"/>`);
            });
            out.push(`<circle class="ob-joint" cx="${CX}" cy="${mergeY}" r="4.2"/>`);
            y0 = mergeY;
        } else {
            y0 = maxBottom + SPLIT_TAIL;
        }
    });
    return y0;
}

function drawZone(mod, y0, side) {
    const out = [];
    const h = zoneHeight(mod);
    const x = PAD;
    const w = W - PAD * 2;

    out.push(`<rect class="ob-zone ob-zone-${side}" x="${x}" y="${y0}" width="${w}" height="${h}" rx="16"/>`);
    out.push(`<rect class="ob-zone-bar ob-zone-bar-${side}" x="${x}" y="${y0}" width="${w}" height="5" rx="2.5"/>`);
    out.push(`<text class="ob-zone-title" x="${x + 24}" y="${y0 + 31}">${side === 'alice' ? 'ALICE \u2014 TRANSMITTER' : 'BOB \u2014 RECEIVER'}</text>`);
    out.push(`<text class="ob-zone-sub" x="${x + w - 24}" y="${y0 + 31}" text-anchor="end">${esc(fit(mod.name, 320))}</text>`);

    const yEnd = drawRows(mod.rows, y0 + 48, out);
    return { svg: out.join(''), height: h, yEnd: yEnd };
}

function drawChannel(y0, out) {
    const h = 96;
    const x = PAD;
    const w = W - PAD * 2;

    out.push(`<path class="ob-wire" d="M${CX} ${y0} L${CX} ${y0 + h - 14}"/>`);
    out.push(`<path class="ob-rule" d="M${x} ${y0 + 20} L${x + w} ${y0 + 20}"/>`);
    out.push(`<path class="ob-rule" d="M${x} ${y0 + h - 20} L${x + w} ${y0 + h - 20}"/>`);
    out.push(`<path class="ob-wire" d="M${CX} ${y0 + h - 26} L${CX - 5} ${y0 + h - 19} M${CX} ${y0 + h - 26} L${CX + 5} ${y0 + h - 19}"/>`);

    const py = y0 + h / 2;
    out.push(`<rect class="ob-pill" x="${CX - 230}" y="${py - 16}" width="460" height="32" rx="16"/>`);
    out.push(`<text class="ob-pill-text" x="${CX}" y="${py + 4.5}" text-anchor="middle">QUANTUM CHANNEL \u00B7 OPTICAL FIBRE / FREE SPACE</text>`);

    /* travelling photons */
    [0, 0.66, 1.32].forEach((delay) => {
        out.push(
            `<circle class="ob-photon" r="4">` +
            `<animateMotion dur="2s" begin="${delay}s" repeatCount="indefinite" path="M${CX} ${y0 + 4} L${CX} ${y0 + h - 4}"/>` +
            `<animate attributeName="opacity" values="0;1;1;0" dur="2s" begin="${delay}s" repeatCount="indefinite"/>` +
            `</circle>`
        );
    });

    return y0 + h;
}

/* ============================================================== module data */
export const ALICE = [
    {
        id: 'a-4laser',
        chip: '4-Laser Array',
        name: 'Four-Laser Array (Canonical Bench)',
        tag: 'TEXTBOOK',
        tagline: 'One pulsed diode laser per BB84 state, passively combined into a single spatial mode. No fast modulator, no drive electronics \u2014 the cleanest way to \u201Csee\u201D BB84 on a table.',
        rows: [
            {
                t: 'fan',
                lanes: [
                    { title: 'CH 1', boxes: [{ label: 'LASER 1', sub: '850 nm \u00B7 1 ns', kind: 'source' }, { label: 'POLARISER', sub: '0' + DEG + ' \u2192 H', kind: 'optic' }] },
                    { title: 'CH 2', boxes: [{ label: 'LASER 2', sub: '850 nm \u00B7 1 ns', kind: 'source' }, { label: 'POLARISER', sub: '90' + DEG + ' \u2192 V', kind: 'optic' }] },
                    { title: 'CH 3', boxes: [{ label: 'LASER 3', sub: '850 nm \u00B7 1 ns', kind: 'source' }, { label: 'HWP', sub: '22.5' + DEG + ' \u2192 +45' + DEG, kind: 'optic' }] },
                    { title: 'CH 4', boxes: [{ label: 'LASER 4', sub: '850 nm \u00B7 1 ns', kind: 'source' }, { label: 'HWP', sub: '67.5' + DEG + ' \u2192 ' + MINUS + '45' + DEG, kind: 'optic' }] }
                ]
            },
            { t: 'unit', label: 'BEAM COMBINER TREE (3 \u00D7 BS)', sub: '4 spatial modes \u2192 1 common mode', kind: 'mod' },
            { t: 'unit', label: 'VARIABLE ATTENUATOR', sub: '\u03BC = 0.5 photons / pulse', kind: 'atten' },
            { t: 'unit', label: 'COLLIMATOR \u00B7 OUTPUT COUPLER', sub: 'NA-matched launch into the quantum channel', kind: 'optic' }
        ],
        specs: [
            ['Wavelength', '850 nm (Si APD window)'],
            ['Clock', '100 MHz'],
            ['Mean photon no.', '\u03BC = 0.5'],
            ['Per-state extinction', '> 30 dB'],
            ['Basis bias', 'set by pulse-pick probability']
        ],
        notes: [
            'Nothing is modulated at speed, so there is no pattern-dependent polarisation drift.',
            'The four lasers must be intensity- and timing-matched, otherwise a \u201Cwhich laser\u201D side channel leaks the bit.',
            'Direct descendant of the original 1990s Gisin/Zbinden laboratory benches.'
        ],
        states: [
            ['LASER 1', 'POL 0' + DEG, 'H', '0'],
            ['LASER 2', 'POL 90' + DEG, 'V', '1'],
            ['LASER 3', 'HWP 22.5' + DEG, '+45' + DEG, '0'],
            ['LASER 4', 'HWP 67.5' + DEG, MINUS + '45' + DEG, '1']
        ]
    },
    {
        id: 'a-pockels',
        chip: 'Single Laser + Pockels',
        name: 'Single Laser with Electro-Optic Pockels Cell',
        tag: 'LAB WORKHORSE',
        tagline: 'One pulsed source, one LiNbO\u2083 crystal. A four-level voltage drive rotates the polarisation into H, V, +45\u00B0 or \u221245\u00B0 on demand.',
        rows: [
            { t: 'unit', label: 'PULSED LASER DIODE', sub: '850 nm \u00B7 1 ns \u00B7 100 MHz', kind: 'source' },
            { t: 'unit', label: 'LiNbO\u2083 POCKELS CELL', sub: '4-level drive \u2014 0, V\u03C0/2, V\u03C0, 3V\u03C0/2', kind: 'mod' },
            { t: 'unit', label: 'BIAS POLARISER', sub: 'defines the |H\u27E9 reference axis', kind: 'optic' },
            { t: 'unit', label: 'VARIABLE ATTENUATOR', sub: '\u03BC = 0.5 photons / pulse', kind: 'atten' }
        ],
        specs: [
            ['Switching', 'sub-ns, 4-level driver'],
            ['Extinction', '20 \u2013 30 dB'],
            ['Half-wave voltage', 'V\u03C0 \u2248 150 V (bulk)'],
            ['Drift', 'temperature dependent']
        ],
        notes: [
            'Only one laser means perfect intensity and timing match between all four states.',
            'The price is high-voltage drive electronics and slow thermal drift in the crystal.',
            'Requires per-state calibration or the QBER floor rises after a few minutes.'
        ],
        states: [
            ['Pockels 0', 'no rotation', 'H', '0'],
            ['Pockels V\u03C0', '90' + DEG + ' rotation', 'V', '1'],
            ['Pockels V\u03C0/2', '45' + DEG + ' rotation', '+45' + DEG, '0'],
            ['Pockels 3V\u03C0/2', '135' + DEG + ' rotation', MINUS + '45' + DEG, '1']
        ]
    },
    {
        id: 'a-decoy',
        chip: 'Decoy-State WCP',
        name: 'Decoy-State Weak Coherent Pulse Source',
        tag: 'COMMERCIAL',
        tagline: 'A gain-switched telecom laser whose intensity is randomised between signal, decoy and vacuum levels \u2014 defeating photon-number-splitting attacks.',
        rows: [
            { t: 'unit', label: 'GAIN-SWITCHED DFB LASER', sub: '1550 nm \u00B7 2.5 GHz clock', kind: 'source' },
            { t: 'unit', label: 'INTENSITY MODULATOR (AM)', sub: 'signal \u03BC \u00B7 decoy \u03BD \u00B7 vacuum', kind: 'mod' },
            { t: 'unit', label: 'POLARISATION MODULATOR', sub: '4 states, RNG-driven per pulse', kind: 'mod' },
            { t: 'unit', label: 'PRECISION ATTENUATOR', sub: '\u03BC = 0.5 \u00B7 \u03BD = 0.1 \u00B7 vac = 0', kind: 'atten' },
            { t: 'unit', label: 'TAP BS + POWER METER', sub: 'live \u03BC stabilisation loop', kind: 'optic' }
        ],
        specs: [
            ['Wavelength', '1550 nm (C-band)'],
            ['Clock', '2.5 GHz'],
            ['Intensities', '\u03BC / \u03BD / vacuum'],
            ['PNS defence', 'decoy statistics'],
            ['Fibre reach', '> 100 km']
        ],
        notes: [
            'Weak coherent pulses occasionally contain two photons \u2014 decoy levels let Alice and Bob *detect* that.',
            'This is what essentially every commercial fibre QKD product ships with today.',
            'The intensity modulator must be immune to Trojan-horse back-reflection.'
        ],
        states: [
            ['PM level 0', 'AM = \u03BC', 'H', '0'],
            ['PM level 1', 'AM = \u03BC', 'V', '1'],
            ['PM level 2', 'AM = \u03BC', '+45' + DEG, '0'],
            ['PM level 3', 'AM = \u03BC', MINUS + '45' + DEG, '1'],
            ['decoy slot', 'AM = \u03BD', 'random', 'discarded']
        ]
    },
    {
        id: 'a-spdc',
        chip: 'Entangled Source (SPDC)',
        name: 'Entangled Photon Pair Source \u2014 BBM92',
        tag: 'ENTANGLEMENT',
        tagline: 'A pump laser drives spontaneous parametric down-conversion; Alice keeps one photon and ships its twin. Measurement choices on both sides replace state preparation.',
        rows: [
            { t: 'unit', label: 'PUMP LASER', sub: '405 nm CW \u00B7 50 mW', kind: 'source' },
            { t: 'unit', label: 'PPKTP CRYSTAL (SPDC)', sub: 'type-II \u00B7 degenerate 810 nm pair', kind: 'mod' },
            {
                t: 'split',
                branches: [
                    { title: 'LOCAL ARM \u2014 ALICE', boxes: [{ label: 'WALK-OFF COMPENSATOR', sub: 'temporal + spatial', kind: 'optic' }, { label: 'POLARISATION ANALYSER', sub: 'random Z / X basis', kind: 'mod' }] },
                    { title: 'CHANNEL ARM \u2192 BOB', boxes: [{ label: 'FIBRE COUPLER', sub: '810 nm single mode', kind: 'optic' }, { label: 'COLLIMATOR', sub: 'launch into channel', kind: 'optic' }] }
                ]
            }
        ],
        specs: [
            ['Pump', '405 nm \u00B7 CW'],
            ['Pair wavelength', '810 nm'],
            ['Brightness', '\u2248 10\u2076 pairs/s/mW'],
            ['Protocol variant', 'BBM92'],
            ['Source side channel', 'none \u2014 no preparation']
        ],
        notes: [
            'Alice never \u201Cchooses\u201D a state \u2014 she measures, and the outcome is correlated with Bob\u2019s.',
            'Removes all source-side imperfections from the security proof.',
            'Pairs follow Poisson statistics, so multi-pair emissions still need decoy-style treatment.'
        ],
        states: [
            ['|\u03A6\u207A\u27E9 outcome', 'Z analyser', 'H', '0'],
            ['|\u03A6\u207A\u27E9 outcome', 'Z analyser', 'V', '1'],
            ['|\u03A6\u207A\u27E9 outcome', 'X analyser', '+45' + DEG, '0'],
            ['|\u03A6\u207A\u27E9 outcome', 'X analyser', MINUS + '45' + DEG, '1']
        ]
    },
    {
        id: 'a-pic',
        chip: 'Silicon Photonics PIC',
        name: 'Integrated Photonic Transmitter',
        tag: 'CHIP SCALE',
        tagline: 'Laser, ring modulators, variable attenuator and grating coupler lithographed onto one silicon die \u2014 the route to mass-deployable QKD.',
        rows: [
            { t: 'unit', label: 'HYBRID DFB LASER', sub: 'III-V bonded on Si \u00B7 C-band', kind: 'source' },
            {
                t: 'fan',
                lanes: [
                    { title: 'CH 1', boxes: [{ label: 'RING MODULATOR', sub: 'H', kind: 'mod' }] },
                    { title: 'CH 2', boxes: [{ label: 'RING MODULATOR', sub: 'V', kind: 'mod' }] },
                    { title: 'CH 3', boxes: [{ label: 'RING MODULATOR', sub: '+45' + DEG, kind: 'mod' }] },
                    { title: 'CH 4', boxes: [{ label: 'RING MODULATOR', sub: MINUS + '45' + DEG, kind: 'mod' }] }
                ]
            },
            { t: 'unit', label: 'ON-CHIP VOA + MONITOR TAP', sub: '\u03BC calibration loop', kind: 'atten' },
            { t: 'unit', label: 'GRATING COUPLER', sub: 'chip \u2192 fibre', kind: 'optic' }
        ],
        specs: [
            ['Platform', 'SOI / SiN, 220 nm'],
            ['Footprint', '< 10 mm\u00B2'],
            ['Modulator', 'carrier-depletion MRM'],
            ['Clock', 'GHz-class'],
            ['Insertion loss', '\u2248 6 \u2013 9 dB total']
        ],
        notes: [
            'Waveguide birefringence makes on-chip polarisation handling the hard part, not the modulation.',
            'Thermal crosstalk between adjacent rings shifts the state \u2014 active trimming is mandatory.',
            'Enables co-packaged QKD inside standard telecom transceivers.'
        ],
        states: [
            ['Ring 1 on', '0' + DEG + ' rotation', 'H', '0'],
            ['Ring 2 on', '90' + DEG + ' rotation', 'V', '1'],
            ['Ring 3 on', '45' + DEG + ' rotation', '+45' + DEG, '0'],
            ['Ring 4 on', '135' + DEG + ' rotation', MINUS + '45' + DEG, '1']
        ]
    },
    {
        id: 'a-freespace',
        chip: 'Free-Space / Satellite Tx',
        name: 'Free-Space and Satellite Transmitter',
        tag: 'LONG HAUL',
        tagline: 'A diffraction-limited beam with an acquisition, tracking and pointing loop \u2014 the only way to reach thousands of kilometres without fibre loss.',
        rows: [
            { t: 'unit', label: 'PULSED FIBRE LASER', sub: '1550 nm \u00B7 100 MHz', kind: 'source' },
            { t: 'unit', label: 'POLARISATION ENCODER (LCVR)', sub: '4 states \u00B7 no moving parts', kind: 'mod' },
            { t: 'unit', label: 'BEAM EXPANDER', sub: '\u00D720 divergence trim', kind: 'optic' },
            { t: 'unit', label: 'FINE-STEERING MIRROR (ATP)', sub: 'beacon tracking loop', kind: 'mod' },
            { t: 'unit', label: 'TRANSMIT TELESCOPE', sub: 'to satellite / remote ground station', kind: 'optic' }
        ],
        specs: [
            ['Wavelength', '1550 nm (eye safe)'],
            ['Beam divergence', '< 20 \u03BCrad'],
            ['Link budget', '30 \u2013 45 dB typical'],
            ['Atmosphere', 'turbulence + seeing'],
            ['Key rate', 'kbit/s from LEO passes']
        ],
        notes: [
            'Polarisation is preserved extremely well by the atmosphere \u2014 free space is a natural quantum channel.',
            'Weather and daylight background photons dominate the QBER, not the optics.',
            'Beam wander is corrected with a fast steering mirror locked to a beacon.'
        ],
        states: [
            ['LCVR 0', 'no retardance', 'H', '0'],
            ['LCVR 1', '\u03BB/2 retardance', 'V', '1'],
            ['LCVR 2', '\u03BB/4 retardance', '+45' + DEG, '0'],
            ['LCVR 3', '3\u03BB/4 retardance', MINUS + '45' + DEG, '1']
        ]
    }
];

export const BOB = [
    {
        id: 'b-passive',
        chip: 'Passive Basis (BS + PBS)',
        name: 'Passive Basis Choice \u2014 50:50 BS into Two PBS',
        tag: 'TEXTBOOK',
        tagline: 'A single beam splitter passively routes each photon into the Z or the X basis. No modulator, no clock alignment, no active element to attack.',
        rows: [
            { t: 'unit', label: 'INPUT COUPLER', sub: 'fibre \u2192 free beam', kind: 'optic' },
            { t: 'unit', label: '50:50 BEAM SPLITTER', sub: 'random basis choice', kind: 'mod' },
            {
                t: 'split',
                branches: [
                    {
                        title: 'Z BASIS',
                        boxes: [
                            { label: 'PBS', sub: 'H transmitted \u00B7 V reflected', kind: 'pbs' },
                            { label: 'D0', sub: 'H detected', kind: 'det', bit: '0' },
                            { label: 'D1', sub: 'V detected', kind: 'det', bit: '1' }
                        ]
                    },
                    {
                        title: 'X BASIS',
                        boxes: [
                            { label: 'HWP', sub: '22.5' + DEG + ' rotation', kind: 'optic' },
                            { label: 'PBS', sub: '+45' + DEG + ' t \u00B7 ' + MINUS + '45' + DEG + ' r', kind: 'pbs' },
                            { label: 'D+', sub: '+45' + DEG + ' detected', kind: 'det', bit: '0' },
                            { label: 'D' + MINUS, sub: MINUS + '45' + DEG + ' detected', kind: 'det', bit: '1' }
                        ]
                    }
                ]
            }
        ],
        specs: [
            ['Detectors', '4 \u00D7 Si APD (850 nm)'],
            ['Basis choice', 'passive, truly random'],
            ['Efficiency', '\u2248 60 % per detector'],
            ['Dark count', '\u2248 100 Hz'],
            ['Timing jitter', '\u2248 350 ps']
        ],
        notes: [
            'The 50:50 BS is the quantum random number generator that picks Bob\u2019s basis.',
            'Four detectors means four dark-count channels \u2014 the dominant noise at long distance.',
            'Detector efficiency mismatch between D0/D1 and D+/\u2212 is a known side channel.'
        ],
        truth: [
            ['H', 'Z', 'D0', '0'],
            ['V', 'Z', 'D1', '1'],
            ['+45' + DEG, 'X', 'D+', '0'],
            [MINUS + '45' + DEG, 'X', 'D' + MINUS, '1'],
            ['wrong basis', 'either', 'random', 'discard']
        ]
    },
    {
        id: 'b-active',
        chip: 'Active Basis (Pockels)',
        name: 'Active Basis Choice \u2014 Pockels Cell + Single PBS',
        tag: 'TWO DETECTORS',
        tagline: 'Bob drives a Pockels cell to rotate by 0\u00B0 (Z) or 22.5\u00B0 (X) before one fixed PBS. Only two detectors are needed.',
        rows: [
            { t: 'unit', label: 'INPUT COUPLER', sub: 'fibre \u2192 free beam', kind: 'optic' },
            { t: 'unit', label: 'POCKELS CELL', sub: '0' + DEG + ' (Z) or 22.5' + DEG + ' (X), RNG driven', kind: 'mod' },
            { t: 'unit', label: 'POLARISING BEAM SPLITTER', sub: 'single PBS', kind: 'pbs' },
            {
                t: 'split',
                branches: [
                    { title: 'OUTPUT 0', boxes: [{ label: 'D0', sub: 'H port', kind: 'det', bit: '0' }] },
                    { title: 'OUTPUT 1', boxes: [{ label: 'D1', sub: 'V port', kind: 'det', bit: '1' }] }
                ]
            }
        ],
        specs: [
            ['Detectors', '2 \u00D7 APD'],
            ['Basis choice', 'active, RNG driven'],
            ['Switch rate', 'per pulse, MHz'],
            ['Insertion loss', '\u2248 1.5 dB'],
            ['Risk', 'modulator side channels']
        ],
        notes: [
            'Halves the detector count, which halves the total dark-count contribution.',
            'The basis is no longer chosen by nature \u2014 an active modulator can leak information.',
            'Needs precise synchronisation between the drive voltage and the photon arrival.'
        ],
        truth: [
            ['H', 'Z (0' + DEG + ')', 'D0', '0'],
            ['V', 'Z (0' + DEG + ')', 'D1', '1'],
            ['+45' + DEG, 'X (22.5' + DEG + ')', 'D0', '0'],
            [MINUS + '45' + DEG, 'X (22.5' + DEG + ')', 'D1', '1']
        ]
    },
    {
        id: 'b-timebin',
        chip: 'Time-Bin Receiver',
        name: 'Time-Bin Receiver \u2014 Unbalanced Mach\u2013Zehnder',
        tag: 'FIBRE ROBUST',
        tagline: 'Bits live in the arrival time (early / late) and in the relative phase of two time bins. Polarisation drift in the fibre becomes irrelevant.',
        rows: [
            { t: 'unit', label: 'INPUT COUPLER', sub: 'fibre \u2192 free beam', kind: 'optic' },
            { t: 'unit', label: '50:50 BEAM SPLITTER', sub: 'basis choice', kind: 'mod' },
            {
                t: 'split',
                branches: [
                    {
                        title: 'Z BASIS \u2014 TIME',
                        boxes: [
                            { label: 'DIRECT PATH', sub: 'early \u21D2 0 \u00B7 late \u21D2 1', kind: 'optic' },
                            { label: 'SPAD + TDC', sub: '25 ps arrival-time tag', kind: 'det' }
                        ]
                    },
                    {
                        title: 'X BASIS \u2014 PHASE',
                        boxes: [
                            { label: 'UNBALANCED MZI', sub: '\u0394L \u21D2 \u0394t \u2248 400 ps', kind: 'mod' },
                            { label: 'PIEZO PHASE SHIFTER', sub: '\u03C6-lock feedback loop', kind: 'mod' },
                            { label: 'SPAD \u00D7 2', sub: 'port A / port B', kind: 'det' }
                        ]
                    }
                ]
            }
        ],
        specs: [
            ['Encoding', 'time bin + phase'],
            ['Bin separation', '400 ps \u2013 1 ns'],
            ['Detectors', '2 \u00D7 InGaAs SPAD'],
            ['Stability', 'needs \u0394L thermal control'],
            ['Fibre reach', 'polarisation insensitive']
        ],
        notes: [
            'Time-bin qubits survive long fibre runs where polarisation would wander.',
            'The interferometer must be stabilised to a fraction of a wavelength.',
            'Gated InGaAs SPADs give \u2248 20 % efficiency with after-pulse gating.'
        ],
        truth: [
            ['early bin', 'Z (time)', 'D @ t\u2080', '0'],
            ['late bin', 'Z (time)', 'D @ t\u2081', '1'],
            ['\u03C6 = 0', 'X (phase)', 'D_A', '0'],
            ['\u03C6 = \u03C0', 'X (phase)', 'D_B', '1']
        ]
    },
    {
        id: 'b-phase',
        chip: 'Phase Encoding (MZI)',
        name: 'Phase-Encoding Receiver \u2014 Plug & Play MZI',
        tag: 'AUTO-ALIGN',
        tagline: 'Bob applies one of four phases to his arm of an unbalanced interferometer; a Faraday mirror makes the loop self-compensating for fibre birefringence.',
        rows: [
            { t: 'unit', label: 'INPUT COUPLER', sub: 'fibre \u2192 interferometer', kind: 'optic' },
            { t: 'unit', label: 'UNBALANCED MZI (\u0394L)', sub: 'early / late arms', kind: 'mod' },
            { t: 'unit', label: 'PHASE MODULATOR', sub: '0, \u03C0/2, \u03C0, 3\u03C0/2 \u2014 basis + bit', kind: 'mod' },
            { t: 'unit', label: 'FARADAY MIRROR', sub: 'auto polarisation compensation', kind: 'optic' },
            {
                t: 'split',
                branches: [
                    { title: 'PORT A', boxes: [{ label: 'D0', sub: 'constructive', kind: 'det', bit: '0' }] },
                    { title: 'PORT B', boxes: [{ label: 'D1', sub: 'destructive', kind: 'det', bit: '1' }] }
                ]
            }
        ],
        specs: [
            ['Encoding', 'relative phase'],
            ['Detectors', '2 \u00D7 APD'],
            ['Self-alignment', 'Faraday round trip'],
            ['Round-trip loss', '3 dB extra'],
            ['Caution', 'Trojan-horse backflash']
        ],
        notes: [
            'The Faraday mirror cancels any birefringence the fibre introduced on the way out.',
            'Plug & play benches were the first commercial products (id Quantique Clavis).',
            'Because light travels out and back, an eavesdropper can in principle inject light.'
        ],
        truth: [
            ['\u0394\u03C6 = 0', 'X', 'D0', '0'],
            ['\u0394\u03C6 = \u03C0', 'X', 'D1', '1'],
            ['early bin', 'Z', 'D @ t\u2080', '0'],
            ['late bin', 'Z', 'D @ t\u2081', '1']
        ]
    },
    {
        id: 'b-snspd',
        chip: 'Cryogenic SNSPD',
        name: 'Superconducting Nanowire Receiver',
        tag: 'STATE OF ART',
        tagline: 'Four nanowire detectors at 2.5 K replace the APDs \u2014 near-unity efficiency, almost no dark counts, and picosecond timing.',
        rows: [
            { t: 'unit', label: 'INPUT COUPLER', sub: 'fibre \u2192 free beam', kind: 'optic' },
            { t: 'unit', label: '50:50 BEAM SPLITTER', sub: 'passive basis choice', kind: 'mod' },
            {
                t: 'split',
                branches: [
                    {
                        title: 'Z BASIS \u00B7 2.5 K',
                        boxes: [
                            { label: 'PBS', sub: 'H t \u00B7 V r', kind: 'pbs' },
                            { label: 'SNSPD 1', sub: 'H channel', kind: 'cryo', bit: '0' },
                            { label: 'SNSPD 2', sub: 'V channel', kind: 'cryo', bit: '1' }
                        ]
                    },
                    {
                        title: 'X BASIS \u00B7 2.5 K',
                        boxes: [
                            { label: 'HWP', sub: '22.5' + DEG + ' rotation', kind: 'optic' },
                            { label: 'PBS', sub: '+45' + DEG + ' t \u00B7 ' + MINUS + '45' + DEG + ' r', kind: 'pbs' },
                            { label: 'SNSPD 3', sub: '+45' + DEG + ' channel', kind: 'cryo', bit: '0' },
                            { label: 'SNSPD 4', sub: MINUS + '45' + DEG + ' channel', kind: 'cryo', bit: '1' }
                        ]
                    }
                ]
            },
            { t: 'unit', label: 'CRYO READOUT \u00B7 TDC', sub: 'jitter < 20 ps \u00B7 dark < 10 Hz', kind: 'cryo' }
        ],
        specs: [
            ['Detectors', '4 \u00D7 SNSPD (NbN / WSi)'],
            ['Efficiency', '> 90 % at 1550 nm'],
            ['Dark count', '< 10 Hz'],
            ['Jitter', '< 20 ps'],
            ['Operating point', '2.5 K closed-cycle']
        ],
        notes: [
            'Efficiency above 90 % roughly doubles the secure distance compared with APDs.',
            'Recovery time (\u2248 20 \u2013 50 ns) sets the maximum count rate, not the jitter.',
            'Cryogenic cost and volume are the reason these live in rack-sized systems, not laptops.'
        ],
        truth: [
            ['H', 'Z', 'SNSPD 1', '0'],
            ['V', 'Z', 'SNSPD 2', '1'],
            ['+45' + DEG, 'X', 'SNSPD 3', '0'],
            [MINUS + '45' + DEG, 'X', 'SNSPD 4', '1']
        ]
    },
    {
        id: 'b-fsrx',
        chip: 'Free-Space Receiver',
        name: 'Free-Space / Ground-Station Receiver',
        tag: 'SATELLITE',
        tagline: 'A tracking telescope plus adaptive optics collects the downlink beam, filters it hard, and only then hands it to a standard polarisation analyser.',
        rows: [
            { t: 'unit', label: 'RECEIVE TELESCOPE', sub: '400 mm aperture \u00B7 f/4', kind: 'optic' },
            { t: 'unit', label: 'ATP \u00B7 FINE STEERING', sub: 'beacon tracking loop', kind: 'mod' },
            { t: 'unit', label: 'SPECTRAL + SPATIAL FILTER', sub: '1550 nm \u00B7 1 nm BW \u00B7 SMF', kind: 'optic' },
            { t: 'unit', label: 'ADAPTIVE OPTICS (DM)', sub: 'turbulence correction', kind: 'mod' },
            { t: 'unit', label: '50:50 BEAM SPLITTER', sub: 'basis choice', kind: 'mod' },
            {
                t: 'split',
                branches: [
                    {
                        title: 'Z BASIS',
                        boxes: [
                            { label: 'PBS', sub: 'H t \u00B7 V r', kind: 'pbs' },
                            { label: 'D0', sub: 'H detected', kind: 'det', bit: '0' },
                            { label: 'D1', sub: 'V detected', kind: 'det', bit: '1' }
                        ]
                    },
                    {
                        title: 'X BASIS',
                        boxes: [
                            { label: 'HWP', sub: '22.5' + DEG + ' rotation', kind: 'optic' },
                            { label: 'PBS', sub: 'diagonal split', kind: 'pbs' },
                            { label: 'D+', sub: '+45' + DEG + ' detected', kind: 'det', bit: '0' },
                            { label: 'D' + MINUS, sub: MINUS + '45' + DEG + ' detected', kind: 'det', bit: '1' }
                        ]
                    }
                ]
            }
        ],
        specs: [
            ['Aperture', '400 mm \u2013 1.8 m'],
            ['Filters', '1 nm spectral + SMF'],
            ['Detectors', '4 \u00D7 SNSPD or InGaAs'],
            ['Background', 'solar / lunar photons'],
            ['Link', 'LEO downlink, \u2248 5 min passes']
        ],
        notes: [
            'Spatial filtering into a single-mode fibre is what makes daylight operation possible.',
            'Adaptive optics recovers the coupling efficiency lost to atmospheric turbulence.',
            'Timing is harder than polarisation: the whole pass must be tracked to < 1 ns.'
        ],
        truth: [
            ['H', 'Z', 'D0', '0'],
            ['V', 'Z', 'D1', '1'],
            ['+45' + DEG, 'X', 'D+', '0'],
            [MINUS + '45' + DEG, 'X', 'D' + MINUS, '1']
        ]
    }
];

const PRESETS = [
    { label: 'Textbook Bench', a: 'a-4laser', b: 'b-passive' },
    { label: 'Metro Fibre Link', a: 'a-decoy', b: 'b-snspd' },
    { label: 'Satellite Downlink', a: 'a-freespace', b: 'b-fsrx' },
    { label: 'Chip-to-Chip', a: 'a-pic', b: 'b-active' },
    { label: 'Entangled BBM92', a: 'a-spdc', b: 'b-passive' },
    { label: 'Time-Bin Fibre', a: 'a-decoy', b: 'b-timebin' }
];

const LEGEND = [
    ['source', 'Source'],
    ['mod', 'Active modulator'],
    ['optic', 'Passive optic'],
    ['atten', 'Attenuator'],
    ['pbs', 'Polarising splitter'],
    ['det', 'Single-photon detector'],
    ['cryo', 'Cryogenic detector']
];

/* ------------------------------------------------------------------- state */
let current = { alice: 'a-4laser', bob: 'b-passive' };

const getAlice = (id) => ALICE.find((m) => m.id === id) || ALICE[0];
const getBob = (id) => BOB.find((m) => m.id === id) || BOB[0];

/* ----------------------------------------------------------------- render  */
function buildSvg() {
    const alice = getAlice(current.alice);
    const bob = getBob(current.bob);
    const out = [];

    const a = drawZone(alice, 6, 'alice');
    out.push(a.svg);
    const y = drawChannel(a.height + 6, out);
    const b = drawZone(bob, y + 6, 'bob');
    out.push(b.svg);

    return `<svg id="ob-bench-svg" viewBox="0 0 ${W} ${b.yEnd + 18}" role="img" aria-label="BB84 optical bench diagram">${out.join('')}</svg>`;
}

function buildChips() {
    const aliceRow = document.getElementById('ob-alice-chips');
    const bobRow = document.getElementById('ob-bob-chips');
    if (!aliceRow || !bobRow) return;

    aliceRow.innerHTML = ALICE.map((m) =>
        `<button type="button" class="ob-chip ob-chip-alice${m.id === current.alice ? ' is-active' : ''}" data-side="alice" data-id="${m.id}">` +
        `<span class="ob-chip-dot"></span>${esc(m.chip)}</button>`
    ).join('');

    bobRow.innerHTML = BOB.map((m) =>
        `<button type="button" class="ob-chip ob-chip-bob${m.id === current.bob ? ' is-active' : ''}" data-side="bob" data-id="${m.id}">` +
        `<span class="ob-chip-dot"></span>${esc(m.chip)}</button>`
    ).join('');

    const presetRow = document.getElementById('ob-presets');
    if (presetRow) {
        presetRow.innerHTML = PRESETS.map((p) =>
            `<button type="button" class="ob-preset" data-a="${p.a}" data-b="${p.b}">${esc(p.label)}</button>`
        ).join('');
    }
}

function specRows(list) {
    return list.map(([k, v]) =>
        `<div class="ob-spec"><span class="ob-spec-k">${esc(k)}</span><span class="ob-spec-v">${esc(v)}</span></div>`
    ).join('');
}

function buildInfo() {
    const alice = getAlice(current.alice);
    const bob = getBob(current.bob);

    const aStates = alice.states.map((s) =>
        `<tr><td>${esc(s[0])}</td><td>${esc(s[1])}</td><td class="ob-mono ob-strong">${esc(s[2])}</td><td class="ob-bit-cell">${esc(s[3])}</td></tr>`
    ).join('');

    const bTruth = bob.truth.map((s) =>
        `<tr><td class="ob-mono ob-strong">${esc(s[0])}</td><td>${esc(s[1])}</td><td>${esc(s[2])}</td><td class="ob-bit-cell">${esc(s[3])}</td></tr>`
    ).join('');

    const aCard = document.getElementById('ob-alice-card');
    if (aCard) {
        aCard.innerHTML =
            `<div class="ob-card-head"><span class="ob-tag ob-tag-alice">${esc(alice.tag)}</span>` +
            `<h3 class="ob-card-title">${esc(alice.name)}</h3></div>` +
            `<p class="ob-card-tagline">${esc(alice.tagline)}</p>` +
            `<div class="ob-specs">${specRows(alice.specs)}</div>` +
            `<h4 class="ob-sub-head">State preparation map</h4>` +
            `<table class="ob-table"><thead><tr><th>Element</th><th>Setting</th><th>State</th><th>Bit</th></tr></thead><tbody>${aStates}</tbody></table>` +
            `<ul class="ob-notes">${alice.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`;
    }

    const bCard = document.getElementById('ob-bob-card');
    if (bCard) {
        bCard.innerHTML =
            `<div class="ob-card-head"><span class="ob-tag ob-tag-bob">${esc(bob.tag)}</span>` +
            `<h3 class="ob-card-title">${esc(bob.name)}</h3></div>` +
            `<p class="ob-card-tagline">${esc(bob.tagline)}</p>` +
            `<div class="ob-specs">${specRows(bob.specs)}</div>` +
            `<h4 class="ob-sub-head">Detection truth table</h4>` +
            `<table class="ob-table"><thead><tr><th>Incoming</th><th>Basis</th><th>Detector</th><th>Bit</th></tr></thead><tbody>${bTruth}</tbody></table>` +
            `<ul class="ob-notes">${bob.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`;
    }

    const benchId = document.getElementById('ob-bench-id');
    if (benchId) benchId.textContent = shortId(alice) + ' / ' + shortId(bob);
    const cfg = document.getElementById('ob-config-tag');
    if (cfg) cfg.textContent = alice.tag + ' + ' + bob.tag;
}

function shortId(m) {
    return m.id.replace(/^[ab]-/, '').toUpperCase().slice(0, 8);
}

function buildLegend() {
    const el = document.getElementById('ob-legend');
    if (!el) return;
    el.innerHTML = LEGEND.map(([k, label]) =>
        `<span class="ob-legend-item"><i class="ob-sw ob-sw-${k}"></i>${esc(label)}</span>`
    ).join('');
}

function render() {
    const host = document.getElementById('ob-bench-host');
    if (host) host.innerHTML = buildSvg();
    buildChips();
    buildInfo();
    buildLegend();
}

function selectModule(side, id) {
    current[side] = id;
    render();
}

/* -------------------------------------------------------------------- init */
export function initStage8() {
    const host = document.getElementById('ob-bench-host');
    if (!host) return;

    render();

    document.addEventListener('click', (e) => {
        const chip = e.target.closest('.ob-chip');
        if (chip) {
            selectModule(chip.getAttribute('data-side'), chip.getAttribute('data-id'));
            return;
        }
        const preset = e.target.closest('.ob-preset');
        if (preset) {
            current.alice = preset.getAttribute('data-a');
            current.bob = preset.getAttribute('data-b');
            render();
        }
    });
}
