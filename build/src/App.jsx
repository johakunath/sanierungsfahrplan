import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  PRESETS, ableiteBauteile,
  OPTIONS_GEBAEUDETYP, OPTIONS_HEIZUNG, OPTIONS_DACH, OPTIONS_KELLER,
  OPTIONS_LUEFTUNG, OPTIONS_WARMWASSER, OPTIONS_ERNEUERBARE, OPTIONS_WAERMEVERTEILUNG,
  BAUTEIL_STUFEN,
  MASSNAHMENPAKETE, BEG_BONUS,
  berechneNachMassnahmen, berechneKumuliert, berechneEffizienzklasse, berechneHeizkosten,
  preisFuerHeizung, traegerFuerHeizung,
  bewerteMassnahmen, vorlauftemperaturFuer, wpTypEmpfehlung,
  WP_VARIANTEN, wpTypVarianteKey,
  EFFIZIENZ_FARBEN, NOTE_FARBEN, PAKET_FARBEN,
} from "./data.js";
import { extractFromPDF } from "./pdfExtract.js";
import { exportAsPDF } from "./printExport.js";
import { fmt, fmtEur, textColorFor, waermeEEK, EnergyBar } from "./helpers.jsx";
import ISFPPrintReport from "./components/ISFPPrintReport.jsx";
import MassnahmenEditor from "./components/MassnahmenEditor.jsx";
const SANIERUNGSSTAND_STUFEN = {
  unsaniert:  { waende: 2, dach: 2, boden: 2, fenster: 2 },
  teilsaniert:{ waende: 3, dach: 4, boden: 3, fenster: 4 },
  saniert:    { waende: 5, dach: 5, boden: 4, fenster: 5 },
  neubau:     { waende: 6, dach: 6, boden: 5, fenster: 6 },
};
const SANIERUNGSSTAND_LEVEL_ORDER = ["unsaniert", "teilsaniert", "saniert", "neubau"];
const SANIERUNGSSTAND_OPTIONS = [
  { value: "unsaniert",   label: "Unsaniert",   note: "Ungedämmt, kein Wärmedämmverbundsystem" },
  { value: "teilsaniert", label: "Teilsaniert", note: "Einzelne Maßnahmen, z.B. neue Fenster" },
  { value: "saniert",     label: "Saniert",     note: "Zeitgemäß gedämmt, EnEV-Niveau" },
  { value: "neubau",      label: "Neubau/KfW",  note: "Neubau- oder KfW-Standard" },
];
const SANIERUNGSSTAND_BAUTEILE = [
  { id: "waende", label: "Wände" },
  { id: "dach", label: "Dach" },
  { id: "boden", label: "Boden" },
  { id: "fenster", label: "Fenster" },
];
const SANIERUNGSSTAND_BAUTEIL_TOOLTIPS = {
  waende: "Außenwand-Qualität steuert vor allem die Wirkung der Fassadendämmung (M5) und die spätere Heizlast.",
  dach: "Dachzustand beeinflusst direkt das Potenzial der Dachdämmung (M2). Schlechter Zustand = hohe Einsparwirkung.",
  boden: "Boden/Kellerdecke wirkt indirekt auf die Gebäudehülle und Heizlast; wichtig für das Gesamtniveau vor Heizungstausch.",
  fenster: "Fensterzustand bestimmt die Wirkung des Fenstertauschs (M3) und beeinflusst Komfort/Zugluft stark.",
};
const sanierungsstandAusBauteile = (bauteile) => {
  const result = {};
  SANIERUNGSSTAND_BAUTEILE.forEach(({ id }) => {
    const note = bauteile.find(b => b.id === id)?.note ?? 2;
    const level = SANIERUNGSSTAND_LEVEL_ORDER.reduce((best, key) => {
      const target = SANIERUNGSSTAND_STUFEN[key][id];
      const bestTarget = SANIERUNGSSTAND_STUFEN[best][id];
      return Math.abs(note - target) < Math.abs(note - bestTarget) ? key : best;
    }, SANIERUNGSSTAND_LEVEL_ORDER[0]);
    result[id] = level;
  });
  return result;
};
const bauteilMitAktualisierterNote = (bauteil, note) => ({
  ...bauteil,
  note,
  info: (BAUTEIL_STUFEN[bauteil.id] && BAUTEIL_STUFEN[bauteil.id][note]) || bauteil.info,
});

// ═══ ICONS ══════════════════════════════════════════════════════════════
const HouseIcon = ({ size = 24, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 28 L4 14 L16 6 L28 14 L28 28 Z" />
    <line x1="4" y1="28" x2="28" y2="28" strokeWidth="1.8" />
    <rect x="8.5" y="17" width="3" height="3.2" />
    <rect x="14.5" y="17" width="3" height="3.2" />
    <rect x="20.5" y="17" width="3" height="3.2" />
    <rect x="8.5" y="22.5" width="3" height="3.2" />
    <rect x="14.5" y="22.5" width="3" height="3.2" />
    <rect x="20.5" y="22.5" width="3" height="3.2" />
  </svg>
);

const InfoIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
    <circle cx="8" cy="5" r="0.9" fill="currentColor" />
    <line x1="8" y1="7.5" x2="8" y2="11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const UploadIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const CheckIcon = ({ size = 14, color = "#00843D" }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
    <path d="M2 7.5 L5.5 11 L12 4" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SparkleIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 1.5 L9.5 6.5 L14.5 8 L9.5 9.5 L8 14.5 L6.5 9.5 L1.5 8 L6.5 6.5 Z" />
  </svg>
);

const PaketHaus = ({ farbe, aktiv, nummer, size = 68 }) => {
  const f = PAKET_FARBEN[farbe] || PAKET_FARBEN.rot;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" style={{ opacity: aktiv ? 1 : 0.28 }}>
      <path d="M8 70 L8 36 L40 12 L72 36 L72 70 Z" fill={f.bg} stroke="#1E1A15" strokeWidth="1.5" strokeLinejoin="round"/>
      <text x="40" y="55" textAnchor="middle" fontFamily="'Fraunces', serif" fontSize="26" fontWeight="500" fill={f.text}>{nummer}</text>
    </svg>
  );
};

// ═══ ERROR BOUNDARY ════════════════════════════════════════════════════
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "'Geist Mono', monospace", color: "var(--acc)", background: "var(--bg)", minHeight: "100vh" }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>App-Fehler — bitte Seite neu laden</div>
          <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", color: "var(--body)", marginBottom: 16 }}>
            {this.state.error.message}
          </pre>
          <button onClick={() => window.location.reload()}
            style={{ padding: "8px 16px", background: "#B5623E", color: "#fff", border: "none", borderRadius: 3, cursor: "pointer" }}>
            Neu versuchen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ═══ MOBILE RESULTS DRAWER ═════════════════════════════════════════════
const MobileResultsDrawer = ({ effizienzklasse, k, ist, heizkosten, aktiveEmpfohleneMassnahmen, empfohleneMassnahmen, reportSummaryPackages, nichtEmpfohleneMassnahmen = [], scrollToTab = () => {}, effectiveBauteilState = {}, gebaeude = {}, aktiveMassnahmen = [] }) => {
  const [open, setOpen] = useState(false);
  const peReduction = ist.primaerenergie > 0 ? Math.round((1 - k.primaerenergie / ist.primaerenergie) * 100) : 0;
  const zielColor = EFFIZIENZ_FARBEN[k.effizienzklasse] || "#00843D";
  const istColor  = EFFIZIENZ_FARBEN[effizienzklasse]   || "#6B6259";
  const zielText  = ["B","C","D"].includes(k.effizienzklasse) ? "#1E1A15" : "#FFF";
  const istText   = ["C","D","E"].includes(effizienzklasse)   ? "#1E1A15" : "#FFF";

  return (
    <div className="lg:hidden print:hidden" style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
      transform: open ? "translateY(0)" : "translateY(calc(100% - 68px))",
      transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
      maxHeight: "75vh",
      background: "var(--surface)",
      borderTop: "1.5px solid var(--bdr)",
      borderRadius: "12px 12px 0 0",
      boxShadow: "0 -6px 32px rgba(30,26,21,0.13)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Collapsed handle strip — always visible, tappable */}
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", padding: "6px 16px 10px", background: "transparent", border: "none",
        cursor: "pointer", flexShrink: 0, textAlign: "left",
      }}>
        <div style={{ width: 36, height: 4, background: "var(--bdr)", borderRadius: 2, margin: "0 auto 8px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* EEK IST → ZIEL */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <div style={{ width: 30, height: 30, background: istColor, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, fontFamily: "'Fraunces', serif", color: istText }}>{effizienzklasse}</div>
            <span style={{ fontSize: 13, color: "var(--acc)" }}>→</span>
            <div style={{ width: 30, height: 30, background: zielColor, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, fontFamily: "'Fraunces', serif", color: zielText }}>{k.effizienzklasse}</div>
          </div>
          {/* Key numbers */}
          <div style={{ flex: 1, display: "flex", gap: 14, fontSize: 11, fontFamily: "'Geist Mono', monospace", color: "var(--body)", flexWrap: "wrap" }}>
            <span style={{ color: "var(--pos)", fontWeight: 600 }}>PE −{peReduction} %</span>
            <span>Eigenanteil {fmtEur(k.eigenanteil)}</span>
          </div>
          <span style={{ fontSize: 10, color: "var(--sec)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.28s", flexShrink: 0 }}>▼</span>
        </div>
      </button>

      {/* Expanded scrollable content */}
      <div style={{ overflowY: "auto", padding: "4px 16px 32px", flex: 1, scrollbarWidth: "thin" }}>
        <div className="text-[9.5px] tracking-[0.18em] uppercase mb-3"
             style={{ color: "var(--acc)", fontFamily: "'Geist Mono', monospace" }}>Ergebnis · Live</div>

        {/* EEK comparison */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, background: "var(--surface)", border: "1.25px solid var(--bdr)", borderRadius: 3, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--sec)", fontFamily: "'Geist Mono', monospace", textTransform: "uppercase", marginBottom: 6 }}>Heute</div>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: istColor, borderRadius: 3, fontSize: 18, fontWeight: 600, fontFamily: "'Fraunces', serif", color: istText }}>{effizienzklasse}</div>
          </div>
          <span style={{ fontSize: 22, color: "var(--acc)", flexShrink: 0 }}>→</span>
          <div style={{ flex: 1, background: zielColor, border: "1.25px solid #1E1A15", borderRadius: 3, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", fontFamily: "'Geist Mono', monospace", textTransform: "uppercase", marginBottom: 6, color: zielText === "#FFF" ? "rgba(248,245,239,0.7)" : "rgba(30,26,21,0.6)" }}>Ziel</div>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "var(--bg)", borderRadius: 3, fontSize: 18, fontWeight: 600, fontFamily: "'Fraunces', serif", color: zielColor }}>{k.effizienzklasse}</div>
          </div>
        </div>

        {/* KPI Scorecards 2×2 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
          {[
            { label: "Primärenergie", istVal: ist.primaerenergie, zielVal: k.primaerenergie, unit: "kWh/(m²·a)", posColor: "var(--pos)" },
            { label: "Endenergie",    istVal: ist.endenergie,     zielVal: k.endenergie,     unit: "kWh/(m²·a)", posColor: "var(--pos)" },
            { label: "CO₂",          istVal: ist.co2,            zielVal: k.co2,            unit: "kg/(m²·a)",  posColor: "var(--pos)" },
            { label: "Heizkosten",   istVal: heizkosten,          zielVal: k.heizkosten_gesamt, unit: "€/a",    posColor: "var(--gold)" },
          ].map(({ label, istVal, zielVal, unit, posColor }) => {
            const pct = istVal > 0 ? Math.round(Math.abs(zielVal - istVal) / istVal * 100) : 0;
            const down = zielVal < istVal;
            const fill = istVal > 0 ? Math.round(Math.min(zielVal / istVal, 1) * 100) : 0;
            const fmtV = n => unit === "€/a" ? fmtEur(n) : new Intl.NumberFormat("de-DE").format(Math.round(n));
            const barColor = down ? posColor : "var(--neg)";
            return (
              <div key={label} style={{ background: "var(--surface)", border: "1.25px solid var(--bdr)",
                                        borderRadius: 3, padding: "10px 11px" }}>
                <div style={{ fontSize: 8, fontFamily: "'Geist Mono', monospace", letterSpacing: "0.14em",
                              textTransform: "uppercase", color: "var(--sec)", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 19, fontWeight: 600, fontFamily: "'Geist Mono', monospace",
                              color: down ? posColor : "var(--neg)", marginBottom: 4, lineHeight: 1 }}>
                  {down ? "−" : "+"}{pct}%
                </div>
                <div style={{ height: 4, background: "var(--div)", borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
                  <div style={{ height: "100%", width: `${fill}%`, background: barColor, borderRadius: 2, transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: 8.5, fontFamily: "'Geist Mono', monospace", color: "var(--sec)", lineHeight: 1.3 }}>
                  {fmtV(istVal)} → {fmtV(zielVal)} {unit}
                </div>
              </div>
            );
          })}
        </div>

        {/* Paket-Übersicht */}
        <div style={{ background: "var(--surface)", border: "1.25px solid var(--bdr)", borderRadius: 3, padding: "10px 12px", marginBottom: 10 }}>
          <div className="text-[10.5px] tracking-[0.18em] uppercase mb-2" style={{ color: "var(--acc)", fontFamily: "'Geist Mono', monospace" }}>Paket-Übersicht</div>
          {reportSummaryPackages.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--sec)" }}>Noch keine Maßnahmen aktiv.</div>
          ) : reportSummaryPackages.map((pkg, idx) => (
            <div key={pkg.id} style={{ padding: "8px 0", borderBottom: idx < reportSummaryPackages.length - 1 ? "1px solid var(--div)" : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: PAKET_FARBEN[pkg.farbe]?.bg || "#6B6259", display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: "var(--txt)", fontWeight: 500 }}>Paket {pkg.nummer} · {pkg.titel}</span>
                </div>
                <span style={{ fontSize: 10.5, fontFamily: "'Geist Mono', monospace", flexShrink: 0 }}>{fmtEur(pkg.kosten)}</span>
              </div>
              <div style={{ paddingLeft: 16 }}>
                {pkg.massnahmen_aktiv_obj.map(m => {
                  const istEmpf = empfohleneMassnahmen.includes(m.id);
                  const istNichtEmpf = nichtEmpfohleneMassnahmen.includes(m.id) && !istEmpf;
                  const warum = getWarum(m.id, {
                    bauteile_state: effectiveBauteilState, gebaeude, aktiveMassnahmen,
                    empfohlen: istEmpf, nichtEmpfohlen: istNichtEmpf,
                  });
                  return (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 22, marginBottom: 1 }}>
                      <span
                        onClick={() => scrollToTab(`paket-${pkg.id}`)}
                        style={{ fontSize: 11, color: "var(--body)", cursor: "pointer", flex: 1 }}
                        onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                        onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                      >{m.kurztitel}</span>
                      {istEmpf && (
                        <Tooltip content={<span><b>Warum empfohlen:</b><br />{warum.grund}</span>}>
                          <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 2, background: "#F6D400", color: "var(--txt)", fontFamily: "'Geist Mono', monospace", fontWeight: 600, flexShrink: 0 }}>★</span>
                        </Tooltip>
                      )}
                      {istNichtEmpf && (
                        <Tooltip content={<span><b>Wirtschaftlichkeit gering:</b><br />{warum.jetzt}</span>}>
                          <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 2, background: "var(--div)", color: "var(--sec)", fontFamily: "'Geist Mono', monospace", fontWeight: 600, flexShrink: 0 }}>✕</span>
                        </Tooltip>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Investment summary */}
        <div style={{ background: "var(--bg)", border: "1px solid var(--bdr)", borderRadius: 3, padding: "10px 12px", fontSize: 12 }}>
          <div className="flex justify-between mb-1.5" style={{ color: "var(--body)" }}>
            <span>Investition</span>
            <span style={{ fontFamily: "'Geist Mono', monospace" }}>{fmtEur(k.invest_gesamt)}</span>
          </div>
          <div className="flex justify-between mb-1.5" style={{ color: "var(--pos)" }}>
            <span>Förderung</span>
            <span style={{ fontFamily: "'Geist Mono', monospace" }}>−{fmtEur(k.foerderung_gesamt)}</span>
          </div>
          <div className="flex justify-between font-medium" style={{ color: "var(--txt)", marginTop: 4, paddingTop: 6, borderTop: "1px solid var(--bdr)" }}>
            <span>Eigenanteil</span>
            <span style={{ fontFamily: "'Geist Mono', monospace" }}>{fmtEur(k.eigenanteil)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══ TOOLTIP ═══════════════════════════════════════════════════════════
const Tooltip = ({ content, children, align = "center" }) => {
  const triggerRef = useRef(null);
  const [pos, setPos] = useState(null);

  const open = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ cx: r.left + r.width / 2, top: r.top });
  };
  const close = () => setPos(null);

  let left = null;
  let caretLeft = 140;
  if (pos) {
    const raw = align === "right" ? pos.cx - 280 : align === "left" ? pos.cx : pos.cx - 140;
    left = Math.max(8, Math.min(raw, (typeof window !== "undefined" ? window.innerWidth : 800) - 296));
    caretLeft = Math.max(10, Math.min(pos.cx - left, 270));
  }

  return (
    <span ref={triggerRef}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "help" }}
      onMouseEnter={open} onMouseLeave={close}
      onClick={() => pos ? close() : open()}>
      {children}
      {pos && (
        <span style={{
          position: "fixed",
          top: pos.top - 8,
          left,
          transform: "translateY(-100%)",
          zIndex: 9999,
          background: "#1E1A15", color: "#F8F5EF",
          padding: "10px 14px", borderRadius: 3, fontSize: 12,
          lineHeight: 1.5, width: 280, textAlign: "left",
          boxShadow: "0 4px 18px rgba(30,26,21,0.25)", fontWeight: 400,
          pointerEvents: "none",
        }}>
          {content}
          <span style={{
            position: "absolute", top: "100%", left: caretLeft,
            transform: "translateX(-50%)", width: 0, height: 0,
            borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderTop: "6px solid #1E1A15",
          }} />
        </span>
      )}
    </span>
  );
};

