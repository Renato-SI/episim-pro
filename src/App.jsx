import { useState, useCallback, useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";

/* ═══════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════ */
const T = {
  bg:      "#07101f",
  surface: "#0c1a2e",
  card:    "#0f2040",
  border:  "#16304f",
  faint:   "#0e2038",
  accent:  "#38bdf8",
  orange:  "#fb923c",
  violet:  "#a78bfa",
  emerald: "#34d399",
  rose:    "#f87171",
  amber:   "#fbbf24",
  sky:     "#7dd3fc",
  pink:    "#e879f9",
  text:    "#e0eaf6",
  muted:   "#5a7a99",
  mono:    "'JetBrains Mono','Fira Code',monospace",
  sans:    "'Inter','IBM Plex Sans',system-ui,sans-serif",
};

/* ═══════════════════════════════════════════════════
   RK4 SOLVER
═══════════════════════════════════════════════════ */
function rk4(f, y0, days, dt = 0.5) {
  const steps = Math.ceil(days / dt);
  let y = [...y0], t = 0;
  const out = [{ t: 0, y: [...y0] }];
  for (let i = 0; i < steps; i++) {
    const k1 = f(t, y);
    const k2 = f(t + dt/2, y.map((v,j) => v + dt/2*k1[j]));
    const k3 = f(t + dt/2, y.map((v,j) => v + dt/2*k2[j]));
    const k4 = f(t + dt,   y.map((v,j) => v + dt*k3[j]));
    y = y.map((v,j) => v + dt/6*(k1[j]+2*k2[j]+2*k3[j]+k4[j]));
    t += dt;
    if (Math.abs(t - Math.round(t)) < dt * 0.6) out.push({ t: Math.round(t), y: [...y] });
  }
  return out;
}

/* ═══════════════════════════════════════════════════
   MODEL EQUATIONS
═══════════════════════════════════════════════════ */
const seirdv = p => (t, [S,E,I,R,D,H,V]) => {
  const { N, beta, sigma, gamma, mu, hosp_rate, icu_rate, vax_rate, vax_eff, reinfection, ifactor, waning } = p;
  const b = beta * ifactor, foi = b * I / N, wan = waning * R, vax = vax_rate * S * vax_eff;
  return [
    -foi*S - vax + wan,
    foi*S - sigma*E + reinfection*gamma*R*foi*0.3,
    sigma*E - gamma*I - mu*I,
    gamma*I - wan - reinfection*gamma*R*foi*0.3,
    mu*I,
    hosp_rate*sigma*E - 0.1*H - icu_rate*H,
    vax,
  ];
};
const sir = p => (t, [S,I,R]) => {
  const b = p.beta * p.ifactor;
  return [-b*S*I/p.N, b*S*I/p.N - p.gamma*I, p.gamma*I];
};
const seirs = p => (t, [S,E,I,R]) => {
  const foi = p.beta * p.ifactor * I / p.N;
  return [-foi*S + p.xi*R, foi*S - p.sigma*E, p.sigma*E - p.gamma*I, p.gamma*I - p.xi*R];
};

function simulate(model, params, days = 365) {
  const { N, I0 = 1, E0 = 0 } = params;
  const [f, y0] = model === "SIR"   ? [sir(params),   [N-I0, I0, 0]]
                : model === "SEIRS" ? [seirs(params), [N-I0-E0, E0, I0, 0]]
                :                    [seirdv(params), [N-I0-E0, E0, I0, 0, 0, 0, 0]];
  const raw = rk4(f, y0, days);
  const R0  = params.beta / ((params.gamma||0.1) + (params.mu||0));
  const daily = [];
  for (let d = 0; d <= days; d++) {
    const entry = raw.find(r => r.t === d) || raw[raw.length - 1];
    const y = entry.y.map(v => Math.max(0, v));
    const prev = daily[d-1];
    const newCases = prev ? Math.max(0, prev.S - y[0]) : 0;
    if (model === "SIR")
      daily.push({ day:d, S:y[0], I:y[1], R:y[2], newCases, Rt:+(R0*y[0]/N).toFixed(3), N });
    else if (model === "SEIRS")
      daily.push({ day:d, S:y[0], E:y[1], I:y[2], R:y[3], newCases, Rt:+(R0*y[0]/N).toFixed(3), N });
    else
      daily.push({ day:d, S:y[0], E:y[1], I:y[2], R:y[3], D:y[4], H:y[5], V:y[6], newCases, Rt:+(R0*y[0]/N).toFixed(3), N });
  }
  return daily;
}

function monteCarlo(params, n = 80, days = 180) {
  const runs = Array.from({ length: n }, () => {
    const p = { ...params,
      beta:  params.beta  * (0.82 + Math.random() * 0.36),
      gamma: params.gamma * (0.88 + Math.random() * 0.24),
      mu:    (params.mu || 0) * (0.75 + Math.random() * 0.5),
    };
    return simulate("SEIRDV", p, days).map(d => d.I);
  });
  return Array.from({ length: days + 1 }, (_, d) => {
    const vals = runs.map(r => r[d] || 0).sort((a, b) => a - b);
    const pct = q => vals[Math.floor(n * q)] ?? 0;
    return { day:d, p5:pct(0.05), p25:pct(0.25), p50:pct(0.5), p75:pct(0.75), p95:pct(0.95) };
  });
}

/* ═══════════════════════════════════════════════════
   SCENARIOS
═══════════════════════════════════════════════════ */
const SCENARIOS = {
  "COVID-19":  { label:"COVID-19 (Baseline)",      color:T.sky,     N:1e6, I0:10,  E0:20,  beta:0.25, sigma:1/5.1, gamma:1/10, mu:0.005, hosp_rate:0.05, icu_rate:0.01,  vax_rate:0,     vax_eff:0.9,  reinfection:0.1,  ifactor:1,   waning:0.003, xi:0.005  },
  "Omicron":   { label:"COVID-19 (Omicron)",        color:T.violet,  N:1e6, I0:50,  E0:100, beta:0.55, sigma:1/3.5, gamma:1/7,  mu:0.002, hosp_rate:0.02, icu_rate:0.004, vax_rate:0.002, vax_eff:0.6,  reinfection:0.3,  ifactor:0.9, waning:0.01,  xi:0.015 },
  "Influenza": { label:"Influenza (Seasonal)",      color:T.amber,   N:1e6, I0:5,   E0:10,  beta:0.18, sigma:1/2,   gamma:1/5,  mu:0.001, hosp_rate:0.02, icu_rate:0.002, vax_rate:0.001, vax_eff:0.5,  reinfection:0.05, ifactor:1,   waning:0.005, xi:0.01  },
  "Measles":   { label:"Measles (Unvaccinated)",    color:T.rose,    N:1e6, I0:1,   E0:5,   beta:1.1,  sigma:1/11,  gamma:1/8,  mu:0.002, hosp_rate:0.15, icu_rate:0.05,  vax_rate:0,     vax_eff:0.97, reinfection:0.01, ifactor:1,   waning:0,     xi:0.0001},
  "Ebola":     { label:"Ebola (Outbreak)",          color:T.orange,  N:1e5, I0:3,   E0:5,   beta:0.35, sigma:1/9,   gamma:1/14, mu:0.45,  hosp_rate:0.8,  icu_rate:0.6,   vax_rate:0,     vax_eff:0.8,  reinfection:0.01, ifactor:1,   waning:0,     xi:0.0001},
};

/* ═══════════════════════════════════════════════════
   FORMAT HELPERS
═══════════════════════════════════════════════════ */
const fmtN   = (n, d=0) => { if (!isFinite(n)||n==null) return "—"; if (n>=1e9) return (n/1e9).toFixed(2)+"B"; if (n>=1e6) return (n/1e6).toFixed(2)+"M"; if (n>=1e3) return (n/1e3).toFixed(1)+"K"; return n.toFixed(d); };
const fmtPct = n => !isFinite(n) ? "—" : (n*100).toFixed(2)+"%";
const fmtR   = n => !isFinite(n) ? "—" : n.toFixed(3);

function calcMetrics(sim, params) {
  if (!sim?.length) return {};
  const peak = sim.reduce((a,b) => (b.I??0)>(a.I??0)?b:a, sim[0]);
  const last  = sim[sim.length-1];
  const R0    = params.beta / ((params.gamma||0.1) + (params.mu||0));
  const Rt30  = R0 * (sim[Math.min(30,sim.length-1)]?.S??params.N) / params.N;
  const hit   = Math.max(0, 1 - 1/R0);
  const AR    = 1 - (last.S??0)/params.N;
  return { peak, last, R0, Rt30, hit, AR };
}

function exportCSV(data, filename) {
  const keys = Object.keys(data[0]);
  const rows = [keys.join(","), ...data.map(r => keys.map(k => typeof r[k]==="number" ? r[k].toFixed(4) : r[k]).join(","))];
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([rows.join("\n")], { type:"text/csv" })),
    download: filename,
  });
  a.click();
}

