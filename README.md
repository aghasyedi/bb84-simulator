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

## The 7-Stage Simulation Pipeline

This simulator bridges the formidable gap between abstract quantum mechanics and practical cryptographic engineering. The journey is divided into seven critical stages:

### 1. Educational Foundation
A rigorous introduction to the history, underlying mechanics, and critical real-world deployments of the BB84 protocol across banking, defense, and nascent quantum networks.

### 2. Quantum Primitives
Interact directly with the physics that guarantee absolute security.
* **Bloch Sphere Representation:** Navigate the 2D Hilbert space.
* **Wavefunction Collapse:** Observe the irreversible disturbance caused by measurement upon superposition states.
* **Mutually Unbiased Bases:** Master Rectilinear (+) and Diagonal (x) encoding schemes.

### 3. Protocol Core Engine (Transmission)
Command the real-time quantum channel between Alice and Bob.
* **Adjustable Parameters:** Scale the protocol up to 10,240 photons. Control channel noise, pulse dynamics, and propagation velocity.
* **Threat Modeling:** Unleash Eve. Toggle active interception to visualize devastating intercept-resend attacks in real time.
* **Synchronized State Matrix:** Monitor the live data stream of Alice's bits and bases against Bob's measurements.

### 4. Basis Sifting (Classical Reconciliation)
Execute the critical public-channel comparison. Alice and Bob ruthlessly discard bits measured in incompatible bases. The surviving data, approximately 50%, forms the foundational Sifted Key.

### 5. QBER Analysis (Security Auditing)
Security is not assumed; it is proven. Analyze the Quantum Bit Error Rate (QBER). Sample the sifted key to detect the inevitable disturbance of an eavesdropper. The system automatically aborts if the critical 12.9% threshold is breached, ensuring compromised keys are never used.

### 6. Post-Processing (Algorithmic Correction)
Forge the raw sifted key into an unbreakable secret.
* **Information Reconciliation:** Deploy the interactive Cascade Protocol for binary bisection parity checks, and Low-Density Parity-Check (LDPC) Tanner graph belief propagation to eliminate discrepancies.
* **Privacy Amplification:** Eradicate any partial knowledge Eve may have gained. Utilize Universal Toeplitz Hashing to mathematically compress and distill the final, perfect key.

### 7. Results & Export
Audit the final unconditionally secure cryptographic key. Generate professional, comprehensive PDF audit reports documenting the entire quantum session.

---

## Technical Architecture

Engineered for uncompromising performance and universal portability. Complex matrix operations and cryptographic hashing execute entirely within the browser envelope.

| Layer | Technologies Used | Details |
| :--- | :--- | :--- |
| **Frontend** | Vanilla JavaScript, HTML5, CSS3 | A zero-dependency, high-performance core logic engine. |
| **Visualizations** | Canvas API | Precision rendering for photon pulses, Bloch spheres, and complex Tanner graphs. |
| **Mathematics** | KaTeX | Real-time, elegant LaTeX formula rendering for rigorous physical proofs. |
| **UI/UX** | Custom CSS | A premium glassmorphism aesthetic, fluid custom animations, and seamless environmental adaptation (Day/Night modes). |
| **Deployment** | Static SPA | Absolute freedom of hosting: GitHub Pages, Netlify, Vercel, or execution directly from a local filesystem. |

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
   * *Recommended:* Serve via a local development server for optimal asset loading and module resolution.

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