// ═══ EDITABLE INPUTS ═══════════════════════════════════════════════════
const labelStyle = { color: "var(--body)", fontSize: 13 };
const valueStyle = {
  fontFamily: "'Geist Mono', ui-monospace, monospace",
  fontVariantNumeric: "tabular-nums", color: "var(--txt)", fontSize: 14,
};

const RowShell = ({ children }) => (
  <div className="flex items-baseline justify-between gap-3"
       style={{ padding: "9px 0", borderBottom: "1px solid var(--div)", minHeight: 38 }}>
    {children}
  </div>
);

const NumberInput = ({ label, value, onChange, unit, min, max, step = 1, tooltip }) => {
  const [local, setLocal] = useState(String(value ?? ""));
  useEffect(() => { setLocal(String(value ?? "")); }, [value]);
  const commit = () => {
    const n = parseFloat(local.replace(",", "."));
    if (Number.isFinite(n)) {
      const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n));
      onChange(clamped);
    } else {
      setLocal(String(value ?? ""));
    }
  };
  return (
    <RowShell>
      <span style={labelStyle} className="flex items-center gap-1.5">
        {label}
        {tooltip && <Tooltip align="right" content={tooltip}><span style={{ color: "var(--acc)" }}><InfoIcon /></span></Tooltip>}
      </span>
      <span className="flex items-baseline gap-1.5">
        <input type="text" inputMode="decimal" value={local}
          onChange={(e) => setLocal(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          style={{ ...valueStyle, background: "transparent", border: "none",
                   borderBottom: "1px dotted #D3CAB9", outline: "none",
                   textAlign: "right", width: 92, padding: "2px 2px", fontSize: 14 }} />
        {unit && <span style={{ fontSize: 12, color: "var(--sec)" }}>{unit}</span>}
      </span>
    </RowShell>
  );
};

const TextInput = ({ label, value, onChange, placeholder }) => (
  <RowShell>
    <span style={labelStyle}>{label}</span>
    <input type="text" value={value ?? ""}
      onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{ ...valueStyle, background: "transparent", border: "none",
               borderBottom: "1px dotted #D3CAB9", outline: "none",
               textAlign: "right", flex: 1, marginLeft: 12, padding: "2px 2px", minWidth: 0 }} />
  </RowShell>
);

const SelectInput = ({ label, value, onChange, options, tooltip }) => (
  <RowShell>
    <span style={{ ...labelStyle, flexShrink: 0 }} className="flex items-center gap-1.5">
      {label}
      {tooltip && <Tooltip content={tooltip}><span style={{ color: "var(--acc)" }}><InfoIcon /></span></Tooltip>}
    </span>
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}
      style={{ ...valueStyle, background: "transparent",
               border: "1px solid var(--bdr)", borderRadius: 2,
               padding: "4px 26px 4px 8px", appearance: "none",
               backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%236B6259' fill='none' stroke-width='1.2'/></svg>\")",
               backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
               cursor: "pointer", outline: "none", fontSize: 13,
               minWidth: 0, maxWidth: "min(220px, 55%)" }}>
      {options.map(o => {
        const opt = typeof o === "string" ? { value: o, label: o } : o;
        return <option key={opt.value} value={opt.value}>{opt.label}</option>;
      })}
    </select>
  </RowShell>
);

const ComputedRow = ({ label, value, unit, tooltip }) => (
  <div className="flex items-baseline justify-between gap-3"
       style={{ padding: "9px 0", borderBottom: "1px solid var(--div)", minHeight: 38 }}>
    <span className="flex items-center gap-1.5" style={labelStyle}>
      {label}
      <span style={{ color: "var(--acc)" }} title="Automatisch berechnet"><SparkleIcon size={11} /></span>
      {tooltip && <Tooltip content={tooltip}><span style={{ color: "var(--acc)" }}><InfoIcon /></span></Tooltip>}
    </span>
    <span className="text-right" style={valueStyle}>
      {value}{unit && <span style={{ fontSize: 12, color: "var(--sec)", marginLeft: 4 }}>{unit}</span>}
    </span>
  </div>
);

// ═══ LAYOUT SHELLS ═════════════════════════════════════════════════════
const Section = ({ id, eyebrow, title, subtitle, children }) => (
  <section id={id} className="mb-16" style={{ scrollMarginTop: 92 }}>
    {eyebrow && (
      <div className="text-[11px] tracking-[0.22em] uppercase mb-3" style={{ color: "var(--acc)", fontFamily: "'Geist Mono', monospace" }}>
        {eyebrow}
      </div>
    )}
    {title && (
      <h2 className="font-serif leading-[1.05] mb-3" style={{ fontSize: 32, fontWeight: 400, color: "var(--txt)", letterSpacing: "-0.01em" }}>
        {title}
      </h2>
    )}
    {subtitle && (
      <p className="max-w-2xl text-[15px] leading-relaxed mb-8" style={{ color: "var(--body)" }}>
        {subtitle}
      </p>
    )}
    {children}
  </section>
);

const Card = ({ children, style }) => (
  <div style={{ background: "var(--surface)", border: "1.25px solid var(--bdr)", borderRadius: 3, padding: 24, ...style }}>
    {children}
  </div>
);

const CardEyebrow = ({ children }) => (
  <div className="text-[11px] tracking-[0.22em] uppercase mb-4"
       style={{ color: "var(--acc)", fontFamily: "'Geist Mono', monospace" }}>
    {children}
  </div>
);