/* ═══════════════════════════════════════════════════
   ATOMS
═══════════════════════════════════════════════════ */
function Pill({ color, children }) {
  return <span style={{ display:"inline-block", padding:"2px 7px", borderRadius:4, fontSize:9, fontWeight:700, letterSpacing:"0.07em", background:color+"22", color, border:`1px solid ${color}44` }}>{children}</span>;
}

function SectionHead({ color=T.accent, children }) {
  return (
    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.17em", textTransform:"uppercase", color, marginBottom:13, display:"flex", alignItems:"center", gap:7 }}>
      <div style={{ width:2, height:11, borderRadius:2, background:color }} />
      {children}
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, color=T.accent, display }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:11, color:T.muted }}>{label}</span>
        <span style={{ fontSize:11, color, fontFamily:T.mono, fontWeight:700 }}>{display??value}</span>
      </div>
      <div style={{ position:"relative", height:3, background:T.faint, borderRadius:2 }}>
        <div style={{ position:"absolute", left:0, top:0, height:"100%", borderRadius:2, width:`${((value-min)/(max-min))*100}%`, background:`linear-gradient(90deg,${color}77,${color})` }} />
        <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)}
          style={{ position:"absolute", width:"100%", top:-8, left:0, WebkitAppearance:"none", background:"transparent", cursor:"pointer" }} />
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background:"none", border:"none", cursor:"pointer",
      padding:"11px 15px", fontSize:12, fontWeight:600, letterSpacing:"0.03em",
      fontFamily:T.sans, color:active?T.text:T.muted,
      borderBottom:`2px solid ${active?T.accent:"transparent"}`,
      transition:"all 0.15s", whiteSpace:"nowrap",
    }}>{children}</button>
  );
}

