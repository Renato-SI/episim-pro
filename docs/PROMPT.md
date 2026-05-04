# EpiSim Pro — Final Consolidated Prompt
# Professional Epidemic Modeling & Forecasting Platform

---

## FULL PROMPT (Original + All Upgrades Integrated)

Design, architect, and develop **EpiSim Pro** — a professional, scientifically rigorous, and visually polished epidemic modeling and forecasting platform for infectious and contagious diseases. The system must be implemented as a single-file React application using Recharts for visualization, with all computation running entirely client-side (no backend required).

---

## 1. Mathematical Engine

Implement a **4th-order Runge-Kutta (RK4) ODE solver** (time step dt = 0.5 days) to numerically integrate all compartmental models with high accuracy. The solver must produce daily-resolution output for all state variables.

### Compartmental Models (all three must be switchable from the UI)

**SEIRD+V (Primary Model)**
Full compartmental model with 7 state variables:
- S = Susceptible
- E = Exposed (incubating)
- I = Infectious
- R = Recovered
- D = Deceased (cumulative)
- H = Hospitalized (active)
- V = Vaccinated (cumulative)

Differential equations:
```
dS/dt = -β·φ·(I/N)·S - ν·ε·S + ξ·R
dE/dt =  β·φ·(I/N)·S - σ·E + δ·γ·R·β·φ·(I/N)·0.3
dI/dt =  σ·E - γ·I - μ·I
dR/dt =  γ·I - ξ·R - δ·γ·R·β·φ·(I/N)·0.3
dD/dt =  μ·I
dH/dt =  h·σ·E - 0.1·H - κ·H
dV/dt =  ν·ε·S
```

**SIR (Classic)**
Kermack-McKendrick (1927), 3 compartments: S → I → R

**SEIRS (Waning Immunity)**
4 compartments with loss of immunity: S → E → I → R → S (via waning rate ξ)

### Monte Carlo Uncertainty Analysis
Run n=80 stochastic simulations with independent Gaussian perturbations applied to β (±18%), γ (±12%), and μ (±25%). Output percentile bands: 5th, 25th, 50th (median), 75th, 95th per day.

---

## 2. Parameters & Controls

Implement **15 real-time adjustable sliders** covering:

| Parameter | Symbol | Range |
|---|---|---|
| Population | N | 10K – 100M |
| Initial infected | I₀ | 1 – 10,000 |
| Transmission rate | β | 0.01 – 2.0 |
| Incubation rate | σ = 1/T_inc | 0.05 – 1.0 |
| Recovery rate | γ = 1/T_inf | 0.01 – 1.0 |
| Case fatality rate | μ | 0 – 50% |
| Hospitalization rate | h | 0 – 50% |
| ICU rate | κ | 0 – 20% |
| Waning immunity | ξ | 0 – 5% |
| Reinfection factor | δ | 0 – 1.0 |
| Intervention strength | φ | 10–100% (transmission reduction) |
| Daily vaccination rate | ν | 0 – 2% per day |
| Vaccine efficacy | ε | 0 – 100% |
| Simulation duration | — | 30 – 730 days |

Each slider must show its current value in a formatted display (e.g. "1/10.0d" for recovery rate, "0.50%" for vaccination rate).

### Computed Epidemiological Indices (sidebar, live)
- Basic R₀ = β / (γ + μ) — color-coded: red ≥ 3, amber ≥ 1, green < 1
- Effective Rt at day 30 = R₀ · S(30) / N
- Herd immunity threshold = 1 − 1/R₀
- Final attack rate = 1 − S(∞) / N
- Peak infection day
- Serial interval = 1/σ + 1/γ

---

## 3. Pre-loaded Scenario Templates

Five scientifically parameterized disease scenarios, selectable from the top header:

| Key | Label | Color | Key Params |
|---|---|---|---|
| COVID-19 | COVID-19 (Baseline) | Sky blue | β=0.25, σ=1/5.1, γ=1/10, μ=0.005 |
| Omicron | COVID-19 (Omicron) | Violet | β=0.55, σ=1/3.5, γ=1/7, μ=0.002 |
| Influenza | Influenza (Seasonal) | Amber | β=0.18, σ=1/2, γ=1/5, μ=0.001 |
| Measles | Measles (Unvaccinated) | Rose | β=1.1, σ=1/11, γ=1/8, μ=0.002 |
| Ebola | Ebola (Outbreak) | Orange | β=0.35, σ=1/9, γ=1/14, μ=0.45 |

Loading a scenario must reset all sliders to that scenario's epidemiological values.

---

## 4. Visualization Dashboard — 8 Tabs

### Tab 1 — Epidemic Curves
- Full-width area chart: Active Infectious over time with peak day reference line
- Grid row (2 columns):
  - Bar chart: New daily cases (incidence curve, sampled every 2 days)
  - Composed chart: Cumulative Recovered (area) + Deaths (line)

### Tab 2 — Compartments
- Single large area chart (height 400px) showing all compartments simultaneously (S, E, I, R, H, D, V) with distinct gradient fills and colors

### Tab 3 — Rt Dynamics
- Composed area chart: Rt(t) over time with Rt=1 reference line (dashed amber)
- 3-column metric cards: R₀, Rt at day 30, Herd Immunity Threshold (each with color-coded value and description)

### Tab 4 — Hospital Stress
- Composed chart: Hospitalized (area), ICU (area), Capacity line (dashed amber, = 0.2% of N)
- 4 KPI cards: Peak Hospitalized, Peak ICU, Capacity Ratio (%), Surge Needed