const KPI = ({ label, value, unit, big = false, style, tooltip }) => (
  <div style={style}>
    <div className="text-[11px] tracking-[0.2em] uppercase mb-2 flex items-center gap-1.5"
         style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>
      {label}
      {tooltip && <Tooltip content={tooltip}><span style={{ color: "var(--acc)" }}><InfoIcon size={11} /></span></Tooltip>}
    </div>
    <div className="flex items-baseline gap-1.5">
      <span className="font-serif leading-none"
        style={{ fontSize: big ? 48 : 30, fontWeight: 400, color: "var(--txt)",
                 fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
      {unit && <span className="text-[13px]" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>{unit}</span>}
    </div>
  </div>
);

// ═══ PRESET PICKER ═════════════════════════════════════════════════════
const PresetPicker = ({ activeId, onPick, onUploadClick, uploadLoading }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
    {Object.values(PRESETS).map(preset => {
      const active = activeId === preset.id;
      return (
        <button key={preset.id} onClick={() => onPick(preset.id)}
          className="print-hide"
          style={{
            padding: "16px 20px", textAlign: "left",
            background: active ? "var(--txt)" : "var(--surface)",
            color: active ? "var(--bg)" : "var(--txt)",
            border: active ? "1.5px solid var(--txt)" : "1.25px solid var(--bdr)",
            borderRadius: 3, cursor: "pointer", transition: "all 0.12s",
          }}
          onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = "var(--acc)"; }}
          onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = "var(--bdr)"; }}
        >
          <div className="text-[10.5px] tracking-[0.2em] uppercase mb-1.5"
               style={{ color: active ? "#F6A400" : "var(--acc)", fontFamily: "'Geist Mono', monospace" }}>
            Preset
          </div>
          <div className="font-serif text-[17px] leading-tight mb-1" style={{ fontWeight: 500 }}>
            {preset.label}
          </div>
          <div className="text-[12px]" style={{ color: active ? "var(--bg)" : "var(--sec)", opacity: active ? 0.72 : 1 }}>
            {preset.beschreibung}
          </div>
        </button>
      );
    })}
    <button className="print-hide" onClick={onUploadClick}
      style={{
        padding: "16px 20px", textAlign: "left",
        background: "var(--surface)", color: "var(--txt)",
        border: "1.5px dashed #D3CAB9",
        borderRadius: 3, cursor: "pointer", transition: "all 0.12s",
        outline: "none",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#B5623E"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#D3CAB9"; }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10.5px] tracking-[0.2em] uppercase"
          style={{ color: "var(--acc)", fontFamily: "'Geist Mono', monospace" }}>Energieausweis</span>
        <span className="text-[9.5px] tracking-[0.1em] uppercase px-1.5 py-0.5"
          style={{ color: "var(--sec)", border: "1px solid var(--bdr)", borderRadius: 100,
                   fontFamily: "'Geist Mono', monospace" }}>Demo</span>
      </div>
      <div className="font-serif text-[17px] leading-tight mb-1" style={{ fontWeight: 500 }}>
        {uploadLoading ? "Wird ausgelesen …" : "PDF hochladen"}
      </div>
      <div className="text-[12px]" style={{ color: "var(--sec)" }}>
        Energieausweis einlesen — experimentell, manuelle Nachbearbeitung empfohlen
      </div>
    </button>
  </div>
);

// ═══ UPLOAD ZONE ═══════════════════════════════════════════════════════

const ExtractionResult = ({ result, onDismiss }) => {
  const matchedCount = result.matched?.length ?? 0;
  return (
    <div className="print-hide" style={{
      background: matchedCount > 0 ? "#F1F7F1" : "#FBF2E8",
      border: `1.25px solid ${matchedCount > 0 ? "#34A030" : "#F07D00"}`,
      borderRadius: 3, padding: "18px 22px",
    }}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {matchedCount > 0 ? (
              <span style={{ display: "inline-flex", width: 20, height: 20, borderRadius: 100,
                             background: "#00843D", alignItems: "center", justifyContent: "center" }}>
                <CheckIcon size={12} color="#FFF" />
              </span>
            ) : (
              <span style={{ color: "#F07D00", fontSize: 18, fontWeight: 700 }}>!</span>
            )}
            <span className="text-[14.5px] font-medium" style={{ color: "var(--txt)" }}>
              {matchedCount > 0
                ? `${matchedCount} Felder aus ${result.fileName} übernommen`
                : `Aus ${result.fileName} konnten keine Standardfelder erkannt werden`}
            </span>
          </div>
          {matchedCount > 0 && (
            <div className="text-[12.5px] leading-relaxed" style={{ color: "var(--body)" }}>
              {result.matched.map((m, i) => (
                <span key={i}>
                  <span style={{ color: "var(--sec)" }}>{m.label}:</span>{" "}
                  <span style={{ fontFamily: "'Geist Mono', monospace", color: "var(--txt)" }}>{String(m.value)}</span>
                  {i < (result.matched?.length ?? 0) - 1 && <span style={{ color: "var(--bdr)" }}>  ·  </span>}
                </span>
              ))}
            </div>
          )}
          {(result.missed?.length ?? 0) > 0 && (
            <div className="text-[11.5px] mt-2 italic" style={{ color: "var(--sec)" }}>
              Nicht automatisch erkannt: {result.missed.join(", ")} — bitte manuell prüfen.
            </div>
          )}
        </div>
        <button onClick={onDismiss} style={{ background: "transparent", border: "none",
          color: "var(--sec)", fontSize: 18, cursor: "pointer", padding: 4 }} aria-label="Schließen">✕</button>
      </div>
    </div>
  );
};

// ═══ BAUTEIL-KACHEL mit benannten Stufen ══════════════════════════════
const BauteilKachel = ({ bauteil, onNoteChange }) => {
  const farbe = NOTE_FARBEN[bauteil.note];
  const stufenLabels = BAUTEIL_STUFEN[bauteil.id] || {};
  const currentLabel = stufenLabels[bauteil.note] || bauteil.info;
  return (
    <div style={{ background: "var(--surface)", border: "1.25px solid var(--bdr)", borderRadius: 3, padding: 16,
                  display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13.5px] font-medium" style={{ color: "var(--txt)" }}>{bauteil.label}</span>
        <span className="inline-flex items-center justify-center text-[11px] font-medium"
          style={{ width: 24, height: 24, borderRadius: 100, background: farbe, color: "#FFFFFF",
                   fontFamily: "'Geist Mono', monospace" }}>{bauteil.note}</span>
      </div>
      <div style={{
        height: 4, borderRadius: 100,
        background: `linear-gradient(to right, ${farbe} 0%, ${farbe} ${(bauteil.note / 7) * 100}%, #E2DBD0 ${(bauteil.note / 7) * 100}%)`,
      }} />
      <input type="range" min={1} max={7} step={1} value={bauteil.note}
        onChange={(e) => onNoteChange(bauteil.id, parseInt(e.target.value, 10))}
        className="print-hide"
        style={{ width: "100%", height: 4, margin: 0, background: "transparent", accentColor: "#B5623E", cursor: "pointer" }} />
      <div className="text-[11.5px] leading-snug font-medium" style={{ color: "var(--txt)" }}>
        {currentLabel}
      </div>
      {bauteil.info && stufenLabels[bauteil.note] && stufenLabels[bauteil.note] !== bauteil.info && (
        <div className="text-[10.5px]" style={{ color: "var(--sec)", fontStyle: "italic" }}>{bauteil.info}</div>
      )}
    </div>
  );
};

// ═══ DYNAMIC "WARUM" GENERATOR ═══════════════════════════════════════════
// Returns { grund, jetzt } strings tailored to current building state and active measures.
function getWarum(measureId, ctx) {
  const { bauteile_state: bs, gebaeude, aktiveMassnahmen, empfohlen, nichtEmpfohlen } = ctx;
  switch (measureId) {
    case "M1": {
      const grund = "Hydraulischer Abgleich verteilt das Heizwasser gleichmäßig auf alle Räume — kein Heizkörper läuft mehr zu kalt oder zu heiß.";
      const jetzt = aktiveMassnahmen.includes("M4")
        ? "Nach WP-Einbau zwingend: BEG-Pflicht und neue Massenströme machen einen erneuten Abgleich nötig."
        : "Sofort umsetzbar — geringe Investition, schnelle Heizkostenwirkung, Voraussetzung für viele BEG-Anträge.";
      return { grund, jetzt };
    }
    case "M2": {
      const note = bs.dach || 2;
      const grund = note <= 2
        ? "Ihr Dach ist ungedämmt. Bis zu 30 % der Heizenergie geht über das Dach verloren — höchstes Einsparpotenzial im Gebäude."
        : note <= 4
        ? "Ihr Dach hat Teildämmung. Eine Aufdopplung bringt noch spürbare Einsparungen."
        : "Ihr Dach ist bereits gut gedämmt. Zusätzliche Dämmung lohnt sich kaum.";
      const jetzt = aktiveMassnahmen.includes("M4")
        ? "Vor der Wärmepumpe einplanen: schlechte Hülle macht eine größer dimensionierte (teurere) WP nötig."
        : "Frühzeitig umsetzen — kurze Bauzeit, hohe Wirkung pro investiertem Euro.";
      return { grund, jetzt };
    }
    case "M3": {
      const note = bs.fenster || 2;
      const grund = note <= 2
        ? "Ihre Fenster sind alt und undicht — Zugluft und hohe Wärmeverluste. Sehr hohes Einsparpotenzial."
        : note <= 3
        ? "Ihre Fenster haben ältere Zweifachverglasung. Mit 3-fach-Verglasung sind noch spürbare Primärenergieeinsparungen möglich."
        : note <= 4
        ? "Ihre Fenster sind auf mittlerem Standard. 3-fach-Verglasung bringt noch mäßige Einsparung."
        : "Fenster bereits auf hohem Standard — Tausch lohnt energetisch kaum.";
      const jetzt = nichtEmpfohlen
        ? "Hoher Investitionsbetrag bei kleiner PE-Wirkung — Dachdämmung oder WP zuerst priorisieren."
        : "Sinnvoll bei größerer Hüllsanierung; Fensterlaibungen bei der Fassadendämmung mitdenken.";
      return { grund, jetzt };
    }
    case "M4": {
      const m7Geplant = (bs.verteilung || 2) >= 6;
      const vt = m7Geplant ? 35 : vorlauftemperaturFuer(gebaeude.waermeverteilung);
      const envAvg = ((bs.waende||2) + (bs.dach||2)) / 2;
      const istOel = /Heizöl/i.test(gebaeude.heizung_typ || "");
      const rawAutoKey = wpTypVarianteKey(vt, envAvg);
      const autoKey = (rawAutoKey === "hybrid" && istOel) ? "monoenergetisch" : rawAutoKey;
      const wpReady = vt <= 50;
      const grund = wpReady
        ? `Vorlauftemperatur ${vt} °C — Gebäude ist sofort WP-ready (${WP_VARIANTEN[autoKey]?.label}). Senkt Heizenergie um Faktor 3–4.`
        : aktiveMassnahmen.includes("M7")
        ? `Mit Erneuerung Wärmeverteilung (M7): Vorlauftemperatur sinkt auf 35 °C → Monovalent-Betrieb möglich (COP ~4–5).`
        : `Aktuelle Vorlauftemperatur ${vt} °C zu hoch für effizienten WP-Betrieb. Ohne M7 nur ${WP_VARIANTEN[autoKey]?.label} sinnvoll.`;
      const jetzt = aktiveMassnahmen.includes("M7")
        ? "Nach Wärmeverteilung-Umbau einbauen — dann ist Monovalent-Betrieb (höchster COP) erreichbar."
        : (aktiveMassnahmen.includes("M2") || aktiveMassnahmen.includes("M5"))
        ? "Nach Hüllsanierung einbauen — WP kann kleiner dimensioniert werden, was Investition senkt."
        : "GEG §71 ab 2026 macht erneuerbare Wärmeerzeugung beim Heizungstausch zur Pflicht — frühzeitig planen.";
      return { grund, jetzt };
    }
    case "M5": {
      const note = bs.waende || 2;
      const grund = note <= 2
        ? "Ihre Außenwände sind ungedämmt — größter Verlust- und Schimmelrisiko-Faktor der Gebäudehülle."
        : note <= 4
        ? "Wände teilgedämmt — Aufdopplung lohnt nur bei sowieso fälliger Putzerneuerung."
        : "Fassade bereits gut gedämmt — Dämmung lohnt energetisch kaum.";
      const jetzt = nichtEmpfohlen
        ? "Ihr €/kWh-Score liegt über 20 €/kWh — andere Maßnahmen bringen mehr Einsparung je investiertem Euro."
        : "Idealerweise gemeinsam mit fälliger Putzerneuerung umsetzen — Gerüstkosten bereits eingerechnet.";
      return { grund, jetzt };
    }
    case "M6": {
      const grund = aktiveMassnahmen.includes("M4")
        ? "Mit Wärmepumpe besonders attraktiv: Eigenstrom senkt WP-Betriebskosten direkt und verbessert die CO₂-Bilanz."
        : "Wirtschaftlich auch ohne WP — amortisiert sich über Eigenverbrauch und EEG-Einspeisung in 8–12 Jahren.";
      const jetzt = "Reihenfolge flexibel — sinnvoll am Schluss, wenn Strombedarf der WP geplant ist.";
      return { grund, jetzt };
    }
    case "M7": {
      const vt = vorlauftemperaturFuer(gebaeude.waermeverteilung);
      const grund = vt > 55
        ? `Aktuelle Vorlauftemperatur ${vt} °C ist zu hoch für effizienten WP-Betrieb. Umbau senkt VT auf ~35 °C.`
        : vt > 45
        ? `Vorlauftemperatur ${vt} °C — Umbau ermöglicht Monovalent statt Monoenergetisch.`
        : `Vorlauftemperatur bereits niedrig (${vt} °C). Umbau bringt nur noch geringen Effizienzgewinn.`;
      const jetzt = aktiveMassnahmen.includes("M4")
        ? "Vor WP-Einbau erledigen — sonst muss man Estrich/Heizkreis zweimal anfassen."
        : "Eigenständig kaum lohnend — Wirkung entsteht erst durch Wärmepumpe.";
      return { grund, jetzt };
    }
    default:
      return { grund: "", jetzt: "" };
  }
}

// ═══ PAKET-BLOCK mit Kostenherleitung-Tooltip ═══════════════════════════
const PaketBlock = ({ paket, aktiv, onToggle, onToggleMassnahme = () => {}, aktiveMassnahmen, empfohleneMassnahmen = [], nichtEmpfohleneMassnahmen = [], gebaeude = {}, bauteile_state = {}, wpVariante = "auto", resolvedWpVariante = "monovalent", onWpVarianteChange = () => {} }) => {
  const f = PAKET_FARBEN[paket.farbe];
  const aktiveMassnahmenInPaket = paket.massnahmen.filter(massnahme => aktiveMassnahmen.includes(massnahme.id));
  const summe_invest  = aktiveMassnahmenInPaket.reduce((s, massnahme) => s + massnahme.investition, 0);
  const summe_instand = aktiveMassnahmenInPaket.reduce((s, massnahme) => s + (massnahme.ohnehin_anteil ?? 0), 0);
  const summe_foerder = aktiveMassnahmenInPaket.reduce((s, massnahme) => {
    const netto = massnahme.investition - (massnahme.ohnehin_anteil ?? 0);
    const bonus = BEG_BONUS.isfp_bonus;
    const klimaBonus = (massnahme.id === "M4" && /Heizöl|Erdgas/i.test(gebaeude.heizung_typ || "")) ? 0.10 : 0;
    const quote = massnahme.foerderquote > 0 ? Math.min(massnahme.foerderquote + bonus + klimaBonus, 0.5) : 0;
    return s + netto * quote;
  }, 0);
  const eigenanteil   = summe_invest - summe_foerder;
  const foerderPct    =summe_invest - summe_instand > 0 ? Math.round(summe_foerder / (summe_invest - summe_instand) * 100) : 0;
  const firstM        = aktiveMassnahmenInPaket[0];
  const [warumOffen, setWarumOffen] = useState(new Set());
  const toggleWarum = mid => setWarumOffen(prev => { const s = new Set(prev); s.has(mid) ? s.delete(mid) : s.add(mid); return s; });

  return (
    <div id={`paket-${paket.id}`} className="transition-all" style={{
      background: "var(--surface)",
      border: aktiv ? "1.75px solid var(--txt)" : "1.25px solid var(--bdr)",
      borderRadius: 3, overflow: "hidden", opacity: aktiv ? 1 : 0.55,
    }}>
      <div className="flex items-stretch">
        <div className="flex items-center justify-center shrink-0" style={{ width: 88, background: "var(--bg)", borderRight: "1.25px solid var(--bdr)" }}>
          <PaketHaus farbe={paket.farbe} aktiv={aktiv} nummer={paket.nummer} size={62} />
        </div>
        <div className="flex-1 p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-[11px] tracking-[0.2em] uppercase" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>
                Paket {paket.nummer}
              </span>
            </div>
            <h3 className="font-serif" style={{ fontSize: 22, fontWeight: 500, color: "var(--txt)" }}>{paket.titel}</h3>
          </div>
          <button onClick={onToggle} className="flex items-center gap-2.5 transition print-hide"
            style={{ padding: "8px 16px",
                     border: `1.25px solid ${aktiv ? "var(--txt)" : "var(--bdr)"}`, borderRadius: 3,
                     background: aktiv ? "var(--txt)" : "transparent",
                     color: aktiv ? "var(--bg)" : "var(--body)",
                     fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>
            <span className="inline-block relative" style={{
              width: 14, height: 14, borderRadius: 2,
              background: aktiv ? "var(--bg)" : "transparent",
              border: aktiv ? "none" : "1.25px solid var(--sec)",
            }}>
              {aktiv && (
                <svg viewBox="0 0 14 14" width="14" height="14" style={{ position: "absolute", top: 0, left: 0 }}>
                  <path d="M3 7.5 L6 10.5 L11 4.5" stroke="var(--txt)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
            {aktiv ? "Im Fahrplan" : "Ausgeblendet"}
          </button>
        </div>
      </div>

      <div>
        {paket.massnahmen.map((massnahme, i) => {
          const massnahmeAktiv = aktiveMassnahmen.includes(massnahme.id);
          const warum = getWarum(massnahme.id, {
            bauteile_state, gebaeude, aktiveMassnahmen,
            empfohlen: empfohleneMassnahmen.includes(massnahme.id),
            nichtEmpfohlen: nichtEmpfohleneMassnahmen.includes(massnahme.id),
          });
          return (
          <div key={massnahme.id} className="p-5" style={{ borderBottom: i < paket.massnahmen.length - 1 ? "1px solid #E2DBD0" : "none", opacity: massnahmeAktiv ? 1 : 0.45, transition: "opacity 0.15s" }}>
            <div className="mb-4">
              <div className="mb-1.5" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
                <div className="text-[14.5px] font-medium flex items-center gap-2 flex-wrap" style={{ color: "var(--txt)", flex: 1 }}>
                <label className="print-hide" style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: "var(--sec)", fontFamily: "'Geist Mono', monospace", letterSpacing: "0.05em" }}>
                  <input type="checkbox" checked={massnahmeAktiv} onChange={() => onToggleMassnahme(massnahme.id)}
                    style={{ accentColor: "#2A8B7A", width: 14, height: 14, cursor: "pointer" }} />
                </label>
                <span style={{ textDecoration: aktiv && !massnahmeAktiv ? "line-through" : "none" }}>{massnahme.titel}</span>
                {massnahme._isMovedAbgleich && (
                  <span style={{ background: "#EBF5F3", color: "#1B4840", border: "1px solid #8CBDB5", padding: "1px 8px", borderRadius: 100, fontSize: 10, fontFamily: "'Geist Mono', monospace", flexShrink: 0 }}>
                    Pflicht nach BEG
                  </span>
                )}
                {empfohleneMassnahmen.includes(massnahme.id) && (
                  <Tooltip content={<span><b>Warum empfohlen:</b><br />{warum.grund}</span>}>
                    <span className="print-hide" style={{ background: "#F6D400", color: "var(--txt)", padding: "1px 8px", borderRadius: 100, fontSize: 10, fontFamily: "'Geist Mono', monospace", fontWeight: 600, letterSpacing: "0.06em", flexShrink: 0, cursor: "help" }}>
                      ★ Empfohlen
                    </span>
                  </Tooltip>
                )}
                {empfohleneMassnahmen.includes(massnahme.id) && !massnahmeAktiv && (
                  <span className="print-hide" title="Empfohlene Maßnahme wurde deaktiviert" style={{ background: "#FEF2E8", color: "var(--acc)", border: "1px solid #F5C09A", padding: "1px 8px", borderRadius: 100, fontSize: 10, fontFamily: "'Geist Mono', monospace", fontWeight: 600, letterSpacing: "0.06em", flexShrink: 0 }}>
                    ⚠ Abgewählt
                  </span>
                )}
                {nichtEmpfohleneMassnahmen.includes(massnahme.id) && !empfohleneMassnahmen.includes(massnahme.id) && (
                  <Tooltip content={<span><b>Wirtschaftlichkeit gering:</b><br />{warum.jetzt}</span>}>
                    <span className="print-hide" style={{ background: "var(--div)", color: "var(--sec)", padding: "1px 8px", borderRadius: 100, fontSize: 10, fontFamily: "'Geist Mono', monospace", fontWeight: 600, letterSpacing: "0.06em", flexShrink: 0, cursor: "help" }}>
                      ✕ Nicht empfohlen
                    </span>
                  </Tooltip>
                )}
                {massnahme.rolle === "synergie" && aktiveMassnahmen.includes("M4") && (
                  <span className="print-hide" title="PV kombiniert sich mit Wärmepumpe: Eigenstrom deckt WP-Betrieb, senkt Betriebskosten und verbessert CO₂-Bilanz." style={{ background: "#DBEAFE", color: "#1D4ED8", padding: "1px 8px", borderRadius: 100, fontSize: 10, fontFamily: "'Geist Mono', monospace", fontWeight: 600, letterSpacing: "0.06em", flexShrink: 0, cursor: "help" }}>
                    ⚡ Synergie mit WP
                  </span>
                )}
                <Tooltip content={
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Kosten-Herleitung</div>
                    <div style={{ fontSize: 11.5, marginBottom: 8 }}>{massnahme.kostenherleitung}</div>
                    <div style={{ fontWeight: 600, marginBottom: 4, marginTop: 8 }}>Förderung</div>
                    <div style={{ fontSize: 11.5 }}>
                      {massnahme.foerderung_rechtsgrundlage} · durchgeführt durch {massnahme.foerderung_stelle}
                      {massnahme.foerderquote > 0 && <><br/>Grundquote: {Math.round(massnahme.foerderquote * 100)} % · mit iSFP-Bonus: {Math.round((massnahme.foerderquote + BEG_BONUS.isfp_bonus) * 100)} %</>}
                    </div>
                  </div>
                }>
                  <span style={{ color: "var(--acc)" }}><InfoIcon /></span>
                </Tooltip>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, minWidth: 140 }}>
                  {massnahme.co2_reduktion > 0 && (
                    <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11.5, color: "var(--sec)", textAlign: "right" }}>
                      CO₂ −{massnahme.co2_reduktion} kg/(m²·a)
                    </div>
                  )}
                  <button className="print-hide" onClick={() => toggleWarum(massnahme.id)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5,
                             color: "var(--acc)", background: "none", border: "none", padding: 0,
                             cursor: "pointer", fontFamily: "'Geist Mono', monospace" }}>
                    Warum {warumOffen.has(massnahme.id) ? "▾" : "▸"}
                  </button>
                </div>
              </div>
              <div className="text-[13px] leading-relaxed" style={{ color: "var(--body)" }}>{massnahme.beschreibung}</div>
            </div>
            {massnahme.id === "M4" && (() => {
              const m7Geplant = (bauteile_state.verteilung || 2) >= 6;
              const vt = m7Geplant ? 35 : vorlauftemperaturFuer(gebaeude.waermeverteilung);
              const envAvg = ((bauteile_state.waende||2) + (bauteile_state.dach||2)) / 2;
              const istOel = /Heizöl/i.test(gebaeude.heizung_typ || "");
              const hatGas = /Gas/i.test(gebaeude.heizung_typ || "");
              // For oil buildings, auto never picks hybrid — mirror suppression logic from effectiveBauteilState
              const rawAutoKey = wpTypVarianteKey(vt, envAvg);
              const autoKey = (rawAutoKey === "hybrid" && istOel) ? "monoenergetisch" : rawAutoKey;
              const currentV = WP_VARIANTEN[resolvedWpVariante] || WP_VARIANTEN.monovalent;
              const isOverriding = wpVariante !== "auto" && wpVariante !== autoKey;
              const hybridOhneGas = resolvedWpVariante === "hybrid" && !hatGas;
              const hybridMitOel  = resolvedWpVariante === "hybrid" && istOel;
              return (
                <div style={{ marginBottom: 12, background: "var(--bg)", border: "1px solid var(--bdr)", borderRadius: 3, padding: "10px 12px", fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: "var(--txt)", marginBottom: 8 }}>WP-Variante</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
                    {Object.entries(WP_VARIANTEN).map(([key, v]) => {
                      const isSelected = key === resolvedWpVariante;
                      const isAuto = key === autoKey;
                      return (
                        <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 8px", borderRadius: 3, background: isSelected ? "#E8F4F2" : "transparent", border: isSelected ? "1px solid #8CBDB5" : "1px solid transparent" }}>
                          <input type="radio" name={`wp-${paket.id}`} value={key} checked={isSelected} onChange={() => onWpVarianteChange(key)} style={{ accentColor: "#2A8B7A" }} />
                          <span style={{ color: "var(--txt)", fontWeight: isSelected ? 600 : 400 }}>{v.label}</span>
                          {isAuto && <span style={{ fontSize: 10, color: "#2A8B7A", fontFamily: "'Geist Mono', monospace" }}>empfohlen</span>}
                        </label>
                      );
                    })}
                  </div>
                  {m7Geplant && <div style={{ color: "#2A8B7A", fontSize: 11, marginBottom: 4 }}>✓ Heizkreisumbau (M7) geplant — niedrige Vorlauftemperatur erreichbar</div>}
                  {!m7Geplant && autoKey !== "monovalent" && (
                    <div style={{ color: "#2A8B7A", fontSize: 11, marginBottom: 4 }}>
                      💡 Maßnahme „Erneuerung Wärmeverteilung" (M7) aktivieren — senkt Vorlauftemperatur und ermöglicht Monovalent-Betrieb.
                    </div>
                  )}
                  <div style={{ color: "var(--sec)", fontSize: 11.5 }}>Vorlauftemperatur: {vt} °C · {m7Geplant ? "Fußbodenheizung" : (gebaeude.waermeverteilung || "–")}</div>
                  <div style={{ color: "var(--body)", marginTop: 4, fontStyle: "italic" }}>→ {currentV.beschreibung}</div>
                  {hybridMitOel && (
                    <div style={{ color: "var(--acc)", fontSize: 11.5, marginTop: 8, padding: "6px 8px", background: "#FEF2E8", borderRadius: 3, border: "1px solid #F5C09A" }}>
                      ⚠ Bei Ölheizung schafft Hybrid-Gas neue fossile Infrastruktur. Monovalent oder Monoenergetisch bevorzugen.
                    </div>
                  )}
                  {isOverriding && !hybridMitOel && (
                    <div style={{ color: "var(--acc)", fontSize: 11, marginTop: 6 }}>
                      ⚠ Abweichung von Empfehlung ({WP_VARIANTEN[autoKey]?.label})
                      <button onClick={() => onWpVarianteChange("auto")} style={{ marginLeft: 8, fontSize: 10, color: "var(--sec)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>zurücksetzen</button>
                    </div>
                  )}
                  {resolvedWpVariante === "monoenergetisch" && (
                    <div style={{ fontSize: 11, color: "var(--sec)", marginTop: 6, fontStyle: "italic" }}>
                      ℹ️ Heizstab deckt ~5 % der Jahresheizlast (Spitzenlast, COP = 1). Geschätzte Mehrkosten: ~200–400 €/Jahr gegenüber monovalentem Betrieb.
                    </div>
                  )}
                  {(istOel || hybridOhneGas) && (
                    <div style={{ marginTop: 10, borderTop: "1px solid var(--bdr)", paddingTop: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 10.5, color: "var(--sec)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Geist Mono', monospace" }}>Begleitkosten</div>
                      {istOel && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--body)", marginBottom: 3 }}>
                          <span>Öltank-Stilllegung & Entsorgung</span>
                          <span style={{ fontFamily: "'Geist Mono', monospace" }}>~2.500 €</span>
                        </div>
                      )}
                      {hybridOhneGas && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--body)" }}>
                          <span>Gasanschluss-Herstellung</span>
                          <span style={{ fontFamily: "'Geist Mono', monospace" }}>~3.000–5.000 €</span>
                        </div>
                      )}
                      <div style={{ fontSize: 10.5, color: "var(--sec)", marginTop: 5, fontStyle: "italic" }}>Nicht förderfähig — erhöhen den Eigenanteil.</div>
                    </div>
                  )}
                </div>
              );
            })()}
            {warumOffen.has(massnahme.id) && (
              <div style={{ marginTop: 8, background: "#EBF4F2", border: "1px solid #A8D5CD",
                            borderRadius: 3, padding: "12px 14px", fontSize: 12, lineHeight: 1.6, color: "#1E3A35" }}>
                {warum.grund && (
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, color: "var(--acc)" }}>Warum diese Maßnahme: </span>{warum.grund}
                  </div>
                )}
                {warum.jetzt && (
                  <div>
                    <span style={{ fontWeight: 600, color: "var(--acc)" }}>Warum jetzt: </span>{warum.jetzt}
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>

      <div className="px-5 py-4 grid grid-cols-3 gap-4" style={{ background: "var(--bg)", borderTop: "1.25px solid var(--bdr)" }}>
        <div>
          <div className="text-[10.5px] tracking-[0.18em] uppercase mb-1" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>Investition</div>
          <div className="text-[15px]" style={{ fontFamily: "'Geist Mono', monospace", color: "var(--txt)", fontVariantNumeric: "tabular-nums" }}>{fmtEur(summe_invest)}</div>
        </div>
        <div>
          <div className="text-[10.5px] tracking-[0.18em] uppercase mb-1" style={{ color: "var(--pos)", fontFamily: "'Geist Mono', monospace" }}>Förderung</div>
          <div className="text-[15px]" style={{ fontFamily: "'Geist Mono', monospace", color: "var(--pos)", fontVariantNumeric: "tabular-nums" }}>
            {summe_foerder > 0 ? `− ${fmtEur(summe_foerder)}` : "—"}
          </div>
          {firstM && foerderPct > 0 && (
            <div className="text-[10.5px] mt-0.5" style={{ color: "var(--pos)", fontFamily: "'Geist Mono', monospace" }}>
              {foerderPct} % · {firstM.foerderung_rechtsgrundlage}
            </div>
          )}
        </div>
        <div>
          <div className="text-[10.5px] tracking-[0.18em] uppercase mb-1" style={{ color: "var(--txt)", fontFamily: "'Geist Mono', monospace" }}>Eigenanteil</div>
          <div className="text-[15px]" style={{ fontFamily: "'Geist Mono', monospace", color: "var(--txt)", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{fmtEur(eigenanteil)}</div>
        </div>
      </div>
    </div>
  );
};

// ═══ STICKY TAB NAV ════════════════════════════════════════════════════
const TABS = [
  { id: "gebaeude",    label: "Gebäude" },
  { id: "bauteile",    label: "Energetischer Zustand" },
  { id: "fahrplan",    label: "Fahrplan" },
  { id: "ergebnis",    label: "Ergebnis" },
];

const StickyTabs = ({ activeId, onClick }) => (
  <div className="flex items-center gap-1 overflow-auto" style={{ scrollbarWidth: "none" }}>
    {TABS.map((t, i) => {
      const active = activeId === t.id;
      return (
        <button key={t.id} onClick={() => onClick(t.id)}
          style={{
            padding: "10px 16px", whiteSpace: "nowrap",
            border: "none", borderBottom: active ? "2.5px solid var(--acc)" : "2.5px solid transparent",
            background: "transparent",
            color: active ? "var(--txt)" : "var(--sec)",
            fontSize: 13.5, fontWeight: active ? 600 : 400,
            letterSpacing: "0.01em", cursor: "pointer",
            transition: "color 0.12s, border-color 0.12s",
          }}
          onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "var(--txt)"; }}
          onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "var(--sec)"; }}
        >
          <span className="text-[10px] tracking-[0.18em]" style={{ color: active ? "var(--acc)" : "var(--sec)", fontFamily: "'Geist Mono', monospace", marginRight: 8 }}>
            {String(i + 1).padStart(2, "0")}
          </span>
          {t.label}
        </button>
      );
    })}
  </div>
);

// ═══ GEBÄUDE-BILD (decoratively) ════════════════════════════════════════

// ═══ ERGEBNIS-SECTION — Vorher/Nachher + Tabelle ════════════════════════
const EffizienzBadge = ({ klasse, size = "md" }) => {
  const farbe = EFFIZIENZ_FARBEN[klasse] || "#6B6259";
  const dim = size === "lg" ? 84 : size === "md" ? 60 : 36;
  const fs = size === "lg" ? 42 : size === "md" ? 28 : 16;
  return (
    <div className="inline-flex items-center justify-center font-serif"
      style={{ width: dim, height: dim, background: farbe,
               color: ["C","D","E"].includes(klasse) ? "#1E1A15" : "#FFFFFF",
               borderRadius: 3, fontSize: fs, fontWeight: 500 }}>{klasse}</div>
  );
};

const VorherNachher = ({ ist, k, heizkostenIst, gebaeude }) => {
  const istTarif   = preisFuerHeizung(gebaeude.heizung_typ);
  const istTraeger = traegerFuerHeizung(gebaeude.heizung_typ);
  const fmtN       = n => new Intl.NumberFormat("de-DE").format(Math.round(n));
  const fmtP       = p => p.toFixed(2).replace(".", ",");

  const istTooltip = (
    <span>
      <b>Berechnung IST:</b><br />
      {fmtN(ist.endenergie)} kWh/m² × {gebaeude.wohnflaeche} m²<br />
      × {fmtP(istTarif)} €/kWh ({istTraeger})<br />
      = <b>{fmtN(heizkostenIst)} €/Jahr</b>
    </span>
  );
  const higher = k.heizkosten_gesamt > heizkostenIst;
  const zielTooltip = (
    <span>
      <b>Berechnung ZIEL:</b><br />
      {fmtN(k.endenergie)} kWh/m² × {gebaeude.wohnflaeche} m²<br />
      × {fmtP(k.heizkosten_tarif)} €/kWh ({k.heizkosten_traeger})<br />
      = <b>{fmtN(k.heizkosten_gesamt)} €/Jahr</b>
      {higher && <><br /><span style={{ color: "var(--acc)" }}>Höher als IST: WP-Stromtarif ({fmtP(k.heizkosten_tarif)} €/kWh) ist teurer als {istTraeger} ({fmtP(istTarif)} €/kWh), aber Endenergie sinkt stark — Hüllsanierung würde dies korrigieren.</span></>}
    </span>
  );

  const stdRows = (rows, border) => rows.map((r, i) => (
    <div key={i} className="flex items-baseline justify-between gap-3"
         style={{ padding: "9px 0", borderBottom: i < rows.length - 1 ? border : "none", fontSize: 13 }}>
      <span style={{ color: "var(--body)" }}>{r[0]}</span>
      <span style={valueStyle}>
        {r[1]}<span style={{ fontSize: 12, color: "var(--sec)", marginLeft: 4 }}>{r[2]}</span>
      </span>
    </div>
  ));

  const dark = ["B","C","D"].includes(k.effizienzklasse);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-6 items-center">
      {/* IST */}
      <div style={{ background: "var(--surface)", border: "1.25px solid var(--bdr)", borderRadius: 3, padding: "28px 26px" }}>
        <div className="flex items-center justify-between mb-5">
          <div className="text-[11px] tracking-[0.22em] uppercase" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>Heute</div>
          <EffizienzBadge klasse={berechneEffizienzklasse(ist.primaerenergie)} size="md" />
        </div>
        <div className="space-y-3">
          {stdRows([
            ["Endenergie",    ist.endenergie,    "kWh/(m²·a)"],
            ["Primärenergie", ist.primaerenergie, "kWh/(m²·a)"],
            ["CO₂-Emissionen",ist.co2,            "kg/(m²·a)"],
          ], "1px solid #E2DBD0")}
          <div className="flex items-baseline justify-between gap-3" style={{ padding: "9px 0", fontSize: 13 }}>
            <span style={{ color: "var(--body)" }}>Heizkosten gesamt</span>
            <span style={valueStyle}>
              {fmt(heizkostenIst)}
              <span style={{ fontSize: 12, color: "var(--sec)", marginLeft: 4 }}>€/a</span>
              <Tooltip content={istTooltip}>
                <span style={{ marginLeft: 5, verticalAlign: "middle", color: "var(--acc)", cursor: "help" }}><InfoIcon size={11} /></span>
              </Tooltip>
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-2 py-4">
        <span className="font-serif text-[28px]" style={{ color: "var(--acc)" }}>→</span>
        <span className="text-[10.5px] tracking-[0.22em] uppercase" style={{ color: "var(--acc)", fontFamily: "'Geist Mono', monospace" }}>Sanierungsfahrplan</span>
      </div>

      {/* ZIEL */}
      <div style={{ background: EFFIZIENZ_FARBEN[k.effizienzklasse] || "#00843D", border: "1.25px solid #1E1A15", borderRadius: 3, padding: "28px 26px", color: dark ? "#1E1A15" : "#F8F5EF" }}>
        <div className="flex items-center justify-between mb-5">
          <div className="text-[11px] tracking-[0.22em] uppercase" style={{ color: dark ? "rgba(30,26,21,0.65)" : "rgba(248,245,239,0.75)", fontFamily: "'Geist Mono', monospace" }}>Ihr Haus in der Zukunft</div>
          <div className="inline-flex items-center justify-center font-serif"
               style={{ width: 60, height: 60, background: "var(--bg)", color: EFFIZIENZ_FARBEN[k.effizienzklasse], borderRadius: 3, fontSize: 28, fontWeight: 500 }}>{k.effizienzklasse}</div>
        </div>
        <div className="space-y-3">
          {[
            ["Endenergie",    k.endenergie,    "kWh/(m²·a)"],
            ["Primärenergie", k.primaerenergie, "kWh/(m²·a)"],
            ["CO₂-Emissionen",k.co2,            "kg/(m²·a)"],
          ].map((r, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3"
                 style={{ padding: "9px 0", borderBottom: `1px solid ${dark ? "rgba(30,26,21,0.18)" : "rgba(248,245,239,0.18)"}`, fontSize: 13 }}>
              <span>{r[0]}</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontVariantNumeric: "tabular-nums", fontSize: 14 }}>
                {r[1]}<span style={{ fontSize: 12, opacity: 0.7, marginLeft: 4 }}>{r[2]}</span>
              </span>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3" style={{ padding: "9px 0", fontSize: 13 }}>
            <span>Heizkosten gesamt</span>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontVariantNumeric: "tabular-nums", fontSize: 14 }}>
              {fmt(k.heizkosten_gesamt)}
              <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 4 }}>€/a</span>
              <Tooltip content={zielTooltip}>
                <span style={{ marginLeft: 5, verticalAlign: "middle", opacity: 0.75, cursor: "help" }}><InfoIcon size={11} /></span>
              </Tooltip>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const DeltaKPI = ({ label, vorher, nachher, unit }) => {
  const delta = nachher - vorher;
  const pct = vorher > 0 ? Math.round(Math.abs(delta) / vorher * 100) : 0;
  return (
    <div style={{ background: "var(--surface)", border: "1.25px solid var(--bdr)", borderRadius: 3, padding: "22px 24px" }}>
      <div className="text-[11px] tracking-[0.22em] uppercase mb-3" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>{label}</div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="font-serif" style={{ fontSize: 34, fontWeight: 500, color: "var(--txt)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          −{pct}%
        </span>
        <span className="text-[12px]" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>
          {fmt(vorher)}{unit && ` ${unit}`} → {fmt(nachher)}{unit && ` ${unit}`}
        </span>
      </div>
    </div>
  );
};

// ═══ EEK ARROW SCALE ═══════════════════════════════════════════════════
const EEK_ARROW_FARBEN = {
  "H":  { bg: "#8B1A14", txt: "#fff" },
  "G":  { bg: "#B83A2E", txt: "#fff" },
  "F":  { bg: "#B83A2E", txt: "#fff" },
  "E":  { bg: "#C8820A", txt: "#fff" },
  "D":  { bg: "#C8820A", txt: "#1E1A15" },
  "C":  { bg: "#6B9E1F", txt: "#fff" },
  "B":  { bg: "#1B6B3A", txt: "#fff" },
  "A":  { bg: "#1B6B3A", txt: "#fff" },
  "A+": { bg: "#1B6B3A", txt: "#fff" },
};
const EEK_CLASSES = ["H","G","F","E","D","C","B","A","A+"];

const EekArrowScale = ({ istKlasse, zielKlasse, istPe, zielPe }) => (
  <div style={{ marginBottom: 28 }}>
    <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase",
                  fontFamily: "'Geist Mono', monospace", color: "var(--acc)", marginBottom: 10 }}>
      Energieeffizienzklasse · Heute → Ziel
    </div>
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end" }}>
      {EEK_CLASSES.map(cls => {
        const isIst  = cls === istKlasse;
        const isZiel = cls === zielKlasse;
        const active = isIst || isZiel;
        const { bg, txt } = EEK_ARROW_FARBEN[cls] || { bg: "#6B6259", txt: "#fff" };
        return (
          <div key={cls} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              width: "100%", height: active ? 38 : 24,
              background: bg,
              opacity: active ? 1 : 0.3,
              clipPath: "polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: active ? 13 : 10, fontWeight: 600,
              fontFamily: "'Fraunces', Georgia, serif", color: txt,
              outline: isIst ? "2.5px solid var(--txt)" : isZiel ? "2.5px solid var(--pos)" : "none",
              outlineOffset: 1,
              transition: "height 0.2s, opacity 0.2s",
            }}>{cls}</div>
            {(isIst || isZiel) && (
              <div style={{ fontSize: 8, fontFamily: "'Geist Mono', monospace", letterSpacing: "0.06em",
                            textTransform: "uppercase", textAlign: "center", lineHeight: 1.4,
                            marginTop: 4, color: isZiel ? "var(--pos)" : "var(--sec)",
                            whiteSpace: "pre-line" }}>
                {isIst ? `Heute\n${istPe}` : `Ziel\n${zielPe}`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

// ═══ MERGED TABLE (Energie + Kosten pro Schritt) ════════════════════════
const MergedTable = ({ kumuliert, ist }) => {
  const maxEE = ist.endenergie || 1;
  const maxPE = ist.primaerenergie || 1;
  const maxCO2 = ist.co2 || 1;

  const totalInvest = kumuliert.length ? kumuliert[kumuliert.length - 1].nachher.invest_gesamt : 0;
  const totalFoerd  = kumuliert.length ? kumuliert[kumuliert.length - 1].nachher.foerderung_gesamt : 0;

  return (
    <div style={{ background: "var(--surface)", border: "1.25px solid var(--bdr)", borderRadius: 3, padding: "24px 28px" }}>
      <div className="text-[11px] tracking-[0.22em] uppercase mb-4 flex items-center gap-2"
           style={{ color: "var(--acc)", fontFamily: "'Geist Mono', monospace" }}>
        Kumulierte Wirkung pro Paket
        <Tooltip content="BAFA-Logik: jedes Paket wird auf dem Ergebnis des vorigen aufbauend berechnet. Zeigt den Fortschritt Schritt für Schritt.">
          <span><InfoIcon size={11} /></span>
        </Tooltip>
      </div>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table className="w-full text-[13px]" style={{ fontVariantNumeric: "tabular-nums", minWidth: 640 }}>
        <thead>
          <tr style={{ borderBottom: "1.25px solid var(--txt)" }}>
            <th className="text-left py-2.5 font-medium">Schritt</th>
            <th className="text-right py-2.5 font-medium">
              <Tooltip content="Tatsächlich gelieferter Energieträger in kWh pro m² Wohnfläche und Jahr.">
                <span style={{ color: "var(--acc)", display: "inline-flex", verticalAlign: "middle" }}><InfoIcon size={11} /></span><span style={{ marginLeft: 5 }}>Endenergie</span>
              </Tooltip>
            </th>
            <th className="text-right py-2.5 font-medium">
              <Tooltip content="Gesamtenergieeinsatz inkl. Vorkette. Basis für die Energieeffizienzklasse.">
                <span style={{ color: "var(--acc)", display: "inline-flex", verticalAlign: "middle" }}><InfoIcon size={11} /></span><span style={{ marginLeft: 5 }}>Primärenergie</span>
              </Tooltip>
            </th>
            <th className="text-right py-2.5 font-medium">
              <Tooltip content="CO₂-Emissionen in kg pro m² und Jahr.">
                <span style={{ color: "var(--acc)", display: "inline-flex", verticalAlign: "middle" }}><InfoIcon size={11} /></span><span style={{ marginLeft: 5 }}>CO₂</span>
              </Tooltip>
            </th>
            <th className="text-right py-2.5 font-medium">Klasse</th>
            <th className="text-right py-2.5 font-medium">
              <Tooltip content="Investitionskosten für diesen Sanierungsschritt.">
                <span style={{ color: "var(--acc)", display: "inline-flex", verticalAlign: "middle" }}><InfoIcon size={11} /></span><span style={{ marginLeft: 5 }}>Invest</span>
              </Tooltip>
            </th>
            <th className="text-right py-2.5 font-medium">Förderung</th>
            <th className="text-right py-2.5 font-medium">Eigenanteil</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: "1px solid var(--div)", background: "var(--surface2)" }}>
            <td className="py-3">
              <span className="text-[11px] tracking-[0.18em] uppercase mr-2" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>0</span>
              Ausgangszustand
            </td>
            <td className="text-right py-3">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                <span style={{ fontFamily: "'Geist Mono', monospace" }}>{ist.endenergie}</span>
                <div style={{ width: 52, height: 4, background: "var(--div)", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: "100%", background: EFFIZIENZ_FARBEN[berechneEffizienzklasse(ist.primaerenergie)] || "var(--sec)", borderRadius: 2 }} />
                </div>
              </div>
            </td>
            <td className="text-right py-3">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                <span style={{ fontFamily: "'Geist Mono', monospace" }}>{ist.primaerenergie}</span>
                <div style={{ width: 52, height: 4, background: "var(--div)", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: "100%", background: EFFIZIENZ_FARBEN[berechneEffizienzklasse(ist.primaerenergie)] || "var(--sec)", borderRadius: 2 }} />
                </div>
              </div>
            </td>
            <td className="text-right py-3">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                <span style={{ fontFamily: "'Geist Mono', monospace" }}>{ist.co2}</span>
                <div style={{ width: 52, height: 4, background: "var(--div)", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: "100%", background: EFFIZIENZ_FARBEN[berechneEffizienzklasse(ist.primaerenergie)] || "var(--sec)", borderRadius: 2 }} />
                </div>
              </div>
            </td>
            <td className="text-right py-3">
              <EffizienzBadge klasse={berechneEffizienzklasse(ist.primaerenergie)} size="sm" />
            </td>
            <td className="text-right py-3" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>—</td>
            <td className="text-right py-3" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>—</td>
            <td className="text-right py-3" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>—</td>
          </tr>
          {kumuliert.map((r, i) => {
            const prevInvest = i === 0 ? 0 : kumuliert[i-1].nachher.invest_gesamt;
            const prevFoerd  = i === 0 ? 0 : kumuliert[i-1].nachher.foerderung_gesamt;
            const stepInvest = r.nachher.invest_gesamt - prevInvest;
            const stepFoerd  = r.nachher.foerderung_gesamt - prevFoerd;
            const stepEigen  = stepInvest - stepFoerd;
            const barColor = EFFIZIENZ_FARBEN[r.nachher.effizienzklasse] || "var(--sec)";
            const eeW = Math.round(Math.min(r.nachher.endenergie / maxEE, 1) * 100);
            const peW = Math.round(Math.min(r.nachher.primaerenergie / maxPE, 1) * 100);
            const coW = Math.round(Math.min(r.nachher.co2 / maxCO2, 1) * 100);
            return (
              <tr key={r.paket.id} style={{ borderBottom: i < kumuliert.length - 1 ? "1px solid var(--div)" : "none" }}>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <span style={{ width: 10, height: 10, borderRadius: 100, background: PAKET_FARBEN[r.paket.farbe]?.bg, display: "inline-block", flexShrink: 0 }} />
                    <span className="text-[11px] tracking-[0.18em] uppercase" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>P{r.paket.nummer}</span>
                    <span style={{ color: "var(--txt)" }}>{r.paket.titel}</span>
                  </div>
                </td>
                <td className="text-right py-3">
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <span style={{ fontFamily: "'Geist Mono', monospace" }}>{r.nachher.endenergie}</span>
                    <div style={{ width: 52, height: 4, background: "var(--div)", borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${eeW}%`, background: barColor, borderRadius: 2 }} />
                    </div>
                  </div>
                </td>
                <td className="text-right py-3">
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <span style={{ fontFamily: "'Geist Mono', monospace" }}>{r.nachher.primaerenergie}</span>
                    <div style={{ width: 52, height: 4, background: "var(--div)", borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${peW}%`, background: barColor, borderRadius: 2 }} />
                    </div>
                  </div>
                </td>
                <td className="text-right py-3">
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <span style={{ fontFamily: "'Geist Mono', monospace" }}>{r.nachher.co2}</span>
                    <div style={{ width: 52, height: 4, background: "var(--div)", borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${coW}%`, background: barColor, borderRadius: 2 }} />
                    </div>
                  </div>
                </td>
                <td className="text-right py-3">
                  <EffizienzBadge klasse={r.nachher.effizienzklasse} size="sm" />
                </td>
                <td className="text-right py-3" style={{ fontFamily: "'Geist Mono', monospace" }}>{stepInvest > 0 ? fmtEur(stepInvest) : "—"}</td>
                <td className="text-right py-3" style={{ fontFamily: "'Geist Mono', monospace", color: stepFoerd > 0 ? "var(--pos)" : "var(--sec)" }}>
                  {stepFoerd > 0 ? `−${fmtEur(stepFoerd)}` : "—"}
                </td>
                <td className="text-right py-3" style={{ fontFamily: "'Geist Mono', monospace" }}>{stepEigen > 0 ? fmtEur(stepEigen) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "1.5px solid var(--txt)", background: "var(--surface2)" }}>
            <td className="py-3 font-medium" colSpan={5}>Gesamt</td>
            <td className="text-right py-3 font-medium" style={{ fontFamily: "'Geist Mono', monospace" }}>{fmtEur(totalInvest)}</td>
            <td className="text-right py-3 font-medium" style={{ fontFamily: "'Geist Mono', monospace", color: totalFoerd > 0 ? "var(--pos)" : "var(--sec)" }}>
              {totalFoerd > 0 ? `−${fmtEur(totalFoerd)}` : "—"}
            </td>
            <td className="text-right py-3 font-medium" style={{ fontFamily: "'Geist Mono', monospace" }}>{fmtEur(totalInvest - totalFoerd)}</td>
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
  );
};

// ═══ KUMULIERT-TABELLE (BAFA-Logik) ═══════════════════════════════════
const KumuliertTabelle = ({ kumuliert, ist, heizkostenIst }) => (
  <div style={{ background: "var(--surface)", border: "1.25px solid var(--bdr)", borderRadius: 3, padding: "24px 28px" }}>
    <div className="text-[11px] tracking-[0.22em] uppercase mb-4 flex items-center gap-2"
         style={{ color: "var(--acc)", fontFamily: "'Geist Mono', monospace" }}>
      Kumulierte Wirkung pro Paket
      <Tooltip content="BAFA-Logik: jedes Paket wird auf dem Ergebnis des vorigen aufbauend berechnet. Zeigt den Fortschritt Schritt für Schritt.">
        <span><InfoIcon size={11} /></span>
      </Tooltip>
    </div>
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
    <table className="w-full text-[13px]" style={{ fontVariantNumeric: "tabular-nums", minWidth: 480 }}>
      <thead>
        <tr style={{ borderBottom: "1.25px solid #1E1A15" }}>
          <th className="text-left py-2.5 font-medium">Schritt</th>
          <th className="text-right py-2.5 font-medium">
            <Tooltip content="Tatsächlich gelieferter Energieträger (Gas, Strom, Öl) in kWh pro m² Wohnfläche und Jahr. Entspricht dem Energieausweis-Verbrauchswert.">
              <span style={{ color: "var(--acc)", display: "inline-flex", verticalAlign: "middle" }}><InfoIcon size={11} /></span><span style={{ marginLeft: 6 }}>Endenergie</span>
            </Tooltip>
          </th>
          <th className="text-right py-2.5 font-medium">
            <Tooltip content="Gesamtenergieeinsatz inkl. Gewinnung und Transport des Energieträgers (Primärenergiefaktor). Basis für die Energieeffizienzklasse nach GEG §86.">
              <span style={{ color: "var(--acc)", display: "inline-flex", verticalAlign: "middle" }}><InfoIcon size={11} /></span><span style={{ marginLeft: 6 }}>Primärenergie</span>
            </Tooltip>
          </th>
          <th className="text-right py-2.5 font-medium">
            <Tooltip content="CO₂-Emissionen aus dem Heizenergieverbrauch in kg pro m² Wohnfläche und Jahr. Inkl. Vorkette des Energieträgers.">
              <span style={{ color: "var(--acc)", display: "inline-flex", verticalAlign: "middle" }}><InfoIcon size={11} /></span><span style={{ marginLeft: 6 }}>CO₂</span>
            </Tooltip>
          </th>
          <th className="text-right py-2.5 font-medium">Klasse</th>
        </tr>
      </thead>
      <tbody>
        <tr style={{ borderBottom: "1px solid var(--div)", background: "var(--bg)" }}>
          <td className="py-3">
            <span className="text-[11px] tracking-[0.18em] uppercase mr-2" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>0</span>
            Ausgangszustand
          </td>
          <td className="text-right py-3" style={{ fontFamily: "'Geist Mono', monospace" }}>{ist.endenergie}</td>
          <td className="text-right py-3" style={{ fontFamily: "'Geist Mono', monospace" }}>{ist.primaerenergie}</td>
          <td className="text-right py-3" style={{ fontFamily: "'Geist Mono', monospace" }}>{ist.co2}</td>
          <td className="text-right py-3">
            <EffizienzBadge klasse={berechneEffizienzklasse(ist.primaerenergie)} size="sm" />
          </td>
        </tr>
        {kumuliert.map((r, i) => (
          <tr key={r.paket.id} style={{ borderBottom: i < kumuliert.length - 1 ? "1px solid #E2DBD0" : "none" }}>
            <td className="py-3">
              <div className="flex items-center gap-2">
                <span style={{ width: 10, height: 10, borderRadius: 100, background: PAKET_FARBEN[r.paket.farbe].bg, display: "inline-block" }} />
                <span className="text-[11px] tracking-[0.18em] uppercase" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>P{r.paket.nummer}</span>
                <span>{r.paket.titel}</span>
              </div>
            </td>
            <td className="text-right py-3" style={{ fontFamily: "'Geist Mono', monospace" }}>{r.nachher.endenergie}</td>
            <td className="text-right py-3" style={{ fontFamily: "'Geist Mono', monospace" }}>{r.nachher.primaerenergie}</td>
            <td className="text-right py-3" style={{ fontFamily: "'Geist Mono', monospace" }}>{r.nachher.co2}</td>
            <td className="text-right py-3">
              <EffizienzBadge klasse={r.nachher.effizienzklasse} size="sm" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  </div>
);

// ═══ iSFP-STYLE PRINT REPORT ═══════════════════════════════════════════

const EEK_ZONEN = [
  { klasse: "A+", von: 0,   bis: 30   },
  { klasse: "A",  von: 30,  bis: 50   },
  { klasse: "B",  von: 50,  bis: 75   },
  { klasse: "C",  von: 75,  bis: 100  },
  { klasse: "D",  von: 100, bis: 130  },
  { klasse: "E",  von: 130, bis: 160  },
  { klasse: "F",  von: 160, bis: 200  },
  { klasse: "G",  von: 200, bis: 250  },
  { klasse: "H",  von: 250, bis: 9999 },
];

const EnergieVerlaufChart = ({ ist, kumuliert }) => {
  const W = 620, H = 320;
  const PAD = { top: 60, right: 36, bottom: 40, left: 52 };
  const pw = W - PAD.left - PAD.right;
  const ph = H - PAD.top - PAD.bottom;

  const punkte = [
    { label: "Heute", pe: ist.primaerenergie, bg: "#6E2E1E", klasse: berechneEffizienzklasse(ist.primaerenergie) },
    ...kumuliert.map(r => ({
      label: r.paket.titel,
      pe: r.nachher.primaerenergie,
      bg: PAKET_FARBEN[r.paket.farbe].bg,
      klasse: r.nachher.effizienzklasse,
    })),
  ];

  const yMax = Math.max(Math.ceil(ist.primaerenergie * 1.18 / 25) * 25, 100);
  const toY = v => PAD.top + ph * (1 - Math.min(v, yMax) / yMax);
  const toX = i => PAD.left + (punkte.length > 1 ? pw * i / (punkte.length - 1) : pw / 2);

  const visibleZonen = EEK_ZONEN.filter(z => z.von < yMax).map(z => ({ ...z, bis: Math.min(z.bis, yMax) }));
  const gridLines = [0, 30, 50, 75, 100, 130, 160, 200, 250].filter(v => v > 0 && v <= yMax);

  const pathD = punkte.map((p, i) =>
    i === 0 ? `M ${toX(i)} ${toY(p.pe)}` : `H ${toX(i)} V ${toY(p.pe)}`
  ).join(" ");
  const areaD = pathD + ` V ${toY(0)} H ${toX(0)} Z`;

  return (
    <div style={{ background: "var(--surface)", border: "1.25px solid var(--bdr)", borderRadius: 3, padding: "24px 28px", marginTop: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--acc)", fontFamily: "'Geist Mono', monospace" }}>
          Primärenergie-Verlauf
        </div>
        <div style={{ fontSize: 10, color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>kWh/(m²·a)</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block", aspectRatio: "620/320", minHeight: 180 }}>
        <defs>
          <clipPath id="evc-clip">
            <rect x={PAD.left} y={PAD.top} width={pw} height={ph} />
          </clipPath>
        </defs>
        {visibleZonen.map(z => (
          <rect key={z.klasse}
            x={PAD.left} y={toY(z.bis)} width={pw} height={toY(z.von) - toY(z.bis)}
            fill={EFFIZIENZ_FARBEN[z.klasse]} opacity={0.13}
            clipPath="url(#evc-clip)"
          />
        ))}
        {gridLines.map(v => (
          <line key={v}
            x1={PAD.left} y1={toY(v)} x2={PAD.left + pw} y2={toY(v)}
            stroke="var(--bdr)" strokeWidth={0.75} strokeDasharray="4 3"
          />
        ))}
        {[0, ...gridLines].map(v => (
          <text key={v} x={PAD.left - 6} y={toY(v) + 3.5}
            textAnchor="end" fontSize={9} fill="#9B8E82"
            fontFamily="'Geist Mono', monospace">{v}</text>
        ))}
        {visibleZonen.map(z => {
          const yMid = (toY(z.von) + toY(z.bis)) / 2;
          return (
            <text key={z.klasse}
              x={PAD.left + pw + 5} y={yMid + 4}
              fontSize={9} fill={EFFIZIENZ_FARBEN[z.klasse]}
              fontFamily="'Geist Mono', monospace" fontWeight={700}
            >{z.klasse}</text>
          );
        })}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ph} stroke="var(--bdr)" strokeWidth={1} />
        <line x1={PAD.left} y1={PAD.top + ph} x2={PAD.left + pw} y2={PAD.top + ph} stroke="var(--bdr)" strokeWidth={1} />
        <path d={areaD} fill="var(--txt)" opacity={0.06} clipPath="url(#evc-clip)" />
        <path d={pathD} fill="none" stroke="var(--txt)" strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round" clipPath="url(#evc-clip)" />
        {punkte.map((pt, i) => {
          const x = toX(i), y = toY(pt.pe);
          return (
            <g key={i}>
              <text x={x} y={y - 36} textAnchor="middle" fontSize={8.5} fill="#3A332B"
                fontFamily="'Geist Mono', monospace" fontWeight={500}>{pt.pe}</text>
              <rect x={x - 12} y={y - 33} width={24} height={20} rx={2}
                fill={EFFIZIENZ_FARBEN[pt.klasse]} />
              <text x={x} y={y - 18} textAnchor="middle" fontSize={12} fontWeight={700}
                fontFamily="'Fraunces', serif" fill={textColorFor(pt.klasse)}>{pt.klasse}</text>
              <circle cx={x} cy={y} r={5.5} fill={pt.bg} stroke="#FFF" strokeWidth={2} />
              <text x={x} y={14} textAnchor="middle" fontSize={8.5} fill={pt.bg}
                fontFamily="'Geist Mono', monospace" fontWeight={600}>{pt.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const WieFunktioniertSection = () => {
  const [open, setOpen] = useState(false);
  const Sub = ({ title, children }) => (
    <div style={{ marginBottom: 22 }}>
      <div className="text-[10px] tracking-[0.2em] uppercase mb-2" style={{ color: "var(--acc)", fontFamily: "'Geist Mono', monospace" }}>{title}</div>
      <div style={{ fontSize: 13.5, color: "var(--body)", lineHeight: 1.65 }}>{children}</div>
    </div>
  );
  return (
    <div className="print-hide" style={{ marginTop: 32, border: "1.25px solid var(--bdr)", borderRadius: 3, background: "var(--surface)" }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between"
        style={{ padding: "16px 24px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span className="text-[11px] tracking-[0.2em] uppercase" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>
          Wie funktioniert dieser Rechner?
        </span>
        <span style={{ color: "var(--acc)", fontSize: 13 }}>{open ? "▲ Schließen" : "▼ Anzeigen"}</span>
      </button>
      {open && (
        <div style={{ borderTop: "1.25px solid var(--bdr)", padding: "24px 24px 32px" }}>
          <Sub title="Was macht dieses Tool?">
            Sie geben Gebäudedaten ein — Baujahr, Heizung, Wohnfläche, Bauteil-Zustand — und erhalten einen priorisierten Sanierungsfahrplan mit Energiekennzahlen, Kosten und BEG-Förderung. Das Tool ist kein BAFA-zertifizierter iSFP, sondern ein Demonstrator auf Basis realer Marktdaten 2026.
          </Sub>
          <Sub title="Woher kommen die Energiezahlen?">
            <b>Endenergie</b> ist die dem Gebäude zugeführte Energie (Öl, Gas, Strom). <b>Primärenergie</b> = Endenergie × Primärenergiefaktor — berücksichtigt die Verluste bei Gewinnung und Transport des Energieträgers. Die <b>Effizienzklasse A+–H</b> basiert auf der Primärenergie nach GEG §86. Die Bauteil-Stufen 1–7 beschreiben den Sanierungsstand; sie bestimmen, wie groß die Einsparung jeder Maßnahme für Ihr Haus konkret ist.
          </Sub>
          <Sub title="Wie wird die Reihenfolge der Maßnahmen bestimmt?">
            Jede Maßnahme erhält eine Punktzahl: Netto-Investition ÷ eingesparte Primärenergie [€/kWh PE]. Niedrig = wirtschaftlich sinnvoll. Die Pakete werden nach dieser Punktzahl sortiert und aktualisieren sich automatisch, wenn Sie Gebäudedaten oder Bauteil-Stufen ändern. Die <b>★ Empfohlen</b>-Markierung zeigt Maßnahmen mit Score unter 10,5 €/kWh PE — besonders wirtschaftlich für Ihr Gebäude. <b>✕ Nicht empfohlen</b> kennzeichnet Maßnahmen mit Score über 20 €/kWh PE oder ohne messbaren Primärenergie-Effekt.
          </Sub>
          <Sub title="Wie werden die Förderungen berechnet?">
            <b>BEG EM (BAFA)</b>: 15 % Grundförderung auf den energetisch bedingten Mehraufwand (Investition minus Sowieso-Kosten). <b>Wärmepumpe (KfW 458)</b>: bis zu 50 % (30 % Grundförderung + 20 % Klimageschwindigkeits-Bonus möglich). <b>iSFP-Bonus</b>: +5 % auf alle Maßnahmen, die im Fahrplan hinterlegt sind — das ist der Kern des iSFP-Verfahrens.
          </Sub>
          <Sub title="Beispielrechnung — EFH Nachkriegszeit 1965">
            <pre style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11.5, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "var(--body)", margin: 0 }}>{`Haus: EFH 1965 · 145 m² · Heizöl · Klasse G  (PE 236 kWh/(m²·a))
IST-Heizkosten:  215 kWh/m² × 145 m² × 0,11 €/kWh (Heizöl) = 3.429 €/Jahr

Fahrplan Schritt 1 — Hydraulischer Abgleich (Heute):
  Investition 1.800 €  ·  Förderung BEG EM ca. 270 €  ·  PE −14 kWh/(m²·a)

Fahrplan Schritt 3 — Wärmepumpe (nach Dach- & Fensterdämmung):
  Endenergie sinkt auf 68 kWh/(m²·a) — Strom statt Öl (COP ~2,5)
  ZIEL-Heizkosten: 68 × 145 m² × 0,22 €/kWh (WP-Sondertarif) = 2.170 €/Jahr (−37 %)
  Investition 32.000 €  ·  Förderung KfW 458 bis 13.500 €

Gesamtfahrplan — alle 6 Maßnahmen:
  Primärenergie ZIEL  78 kWh/(m²·a)  →  Klasse C
  CO₂:  63 → 20 kg/(m²·a)  (−68 %)
  Investition 130.800 €  ·  Förderung ca. 21.000 €`}</pre>
          </Sub>
          <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--sec)", fontStyle: "italic", lineHeight: 1.6 }}>
            Alle Werte sind Richtwerte auf Basis realistischer Marktpreise und BEG-Konditionen Stand April 2026. Dieser Rechner ist ein Demonstrator und ersetzt keine zertifizierte iSFP-Beratung nach BAFA-Anforderungen.
          </div>
        </div>
      )}
    </div>
  );
};

// ═══ MAIN APP ══════════════════════════════════════════════════════════

export default function App() {
  const [presetId, setPresetId] = useState("efhNachkrieg");
  const [gebaeude, setGebaeude] = useState(PRESETS.efhNachkrieg.gebaeude);
  const [ist, setIst] = useState(PRESETS.efhNachkrieg.ist);
  const [bauteile, setBauteile] = useState(() => ableiteBauteile(
    PRESETS.efhNachkrieg.gebaeude.baujahr,
    PRESETS.efhNachkrieg.gebaeude.heizung_typ,
    PRESETS.efhNachkrieg.gebaeude.lueftung,
    PRESETS.efhNachkrieg.gebaeude.warmwasser,
  ));
  const [aktiveMassnahmen, setAktiveMassnahmen] = useState(() => {
    const bs = {};
    ableiteBauteile(
      PRESETS.efhNachkrieg.gebaeude.baujahr,
      PRESETS.efhNachkrieg.gebaeude.heizung_typ,
      PRESETS.efhNachkrieg.gebaeude.lueftung,
      PRESETS.efhNachkrieg.gebaeude.warmwasser,
    ).forEach(b => { bs[b.id] = b.note; });
    // intentional: uses raw MASSNAHMENPAKETE — effectivePakete (useMemo) doesn't exist during useState init
    return MASSNAHMENPAKETE.flatMap(p =>
      p.massnahmen
        .filter(m => Math.abs((m.impact ? m.impact(bs) : { primaerenergie_delta: m.primaerenergie_delta || 0 }).primaerenergie_delta) >= 3)
        .map(m => m.id)
    );
  });
  const [massnahmenOverrides, setMassnahmenOverrides] = useState({});
  const [wpVariante, setWpVariante] = useState("auto");
  const [extraction, setExtraction] = useState(null);
  const [sanierungsstandProBauteil, setSanierungsstandProBauteil] = useState(() =>
    sanierungsstandAusBauteile(ableiteBauteile(
      PRESETS.efhNachkrieg.gebaeude.baujahr,
      PRESETS.efhNachkrieg.gebaeude.heizung_typ,
      PRESETS.efhNachkrieg.gebaeude.lueftung,
      PRESETS.efhNachkrieg.gebaeude.warmwasser,
    ))
  );
  const [activeTab, setActiveTab] = useState("gebaeude");
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Scroll observer für sticky tabs
  useEffect(() => {
    const handler = () => {
      const scrollY = window.scrollY + 130;
      for (let i = TABS.length - 1; i >= 0; i--) {
        const el = document.getElementById(TABS[i].id);
        if (el && el.offsetTop <= scrollY) {
          setActiveTab(TABS[i].id);
          return;
        }
      }
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const updateGebaeude = useCallback((field, value) => {
    setGebaeude(prev => {
      const next = { ...prev, [field]: value };
      // Auto-derive Bauteile wenn baujahr/heizung/lueftung/warmwasser ändern
      if (["baujahr", "heizung_typ", "lueftung", "warmwasser"].includes(field)) {
        const neueBauteile = ableiteBauteile(next.baujahr, next.heizung_typ, next.lueftung, next.warmwasser);
        setBauteile(neueBauteile);
        setSanierungsstandProBauteil(sanierungsstandAusBauteile(neueBauteile));
      }
      return next;
    });
  }, []);

  const updateIst = useCallback((field, value) => {
    setIst(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateBauteilNote = useCallback((id, note) => {
    setBauteile(prev => {
      const next = prev.map(b => b.id === id ? bauteilMitAktualisierterNote(b, note) : b);
      setSanierungsstandProBauteil(sanierungsstandAusBauteile(next));
      return next;
    });
  }, []);

  const applyPreset = useCallback((id) => {
    const p = PRESETS[id];
    if (!p) return;
    const neueBauteile = ableiteBauteile(p.gebaeude.baujahr, p.gebaeude.heizung_typ, p.gebaeude.lueftung, p.gebaeude.warmwasser);
    if (p.bauteile_overrides) {
      neueBauteile.forEach(b => { if (p.bauteile_overrides[b.id] !== undefined) b.note = p.bauteile_overrides[b.id]; });
    }
    const bs = {};
    neueBauteile.forEach(b => { bs[b.id] = b.note; });
    const vt = vorlauftemperaturFuer(p.gebaeude.waermeverteilung);
    const fossil = /Heizöl|Erdgas|Fernwärme \(Gas/i.test(p.gebaeude.heizung_typ || "");
    // intentional: uses raw MASSNAHMENPAKETE — preset defaults must be override-independent
    const defaultAktive = MASSNAHMENPAKETE.flatMap(pkg =>
      pkg.massnahmen.filter(m => {
        // M7: nur aktivieren wenn VT > 50 °C (Hochtemperatur-Heizkörper).
        if (m.id === "M7") return vt > 50;
        // M4: immer aktivieren bei fossiler Heizung — Heizungstausch ist sinnvoll.
        if (m.id === "M4") return fossil;
        // Alle anderen Maßnahmen: nach PE-Wirkungsschwelle (>= 3 kWh/m²a).
        const imp = m.impact ? m.impact(bs) : { primaerenergie_delta: m.primaerenergie_delta || 0 };
        return Math.abs(imp.primaerenergie_delta) >= 3;
      }).map(m => m.id)
    );
    setPresetId(id);
    setGebaeude(p.gebaeude);
    setIst(p.ist);
    setBauteile(neueBauteile);
    setAktiveMassnahmen(defaultAktive);
    setMassnahmenOverrides({});
    setWpVariante("auto");
    setExtraction(null);
    setSanierungsstandProBauteil(sanierungsstandAusBauteile(neueBauteile));
  }, []);
  const applySanierungsstandFuerBauteil = useCallback((bauteilId, level) => {
    const stufen = SANIERUNGSSTAND_STUFEN[level];
    if (!stufen || stufen[bauteilId] === undefined) return;
    setBauteile(prev => prev.map(b => b.id === bauteilId ? bauteilMitAktualisierterNote(b, stufen[bauteilId]) : b));
    setSanierungsstandProBauteil(prev => ({ ...prev, [bauteilId]: level }));
  }, []);

  const fileInputRef = useRef(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const handleUpload = useCallback((result) => {
    if (result.gebaeude && Object.keys(result.gebaeude).length > 0) {
      setGebaeude(prev => {
        const next = { ...prev, ...result.gebaeude };
        const neueBauteile = ableiteBauteile(next.baujahr, next.heizung_typ, next.lueftung, next.warmwasser);
        setBauteile(neueBauteile);
        setSanierungsstandProBauteil(sanierungsstandAusBauteile(neueBauteile));
        return next;
      });
    }
    if (result.ist && Object.keys(result.ist).length > 0) {
      setIst(prev => ({ ...prev, ...result.ist }));
    }
    setPresetId(null);
    setExtraction(result);
  }, []);

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { setUploadError("Bitte PDF-Datei verwenden."); return; }
    setUploadError(null);
    setUploadLoading(true);
    try {
      const result = await extractFromPDF(file);
      result.fileName = file.name;
      handleUpload(result);
    } catch (e) {
      setUploadError("Datei konnte nicht gelesen werden: " + (e.message || "unbekannter Fehler"));
    } finally {
      setUploadLoading(false);
    }
  }, [handleUpload]);

  const scrollToTab = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 92;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  // Package toggle = "select all / deselect all" of its measures.
  // Off if any measure is active; turning on activates all measures of the package.
  const togglePaket = (id) => {
    const paket = dynamicPakete.find(p => p.id === id);
    if (!paket) return;
    const mIds = paket.massnahmen.map(m => m.id);
    const anyActive = mIds.some(mid => aktiveMassnahmen.includes(mid));
    setAktiveMassnahmen(prev => anyActive
      ? prev.filter(x => !mIds.includes(x))
      : [...prev.filter(x => !mIds.includes(x)), ...mIds]
    );
  };

  const toggleMassnahme = (mid) => {
    setAktiveMassnahmen(prev => prev.includes(mid)
      ? prev.filter(x => x !== mid)
      : [...prev, mid]
    );
  };

  const updateMassnahme = useCallback((id, field, value) => {
    setMassnahmenOverrides(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  }, []);

  const resetMassnahme = useCallback((id) => {
    setMassnahmenOverrides(prev => { const n = { ...prev }; delete n[id]; return n; });
  }, []);

  // ─── Derived values ──
  const bauteile_state = useMemo(() => {
    const bs = {};
    bauteile.forEach(b => { bs[b.id] = b.note; });
    return bs;
  }, [bauteile]);

  // When M7 (Heizkreisumbau) is active, treat verteilung as floor-heating level so M4's COP malus is lifted.
  const effectiveBauteilState = useMemo(() => {
    let state = { ...bauteile_state };
    if (aktiveMassnahmen.includes("M7")) state = { ...state, verteilung: 7 };
    const vt = vorlauftemperaturFuer(gebaeude.waermeverteilung);
    const envAvg = ((state.waende||2) + (state.dach||2)) / 2;
    let resolvedVariant = wpVariante === "auto" ? wpTypVarianteKey(vt, envAvg) : wpVariante;
    // Oil buildings: don't auto-select hybrid (avoids creating new fossil infrastructure)
    if (wpVariante === "auto" && resolvedVariant === "hybrid" && /Heizöl/i.test(gebaeude.heizung_typ || "")) {
      resolvedVariant = "monoenergetisch";
    }
    return { ...state, wpVariante: resolvedVariant, vorlauftemp: vt };
  }, [bauteile_state, aktiveMassnahmen, wpVariante, gebaeude.waermeverteilung, gebaeude.heizung_typ]);
  const resolvedWpVariante = effectiveBauteilState.wpVariante || "monovalent";

  useEffect(() => {
    const v = WP_VARIANTEN[resolvedWpVariante];
    if (!v) return;
    setMassnahmenOverrides(prev => ({
      ...prev,
      M4: { ...(prev.M4||{}), investition: v.investition, ohnehin_anteil: v.ohnehin_anteil, foerderquote: v.foerderquote },
    }));
  }, [resolvedWpVariante]);

  const effectivePakete = useMemo(() => {
    const allMerged = MASSNAHMENPAKETE.flatMap(p =>
      p.massnahmen.map(m => ({ ...m, ...(massnahmenOverrides[m.id] || {}) }))
    );
    const scored = bewerteMassnahmen(allMerged, effectiveBauteilState, gebaeude);
    const scoreMap = Object.fromEntries(scored.map(s => [s.id, s.score]));
    const pakete = MASSNAHMENPAKETE.map(p => {
      const sortedM = p.massnahmen
        .map(m => ({ ...m, ...(massnahmenOverrides[m.id] || {}) }))
        .sort((a, b) => (scoreMap[a.id] ?? Infinity) - (scoreMap[b.id] ?? Infinity));
      const bestScore = sortedM.length ? Math.min(...sortedM.map(m => scoreMap[m.id] ?? Infinity)) : Infinity;
      return { ...p, massnahmen: sortedM, _bestScore: bestScore };
    });
    const [p1, ...rest] = pakete; // P1 always first (Sofortmaßnahmen / hydraulischer Abgleich)
    const ordered = [p1, ...rest.sort((a, b) => a._bestScore - b._bestScore)];
    return ordered.map((p, idx) => ({ ...p, nummer: idx + 1 }));
  }, [massnahmenOverrides, effectiveBauteilState, gebaeude]);

  // M1 (Hydraulischer Abgleich) must be redone after WP install (BEG requirement).
  // Move it from P1 to the END of P3 so the install sequence reads: M7 → M4 → M1.
  const dynamicPakete = useMemo(() => {
    const m4Active = aktiveMassnahmen.includes("M4");
    if (!m4Active) return effectivePakete;

    const p1 = effectivePakete.find(p => p.id === "P1");
    const m1Measure = p1?.massnahmen.find(m => m.id === "M1");
    if (!m1Measure) return effectivePakete;

    const result = effectivePakete
      .filter(p => p.id !== "P1")  // Remove P1 (its only measure M1 moves)
      .map(p => {
        if (p.id === "P3") {
          return { ...p, massnahmen: [...p.massnahmen, { ...m1Measure, _isMovedAbgleich: true }] };
        }
        return p;
      });
    return result.map((p, idx) => ({ ...p, nummer: idx + 1 }));
  }, [effectivePakete, aktiveMassnahmen]);

  const aktivePakete = useMemo(() =>
    dynamicPakete.filter(p => p.massnahmen.some(m => aktiveMassnahmen.includes(m.id))).map(p => p.id),
    [dynamicPakete, aktiveMassnahmen]
  );

  const heizkosten = useMemo(
    () => berechneHeizkosten(ist.endenergie, gebaeude.wohnflaeche, gebaeude.heizung_typ),
    [ist.endenergie, gebaeude.wohnflaeche, gebaeude.heizung_typ]
  );
  const heizkostenWE = useMemo(() => gebaeude.wohneinheiten > 0 ? Math.round(heizkosten / gebaeude.wohneinheiten) : 0, [heizkosten, gebaeude.wohneinheiten]);
  const effizienzklasse = useMemo(() => berechneEffizienzklasse(ist.primaerenergie), [ist.primaerenergie]);
  const gebaeudeWithState = useMemo(() => ({ ...gebaeude, bauteile_state: effectiveBauteilState }), [gebaeude, effectiveBauteilState]);
  const k = useMemo(() => berechneNachMassnahmen(aktiveMassnahmen, ist, gebaeudeWithState, dynamicPakete), [aktiveMassnahmen, ist, gebaeudeWithState, dynamicPakete]);
  const kumuliert = useMemo(() => berechneKumuliert(aktiveMassnahmen, ist, gebaeudeWithState, dynamicPakete), [aktiveMassnahmen, ist, gebaeudeWithState, dynamicPakete]);
  const bewertung = useMemo(() =>
    bewerteMassnahmen(effectivePakete.flatMap(p => p.massnahmen), effectiveBauteilState, gebaeude),
    [effectivePakete, effectiveBauteilState, gebaeude]
  );
  const empfohleneMassnahmen      = useMemo(() => bewertung.filter(m => m.empfohlen).map(m => m.id),      [bewertung]);
  const nichtEmpfohleneMassnahmen = useMemo(() => bewertung.filter(m => m.nichtEmpfohlen).map(m => m.id), [bewertung]);
  const aktiveEmpfohleneMassnahmen = useMemo(() => empfohleneMassnahmen.filter(id => aktiveMassnahmen.includes(id)), [empfohleneMassnahmen, aktiveMassnahmen]);
  const reportSummaryPackages = useMemo(() => {
    return dynamicPakete.map((paket) => {
      const aktiveInPaket = paket.massnahmen.filter((m) => aktiveMassnahmen.includes(m.id));
      if (aktiveInPaket.length === 0) return null;
      const investition = aktiveInPaket.reduce((sum, m) => sum + m.investition, 0);
      const foerderung = aktiveInPaket.reduce((sum, m) => {
        const netto = m.investition - (m.ohnehin_anteil ?? 0);
        const klimaBonus = (m.id === "M4" && /Heizöl|Erdgas/i.test(gebaeude.heizung_typ || "")) ? 0.10 : 0;
        const quote = m.foerderquote > 0 ? Math.min(m.foerderquote + BEG_BONUS.isfp_bonus + klimaBonus, 0.5) : 0;
        return sum + netto * quote;
      }, 0);
      return { id: paket.id, nummer: paket.nummer, titel: paket.titel, farbe: paket.farbe, kosten: investition - foerderung, massnahmen_aktiv: aktiveInPaket.map(m => m.id), massnahmen_aktiv_obj: aktiveInPaket.map(m => ({ id: m.id, kurztitel: m.kurztitel || m.id })) };
    }).filter(Boolean);
  }, [dynamicPakete, aktiveMassnahmen, gebaeude]);

  const handleExport = () => {
    exportAsPDF();
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--txt)" }}>
      {/* Header mit Sticky-Tabs */}
      <header className="print-hide" style={{
        borderBottom: "1px solid var(--bdr)",
        background: darkMode ? "rgba(14,13,11,0.96)" : "rgba(248,245,239,0.96)",
        position: "sticky", top: 0, zIndex: 30,
        backdropFilter: "blur(8px)",
      }}>
        <div className="mx-auto max-w-[1400px] px-5 md:px-10" style={{ paddingTop: 14 }}>
          <div className="flex items-center justify-between gap-6 flex-wrap mb-3">
            <div className="flex items-center gap-3">
              <div style={{ color: "var(--acc)" }}><HouseIcon size={26} /></div>
              <div>
                <div className="font-serif" style={{ fontSize: 18, fontWeight: 500, color: "var(--txt)", lineHeight: 1.1 }}>
                  iSFP-Schnellcheck
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setDarkMode(d => !d)}
                title={darkMode ? "Zum hellen Modus" : "Zum dunklen Modus"}
                style={{ width: 34, height: 34, border: "1px solid var(--bdr)", borderRadius: 3,
                         background: "var(--surface)", color: "var(--sec)",
                         cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {darkMode ? "☀" : "☾"}
              </button>
              <button onClick={handleExport}
                style={{ padding: "9px 18px", background: "var(--txt)", color: "var(--bg)",
                         borderRadius: 3, fontSize: 13, fontWeight: 500, border: "none",
                         cursor: "pointer", transition: "background 0.12s" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--acc)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "var(--txt)"}>
                Als PDF exportieren →
              </button>
            </div>
          </div>
          <StickyTabs activeId={activeTab} onClick={scrollToTab} />
        </div>
      </header>

      {/* Print-Title (nur im PDF) */}
      <ISFPPrintReport ist={ist} k={k} heizkostenIst={heizkosten} aktivePakete={aktivePakete} aktiveMassnahmen={aktiveMassnahmen} gebaeude={gebaeude} kumuliert={kumuliert} effectivePakete={effectivePakete} />

      <main className="mx-auto max-w-[1400px] print-hide px-5 md:px-10" style={{ paddingTop: 36, paddingBottom: 80 }}>

        {/* 2-col layout on xl+: left=scrollable content, right=sticky Ergebnis sidebar */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:items-start">
        <div>


        {/* Preset-Picker */}
        <Section id="presets" eyebrow="Schnellstart">
          <Card style={{ padding: 20 }}>
            <div className="flex items-center justify-between gap-4 mb-5 print-hide">
              <h2 className="font-serif leading-[1.05]" style={{ fontSize: 22, fontWeight: 500, color: "var(--txt)" }}>
                Startpunkt wählen
              </h2>
            </div>
            <PresetPicker activeId={presetId} onPick={applyPreset}
              onUploadClick={() => fileInputRef.current?.click()}
              uploadLoading={uploadLoading} />
            <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }}
              onChange={(e) => { handleFileSelect(e.target.files?.[0]); e.target.value = ""; }} />
            {uploadError && (
              <div className="mt-3 text-[13px]" style={{ color: "#E30613" }}>{uploadError}</div>
            )}
            {extraction && (
              <div className="mt-3">
                <ExtractionResult result={extraction} onDismiss={() => setExtraction(null)} />
              </div>
            )}
          </Card>
        </Section>

        {/* Gebäude & Bestand */}
        <Section id="gebaeude" eyebrow="Schritt 1 · Erfassung" title="Ihr Gebäude heute"
          subtitle="Alle Felder editierbar — Änderungen wirken sofort auf Fahrplan und Ergebnis.">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <Card>
              <CardEyebrow>Stammdaten</CardEyebrow>
              <TextInput   label="Standort"             value={gebaeude.standort}            onChange={v => updateGebaeude("standort", v)} />
              <TextInput   label="Adresse"              value={gebaeude.strasse}             onChange={v => updateGebaeude("strasse", v)} />
              <TextInput   label="PLZ"                  value={gebaeude.plz}                 onChange={v => updateGebaeude("plz", v)} />
              <SelectInput label="Gebäudetyp"           value={gebaeude.typ}                 onChange={v => updateGebaeude("typ", v)} options={OPTIONS_GEBAEUDETYP} />
              <NumberInput label="Baujahr"              value={gebaeude.baujahr}             onChange={v => updateGebaeude("baujahr", v)} min={1700} max={2030}
                tooltip="Wird zur automatischen Ableitung der Bauteil-Noten verwendet (TABULA-Baualtersklassen)." />
              <NumberInput label="Wohneinheiten"        value={gebaeude.wohneinheiten}       onChange={v => updateGebaeude("wohneinheiten", v)} min={1} max={1000}
                tooltip="Hat keinen Einfluss auf die Energierechnung in dieser Demo. Wird für die Dokumentation im Bericht verwendet." />
              <NumberInput label="Wohnfläche"           value={gebaeude.wohnflaeche}         onChange={v => updateGebaeude("wohnflaeche", v)} unit="m²" min={20} />
              <NumberInput label="Gebäudenutzfläche AN" value={gebaeude.gebaeudenutzflaeche} onChange={v => updateGebaeude("gebaeudenutzflaeche", v)} unit="m²" min={20}
                tooltip="AN = beheizbare Nettogrundfläche nach DIN V 18599. Bezugsfläche für GEG-Kennzahlen (PE, CO₂). Faustregel: AN ≈ 1,2–1,4 × Wohnfläche." />
            </Card>

            <Card>
              <CardEyebrow>Anlagentechnik</CardEyebrow>
              <SelectInput label="Heizung"           value={gebaeude.heizung_typ} onChange={v => updateGebaeude("heizung_typ", v)} options={OPTIONS_HEIZUNG}
                tooltip="Bestimmt Primärenergiefaktor und Heizkosten-Tarif. Änderung setzt auch die Bauteil-Note 'Heizung' zurück." />
              <NumberInput label="Baujahr Heizung"   value={gebaeude.heizung_bj}  onChange={v => updateGebaeude("heizung_bj", v)} min={1950} max={2030} />
              <SelectInput label="Warmwasser"        value={gebaeude.warmwasser}  onChange={v => updateGebaeude("warmwasser", v)} options={OPTIONS_WARMWASSER} />
              <SelectInput label="Lüftung"           value={gebaeude.lueftung}    onChange={v => updateGebaeude("lueftung", v)} options={OPTIONS_LUEFTUNG}
                tooltip="WRG = Wärmerückgewinnung. Eine Lüftungsanlage mit WRG entzieht der Abluft Wärme und gibt sie an die Frischluft ab — spart 10–15 kWh/(m²·a) Primärenergie ggü. Fensterlüftung." />
              <SelectInput label="Erneuerbare"       value={gebaeude.erneuerbare} onChange={v => updateGebaeude("erneuerbare", v)} options={OPTIONS_ERNEUERBARE}
                tooltip="Wird automatisch vorgeschlagen, wenn Heizung auf Wärmepumpe oder Pellets steht. Manuelle Überschreibung möglich." />
              <SelectInput label="Dach"              value={gebaeude.dach}        onChange={v => updateGebaeude("dach", v)} options={OPTIONS_DACH} />
              <SelectInput label="Keller"            value={gebaeude.keller}      onChange={v => updateGebaeude("keller", v)} options={OPTIONS_KELLER} />
              <SelectInput label="Wärmeverteilung"   value={gebaeude.waermeverteilung || OPTIONS_WAERMEVERTEILUNG[0]} onChange={v => updateGebaeude("waermeverteilung", v)} options={OPTIONS_WAERMEVERTEILUNG}
                tooltip="Bestimmt Vorlauftemperatur und empfohlene WP-Betriebsart (Monovalent / Monoenergetic / Bivalent)." />
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: "var(--sec)", marginBottom: 6, fontFamily: "'Geist Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Sanierungsstand Hülle
                  
                </div>
                <div>
                  {SANIERUNGSSTAND_BAUTEILE.map(({ id, label }) => {
                    const selVal = sanierungsstandProBauteil[id] || "unsaniert";
                    const selNote = SANIERUNGSSTAND_OPTIONS.find(o => o.value === selVal)?.note;
                    return (
                      <div key={id}>
                        <SelectInput
                          label={label}
                          value={selVal}
                          onChange={v => applySanierungsstandFuerBauteil(id, v)}
                          options={SANIERUNGSSTAND_OPTIONS}
                          tooltip={SANIERUNGSSTAND_BAUTEIL_TOOLTIPS[id]}
                        />
                        {selNote && <div style={{ fontSize: 10, color: "var(--sec)", paddingLeft: 12, marginTop: 3, marginBottom: 6 }}>{selNote}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card>
              <CardEyebrow>Energie­kennzahlen (Ist)</CardEyebrow>
              <NumberInput label="Endenergie"       value={ist.endenergie}     onChange={v => updateIst("endenergie", v)} unit="kWh/(m²·a)" min={0} max={600}
                tooltip="Die dem Gebäude zugeführte Energie. Basis für Heizkosten-Berechnung." />
              <NumberInput label="Primärenergie"    value={ist.primaerenergie} onChange={v => updateIst("primaerenergie", v)} unit="kWh/(m²·a)" min={0} max={700}
                tooltip="Berücksichtigt die 'Vorkette' (Energieträger-Gewinnung, Transport). Basis für die Effizienzklasse nach GEG §86." />
              <NumberInput label="CO₂-Emissionen"   value={ist.co2}            onChange={v => updateIst("co2", v)} unit="kg/(m²·a)" min={0} max={200} step={0.1} />
              <div className="flex items-center justify-between gap-3" style={{ padding: "9px 0", borderBottom: "1px solid var(--div)", minHeight: 38 }}>
                <span className="flex items-center gap-1.5" style={labelStyle}>
                  Effizienzklasse
                  <span style={{ color: "var(--acc)" }} title="Automatisch berechnet"><SparkleIcon size={11} /></span>
                  <Tooltip content="Nach iSFP-Bewertungsschema aus Primärenergie (nicht Endenergie!)."><span style={{ color: "var(--acc)" }}><InfoIcon /></span></Tooltip>
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: EFFIZIENZ_FARBEN[effizienzklasse] || "#6B6259", color: ["C","D","E"].includes(effizienzklasse) ? "#1E1A15" : "#FFF", borderRadius: 3, fontSize: 15, fontWeight: 600, width: 34, height: 28, fontFamily: "'Fraunces', serif" }}>{effizienzklasse}</span>
              </div>
              <ComputedRow label="Heizkosten gesamt"   value={fmt(heizkosten)}   unit="€/a"
                tooltip={`${ist.endenergie} kWh/m² × ${gebaeude.wohnflaeche} m² × ${preisFuerHeizung(gebaeude.heizung_typ).toFixed(2)} €/kWh (${traegerFuerHeizung(gebaeude.heizung_typ)}) = ${fmt(heizkosten)} €/Jahr`} />
            </Card>
          </div>
        </Section>

        {/* Energetischer Zustand — Bauteile */}
        <Section id="bauteile" eyebrow="Energetischer Zustand" title="Bauteilbewertung"
          subtitle="Noten 1 (rot, sehr schlecht) bis 7 (grün, sehr gut) — pro Bauteil mit benannten Stufen. Defaults werden aus Baujahr und Anlagentechnik abgeleitet, sind aber manuell anpassbar.">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[11px]" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace", letterSpacing: "0.15em", textTransform: "uppercase" }}>sehr schlecht</span>
            <div style={{ flex: 1, height: 6, borderRadius: 100, background: "linear-gradient(to right, #E30613, #E3501C, #F07D00, #F6A400, #C5D62E, #34A030, #00843D)" }} />
            <span className="text-[11px]" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace", letterSpacing: "0.15em", textTransform: "uppercase" }}>sehr gut</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {bauteile.map(b => <BauteilKachel key={b.id} bauteil={b} onNoteChange={updateBauteilNote} />)}
          </div>
        </Section>

        {/* Fahrplan */}
        <Section id="fahrplan" eyebrow="Schritt 2 · Fahrplan" title="Empfohlene Maßnahmenpakete"
          subtitle="Reihenfolge nach Kosten-Nutzen (€/kWh Primärenergie). ★ = Score &lt; 10,5 €/kWh (empfohlen); ✕ = Score &gt; 20 €/kWh oder kein PE-Effekt.">
          {(() => {
            const totalCols = dynamicPakete.length + 2;
            const lineOffset = `${50 / totalCols}%`;
            return (
              <div className="mb-10" style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${totalCols}, 1fr)`, gap: 0 }}>
                <div className="absolute" style={{ left: lineOffset, right: lineOffset, top: 24, height: 2, background: "linear-gradient(to right, #E30613, #F07D00, #7C3AED, #F6D400, #00843D, #2563EB)", pointerEvents: "none" }} />
                <div className="flex flex-col items-center gap-1.5 relative">
                  <div style={{ width: 46, height: 50, background: EFFIZIENZ_FARBEN[effizienzklasse] || "#6B6259", borderRadius: 3, border: "1.5px solid #1E1A15", display: "flex", alignItems: "center", justifyContent: "center" }}><span className="font-serif text-[16px]" style={{ color: ["C","D","E"].includes(effizienzklasse) ? "#1E1A15" : "#FFF" }}>{effizienzklasse}</span></div>
                  <div className="text-[9px] tracking-[0.18em] uppercase text-center" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>Heute</div>
                  <div className="text-[10px]" style={{ color: "var(--body)" }}>Kl. {effizienzklasse}</div>
                </div>
                {dynamicPakete.map(p => (
                  <div key={p.id} className="flex flex-col items-center gap-1.5 relative" style={{ opacity: aktivePakete.includes(p.id) ? 1 : 0.3 }}>
                    <button className="print-hide" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "block" }}
                      onClick={() => document.getElementById(`paket-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      title={`Zu Paket ${p.nummer}: ${p.titel} springen`}>
                      <PaketHaus farbe={p.farbe} aktiv={aktivePakete.includes(p.id)} nummer={p.nummer} size={48} />
                    </button>
                    <div className="text-[10px] text-center leading-tight px-0.5" style={{ color: "var(--body)", maxWidth: "100%" }}>{p.titel}</div>
                  </div>
                ))}
                <div className="flex flex-col items-center gap-1.5 relative">
                  <div style={{ width: 46, height: 50, background: EFFIZIENZ_FARBEN[k.effizienzklasse] || "#00843D", borderRadius: 3, border: "1.5px solid #1E1A15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="font-serif text-[16px]" style={{ color: ["B","C","D"].includes(k.effizienzklasse) ? "#1E1A15" : "#FFF" }}>{k.effizienzklasse}</span>
                  </div>
                  <div className="text-[9px] tracking-[0.18em] uppercase text-center" style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>Ziel</div>
                  <div className="text-[10px]" style={{ color: "var(--body)" }}>Kl. {k.effizienzklasse}</div>
                </div>
              </div>
            );
          })()}

          <div className="space-y-5">
            {dynamicPakete.map(p => (
              <PaketBlock key={p.id} paket={p} aktiv={aktivePakete.includes(p.id)} onToggle={() => togglePaket(p.id)}
                onToggleMassnahme={toggleMassnahme}
                aktiveMassnahmen={aktiveMassnahmen}
                empfohleneMassnahmen={empfohleneMassnahmen}
                nichtEmpfohleneMassnahmen={nichtEmpfohleneMassnahmen}
                gebaeude={gebaeude}
                bauteile_state={effectiveBauteilState}
                wpVariante={wpVariante}
                resolvedWpVariante={resolvedWpVariante}
                onWpVarianteChange={setWpVariante} />
            ))}
          </div>
        </Section>

        {/* Ergebnis section — inside left column so sidebar stays visible throughout */}
        <Section id="ergebnis" eyebrow="Schritt 3 · Ergebnis" title="Ihr Gebäude nach der Sanierung"
          subtitle="Alle Kennzahlen, Einsparungen und Förderungen im Überblick. Kumulierte Wirkung nach BAFA-Logik: jedes Paket baut auf dem vorigen auf.">
          {/* VorherNachher: hidden on screen (sidebar on lg+, drawer on mobile); kept for print */}
          <div className="hidden print:block">
            <VorherNachher ist={ist} k={k} heizkostenIst={heizkosten} gebaeude={gebaeude} />
            <div className="mt-10">
              <h3 className="font-serif mb-4" style={{ fontSize: 22, fontWeight: 500, color: "var(--txt)" }}>Einsparungen im Überblick</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <DeltaKPI label="Endenergie" vorher={ist.endenergie} nachher={k.endenergie} unit="kWh/(m²·a)" />
                <DeltaKPI label="CO₂-Emissionen" vorher={ist.co2} nachher={k.co2} unit="kg/(m²·a)" />
                <DeltaKPI label="Heizkosten" vorher={heizkosten} nachher={k.heizkosten_gesamt} unit="€/a" />
              </div>
            </div>
          </div>

          <div className="mt-10">
            <h3 className="font-serif mb-4" style={{ fontSize: 22, fontWeight: 500, color: "var(--txt)" }}>Schritt-für-Schritt-Wirkung</h3>
            <EekArrowScale
              istKlasse={effizienzklasse}
              zielKlasse={k.effizienzklasse}
              istPe={`${ist.primaerenergie} kWh`}
              zielPe={`${k.primaerenergie} kWh`}
            />
            <MergedTable kumuliert={kumuliert} ist={ist} />
          </div>

          <EnergieVerlaufChart ist={ist} kumuliert={kumuliert} />

          <div className="mt-10">
            <div style={{ background: "var(--surface2)", border: "1.25px solid var(--bdr)", borderRadius: 3, padding: "20px 24px" }}>
              <div className="text-[11px] tracking-[0.22em] uppercase mb-3" style={{ color: "var(--acc)", fontFamily: "'Geist Mono', monospace" }}>Förderannahmen dieser Demo</div>
              <div className="text-[12px] leading-relaxed mb-4" style={{ color: "var(--sec)" }}>
                Diese Vorabschätzung nutzt vereinfachte Förderannahmen je Maßnahmentyp. Die konkrete Förderung wird in der Maßnahmenübersicht und Kostenaufstellung je Paket berücksichtigt.
              </div>
              <div className="space-y-2 mb-4">
                {[
                  ["Gebäudehülle · Fenster · Optimierung", "BEG EM + iSFP-Bonus (Demo-Logik)"],
                  ["Heizungstausch · Wärmepumpe", "vereinfachte KfW-/BEG-Annahme"],
                  ["PV · Eigenstrom", "kein Direktzuschuss in dieser Demo"],
                ].map(([cat, note], i) => (
                  <div key={i} style={{ paddingBottom: 8, borderBottom: "1px solid var(--bdr)" }}>
                    <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--txt)", marginBottom: 1 }}>{cat}</div>
                    <div style={{ fontSize: 11, color: "var(--sec)", fontFamily: "'Geist Mono', monospace" }}>{note}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--txt)" }}>Förderanteil (von Gesamtinvestition)</span>
                <span style={{ fontSize: 20, fontFamily: "'Fraunces', serif", color: "var(--pos)", fontVariantNumeric: "tabular-nums" }}>
                  {k.invest_gesamt > 0
                    ? `${Math.round(k.foerderung_gesamt / k.invest_gesamt * 100)} %`
                    : "—"}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--sec)", lineHeight: 1.5 }}>
                Keine Förderzusage. Förderdeckel, Eigentümerstatus, Bonuskombinationen, technische Mindestanforderungen und Antragspflichten müssen im echten Prozess geprüft werden.
              </div>
            </div>
          </div>

          <MassnahmenEditor overrides={massnahmenOverrides} onUpdate={updateMassnahme} onReset={resetMassnahme} />

          <WieFunktioniertSection />
        </Section>

        </div>{/* end left column */}

        {/* Sidebar — sticky right column on lg+; hidden on mobile (replaced by MobileResultsDrawer) */}
        <aside className="hidden lg:block print:hidden lg:sticky lg:top-[92px] lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto"
               style={{ scrollbarWidth: "thin", paddingBottom: 24 }}>
          <div className="text-[9.5px] tracking-[0.18em] uppercase mb-3"
               style={{ color: "var(--acc)", fontFamily: "'Geist Mono', monospace" }}>Ergebnis · Live</div>

          {/* EEK comparison */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, background: "var(--surface)", border: "1.25px solid var(--bdr)", borderRadius: 3,
                          padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--sec)",
                            fontFamily: "'Geist Mono', monospace", textTransform: "uppercase", marginBottom: 6 }}>Heute</div>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: 36, height: 36, background: EFFIZIENZ_FARBEN[effizienzklasse] || "#6B6259",
                            borderRadius: 3, fontSize: 18, fontWeight: 600, fontFamily: "'Fraunces', serif",
                            color: ["C","D","E"].includes(effizienzklasse) ? "#1E1A15" : "#FFF" }}>{effizienzklasse}</div>
            </div>
            <span style={{ fontSize: 22, color: "var(--acc)", flexShrink: 0 }}>→</span>
            <div style={{ flex: 1, background: EFFIZIENZ_FARBEN[k.effizienzklasse] || "#00843D",
                          border: "1.25px solid #1E1A15", borderRadius: 3, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 9, letterSpacing: "0.2em", fontFamily: "'Geist Mono', monospace",
                            textTransform: "uppercase", marginBottom: 6,
                            color: ["B","C","D"].includes(k.effizienzklasse) ? "rgba(30,26,21,0.6)" : "rgba(248,245,239,0.7)" }}>Ziel</div>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: 36, height: 36, background: "var(--bg)",
                            borderRadius: 3, fontSize: 18, fontWeight: 600, fontFamily: "'Fraunces', serif",
                            color: EFFIZIENZ_FARBEN[k.effizienzklasse] || "#00843D" }}>{k.effizienzklasse}</div>
            </div>
          </div>

          {/* KPI Scorecards 2×2 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            {[
              { label: "Primärenergie", istVal: ist.primaerenergie, zielVal: k.primaerenergie, unit: "kWh/(m²·a)", posColor: "var(--pos)" },
              { label: "Endenergie",    istVal: ist.endenergie,     zielVal: k.endenergie,     unit: "kWh/(m²·a)", posColor: "var(--pos)" },
              { label: "CO₂",          istVal: ist.co2,            zielVal: k.co2,            unit: "kg/(m²·a)",  posColor: "var(--pos)" },
              { label: "Heizkosten",   istVal: heizkosten,          zielVal: k.heizkosten_gesamt, unit: "€/a",    posColor: "var(--gold)" },
            ].map(({ label, istVal, zielVal, unit, posColor }) => {
              const pct = istVal > 0 ? Math.round(Math.abs(zielVal - istVal) / istVal * 100) : 0;
              const down = zielVal < istVal;
              const fill = istVal > 0 ? Math.round(Math.min(zielVal / istVal, 1) * 100) : 0;
              const fmtV = n => unit === "€/a" ? fmtEur(n) : new Intl.NumberFormat("de-DE").format(Math.round(n));
              const barColor = down ? posColor : "var(--neg)";
              return (
                <div key={label} style={{ background: "var(--surface)", border: "1.25px solid var(--bdr)",
                                          borderRadius: 3, padding: "10px 11px" }}>
                  <div style={{ fontSize: 8, fontFamily: "'Geist Mono', monospace", letterSpacing: "0.14em",
                                textTransform: "uppercase", color: "var(--sec)", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 19, fontWeight: 600, fontFamily: "'Geist Mono', monospace",
                                color: down ? posColor : "var(--neg)", marginBottom: 4, lineHeight: 1 }}>
                    {down ? "−" : "+"}{pct}%
                  </div>
                  <div style={{ height: 4, background: "var(--div)", borderRadius: 2, overflow: "hidden", marginBottom: 4 }}>
                    <div style={{ height: "100%", width: `${fill}%`, background: barColor, borderRadius: 2, transition: "width 0.3s" }} />
                  </div>
                  <div style={{ fontSize: 8.5, fontFamily: "'Geist Mono', monospace", color: "var(--sec)", lineHeight: 1.3 }}>
                    {fmtV(istVal)} → {fmtV(zielVal)} {unit}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paket-Übersicht */}
          <div style={{ background: "var(--surface)", border: "1.25px solid var(--bdr)", borderRadius: 3, padding: "10px 12px", marginBottom: 10 }}>
            <div className="text-[10.5px] tracking-[0.18em] uppercase mb-2" style={{ color: "var(--acc)", fontFamily: "'Geist Mono', monospace" }}>Paket-Übersicht</div>
            {reportSummaryPackages.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--sec)" }}>Noch keine Maßnahmen aktiv.</div>
            ) : reportSummaryPackages.map((pkg, idx) => (
              <div key={pkg.id} style={{ padding: "8px 0", borderBottom: idx < reportSummaryPackages.length - 1 ? "1px solid var(--div)" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: PAKET_FARBEN[pkg.farbe]?.bg || "#6B6259", display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: "var(--txt)", fontWeight: 500 }}>Paket {pkg.nummer} · {pkg.titel}</span>
                  </div>
                  <span style={{ fontSize: 10.5, fontFamily: "'Geist Mono', monospace", flexShrink: 0 }}>{fmtEur(pkg.kosten)}</span>
                </div>
                <div style={{ paddingLeft: 16 }}>
                  {pkg.massnahmen_aktiv_obj.map(m => {
                    const istEmpf = empfohleneMassnahmen.includes(m.id);
                    const istNichtEmpf = nichtEmpfohleneMassnahmen.includes(m.id) && !istEmpf;
                    const warum = getWarum(m.id, {
                      bauteile_state: effectiveBauteilState, gebaeude, aktiveMassnahmen,
                      empfohlen: istEmpf, nichtEmpfohlen: istNichtEmpf,
                    });
                    return (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 22, marginBottom: 1 }}>
                        <span
                          onClick={() => scrollToTab(`paket-${pkg.id}`)}
                          style={{ fontSize: 11, color: "var(--body)", cursor: "pointer", flex: 1 }}
                          onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                          onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                        >{m.kurztitel}</span>
                        {istEmpf && (
                          <Tooltip content={<span><b>Warum empfohlen:</b><br />{warum.grund}</span>}>
                            <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 2, background: "#F6D400", color: "var(--txt)", fontFamily: "'Geist Mono', monospace", fontWeight: 600, flexShrink: 0 }}>★</span>
                          </Tooltip>
                        )}
                        {istNichtEmpf && (
                          <Tooltip content={<span><b>Wirtschaftlichkeit gering:</b><br />{warum.jetzt}</span>}>
                            <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 2, background: "var(--div)", color: "var(--sec)", fontFamily: "'Geist Mono', monospace", fontWeight: 600, flexShrink: 0 }}>✕</span>
                          </Tooltip>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Investment summary */}
          <div style={{ background: "var(--bg)", border: "1px solid var(--bdr)",
                        borderRadius: 3, padding: "10px 12px", fontSize: 12 }}>
            <div className="flex justify-between mb-1.5" style={{ color: "var(--body)" }}>
              <span>Investition</span>
              <span style={{ fontFamily: "'Geist Mono', monospace" }}>{fmtEur(k.invest_gesamt)}</span>
            </div>
            <div className="flex justify-between mb-1.5" style={{ color: "var(--pos)" }}>
              <span>Förderung</span>
              <span style={{ fontFamily: "'Geist Mono', monospace" }}>−{fmtEur(k.foerderung_gesamt)}</span>
            </div>
            <div className="flex justify-between font-medium"
                 style={{ color: "var(--txt)", marginTop: 4, paddingTop: 6, borderTop: "1px solid var(--bdr)" }}>
              <span>Eigenanteil</span>
              <span style={{ fontFamily: "'Geist Mono', monospace" }}>{fmtEur(k.eigenanteil)}</span>
            </div>
          </div>

        </aside>

        </div>{/* end 2-col grid */}

      </main>

      <MobileResultsDrawer
        effizienzklasse={effizienzklasse}
        k={k}
        ist={ist}
        heizkosten={heizkosten}
        aktiveEmpfohleneMassnahmen={aktiveEmpfohleneMassnahmen}
        empfohleneMassnahmen={empfohleneMassnahmen}
        nichtEmpfohleneMassnahmen={nichtEmpfohleneMassnahmen}
        reportSummaryPackages={reportSummaryPackages}
        scrollToTab={scrollToTab}
        effectiveBauteilState={effectiveBauteilState}
        gebaeude={gebaeude}
        aktiveMassnahmen={aktiveMassnahmen}
      />

      <footer className="print-hide px-5 md:px-10" style={{ borderTop: "1px solid var(--bdr)", paddingTop: 32, paddingBottom: 32, marginTop: 40 }}>
        <div className="mx-auto max-w-[1400px] flex items-center justify-between flex-wrap gap-4 text-[11.5px]"
             style={{ color: "var(--sec)", fontFamily: "'Geist Mono', monospace", letterSpacing: "0.05em" }}>
          <span>Demonstrator · keine rechtsverbindliche Energieberatung</span>
          <span>Stand April 2026 · BEG + GEG · TABULA-Baseline</span>
        </div>
      </footer>

      {/* Print-Footer */}
      <div className="print-only" style={{ padding: "24px 40px", borderTop: "1px solid var(--bdr)", fontSize: 10, color: "var(--sec)", fontFamily: "'Geist Mono', monospace", textAlign: "center" }}>
        Demonstrator — kein BAFA-iSFP. Stand April 2026.
      </div>
    </div>
  );
}
