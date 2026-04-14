<div align="center">
  
# ⚛️ BB84 Quantum Key Distribution Simulator

**An interactive, research-grade educational environment for quantum cryptography.**

[![Live Demo](https://img.shields.io/badge/Live_Demo-Access_Simulator-00acc1?style=for-the-badge&logo=googlechrome&logoColor=white)](https://bb84qkd.netlify.app/)
[![Presentation](https://img.shields.io/badge/Presentation-View_Slides-1565c0?style=for-the-badge&logo=presentation&logoColor=white)](https://bb84qkd.netlify.app/bb84_qkd_presentation.html)
[![Audit Report](https://img.shields.io/badge/Audit_Report-Sample_PDF-c0392b?style=for-the-badge&logo=adobeacrobatreader&logoColor=white)](https://bb84qkd.netlify.app/BB84%20QKD%20Protocol%20%E2%80%94%20Audit%20Report%20_%20QKD-8824-A.pdf)



</div>

---

## 📖 Overview

Modern internet security is built on computational hardness—assumptions that are currently under threat by algorithms like Shor's running on sufficiently powerful quantum computers. 

This project provides a comprehensive, **pure client-side** simulator for the **BB84 QKD protocol**. Unlike classical encryption schemes (like RSA), BB84's security does not depend on mathematics; it is guaranteed by the fundamental laws of quantum physics (the No-Cloning Theorem and Heisenberg's Uncertainty Principle). 

This application takes users through the entire cryptographic pipeline, from preparing photon polarisations to finalising an unconditionally secure symmetric key ready for the ChaCha20-Poly1305 cipher suite.

---

## ✨ The 7-Stage Simulation Pipeline

The simulator is structured into seven interactive stages, designed to bridge the gap between theoretical quantum mechanics and practical cryptographic engineering:

### 1. Educational Foundation
A comprehensive introduction to the history, mechanics, and real-world deployments (Banking, Defense, Quantum Networks) of the BB84 protocol.

### 2. Quantum Primitives
Interactive visualisations of the physics that make QKD secure.
* **Bloch Sphere Representation:** Understand 2D Hilbert space.
* **Wavefunction Collapse:** Visualise how measurement disturbs superposition states.
* **Mutually Unbiased Bases:** Explore Rectilinear ($+$) and Diagonal ($\times$) encoding.

### 3. Protocol Core Engine (Transmission)
Simulate the real-time quantum channel between Alice and Bob.
* **Adjustable Parameters:** Control protocol scale (up to 10,240 photons), channel noise, pulse dynamics, and propagation speed.
* **Threat Modeling:** Toggle Eve's active interception to visualise intercept-resend attacks.
* **Synchronised State Matrix:** Real-time data logging of Alice's bits/bases and Bob's measurements.

### 4. Basis Sifting (Classical Reconciliation)
Execute the public-channel comparison where Alice and Bob discard bits measured in incompatible bases, retaining ~50% efficiency to form the **Sifted Key**.

### 5. QBER Analysis (Security Auditing)
Analyse the **Quantum Bit Error Rate (QBER)**. Sample a random subset of the sifted key to detect eavesdropper interference based on the Hoeffding Inequality. Automatically aborts if the critical 12.9% threshold is breached.

### 6. Post-Processing (Algorithmic Correction)
Transform the raw sifted key into a polished secret.
* **Information Reconciliation:** Interactive **Cascade Protocol** (binary bisection parity checks) and **LDPC** (Low-Density Parity-Check) Tanner graph belief propagation.
* **Privacy Amplification:** Mitigate Eve's partial knowledge using **Universal Toeplitz Hashing** to compress the key mathematically.

### 7. Results & Export
Audit the final unconditionally secure cryptographic key and generate professional, downloadable PDF audit reports of the quantum session.

---

## 🛠️ Technical Architecture

This simulator is engineered for maximum performance and portability, running complex matrix multiplications and cryptographic hashing entirely in the browser.

| Layer | Technologies Used | Details |
| :--- | :--- | :--- |
| **Frontend** | Vanilla JavaScript, HTML5, CSS3 | Zero-dependency core logic. |
| **Visualisations** | Canvas API | High-performance rendering for photon pulses, Bloch spheres, and Tanner graphs. |
| **Mathematics** | KaTeX | Real-time LaTeX formula rendering for physical proofs. |
| **UI/UX** | Custom CSS | Premium glassmorphism design, custom animations, and seamless Day/Night theme toggling. |
| **Deployment** | Static SPA | Hostable anywhere (GitHub Pages, Netlify, Vercel, or local filesystem). |

---

## 🚀 Getting Started

Because the application is a fully client-side Single Page Application (SPA), no build tools, package managers, or server-side runtimes are required.

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/aghasyedi/bb84-simulator.git](https://github.com/aghasyedi/bb84-simulator.git)
   ```

2.  **Navigate to the directory:**
    ```bash
    cd bb84-simulator
    ```
3.  **Launch the simulator:**
      * Simply double-click `index.html` to open it in your default web browser.
      * *Recommended:* For the best experience with JS modules and Canvas assets, serve it via a local development server (e.g., using the VS Code "Live Server" extension or Python's `python -m http.server`).

-----

## 🎓 Academic Context

This simulator was developed as an academic project within the **Master of Technology (M.Tech) in Quantum Computing** program, specialising in Quantum Communication & Sensing.

  * **Developer:** Agha Tasheer Syedi
  * **Institution:** School of Quantum Technology (SQT), DIAT-DRDO, Pune, MH, India.
  * **Supervisor:** Dr. Kanaka Raju Pandiri

-----

## 📚 Acknowledgements & References

  * Based upon the foundational 1984 paper: *Quantum cryptography: Public key distribution and coin tossing* by Charles H. Bennett and Gilles Brassard.
  * Incorporates architecture principles from the **ETSI GS QKD 002** industry standards.
  * Relies on the **No-Cloning Theorem** (Wootters & Zurek, 1982) and information-theoretic security proofs (Shor & Preskill, 2000).

-----

<div align="center">
<small>Designed & Engineered for the Post-Quantum Era.</small>
</div>