function Card({ title, sub, action, children, style={} }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"17px 19px", ...style }}>
      {(title||action) && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:15 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{title}</div>
            {sub && <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{sub}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

const Tip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:"#0a1e38f2", border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 14px", fontSize:12 }}>
      <div style={{ color:T.muted, marginBottom:6, fontFamily:T.mono, fontSize:11 }}>Day {label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ display:"flex", justifyContent:"space-between", gap:16, marginBottom:2 }}>
          <span style={{ color:T.muted }}>{p.name}</span>
          <span style={{ fontFamily:T.mono, fontWeight:700, color:p.color }}>{fmtN(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   DATA TABLE
═══════════════════════════════════════════════════ */
function DataTable({ data, model }) {
  const [page,   setPage]   = useState(0);
  const [stride, setStride] = useState(7);
  const rows = data.filter(d => d.day % stride === 0);
  const pageSize = 18, totalPages = Math.ceil(rows.length / pageSize);
  const visible = rows.slice(page * pageSize, (page+1) * pageSize);

  const cols = [
    { key:"day",      label:"Day",        fmt:v=>v },
    { key:"S",        label:"Susceptible",fmt:fmtN },
    ...(model!=="SIR" ? [{ key:"E", label:"Exposed", fmt:fmtN }] : []),
    { key:"I",        label:"Infectious", fmt:fmtN },
    { key:"R",        label:"Recovered",  fmt:fmtN },
    ...(model==="SEIRDV" ? [
      { key:"H", label:"Hospitalized", fmt:fmtN },
      { key:"D", label:"Deaths",       fmt:fmtN },
      { key:"V", label:"Vaccinated",   fmt:fmtN },
    ] : []),
    { key:"newCases", label:"New Cases/d",fmt:fmtN },
    { key:"Rt",       label:"Rt",         fmt:fmtR },
  ];

  const th = { padding:"9px 12px", fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:T.muted, borderBottom:`1px solid ${T.border}`, textAlign:"right", whiteSpace:"nowrap" };
  const td = { padding:"7px 12px", fontSize:12, fontFamily:T.mono, borderBottom:`1px solid ${T.faint}`, textAlign:"right" };

  return (
    <>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        <span style={{ fontSize:11, color:T.muted }}>Interval:</span>
        {[1,7,14,30].map(s => (
          <button key={s} onClick={() => { setStride(s); setPage(0); }} style={{
            background:stride===s?T.accent+"22":"none", border:`1px solid ${stride===s?T.accent:T.border}`,
            color:stride===s?T.accent:T.muted, borderRadius:5, padding:"3px 10px",
            fontSize:11, cursor:"pointer", fontFamily:T.sans,
          }}>Every {s}d</button>
        ))}
        <button onClick={() => exportCSV(data,"episim-simulation.csv")} style={{
          marginLeft:"auto", background:`${T.emerald}18`, border:`1px solid ${T.emerald}55`,
          color:T.emerald, borderRadius:6, padding:"5px 14px", fontSize:11,
          cursor:"pointer", fontWeight:700, fontFamily:T.sans,
        }}>↓ Export Full CSV</button>
      </div>

      <div style={{ overflowX:"auto", borderRadius:8, border:`1px solid ${T.border}` }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead style={{ background:T.surface }}>
            <tr>{cols.map(c => <th key={c.key} style={th}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {visible.map((row, i) => {
              const rtColor = row.Rt>=2?T.rose:row.Rt>=1?T.amber:T.emerald;
              return (
                <tr key={row.day} style={{ background:i%2===0?"transparent":T.surface+"55" }}>
                  {cols.map(c => (
                    <td key={c.key} style={{ ...td,
                      color: c.key==="Rt"?rtColor : c.key==="D"?T.rose : c.key==="day"?T.accent : T.text,
                      fontWeight: c.key==="day"?700:400,
                    }}>
                      {c.fmt(row[c.key]??0)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:12 }}>
        <span style={{ fontSize:11, color:T.muted }}>{rows.length} rows · page {page+1} / {totalPages}</span>
        <div style={{ display:"flex", gap:6 }}>
          {["← Prev","Next →"].map((lbl,i) => (
            <button key={lbl} onClick={() => setPage(p => Math.max(0,Math.min(totalPages-1,p+(i?1:-1))))}
              disabled={i?page>=totalPages-1:page===0}
              style={{ background:T.surface, border:`1px solid ${T.border}`, color:T.muted,
                borderRadius:5, padding:"4px 12px", cursor:"pointer", fontSize:12, fontFamily:T.sans,
                opacity:(i?page>=totalPages-1:page===0)?0.3:1 }}>{lbl}</button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   SCENARIO COMPARISON
═══════════════════════════════════════════════════ */
function ScenarioComparison({ activeKey, simDays }) {
  const keys = Object.keys(SCENARIOS);

  const allSims = useMemo(() =>
    keys.reduce((acc,k) => { acc[k] = simulate("SEIRDV", SCENARIOS[k], simDays); return acc; }, {}),
  [simDays]);

  const allM = useMemo(() =>
    keys.reduce((acc,k) => { acc[k] = calcMetrics(allSims[k], SCENARIOS[k]); return acc; }, {}),
  [allSims]);

  const overlayData = useMemo(() =>
    Array.from({ length: simDays+1 }, (_,d) => {
      const row = { day:d };
      keys.forEach(k => { row[k] = allSims[k][d]?.I ?? 0; });
      return row;
    }),
  [allSims, simDays]);

  const metricsRows = [
    { label:"Basic R₀",             fmt:k=>fmtR(allM[k]?.R0),                    hi:k=>allM[k]?.R0 },
    { label:"Peak Infectious",       fmt:k=>fmtN(allM[k]?.peak?.I),               hi:k=>allM[k]?.peak?.I },
    { label:"Peak Day",              fmt:k=>`Day ${allM[k]?.peak?.day??"—"}`,      hi:k=>allM[k]?.peak?.day },
    { label:"Total Deaths",          fmt:k=>fmtN(allM[k]?.last?.D),               hi:k=>allM[k]?.last?.D },
    { label:"Case Fatality Rate",    fmt:k=>fmtPct(SCENARIOS[k].mu),              hi:k=>SCENARIOS[k].mu },
    { label:"Attack Rate",           fmt:k=>fmtPct(allM[k]?.AR),                  hi:k=>allM[k]?.AR },
    { label:"Hospitalization Rate",  fmt:k=>fmtPct(SCENARIOS[k].hosp_rate),       hi:k=>SCENARIOS[k].hosp_rate },
    { label:"Herd Immunity Thr.",    fmt:k=>fmtPct(allM[k]?.hit),                 hi:k=>allM[k]?.hit },
    { label:"Vaccine Efficacy",      fmt:k=>fmtPct(SCENARIOS[k].vax_eff),         hi:k=>SCENARIOS[k].vax_eff },
    { label:"Waning Immunity",       fmt:k=>SCENARIOS[k].waning.toFixed(4),       hi:k=>SCENARIOS[k].waning },
  ];

  const thC = { padding:"9px 14px", fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:T.muted, borderBottom:`1px solid ${T.border}`, textAlign:"center" };
  const tdC = { padding:"8px 14px", fontSize:12, fontFamily:T.mono, borderBottom:`1px solid ${T.faint}`, textAlign:"center" };

  const peakBarData = keys.map(k => ({ name:SCENARIOS[k].label.split(" ")[0], value:allM[k]?.peak?.I??0, fill:SCENARIOS[k].color }));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* Overlay line chart */}
      <Card title="Infectious Trajectories — All Scenarios" sub="Overlay comparison of active infectious individuals over time">
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={overlayData} margin={{top:8,right:16,left:0,bottom:0}}>
            <CartesianGrid stroke={T.faint} strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke={T.muted} tick={{fill:T.muted,fontSize:11}} />
            <YAxis stroke={T.muted} tick={{fill:T.muted,fontSize:11}} tickFormatter={fmtN} />
            <Tooltip content={<Tip />} />
            <Legend wrapperStyle={{fontSize:11}} />
            {keys.map(k => (
              <Line key={k} type="monotone" dataKey={k} name={SCENARIOS[k].label}
                stroke={SCENARIOS[k].color}
                strokeWidth={k===activeKey?2.8:1.5}
                dot={false}
                strokeDasharray={k===activeKey?"none":"5 4"} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Side-by-side metrics table */}
      <Card title="Epidemiological Metrics — Side-by-Side" sub="All key indicators compared across scenarios — highest value marked ▲">
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead style={{ background:T.surface }}>
              <tr>
                <th style={{ ...thC, textAlign:"left", minWidth:180 }}>Metric</th>
                {keys.map(k => (
                  <th key={k} style={{ ...thC, color:SCENARIOS[k].color, background:k===activeKey?SCENARIOS[k].color+"0e":"transparent" }}>
                    {SCENARIOS[k].label.split(" ")[0]}
                    {k===activeKey && <div style={{ fontSize:9, color:T.muted, fontWeight:400, marginTop:2 }}>active</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricsRows.map((row, ri) => {
                const vals = keys.map(k => row.hi(k)).filter(v => isFinite(v));
                const maxVal = Math.max(...vals);
                return (
                  <tr key={ri} style={{ background:ri%2===0?"transparent":T.surface+"33" }}>
                    <td style={{ ...tdC, textAlign:"left", color:T.muted, fontSize:11 }}>{row.label}</td>
                    {keys.map(k => {
                      const v = row.hi(k);
                      const isMax = isFinite(v) && v===maxVal;
                      return (
                        <td key={k} style={{ ...tdC, color:isMax?SCENARIOS[k].color:T.text, fontWeight:isMax?700:400, background:k===activeKey?SCENARIOS[k].color+"0a":"transparent" }}>
                          {row.fmt(k)}{isMax && <span style={{ fontSize:9, marginLeft:4, opacity:0.7 }}>▲</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Peak bar chart */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <Card title="Peak Infectious — Ranked" sub="Maximum simultaneous infectious count">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={peakBarData} margin={{top:8,right:12,left:0,bottom:0}}>
              <CartesianGrid stroke={T.faint} strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke={T.muted} tick={{fill:T.muted,fontSize:11}} />
              <YAxis stroke={T.muted} tick={{fill:T.muted,fontSize:11}} tickFormatter={fmtN} />
              <Tooltip content={<Tip />} />
              {peakBarData.map((d,i) => null)}
              <Bar dataKey="value" name="Peak I" radius={[4,4,0,0]}>
                {peakBarData.map((d,i) => (
                  <rect key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Case Fatality Rate" sub="Mortality risk comparison">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={keys.map(k => ({ name:SCENARIOS[k].label.split(" ")[0], cfr:SCENARIOS[k].mu*100, fill:SCENARIOS[k].color }))}
              margin={{top:8,right:12,left:0,bottom:0}}>
              <CartesianGrid stroke={T.faint} strokeDasharray="3 3" />
              <XAxis dataKey="name" stroke={T.muted} tick={{fill:T.muted,fontSize:11}} />
              <YAxis stroke={T.muted} tick={{fill:T.muted,fontSize:11}} tickFormatter={v=>v+"%"} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="cfr" name="CFR %" fill={T.rose} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Export row */}
      <div style={{ display:"flex", gap:8, justifyContent:"flex-end", flexWrap:"wrap" }}>
        {keys.map(k => (
          <button key={k} onClick={() => exportCSV(allSims[k],`episim-${k.toLowerCase()}.csv`)} style={{
            background:SCENARIOS[k].color+"18", border:`1px solid ${SCENARIOS[k].color}44`,
            color:SCENARIOS[k].color, borderRadius:6, padding:"6px 14px",
            fontSize:11, cursor:"pointer", fontWeight:600, fontFamily:T.sans,
          }}>↓ {SCENARIOS[k].label.split(" ")[0]}</button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════ */
export default function App() {
  const [scKey,    setScKey]    = useState("COVID-19");
  const [model,    setModel]    = useState("SEIRDV");
  const [tab,      setTab]      = useState("curves");
  const [simDays,  setSimDays]  = useState(365);
  const [mcData,   setMcData]   = useState(null);
  const [mcBusy,   setMcBusy]   = useState(false);
  const [params,   setParams]   = useState(SCENARIOS["COVID-19"]);

  const set = k => v => setParams(p => ({ ...p, [k]: v }));

  const loadScenario = k => { setScKey(k); setParams(SCENARIOS[k]); setMcData(null); };

  const simData = useMemo(() => { try { return simulate(model, params, simDays); } catch { return []; } }, [model, params, simDays]);
  const m       = useMemo(() => calcMetrics(simData, params), [simData, params]);
  const R0      = params.beta / ((params.gamma||0.1) + (params.mu||0));

  const rtData = useMemo(() =>
    simData.filter((_,i)=>i%3===0).map(d => ({ day:d.day, Rt:+(R0*(d.S??0)/params.N).toFixed(3) })),
  [simData, R0, params.N]);

  const hospData = useMemo(() => {
    const cap = params.N * 0.002;
    return simData.filter((_,i)=>i%2===0).map(d => ({
      day: d.day, Hospitalized:Math.round(d.H??0), ICU:Math.round((d.H??0)*0.2), Capacity:Math.round(cap),
    }));
  }, [simData, params.N]);

  const ageData = useMemo(() => {
    const ages=["0–17","18–29","30–44","45–59","60–74","75+"], sw=[0.5,0.9,0.9,0.85,0.8,0.75], mw=[0.01,0.05,0.1,0.3,1,3.5];
    const ss=sw.reduce((a,b)=>a+b), ms=mw.reduce((a,b)=>a+b);
    return ages.map((a,i) => ({ age:a, Infected:Math.round((m.last?.I??0)*sw[i]/ss), Deaths:Math.round((m.last?.D??0)*mw[i]/ms) }));
  }, [m]);

  const runMC = useCallback(() => {
    setMcBusy(true);
    setTimeout(() => { setMcData(monteCarlo(params,80,Math.min(simDays,180))); setMcBusy(false); }, 20);
  }, [params, simDays]);

  const TABS = [
    ["curves","Epidemic Curves"],["compartments","Compartments"],["rt","Rt Dynamics"],
    ["hospital","Hospital Stress"],["age","Age Groups"],["montecarlo","Uncertainty"],
    ["table","Data Table"],["compare","Scenario Compare"],
  ];
  const CH = 240;

  const gradDef = (id, color) => (
    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.35}/>
      <stop offset="100%" stopColor={color} stopOpacity={0}/>
    </linearGradient>
  );

  return (
    <div style={{ fontFamily:T.sans, background:T.bg, color:T.text, minHeight:"100vh", fontSize:13 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input[type=range]{-webkit-appearance:none;height:18px;background:transparent;width:100%}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:${T.accent};cursor:pointer;box-shadow:0 0 0 3px ${T.accent}2a}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:${T.bg}}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
        select{background:${T.card};color:${T.text};border:1px solid ${T.border};border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;font-family:${T.sans};outline:none}
        select:focus{border-color:${T.accent}}
        button:focus{outline:none}
      `}</style>

      {/* ── TOPBAR ── */}
      <header style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 22px", height:52, gap:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:11 }}>
          <div style={{ width:30, height:30, borderRadius:7, background:`linear-gradient(135deg,${T.accent}22,${T.violet}22)`, border:`1px solid ${T.accent}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>🦠</div>
          <div>
            <div style={{ fontWeight:800, fontSize:14, color:"#fff", letterSpacing:"-0.01em" }}>EpiSim Pro</div>
            <div style={{ fontSize:9, color:T.muted, letterSpacing:"0.12em", textTransform:"uppercase" }}>Epidemic Modeling Platform</div>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          {Object.keys(SCENARIOS).map(k => (
            <button key={k} onClick={() => loadScenario(k)} style={{
              background:scKey===k?SCENARIOS[k].color+"18":"none",
              border:`1px solid ${scKey===k?SCENARIOS[k].color+"66":T.border}`,
              color:scKey===k?SCENARIOS[k].color:T.muted,
              borderRadius:6, padding:"4px 11px", fontSize:11, cursor:"pointer",
              fontFamily:T.sans, fontWeight:600, transition:"all 0.12s",
            }}>{SCENARIOS[k].label.split(" ")[0]}</button>
          ))}
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:11, color:T.muted }}>Model</span>
          <select value={model} onChange={e => setModel(e.target.value)}>
            <option value="SEIRDV">SEIRD+V</option>
            <option value="SIR">SIR</option>
            <option value="SEIRS">SEIRS</option>
          </select>
          <button onClick={() => exportCSV(simData,`episim-${scKey.toLowerCase()}.csv`)} style={{
            background:`${T.emerald}18`, border:`1px solid ${T.emerald}55`, color:T.emerald,
            borderRadius:6, padding:"5px 13px", fontSize:11, cursor:"pointer", fontWeight:700, fontFamily:T.sans,
          }}>↓ Export CSV</button>
        </div>
      </header>

      <div style={{ display:"grid", gridTemplateColumns:"268px 1fr", height:"calc(100vh - 52px)", overflow:"hidden" }}>

        {/* ── SIDEBAR ── */}
        <aside style={{ background:T.surface, borderRight:`1px solid ${T.border}`, overflowY:"auto", padding:"16px 15px", display:"flex", flexDirection:"column", gap:20 }}>

          <section>
            <SectionHead color={T.accent}>Disease Parameters</SectionHead>
            <SliderRow label="Population (N)"      value={params.N}           min={10000} max={1e8}  step={10000} onChange={set("N")}           color={T.text}    display={fmtN(params.N)} />
            <SliderRow label="Initial Infected"    value={params.I0??1}       min={1}     max={10000} step={1}    onChange={set("I0")}           color={T.amber}   display={params.I0??1} />
            <SliderRow label="Transmission β"      value={params.beta}        min={0.01}  max={2}    step={0.01}  onChange={set("beta")}          color={T.orange}  display={params.beta.toFixed(2)} />
            <SliderRow label="Incubation σ"        value={params.sigma??0.2}  min={0.05}  max={1}    step={0.01}  onChange={set("sigma")}         color={T.accent}  display={`1/${(1/(params.sigma??0.2)).toFixed(1)}d`} />
            <SliderRow label="Recovery γ"          value={params.gamma}       min={0.01}  max={1}    step={0.01}  onChange={set("gamma")}         color={T.emerald} display={`1/${(1/params.gamma).toFixed(1)}d`} />
            <SliderRow label="Case Fatality μ"     value={params.mu}          min={0}     max={0.5}  step={0.001} onChange={set("mu")}            color={T.rose}    display={fmtPct(params.mu)} />
            <SliderRow label="Hospitalization"     value={params.hosp_rate??0.05} min={0} max={0.5}  step={0.005} onChange={set("hosp_rate")}     color={T.pink}    display={fmtPct(params.hosp_rate??0.05)} />
            <SliderRow label="ICU Rate"            value={params.icu_rate??0.01}  min={0} max={0.2}  step={0.001} onChange={set("icu_rate")}      color={T.violet}  display={fmtPct(params.icu_rate??0.01)} />
            <SliderRow label="Waning Immunity"     value={params.waning??0.003}   min={0} max={0.05} step={0.001} onChange={set("waning")}        color={T.sky}     display={(params.waning??0.003).toFixed(4)} />
            <SliderRow label="Reinfection Factor"  value={params.reinfection??0.1} min={0} max={1}  step={0.01}  onChange={set("reinfection")}   color={T.amber}   display={(params.reinfection??0.1).toFixed(2)} />
          </section>

          <section>
            <SectionHead color={T.violet}>Interventions</SectionHead>
            <SliderRow label="Intervention Strength"  value={params.ifactor??1}    min={0.1} max={1}    step={0.01}   onChange={set("ifactor")}   color={T.violet}  display={`${fmtPct(1-(params.ifactor??1))} reduction`} />
            <SliderRow label="Daily Vaccination Rate" value={params.vax_rate??0}   min={0}   max={0.02} step={0.0001} onChange={set("vax_rate")}  color={T.emerald} display={fmtPct(params.vax_rate??0)} />
            <SliderRow label="Vaccine Efficacy"       value={params.vax_eff??0.9}  min={0}   max={1}    step={0.01}   onChange={set("vax_eff")}   color={T.emerald} display={fmtPct(params.vax_eff??0.9)} />
          </section>

          <section>
            <SectionHead color={T.amber}>Simulation</SectionHead>
            <SliderRow label="Duration (days)" value={simDays} min={30} max={730} step={10} onChange={setSimDays} color={T.amber} display={`${simDays} days`} />
          </section>

          {/* Indices */}
          <section style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:"13px 14px" }}>
            <SectionHead color={T.muted}>Epidemiological Indices</SectionHead>
            {[
              ["Basic R₀",             fmtR(R0),            R0>=3?T.rose:R0>=1?T.amber:T.emerald],
              ["Effective Rt (d30)",   fmtR(m.Rt30),        (m.Rt30??0)>=1?T.rose:T.emerald],
              ["Herd Imm. Threshold",  fmtPct(m.hit),       T.sky],
              ["Attack Rate (final)",  fmtPct(m.AR),        T.orange],
              ["Peak Infection Day",   `Day ${m.peak?.day??"—"}`, T.accent],
              ["Serial Interval",      `${(1/(params.sigma??0.2)).toFixed(1)}+${(1/params.gamma).toFixed(1)}d`, T.muted],
            ].map(([l,v,c]) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
                <span style={{ fontSize:11, color:T.muted }}>{l}</span>
                <span style={{ fontSize:12, color:c, fontFamily:T.mono, fontWeight:700 }}>{v}</span>
              </div>
            ))}
          </section>

          <button onClick={runMC} disabled={mcBusy} style={{
            background:`${T.accent}14`, border:`1px solid ${T.accent}44`, color:T.accent,
            borderRadius:7, padding:"9px", fontSize:12, cursor:"pointer",
            fontWeight:700, fontFamily:T.sans, opacity:mcBusy?0.5:1,
          }}>{mcBusy?"⟳ Running…":"⚂ Run Monte Carlo (n=80)"}</button>
        </aside>

        {/* ── MAIN ── */}
        <main style={{ overflowY:"auto", display:"flex", flexDirection:"column" }}>

          {/* KPI strip */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", borderBottom:`1px solid ${T.border}` }}>
            {[
              { label:"Peak Infectious",  value:fmtN(m.peak?.I),  sub:`Day ${m.peak?.day}`,                          color:T.orange,  badge:(m.peak?.I??0)>params.N*0.1?"HIGH":null },
              { label:"Total Deaths",     value:fmtN(m.last?.D),  sub:`CFR ${fmtPct(params.mu)}`,                    color:T.rose,    badge:null },
              { label:"Peak Hospitalized",value:fmtN(m.peak?.H),  sub:`${fmtPct((m.peak?.H??0)/params.N)} of pop`,  color:T.pink,    badge:null },
              { label:"Vaccinated",       value:fmtN(m.last?.V),  sub:`${fmtPct((m.last?.V??0)/params.N)} coverage`, color:T.emerald, badge:null },
              { label:"Basic R₀",         value:fmtR(R0),          sub:(m.Rt30??0)>=1?"⚠ Epidemic active":"✓ Declining", color:T.accent,  badge:null },
            ].map((kpi,i) => (
              <div key={i} style={{ background:T.card, padding:"13px 16px", borderLeft:i>0?`1px solid ${T.border}`:"none" }}>
                <div style={{ fontSize:20, fontWeight:800, color:kpi.color, fontFamily:T.mono, lineHeight:1 }}>{kpi.value}</div>
                <div style={{ fontSize:9, color:T.muted, textTransform:"uppercase", letterSpacing:"0.08em", marginTop:5 }}>{kpi.label}</div>
                <div style={{ fontSize:11, color:T.text, marginTop:3, opacity:0.6 }}>{kpi.sub}</div>
                {kpi.badge && <div style={{ marginTop:5 }}><Pill color={kpi.color}>{kpi.badge}</Pill></div>}
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div style={{ borderBottom:`1px solid ${T.border}`, display:"flex", background:T.surface, paddingLeft:6, overflowX:"auto" }}>
            {TABS.map(([id,lbl]) => <Tab key={id} active={tab===id} onClick={() => setTab(id)}>{lbl}</Tab>)}
          </div>

          {/* Content */}
          <div style={{ padding:"16px 18px", flex:1, display:"flex", flexDirection:"column", gap:14 }}>

            {/* CURVES */}
            {tab==="curves" && <>
              <Card title="Active Infectious" sub="Daily count of currently infectious individuals">
                <ResponsiveContainer width="100%" height={CH}>
                  <AreaChart data={simData} margin={{top:8,right:16,left:0,bottom:0}}>
                    <defs>{gradDef("gI",T.orange)}</defs>
                    <CartesianGrid stroke={T.faint} strokeDasharray="3 3" />
                    <XAxis dataKey="day" stroke={T.muted} tick={{fill:T.muted,fontSize:11}} />
                    <YAxis stroke={T.muted} tick={{fill:T.muted,fontSize:11}} tickFormatter={fmtN} />
                    <Tooltip content={<Tip />} />
                    {m.peak && <ReferenceLine x={m.peak.day} stroke={T.amber} strokeDasharray="5 4" label={{value:`Peak d${m.peak.day}`,fill:T.amber,fontSize:10,position:"top"}} />}
                    <Area type="monotone" dataKey="I" name="Infectious" stroke={T.orange} fill="url(#gI)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <Card title="New Daily Cases" sub="Incidence curve">
                  <ResponsiveContainer width="100%" height={CH}>
                    <BarChart data={simData.filter((_,i)=>i%2===0)} margin={{top:8,right:12,left:0,bottom:0}}>
                      <CartesianGrid stroke={T.faint} strokeDasharray="3 3" />
                      <XAxis dataKey="day" stroke={T.muted} tick={{fill:T.muted,fontSize:10}} />
                      <YAxis stroke={T.muted} tick={{fill:T.muted,fontSize:10}} tickFormatter={fmtN} />
                      <Tooltip content={<Tip />} />
                      <Bar dataKey="newCases" name="New Cases" fill={T.violet} radius={[2,2,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="Deaths & Recovered" sub="Cumulative outcomes">
                  <ResponsiveContainer width="100%" height={CH}>
                    <ComposedChart data={simData} margin={{top:8,right:12,left:0,bottom:0}}>
                      <defs>{gradDef("gR",T.emerald)}</defs>
                      <CartesianGrid stroke={T.faint} strokeDasharray="3 3" />
                      <XAxis dataKey="day" stroke={T.muted} tick={{fill:T.muted,fontSize:10}} />
                      <YAxis stroke={T.muted} tick={{fill:T.muted,fontSize:10}} tickFormatter={fmtN} />
                      <Tooltip content={<Tip />} />
                      <Legend wrapperStyle={{fontSize:11}} />
                      <Area type="monotone" dataKey="R" name="Recovered" stroke={T.emerald} fill="url(#gR)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="D" name="Deaths" stroke={T.rose} strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            </>}

            {/* COMPARTMENTS */}
            {tab==="compartments" && (
              <Card title="Full Compartmental Flow" sub="All model compartments over simulation period">
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={simData} margin={{top:8,right:20,left:0,bottom:0}}>
                    <defs>
                      {[[T.muted,"gS"],[T.amber,"gE"],[T.orange,"gI2"],[T.emerald,"gR2"],
                        [T.rose,"gD"],[T.pink,"gH2"],[T.accent,"gV"]].map(([c,id])=>gradDef(id,c))}
                    </defs>
                    <CartesianGrid stroke={T.faint} strokeDasharray="3 3" />
                    <XAxis dataKey="day" stroke={T.muted} tick={{fill:T.muted,fontSize:11}} />
                    <YAxis stroke={T.muted} tick={{fill:T.muted,fontSize:11}} tickFormatter={fmtN} />
                    <Tooltip content={<Tip />} />
                    <Legend wrapperStyle={{fontSize:11}} />
                    <Area type="monotone" dataKey="S" name="Susceptible"  stroke={T.muted}   fill="url(#gS)"  strokeWidth={1.5} dot={false} />
                    {model!=="SIR" && <Area type="monotone" dataKey="E" name="Exposed" stroke={T.amber} fill="url(#gE)" strokeWidth={1.5} dot={false} />}
                    <Area type="monotone" dataKey="I" name="Infectious"   stroke={T.orange}  fill="url(#gI2)" strokeWidth={2}   dot={false} />
                    <Area type="monotone" dataKey="R" name="Recovered"    stroke={T.emerald} fill="url(#gR2)" strokeWidth={1.5} dot={false} />
                    {model==="SEIRDV" && <>
                      <Area type="monotone" dataKey="H" name="Hospitalized" stroke={T.pink}  fill="url(#gH2)" strokeWidth={1.5} dot={false} />
                      <Area type="monotone" dataKey="D" name="Deaths"       stroke={T.rose}  fill="url(#gD)"  strokeWidth={1.5} dot={false} />
                      <Area type="monotone" dataKey="V" name="Vaccinated"   stroke={T.accent} fill="url(#gV)"  strokeWidth={1.5} dot={false} />
                    </>}
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            )}

            {/* RT */}
            {tab==="rt" && <>
              <Card title="Effective Reproduction Number Rt(t)" sub="Values > 1 = exponential growth; < 1 = epidemic declining">
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={rtData} margin={{top:8,right:20,left:0,bottom:0}}>
                    <defs>{gradDef("gRt",T.accent)}</defs>
                    <CartesianGrid stroke={T.faint} strokeDasharray="3 3" />
                    <XAxis dataKey="day" stroke={T.muted} tick={{fill:T.muted,fontSize:11}} />
                    <YAxis stroke={T.muted} tick={{fill:T.muted,fontSize:11}} domain={[0,"auto"]} />
                    <Tooltip content={<Tip />} />
                    <ReferenceLine y={1} stroke={T.amber} strokeDasharray="6 4" label={{value:"Rt = 1",fill:T.amber,fontSize:11,position:"insideTopRight"}} />
                    <Area type="monotone" dataKey="Rt" name="Rt" stroke={T.accent} fill="url(#gRt)" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                {[
                  { l:"Basic R₀", v:fmtR(R0), c:R0>=3?T.rose:R0>=1?T.amber:T.emerald, d:"Without intervention" },
                  { l:"Rt at Day 30", v:fmtR(m.Rt30), c:(m.Rt30??0)>=1?T.rose:T.emerald, d:"With current parameters" },
                  { l:"Herd Immunity Thr.", v:fmtPct(m.hit), c:T.sky, d:"Population fraction required" },
                ].map(({l,v,c,d}) => (
                  <div key={l} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:9, padding:"20px", textAlign:"center" }}>
                    <div style={{ fontSize:32, fontWeight:800, color:c, fontFamily:T.mono }}>{v}</div>
                    <div style={{ fontSize:12, color:T.text, marginTop:6, fontWeight:600 }}>{l}</div>
                    <div style={{ fontSize:11, color:T.muted, marginTop:4 }}>{d}</div>
                  </div>
                ))}
              </div>
            </>}

            {/* HOSPITAL */}
            {tab==="hospital" && <>
              <Card title="Hospital & ICU Capacity Stress" sub="Demand vs. baseline capacity (0.2% of population = available beds)">
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={hospData} margin={{top:8,right:20,left:0,bottom:0}}>
                    <defs>{gradDef("gH3",T.pink)}</defs>
                    <CartesianGrid stroke={T.faint} strokeDasharray="3 3" />
                    <XAxis dataKey="day" stroke={T.muted} tick={{fill:T.muted,fontSize:11}} />
                    <YAxis stroke={T.muted} tick={{fill:T.muted,fontSize:11}} tickFormatter={fmtN} />
                    <Tooltip content={<Tip />} />
                    <Legend wrapperStyle={{fontSize:11}} />
                    <Area type="monotone" dataKey="Hospitalized" stroke={T.pink}  fill="url(#gH3)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="ICU"          stroke={T.rose}   fill={`${T.rose}18`} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Capacity"     stroke={T.amber}  strokeDasharray="7 4" strokeWidth={2} dot={false} name="Capacity" />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                {[
                  { l:"Peak Hospitalized", v:fmtN(m.peak?.H), c:T.pink },
                  { l:"Peak ICU",          v:fmtN((m.peak?.H??0)*0.2), c:T.rose },
                  { l:"Capacity Ratio",    v:`${(((m.peak?.H??0)/(params.N*0.002))*100).toFixed(0)}%`, c:T.amber },
                  { l:"Surge Needed",      v:fmtN(Math.max(0,(m.peak?.H??0)-params.N*0.002)), c:T.orange },
                ].map(({l,v,c}) => (
                  <div key={l} style={{ background:T.card, border:`1px solid ${T.border}`, borderTop:`2px solid ${c}`, borderRadius:8, padding:"13px", textAlign:"center" }}>
                    <div style={{ fontSize:20, fontWeight:800, color:c, fontFamily:T.mono }}>{v}</div>
                    <div style={{ fontSize:9, color:T.muted, marginTop:5, textTransform:"uppercase", letterSpacing:"0.08em" }}>{l}</div>
                  </div>
                ))}
              </div>
            </>}

            {/* AGE */}
            {tab==="age" && <>
              <Card title="Age-Stratified Impact" sub="Synthetic demographic breakdown using age-susceptibility and infection fatality rate curves">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={ageData} margin={{top:8,right:20,left:0,bottom:0}}>
                    <CartesianGrid stroke={T.faint} strokeDasharray="3 3" />
                    <XAxis dataKey="age" stroke={T.muted} tick={{fill:T.muted,fontSize:11}} />
                    <YAxis stroke={T.muted} tick={{fill:T.muted,fontSize:11}} tickFormatter={fmtN} />
                    <Tooltip content={<Tip />} />
                    <Legend wrapperStyle={{fontSize:11}} />
                    <Bar dataKey="Infected" fill={T.violet} radius={[4,4,0,0]} />
                    <Bar dataKey="Deaths"   fill={T.rose}   radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:"13px 17px" }}>
                <div style={{ fontSize:9, color:T.muted, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>Methodology Note</div>
                <p style={{ fontSize:12, color:T.text, lineHeight:1.8, opacity:0.8 }}>
                  Age-stratified results use synthetic susceptibility weights and IFR multipliers derived from published COVID-19 literature.
                  The 75+ cohort carries an estimated 350× greater mortality risk than the 0–17 group.
                  For production use, integrate POLYMOD social contact matrices and age-specific seroprevalence datasets.
                </p>
              </div>
            </>}

            {/* MONTE CARLO */}
            {tab==="montecarlo" && (!mcData
              ? <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:10, padding:"50px 30px", textAlign:"center" }}>
                  <div style={{ fontSize:34, marginBottom:12 }}>⚂</div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#fff", marginBottom:8 }}>Monte Carlo Uncertainty Analysis</div>
                  <div style={{ fontSize:12, color:T.muted, maxWidth:440, margin:"0 auto 22px", lineHeight:1.7 }}>
                    80 stochastic simulations with ±15–30% perturbation on β, γ, μ. Produces 5–95th percentile confidence bands.
                  </div>
                  <button onClick={runMC} disabled={mcBusy} style={{ background:`${T.accent}18`, border:`1px solid ${T.accent}55`, color:T.accent, borderRadius:7, padding:"10px 28px", fontSize:13, cursor:"pointer", fontWeight:700, fontFamily:T.sans, opacity:mcBusy?0.5:1 }}>
                    {mcBusy?"⟳ Running…":"▶ Run Monte Carlo (n = 80)"}
                  </button>
                </div>
              : <Card title="Infectious Trajectory — Confidence Bands" sub="Shaded regions = 5–95th percentile across 80 stochastic runs"
                  action={<button onClick={()=>setMcData(null)} style={{ background:"none", border:`1px solid ${T.border}`, color:T.muted, borderRadius:5, padding:"3px 10px", fontSize:11, cursor:"pointer", fontFamily:T.sans }}>Reset</button>}>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={mcData} margin={{top:8,right:20,left:0,bottom:0}}>
                      <defs>
                        <linearGradient id="mc90" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.accent} stopOpacity={0.10}/><stop offset="100%" stopColor={T.accent} stopOpacity={0.02}/></linearGradient>
                        <linearGradient id="mc50" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.accent} stopOpacity={0.22}/><stop offset="100%" stopColor={T.accent} stopOpacity={0.04}/></linearGradient>
                      </defs>
                      <CartesianGrid stroke={T.faint} strokeDasharray="3 3" />
                      <XAxis dataKey="day" stroke={T.muted} tick={{fill:T.muted,fontSize:11}} />
                      <YAxis stroke={T.muted} tick={{fill:T.muted,fontSize:11}} tickFormatter={fmtN} />
                      <Tooltip content={<Tip />} />
                      <Area type="monotone" dataKey="p95" stroke="none" fill="url(#mc90)" dot={false} />
                      <Area type="monotone" dataKey="p75" stroke="none" fill="url(#mc50)" dot={false} />
                      <Area type="monotone" dataKey="p25" stroke="none" fill={T.bg} dot={false} strokeWidth={0} />
                      <Area type="monotone" dataKey="p5"  stroke="none" fill={T.bg} dot={false} strokeWidth={0} />
                      <Line type="monotone" dataKey="p50" name="Median" stroke={T.accent} strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="p95" name="95% CI" stroke={T.accent} strokeWidth={1} strokeDasharray="4 4" dot={false} />
                      <Line type="monotone" dataKey="p5"  name="5% CI"  stroke={T.accent} strokeWidth={1} strokeDasharray="4 4" dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginTop:13 }}>
                    {[
                      { l:"Median Peak",       v:fmtN(Math.max(...mcData.map(d=>d.p50??0))), c:T.accent },
                      { l:"Worst Case (95th)", v:fmtN(Math.max(...mcData.map(d=>d.p95??0))), c:T.rose },
                      { l:"Best Case (5th)",   v:fmtN(Math.max(...mcData.map(d=>d.p5??0))),  c:T.emerald },
                      { l:"Uncertainty Ratio", v:((Math.max(...mcData.map(d=>d.p95??0)))/(Math.max(...mcData.map(d=>d.p5??1))||1)).toFixed(1)+"×", c:T.amber },
                    ].map(({l,v,c}) => (
                      <div key={l} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:7, padding:"10px", textAlign:"center" }}>
                        <div style={{ fontSize:18, fontWeight:700, color:c, fontFamily:T.mono }}>{v}</div>
                        <div style={{ fontSize:9, color:T.muted, marginTop:4, textTransform:"uppercase", letterSpacing:"0.06em" }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </Card>
            )}

            {/* DATA TABLE */}
            {tab==="table" && (
              <Card title="Detailed Simulation Output" sub="Full daily timeseries — paginated, filterable by interval, exportable to CSV">
                <DataTable data={simData} model={model} />
              </Card>
            )}

            {/* COMPARE */}
            {tab==="compare" && <ScenarioComparison activeKey={scKey} simDays={simDays} />}

          </div>

          {/* Footer */}
          <div style={{ borderTop:`1px solid ${T.border}`, padding:"9px 20px", display:"flex", justifyContent:"space-between", fontSize:10, color:T.muted, background:T.surface }}>
            <span>EpiSim Pro · SEIRD+V / SIR / SEIRS · RK4 solver · Monte Carlo n=80 · CSV export</span>
            <span>Research & policy support — not for clinical or diagnostic use</span>
          </div>
        </main>
      </div>
    </div>
  );
}
