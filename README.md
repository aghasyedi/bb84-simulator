# BB84 Quantum Key Distribution Simulator

**🌐 Live Interactive Demo:** [Website](https://bb84qkd.netlify.app/)

**🌐 Presentation:** [Presentation](https://bb84qkd.netlify.app/bb84_qkd_presentation.html)

**🌐 Audit report after running app:** [Audit Report](https://bb84qkd.netlify.app/BB84%20QKD%20Protocol%20%E2%80%94%20Audit%20Report%20_%20QKD-8824-A.pdf)

An interactive, research-grade educational web application designed to simulate and visualise the BB84 QKD protocol from end to end.

## Overview

This simulator provides a comprehensive, pure client-side environment for exploring quantum cryptography. Unlike classical encryption schemes, BB84 relies on the fundamental laws of quantum mechanics to guarantee unconditionally secure communication. This application walks users through the entire pipeline, from photon polarisation to final key post-processing, making complex physical primitives accessible and interactive.

## Key Features

* **Quantum Foundations:** Interactive Bloch sphere and wavefunction collapse visualisations to understand superposition and Heisenberg's Uncertainty Principle.
* **Real-Time Transmission:** Simulate Alice and Bob's quantum channel with adjustable photon counts, propagation speeds, and wave dynamics.
* **Basis Sifting:** Visualise the public classical channel reconciliation and key sifting process.
* **Security Auditing (QBER):** Inject manual noise or use auto-sampling to calculate the Quantum Bit Error Rate to detect eavesdropper (Eve) interference.
* **Advanced Post-Processing:**
    * *Information Reconciliation:* Includes interactive Cascade protocol modelling and LDPC (Low-Density Parity-Check) Tanner graph representations.
    * *Privacy Amplification:* Compresses the key using Universal Toeplitz Hashing to nullify any partial knowledge intercepted by an adversary.
    * *Cryptographic Integration:* Theoretical foundations for applying the final secure key to the ChaCha20-Poly1305 cipher suite.

## Technical Architecture

* **Frontend:** Vanilla JavaScript, HTML5, CSS3 (Zero server dependencies).
* **Mathematics:** KaTeX integration for real-time LaTeX formula rendering.
* **Deployment:** Static SPA architecture, ready to be hosted on GitHub Pages, Vercel, or run locally from the filesystem.

## Getting Started

Since this is a fully client-side application, no build tools or local servers are strictly required to run the core simulation.

1. Clone the repository:
   ```bash
   git clone [https://github.com/aghasyedi/bb84-simulator.git](https://github.com/aghasyedi/bb84-simulator.git)
   ```
2. Navigate to the project directory:
   ```bash
   cd bb84-simulator
   ```
3. Open `index.html` in any modern web browser to initialise the simulator.

## Academic Context

This project was developed by **Agha Tasheer Syedi** as part of the M.Tech programme in Quantum Computing (specialising in Quantum Communication & Sensing) at the School of Quantum Technology, DIAT-DRDO, Pune, India. 

* **Supervisor:** Dr. Kanaka Raju Pandiri

## Acknowledgements

* Built upon the foundational 1984 paper by Charles H. Bennett and Gilles Brassard.
* Incorporates principles from the ETSI GS QKD 002 industry standards.
* Designed to bridge the gap between theoretical quantum mechanics and practical cryptographic engineering.