### Tab 5 — Age Groups
- Grouped bar chart: Infected and Deaths by 6 age cohorts (0–17, 18–29, 30–44, 45–59, 60–74, 75+)
- Methodology note explaining IFR multipliers and POLYMOD reference

### Tab 6 — Uncertainty (Monte Carlo)
- Landing state: centered call-to-action with description and "Run Monte Carlo" button
- After run: Composed chart with p95/p75 gradient fills and p50 median line + CI dashed lines
- 4 summary metric cards: Median Peak, Worst Case (95th), Best Case (5th), Uncertainty Ratio

### Tab 7 — Data Table
- Paginated table (18 rows/page) of full daily simulation output
- Columns: Day, Susceptible, Exposed (if model ≠ SIR), Infectious, Recovered, Hospitalized, Deaths, Vaccinated (if SEIRDV), New Cases/day, Rt
- Row interval filter buttons: Every 1d / 7d / 14d / 30d
- Rt column color-coded: red ≥ 2, amber ≥ 1, green < 1
- Pagination controls with row count display
- "Export Full CSV" button (top-right of table)

### Tab 8 — Scenario Compare
- **Overlay line chart**: All 5 scenarios' infectious trajectories on one chart, active scenario shown with solid thicker line, others dashed
- **Side-by-side metrics table**: 10 epidemiological metrics × 5 scenarios; highest value per row marked with ▲ and colored; active scenario column highlighted
- **Peak infectious bar chart** + **CFR bar chart** (2-column grid)
- Per-scenario CSV export buttons

---

## 5. KPI Strip (always visible, above tabs)

5 cards showing live metrics from current simulation:
1. Peak Infectious — value + "Day X" sub + HIGH/LOW badge if > 10% of N
2. Total Deaths — value + CFR sub
3. Peak Hospitalized — value + % of population
4. Vaccinated — value + % coverage
5. Basic R₀ — value + "Epidemic active / Declining" status

---

## 6. CSV Export

- Header button: exports full daily timeseries for active simulation as `episim-{scenario}.csv`
- Data Table button: exports same with label "Export Full CSV"
- Scenario Compare: one export button per scenario, labeled with scenario name
- CSV format: all numeric columns to 4 decimal places, headers match column names

---

## 7. Design System

**Color palette (dark scientific theme):**
```
bg:      #07101f   (deep navy background)
surface: #0c1a2e   (sidebar, header, footer)
card:    #0f2040   (chart cards)
border:  #16304f
faint:   #0e2038   (grid lines)
accent:  #38bdf8   (sky blue — primary)
orange:  #fb923c
violet:  #a78bfa
emerald: #34d399
rose:    #f87171
amber:   #fbbf24
sky:     #7dd3fc
pink:    #e879f9
text:    #e0eaf6
muted:   #5a7a99
mono:    JetBrains Mono / Fira Code
sans:    Inter / IBM Plex Sans
```

**Layout:**
- Fixed topbar (52px height): logo, scenario pills, model selector, export button
- Left sidebar (268px): scrollable sliders + index panel + Monte Carlo button
- Main area: KPI strip → tab bar → scrollable tab content → footer
- All sidebar sliders use a 3px track with colored fill and minimal thumb

**Typography:**
- All numeric KPIs and table values: JetBrains Mono, bold
- Labels: Inter, uppercase, letter-spaced, muted color
- Section headers: 9px, 0.17em letter spacing, colored accent bar left

**Component patterns:**
- Cards: `background: card, border: 1px solid border, border-radius: 10px, padding: 17px 19px`
- KPI cards: top border accent, large mono number, small muted label
- Tabs: no background, bottom border 2px solid accent when active
- Scenario pills in header: colored border + background tint when active
- Sliders: gradient fill from color@50% → color@100%
- Tooltips: semi-transparent dark bg, mono values, muted day label

---

## 8. Architecture Requirements

- **Single-file React component** (`App.jsx`) — no external CSS files
- All state managed with `useState`, all derived values with `useMemo`, callbacks with `useCallback`
- No backend, no API calls, no localStorage
- Must work in Create React App with only `react`, `react-dom`, `recharts` as dependencies
- Google Fonts loaded via `@import` in injected `<style>` tag
- All computation (ODE solver, Monte Carlo) runs synchronously in JS
- Monte Carlo triggered on button click via `setTimeout(..., 20)` to allow UI to update first
- Export via `Blob` + programmatic anchor click

---

## 9. Technical Standards

- RK4 solver accurate to at least daily resolution
- All compartment values clamped to ≥ 0
- newCases computed as max(0, S[d-1] − S[d]) per day
- Rt(t) = R₀ · S(t) / N at each timestep
- Monte Carlo: each run independently perturbs β, γ, μ with uniform random multipliers
- Percentile calculation: sort ascending, index by floor(n × quantile)
- Format helpers: fmtN (K/M/B suffix), fmtPct (2 decimal %), fmtR (3 decimal)
- All charts: CartesianGrid with faint stroke, muted axis tick color, custom Tooltip component

---

## 10. Deliverable

A single `App.jsx` file that, when placed in a standard Create React App project with `recharts` installed, produces a fully functional, professionally designed, scientifically accurate epidemic modeling platform — ready for GitHub, Netlify, or Vercel deployment — with zero additional configuration required.
