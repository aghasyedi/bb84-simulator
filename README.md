<div align="center">
  
# BB84 Quantum Key Distribution Simulator

**An interactive, research-grade educational environment for quantum cryptography.**

[![Live Demo](https://img.shields.io/badge/Live_Demo-Access_Simulator-00acc1?style=for-the-badge&logo=googlechrome&logoColor=white)](https://bb84qkd.netlify.app/)
[![Presentation](https://img.shields.io/badge/Presentation-View_Slides-1565c0?style=for-the-badge&logo=presentation&logoColor=white)](https://bb84qkd.netlify.app/bb84_qkd_presentation.html)
[![Audit Report](https://img.shields.io/badge/Audit_Report-Sample_PDF-c0392b?style=for-the-badge&logo=adobeacrobatreader&logoColor=white)](https://bb84qkd.netlify.app/BB84%20QKD%20Protocol%20%E2%80%94%20Audit%20Report%20_%20QKD-8824-A.pdf)

</div>

---

## Overview

Modern internet security stands on a precipice. The mathematical bedrock of current encryption faces imminent collapse under the weight of advancing quantum computation. Shor's algorithm will shatter the illusions of computational hardness.

We must look to physics, not mathematics, for salvation. 

This project delivers a comprehensive, purely client-side simulator for the BB84 Quantum Key Distribution (QKD) protocol. The security of BB84 is absolute. It is underwritten by the immutable laws of the universe: the No-Cloning Theorem and Heisenberg's Uncertainty Principle. 

Experience the entire cryptographic pipeline. Prepare photon polarizations. Witness the collapse of superpositions. Finalize an unconditionally secure symmetric key, mathematically proven to withstand any adversary, ready for modern cipher suites like ChaCha20-Poly1305.

---

## The 7-Stage Simulation Pipeline in Detail

This simulator bridges the formidable gap between abstract quantum mechanics and practical cryptographic engineering. The journey is meticulously divided into seven critical stages, each highly interactive and visually represented via high-performance Canvas animations.

### 1. Educational Foundation
A rigorous introduction to the history, underlying mechanics, and critical real-world deployments of the BB84 protocol across banking, defense, and nascent quantum networks. It establishes the mathematical and physical prerequisites required to understand QKD.

### 2. Quantum Primitives
Interact directly with the physics that guarantee absolute security.
* **Bloch Sphere Representation:** Navigate the 2D Hilbert space. Visually rotate state vectors.
* **Wavefunction Collapse:** Observe the irreversible disturbance caused by measurement upon superposition states.
* **Mutually Unbiased Bases:** Master Rectilinear (+) and Diagonal (x) encoding schemes, visualizing how orthogonal measurements force probabilistic outcomes.

### 3. Protocol Core Engine (Transmission)
Command the real-time quantum channel between Alice (Transmitter) and Bob (Receiver).
* **Execution Modes:** Toggle between Auto Mode (simulating thousands of bits instantly) and Manual Mode (allowing direct input of specific bits and bases for Alice and Bob).
* **Adjustable Parameters:** Scale the protocol up to 10,240 photons. Control channel noise, photon pulse dynamics, and propagation velocity.
* **Threat Modeling:** Unleash Eve. Toggle active interception to visualize devastating intercept-resend attacks in real time, observing how Eve's measurements inevitably collapse the wavefunction and induce errors.
* **Synchronized State Matrix:** Monitor the live data stream of Alice's prepared bits and bases against Bob's received measurements.

### 4. Basis Sifting (Classical Reconciliation)
Execute the critical public-channel comparison. Alice and Bob ruthlessly discard bits measured in incompatible bases over an authenticated, but public, classical channel. The surviving data, approximately 50%, forms the foundational Sifted Key.

### 5. QBER Analysis (Security Auditing)
Security is not assumed; it is proven. Analyze the Quantum Bit Error Rate (QBER).
* **Statistical Sampling:** Sample the sifted key to detect the inevitable disturbance of an eavesdropper or high channel noise based on the Hoeffding Inequality.
* **Threshold Enforcement:** The system enforces strict security tolerances. It automatically aborts the protocol if the critical 12.9% QBER threshold is breached, ensuring compromised keys are discarded.

### 6. Post-Processing (Algorithmic Correction)
Forge the raw sifted key into an unbreakable secret.
* **Information Reconciliation (Two Modes):** 
  * Deploy the interactive **Cascade Protocol** for binary bisection parity checks.
  * Utilize advanced **Low-Density Parity-Check (LDPC)** via Syndrome Decoding and Tanner graph belief propagation to eliminate discrepancies efficiently.
* **Privacy Amplification:** Eradicate any partial knowledge Eve may have gained during the sifting or error correction phases. Utilize **Universal Toeplitz Hashing** to mathematically compress the key, distilling out a perfectly secure final string.

### 7. Results & Export
Audit the final unconditionally secure cryptographic key. The system provides a comprehensive breakdown of bits retained versus discarded throughout the pipeline.
* **Cryptographic Report Generation:** Generate professional, highly detailed PDF audit reports documenting the entire quantum session, including transmission metrics, error rates, and final key outputs.

---

## Technical Architecture

Engineered for uncompromising performance and universal portability. Complex matrix operations, LDPC belief propagation, and cryptographic hashing execute entirely within the browser envelope.

| Layer | Technologies Used | Details |
| :--- | :--- | :--- |
| **Frontend Core** | Vanilla JavaScript, HTML5, CSS3 | A zero-dependency, high-performance logic engine utilizing ES6 modules for modularity. |
| **State Management** | Custom Event Emitter | Decoupled state synchronization across 7 independent stage modules. |
| **Visualizations** | HTML5 Canvas API | Precision rendering for photon pulses, 3D-like Bloch spheres, and complex LDPC Tanner graphs. |
| **Mathematics** | KaTeX | Real-time, elegant LaTeX formula rendering for rigorous physical proofs and algorithms. |
| **UI/UX** | Custom CSS Variables | A premium glassmorphism aesthetic, fluid custom CSS animations, and seamless environmental adaptation (Day/Night themes). |
| **Export Engine** | Client-Side PDF Generation | Compiles real-time simulation metrics into structured audit reports. |
| **Deployment** | Static SPA Architecture | Absolute freedom of hosting: GitHub Pages, Netlify, Vercel, or execution directly from a local filesystem without any server backend. |

---

## Advanced Features & Capabilities

* **Deterministic vs Probabilistic Measurement Logic:** Accurately simulates the probabilistic collapse of photons when measured in incompatible bases versus the deterministic outcome in matched bases.
* **Live Dashboard Metrics:** Real-time tracking of input bits, correction overhead, privacy amplification compression ratios, and final secure key length.
* **Interactive Bisection UI:** Visualizes the Cascade protocol block by block, demonstrating exactly how parity mismatch reveals single-bit errors.
* **Custom Configurable Channel:** Users can inject artificial channel noise to test the robustness of the LDPC and Cascade error correction implementations against natural degradation rather than just Eve's interference.

---

## Getting Started

Frictionless deployment. As a fully client-side Single Page Application (SPA), this environment requires no build tools, no package managers, and no server-side runtimes.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/aghasyedi/bb84-simulator.git
   ```

2. **Navigate to the directory:**
   ```bash
   cd bb84-simulator
   ```

3. **Launch the simulator:**
   * Execute directly by opening `index.html` in any modern web browser.
   * *Recommended:* Serve via a local development server for optimal asset loading, font rendering, and ES6 module resolution (e.g., using VS Code "Live Server" or `python -m http.server`).

---

## Academic Context

Forged in the crucible of advanced academia. This simulator is a cornerstone project within the Master of Technology (M.Tech) in Quantum Computing program, specializing in Quantum Communication & Sensing.

* **Developer:** Agha Tasheer Syedi
* **Institution:** School of Quantum Technology (SQT), DIAT-DRDO, Pune, MH, India.
* **Supervisor:** Dr. Kanaka Raju Pandiri

---

## Acknowledgements & References

Built upon the shoulders of giants.

* Rooted in the foundational 1984 text: *Quantum cryptography: Public key distribution and coin tossing* by Charles H. Bennett and Gilles Brassard.
* Architected in alignment with **ETSI GS QKD 002** industry standards.
* Secured by the **No-Cloning Theorem** (Wootters & Zurek, 1982) and absolute information-theoretic security proofs (Shor & Preskill, 2000).

---

<div align="center">
<small>Designed and Engineered for the Post-Quantum Era.</small>
</div>
