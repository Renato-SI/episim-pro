# 🦠 EpiSim Pro — Epidemic Modeling & Forecasting Platform

> A research-grade, policy-support epidemic simulation platform for modeling infectious disease spread with scientific accuracy, visual clarity, and decision-making utility.

---

## 📋 Overview

**EpiSim Pro** is a professional, browser-based epidemic modeling platform built with React and Recharts. It implements validated compartmental epidemiological models solved with a 4th-order Runge-Kutta (RK4) ODE integrator, Monte Carlo uncertainty quantification, interactive parameter controls, and full CSV data export — all running client-side with no backend required.

Designed for researchers, healthcare professionals, educators, and government agencies who need a fast, transparent, and reproducible tool for outbreak simulation and policy planning.

---

## ✨ Features

### Epidemiological Models
| Model | Compartments | Description |
|---|---|---|
| **SEIRD+V** | S→E→I→R/D/H + V | Full model with hospitalization, deaths, vaccination |
| **SIR** | S→I→R | Classic Kermack-McKendrick (1927) |
| **SEIRS** | S→E→I→R→S | With waning immunity and reinfection cycles |

### Mathematical Engine
- **RK4 ODE solver** (dt = 0.5 days) for numerical accuracy
- **Force of infection** with intervention scaling
- **Waning immunity** and reinfection pathways
- **Monte Carlo** uncertainty analysis (n=80 stochastic runs, ±15–30% parameter perturbation)
- **5th–95th percentile** confidence bands

### Parameter Controls (15 adjustable sliders)
- Transmission rate β, incubation σ, recovery γ, case fatality μ
- Hospitalization & ICU rates
- Waning immunity & reinfection factor
- Vaccination rate & efficacy
- Intervention effectiveness (contact reduction)
- Population size & initial cases
- Simulation duration (30–730 days)

### Pre-loaded Disease Scenarios
| Scenario | R₀ | CFR | Notes |
|---|---|---|---|
| COVID-19 (Baseline) | ~2.5 | 0.5% | Alpha/original strain |
| COVID-19 (Omicron) | ~8.0 | 0.2% | With partial vaccine coverage |
| Influenza (Seasonal) | ~1.4 | 0.1% | Typical seasonal flu |
| Measles (Unvaccinated) | ~15 | 0.2% | No vaccination |
| Ebola (Outbreak) | ~2.0 | 45% | High CFR, small population |

### Dashboard Tabs
1. **Epidemic Curves** — Active infectious, daily incidence, deaths & recovered
2. **Compartments** — Full SEIRD+V population flow
3. **Rt Dynamics** — Time-varying reproduction number with threshold line
4. **Hospital Stress** — Hospitalized/ICU demand vs. surge capacity
5. **Age Groups** — Stratified impact by 6 age cohorts (IFR curves)
6. **Uncertainty** — Monte Carlo confidence bands (5/25/50/75/95th percentile)
7. **Data Table** — Paginated daily timeseries, filterable by interval
8. **Scenario Compare** — Side-by-side metrics table, overlay chart, CFR bar chart

### Export
- **CSV export** from header button (current simulation)
- **Per-scenario CSV** from the Scenario Compare tab
- Interval filtering (every 1/7/14/30 days) in the Data Table

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 16
- npm or yarn

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/episim-pro.git
cd episim-pro

# Install dependencies
npm install

# Start development server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
```

The `build/` folder contains the optimized static site — deploy to GitHub Pages, Netlify, Vercel, or any static host.

### Deploy to GitHub Pages

```bash
npm install --save-dev gh-pages

# Add to package.json scripts:
# "predeploy": "npm run build",
# "deploy": "gh-pages -d build"
# And: "homepage": "https://YOUR_USERNAME.github.io/episim-pro"

npm run deploy
```

---

## 🗂 Project Structure

```
episim-pro/
├── public/
│   └── index.html
├── src/
│   ├── App.jsx          # Full application (single-file architecture)
│   └── index.js         # React entry point
├── package.json
├── .gitignore
└── README.md
```

---

## 🔬 Mathematical Model

### SEIRD+V Differential Equations

```
dS/dt = -β·(I/N)·S·φ - ν·S·ε + ξ·R
dE/dt =  β·(I/N)·S·φ - σ·E + δ·γ·R·β·(I/N)·0.3
dI/dt =  σ·E - γ·I - μ·I
dR/dt =  γ·I - ξ·R - δ·γ·R·β·(I/N)·0.3
dD/dt =  μ·I
dH/dt =  h·σ·E - 0.1·H - κ·H
dV/dt =  ν·S·ε
```

| Symbol | Parameter |
|---|---|
| β | Transmission rate |
| σ | Incubation rate (1/incubation period) |
| γ | Recovery rate (1/infectious period) |
| μ | Case fatality rate |
| φ | Intervention factor (contact reduction) |
| ξ | Waning immunity rate |
| δ | Reinfection susceptibility factor |
| ν | Daily vaccination rate |
| ε | Vaccine efficacy |
| h | Hospitalization rate |
| κ | ICU rate |

### Key Indices

```
R₀ = β / (γ + μ)                    Basic reproduction number
Rt = R₀ · S(t) / N                  Effective reproduction number
HIT = 1 - 1/R₀                      Herd immunity threshold
AR  = 1 - S(∞) / N                  Final attack rate
```

---

## 📊 Technology Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 |
| Charts | Recharts 2.x |
| ODE Solver | Custom RK4 (pure JS) |
| Styling | CSS-in-JS (inline) |
| Fonts | Inter + JetBrains Mono (Google Fonts) |
| Build | Create React App |
| Export | Blob API (CSV) |

No external epidemiology libraries — all models are implemented from scratch for full transparency and reproducibility.

---

## ⚠️ Disclaimer

EpiSim Pro is a **research and educational tool**. It is not intended for clinical decision-making, patient care, or official public health policy without expert epidemiological review. Model outputs are sensitive to parameter assumptions and should be interpreted alongside domain expertise.

---

## 📄 License

MIT License — free to use, modify, and distribute with attribution.

---

## 🤝 Contributing

Pull requests welcome. For major changes, please open an issue first to discuss what you'd like to change.

Areas for contribution:
- Age-structured POLYMOD contact matrices
- Real-world data import (WHO, CDC APIs)
- Additional model variants (SEIQR, network models)
- Multi-patch spatial models
- AI/ML forecasting layer

---

*Built with React + Recharts · Powered by RK4 numerical integration · Monte Carlo uncertainty quantification*
