import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import {
  PRESETS, ableiteBauteile,
  OPTIONS_GEBAEUDETYP, OPTIONS_HEIZUNG, OPTIONS_DACH, OPTIONS_KELLER,
  OPTIONS_LUEFTUNG, OPTIONS_WARMWASSER, OPTIONS_ERNEUERBARE, BAUTEIL_STUFEN,
  MASSNAHMENPAKETE, BEG_BONUS,
  berechneNachMassnahmen, berechneKumuliert, berechneEffizienzklasse, berechneHeizkosten,
  EFFIZIENZ_FARBEN, NOTE_FARBEN, PAKET_FARBEN,
} from "./data.js";
import { extractFromPDF } from "./pdfExtract.js";
import { exportAsPDF } from "./printExport.js";

// ═══ HELPERS ════════════════════════════════════════════════════════════
const fmt = (n) => new Intl.NumberFormat("de-DE").format(Math.round(n));
const fmtEur = (n) => fmt(n) + " €";

// ═══ ICONS ══════════════════════════════════════════════════════════════
const MFHIcon = ({ size = 24, color = "currentColor" }) => (
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
    <svg width={size} height={size * 1.05} viewBox="0 0 80 84" style={{ opacity: aktiv ? 1 : 0.28 }}>
      <path d="M8 72 L8 36 L40 12 L72 36 L72 72 Z" fill={f.bg} stroke="#1E1A15" strokeWidth="1.5" strokeLinejoin="round"/>
      <text x="40" y="56" textAnchor="middle" fontFamily="'Fraunces', serif" fontSize="26" fontWeight="500" fill={f.text}>{nummer}</text>
    </svg>
  );
};

// ═══ TOOLTIP ═══════════════════════════════════════════════════════════
const Tooltip = ({ content, children }) => {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "help" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      onClick={() => setShow(s => !s)}>
      {children}
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
          transform: "translateX(-50%)", zIndex: 100,
          background: "#1E1A15", color: "#F8F5EF",
          padding: "10px 14px", borderRadius: 3, fontSize: 12,
          lineHeight: 1.5, width: 280, textAlign: "left",
          boxShadow: "0 4px 18px rgba(30,26,21,0.25)", fontWeight: 400,
          pointerEvents: "none",
        }}>
          {content}
          <span style={{ position: "absolute", top: "100%", left: "50%",
            transform: "translateX(-50%)", width: 0, height: 0,
            borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderTop: "6px solid #1E1A15" }} />
        </span>
      )}
    </span>
  );
};

// ═══ EDITABLE INPUTS ═══════════════════════════════════════════════════
const labelStyle = { color: "#3A332B", fontSize: 13 };
const valueStyle = {
  fontFamily: "'Geist Mono', ui-monospace, monospace",
  fontVariantNumeric: "tabular-nums", color: "#1E1A15", fontSize: 14,
};

const RowShell = ({ children }) => (
  <div className="flex items-baseline justify-between gap-3"
       style={{ padding: "9px 0", borderBottom: "1px solid #E2DBD0", minHeight: 38 }}>
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
        {tooltip && <Tooltip content={tooltip}><span style={{ color: "#B5623E" }}><InfoIcon /></span></Tooltip>}
      </span>
      <span className="flex items-baseline gap-1.5">
        <input type="text" inputMode="decimal" value={local}
          onChange={(e) => setLocal(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          style={{ ...valueStyle, background: "transparent", border: "none",
                   borderBottom: "1px dotted #D3CAB9", outline: "none",
                   textAlign: "right", width: 92, padding: "2px 2px", fontSize: 14 }} />
        {unit && <span style={{ fontSize: 12, color: "#6B6259" }}>{unit}</span>}
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
    <span style={labelStyle} className="flex items-center gap-1.5">
      {label}
      {tooltip && <Tooltip content={tooltip}><span style={{ color: "#B5623E" }}><InfoIcon /></span></Tooltip>}
    </span>
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}
      style={{ ...valueStyle, background: "transparent",
               border: "1px solid #D3CAB9", borderRadius: 2,
               padding: "4px 26px 4px 8px", appearance: "none",
               backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%236B6259' fill='none' stroke-width='1.2'/></svg>\")",
               backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
               cursor: "pointer", outline: "none", fontSize: 13, maxWidth: 220 }}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </RowShell>
);

const ComputedRow = ({ label, value, unit, tooltip }) => (
  <div className="flex items-baseline justify-between gap-3"
       style={{ padding: "9px 0", borderBottom: "1px solid #E2DBD0", minHeight: 38 }}>
    <span className="flex items-center gap-1.5" style={labelStyle}>
      {label}
      <span style={{ color: "#B5623E" }} title="Automatisch berechnet"><SparkleIcon size={11} /></span>
      {tooltip && <Tooltip content={tooltip}><span style={{ color: "#B5623E" }}><InfoIcon /></span></Tooltip>}
    </span>
    <span className="text-right" style={valueStyle}>
      {value}{unit && <span style={{ fontSize: 12, color: "#6B6259", marginLeft: 4 }}>{unit}</span>}
    </span>
  </div>
);

// ═══ LAYOUT SHELLS ═════════════════════════════════════════════════════
const Section = ({ id, eyebrow, title, subtitle, children }) => (
  <section id={id} className="mb-16" style={{ scrollMarginTop: 92 }}>
    {eyebrow && (
      <div className="text-[11px] tracking-[0.22em] uppercase mb-3" style={{ color: "#B5623E", fontFamily: "'Geist Mono', monospace" }}>
        {eyebrow}
      </div>
    )}
    {title && (
      <h2 className="font-serif leading-[1.05] mb-3" style={{ fontSize: 32, fontWeight: 400, color: "#1E1A15", letterSpacing: "-0.01em" }}>
        {title}
      </h2>
    )}
    {subtitle && (
      <p className="max-w-2xl text-[15px] leading-relaxed mb-8" style={{ color: "#3A332B" }}>
        {subtitle}
      </p>
    )}
    {children}
  </section>
);

const Card = ({ children, style }) => (
  <div style={{ background: "#FFFFFF", border: "1.25px solid #D3CAB9", borderRadius: 3, padding: 24, ...style }}>
    {children}
  </div>
);

const CardEyebrow = ({ children }) => (
  <div className="text-[11px] tracking-[0.22em] uppercase mb-4"
       style={{ color: "#B5623E", fontFamily: "'Geist Mono', monospace" }}>
    {children}
  </div>
);

const KPI = ({ label, value, unit, big = false, style, tooltip }) => (
  <div style={style}>
    <div className="text-[11px] tracking-[0.2em] uppercase mb-2 flex items-center gap-1.5"
         style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>
      {label}
      {tooltip && <Tooltip content={tooltip}><span style={{ color: "#B5623E" }}><InfoIcon size={11} /></span></Tooltip>}
    </div>
    <div className="flex items-baseline gap-1.5">
      <span className="font-serif leading-none"
        style={{ fontSize: big ? 48 : 30, fontWeight: 400, color: "#1E1A15",
                 fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
      {unit && <span className="text-[13px]" style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>{unit}</span>}
    </div>
  </div>
);

// ═══ PRESET PICKER ═════════════════════════════════════════════════════
const PresetPicker = ({ activeId, onPick }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
    {Object.values(PRESETS).map(p => {
      const active = activeId === p.id;
      return (
        <button key={p.id} onClick={() => onPick(p.id)}
          className="print-hide"
          style={{
            padding: "16px 20px", textAlign: "left",
            background: active ? "#1E1A15" : "#FFFFFF",
            color: active ? "#F8F5EF" : "#1E1A15",
            border: active ? "1.5px solid #1E1A15" : "1.25px solid #D3CAB9",
            borderRadius: 3, cursor: "pointer", transition: "all 0.12s",
          }}
          onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = "#B5623E"; }}
          onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = "#D3CAB9"; }}
        >
          <div className="text-[10.5px] tracking-[0.2em] uppercase mb-1.5"
               style={{ color: active ? "#F6A400" : "#B5623E", fontFamily: "'Geist Mono', monospace" }}>
            Preset
          </div>
          <div className="font-serif text-[17px] leading-tight mb-1" style={{ fontWeight: 500 }}>
            {p.label}
          </div>
          <div className="text-[12px]" style={{ color: active ? "rgba(248,245,239,0.75)" : "#6B6259" }}>
            {p.beschreibung}
          </div>
        </button>
      );
    })}
  </div>
);

// ═══ UPLOAD ZONE ═══════════════════════════════════════════════════════
const UploadZone = ({ onUpload, extraction, onDismiss }) => {
  const [hover, setHover] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Bitte PDF-Datei verwenden.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await extractFromPDF(file);
      result.fileName = file.name;
      onUpload(result);
    } catch (e) {
      setError("Datei konnte nicht gelesen werden: " + (e.message || "unbekannter Fehler"));
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setHover(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }, []);

  if (extraction) {
    return <ExtractionResult result={extraction} onDismiss={onDismiss} />;
  }

  return (
    <div className="print-hide">
      <div
        onDragOver={(e) => { e.preventDefault(); setHover(true); }}
        onDragLeave={() => setHover(false)}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current?.click()}
        style={{
          border: `1.5px dashed ${hover ? "#B5623E" : "#D3CAB9"}`,
          background: hover ? "#F1EDE4" : "#F8F5EF",
          padding: "22px 24px", borderRadius: 3,
          cursor: loading ? "wait" : "pointer", transition: "all 0.15s",
        }}
      >
        <div className="flex items-start gap-4">
          <div style={{ color: hover ? "#B5623E" : "#6B6259", marginTop: 2 }}>
            <UploadIcon />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[14.5px] font-medium" style={{ color: "#1E1A15" }}>
                {loading ? "Dokument wird ausgelesen …" : "Energieausweis als PDF hochladen"}
              </span>
              <span className="text-[10px] tracking-[0.18em] uppercase px-1.5 py-0.5"
                style={{ color: "#B5623E", border: "1px solid #B5623E", borderRadius: 100,
                         fontFamily: "'Geist Mono', monospace", letterSpacing: "0.1em" }}>
                funktional
              </span>
            </div>
            <div className="text-[13px]" style={{ color: "#3A332B" }}>
              PDF hineinziehen oder klicken. Stammdaten, Kennzahlen und Anlagentechnik werden automatisch ausgelesen und in die Felder unten übernommen.
            </div>
            {error && <div className="text-[12.5px] mt-2" style={{ color: "#E30613" }}>{error}</div>}
          </div>
        </div>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf"
          onChange={(e) => handleFile(e.target.files?.[0])} style={{ display: "none" }} />
      </div>
    </div>
  );
};

const ExtractionResult = ({ result, onDismiss }) => {
  const matchedCount = result.matched.length;
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
            <span className="text-[14.5px] font-medium" style={{ color: "#1E1A15" }}>
              {matchedCount > 0
                ? `${matchedCount} Felder aus ${result.fileName} übernommen`
                : `Aus ${result.fileName} konnten keine Standardfelder erkannt werden`}
            </span>
          </div>
          {matchedCount > 0 && (
            <div className="text-[12.5px] leading-relaxed" style={{ color: "#3A332B" }}>
              {result.matched.map((m, i) => (
                <span key={i}>
                  <span style={{ color: "#6B6259" }}>{m.label}:</span>{" "}
                  <span style={{ fontFamily: "'Geist Mono', monospace", color: "#1E1A15" }}>{String(m.value)}</span>
                  {i < result.matched.length - 1 && <span style={{ color: "#D3CAB9" }}>  ·  </span>}
                </span>
              ))}
            </div>
          )}
          {result.missed.length > 0 && (
            <div className="text-[11.5px] mt-2 italic" style={{ color: "#6B6259" }}>
              Nicht automatisch erkannt: {result.missed.join(", ")} — bitte manuell prüfen.
            </div>
          )}
        </div>
        <button onClick={onDismiss} style={{ background: "transparent", border: "none",
          color: "#6B6259", fontSize: 18, cursor: "pointer", padding: 4 }} aria-label="Schließen">✕</button>
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
    <div style={{ background: "#FFFFFF", border: "1.25px solid #D3CAB9", borderRadius: 3, padding: 16,
                  display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13.5px] font-medium" style={{ color: "#1E1A15" }}>{bauteil.label}</span>
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
      <div className="text-[11.5px] leading-snug font-medium" style={{ color: "#1E1A15" }}>
        {currentLabel}
      </div>
      {bauteil.info && stufenLabels[bauteil.note] && stufenLabels[bauteil.note] !== bauteil.info && (
        <div className="text-[10.5px]" style={{ color: "#6B6259", fontStyle: "italic" }}>{bauteil.info}</div>
      )}
    </div>
  );
};

// ═══ PAKET-BLOCK mit Kostenherleitung-Tooltip ═══════════════════════════
const PaketBlock = ({ paket, aktiv, onToggle }) => {
  const f = PAKET_FARBEN[paket.farbe];
  const summe_invest = paket.massnahmen.reduce((s, m) => s + m.investition, 0);
  const summe_instand = paket.massnahmen.reduce((s, m) => s + m.ohnehin_anteil, 0);
  const summe_foerder = paket.massnahmen.reduce((s, m) => {
    const netto = m.investition - m.ohnehin_anteil;
    const bonus = BEG_BONUS.isfp_bonus;
    const quote = m.foerderquote > 0 ? Math.min(m.foerderquote + bonus, 0.5) : 0;
    return s + netto * quote;
  }, 0);
  const eigenanteil = summe_invest - summe_foerder;

  return (
    <div className="transition-all" style={{
      background: "#FFFFFF",
      border: aktiv ? "1.75px solid #1E1A15" : "1.25px solid #D3CAB9",
      borderRadius: 3, overflow: "hidden", opacity: aktiv ? 1 : 0.55,
    }}>
      <div className="flex items-stretch">
        <div className="flex items-center justify-center shrink-0" style={{ width: 120, background: "#F8F5EF", borderRight: "1.25px solid #D3CAB9" }}>
          <PaketHaus farbe={paket.farbe} aktiv={aktiv} nummer={paket.nummer} size={74} />
        </div>
        <div className="flex-1 p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-[11px] tracking-[0.2em] uppercase" style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>
                Paket {paket.nummer}
              </span>
              <span style={{ background: f.hell, padding: "2px 10px", borderRadius: 100,
                             fontSize: 11, color: "#1E1A15" }}>{paket.zeitraum}</span>
            </div>
            <h3 className="font-serif" style={{ fontSize: 22, fontWeight: 500, color: "#1E1A15" }}>{paket.titel}</h3>
          </div>
          <button onClick={onToggle} className="flex items-center gap-2.5 transition print-hide"
            style={{ padding: "8px 16px",
                     border: `1.25px solid ${aktiv ? "#1E1A15" : "#D3CAB9"}`, borderRadius: 3,
                     background: aktiv ? "#1E1A15" : "transparent",
                     color: aktiv ? "#F8F5EF" : "#3A332B",
                     fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>
            <span className="inline-block relative" style={{
              width: 14, height: 14, borderRadius: 2,
              background: aktiv ? "#F8F5EF" : "transparent",
              border: aktiv ? "none" : "1.25px solid #6B6259",
            }}>
              {aktiv && (
                <svg viewBox="0 0 14 14" width="14" height="14" style={{ position: "absolute", top: 0, left: 0 }}>
                  <path d="M3 7.5 L6 10.5 L11 4.5" stroke="#1E1A15" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
            {aktiv ? "Im Fahrplan" : "Ausgeblendet"}
          </button>
        </div>
      </div>

      <div className="px-5 py-3 italic text-[13px]"
        style={{ background: "#F8F5EF", borderTop: "1px solid #E2DBD0", color: "#3A332B", borderBottom: "1px solid #E2DBD0" }}>
        <span className="not-italic uppercase tracking-[0.18em] text-[10.5px] mr-2"
          style={{ color: "#B5623E", fontFamily: "'Geist Mono', monospace" }}>Warum</span>
        {paket.begruendung}
      </div>

      <div>
        {paket.massnahmen.map((m, i) => {
          const foerderfaehig = m.investition - m.ohnehin_anteil;
          const quote = m.foerderquote > 0 ? Math.min(m.foerderquote + BEG_BONUS.isfp_bonus, 0.5) : 0;
          const foerderung = Math.round(foerderfaehig * quote);
          const eigenanteil = m.investition - foerderung;
          return (
          <div key={m.id} className="p-5" style={{ borderBottom: i < paket.massnahmen.length - 1 ? "1px solid #E2DBD0" : "none" }}>
            <div className="mb-4">
              <div className="text-[14.5px] font-medium mb-1.5 flex items-center gap-2" style={{ color: "#1E1A15" }}>
                {m.titel}
                <Tooltip content={
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Kosten-Herleitung</div>
                    <div style={{ fontSize: 11.5, marginBottom: 8 }}>{m.kostenherleitung}</div>
                    <div style={{ fontWeight: 600, marginBottom: 4, marginTop: 8 }}>Förderung</div>
                    <div style={{ fontSize: 11.5 }}>
                      {m.foerderung_rechtsgrundlage} · durchgeführt durch {m.foerderung_stelle}
                      {m.foerderquote > 0 && <><br/>Grundquote: {Math.round(m.foerderquote * 100)} % · mit iSFP-Bonus: {Math.round((m.foerderquote + BEG_BONUS.isfp_bonus) * 100)} %</>}
                    </div>
                  </div>
                }>
                  <span style={{ color: "#B5623E" }}><InfoIcon /></span>
                </Tooltip>
              </div>
              <div className="text-[13px] leading-relaxed" style={{ color: "#3A332B" }}>{m.beschreibung}</div>
            </div>

            <div style={{ maxWidth: 560, fontFamily: "'Geist Mono', monospace", fontSize: 13 }}>
              <div className="flex justify-between items-baseline" style={{ padding: "7px 0", borderBottom: "1px dotted #D3CAB9" }}>
                <span style={{ color: "#3A332B" }}>Investitionskosten</span>
                <span style={{ color: "#1E1A15", fontVariantNumeric: "tabular-nums" }}>{fmtEur(m.investition)}</span>
              </div>
              <div className="flex justify-between items-baseline" style={{ padding: "7px 0", borderBottom: "1px dotted #D3CAB9" }}>
                <span className="flex items-center gap-1.5" style={{ color: "#3A332B" }}>
                  Davon förderfähige Kosten
                  <Tooltip content="Von der Gesamtinvestition werden die sowieso fälligen Erneuerungskosten abgezogen (z.B. Fassadenanstrich, Fenster-Lebenszyklus, Dachneueindeckung). Nur die 'energetische Mehrinvestition' ist BEG-förderfähig. Dies ist nicht zu verwechseln mit jährlichen Wartungs-/Instandhaltungskosten im Betrieb.">
                    <span style={{ color: "#B5623E" }}><InfoIcon size={11} /></span>
                  </Tooltip>
                </span>
                <span style={{ color: "#1E1A15", fontVariantNumeric: "tabular-nums" }}>{fmtEur(foerderfaehig)}</span>
              </div>
              {m.foerderquote > 0 ? (
                <div className="flex justify-between items-baseline" style={{ padding: "7px 0", borderBottom: "1px dotted #D3CAB9" }}>
                  <span style={{ color: "#00843D" }}>Förderung ({Math.round(quote * 100)} % · {m.foerderung_stelle})</span>
                  <span style={{ color: "#00843D", fontVariantNumeric: "tabular-nums" }}>− {fmtEur(foerderung)}</span>
                </div>
              ) : (
                <div className="flex justify-between items-baseline" style={{ padding: "7px 0", borderBottom: "1px dotted #D3CAB9" }}>
                  <span style={{ color: "#6B6259" }}>Keine BEG-Förderung ({m.foerderung_rechtsgrundlage})</span>
                  <span style={{ color: "#6B6259", fontVariantNumeric: "tabular-nums" }}>—</span>
                </div>
              )}
              <div className="flex justify-between items-baseline" style={{ padding: "10px 0", borderTop: "1.5px solid #1E1A15", marginTop: 2 }}>
                <span style={{ color: "#1E1A15", fontSize: 14, fontWeight: 500 }}>Ihr Kostenanteil</span>
                <span style={{ color: "#1E1A15", fontSize: 15, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{fmtEur(eigenanteil)}</span>
              </div>
            </div>

            <div className="mt-3 text-[11.5px]" style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>
              CO₂-Einsparung: <span style={{ color: "#1E1A15" }}>−{m.co2_reduktion} kg/(m²·a)</span>
            </div>
          </div>
          );
        })}
      </div>

      <div className="px-5 py-4 grid grid-cols-3 gap-4" style={{ background: "#F8F5EF", borderTop: "1.25px solid #D3CAB9" }}>
        <div>
          <div className="text-[10.5px] tracking-[0.18em] uppercase mb-1" style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>Summe Investition</div>
          <div className="text-[15px]" style={{ fontFamily: "'Geist Mono', monospace", color: "#1E1A15", fontVariantNumeric: "tabular-nums" }}>{fmtEur(summe_invest)}</div>
        </div>
        <div>
          <div className="text-[10.5px] tracking-[0.18em] uppercase mb-1" style={{ color: "#00843D", fontFamily: "'Geist Mono', monospace" }}>Summe Förderung</div>
          <div className="text-[15px]" style={{ fontFamily: "'Geist Mono', monospace", color: "#00843D", fontVariantNumeric: "tabular-nums" }}>− {fmtEur(summe_foerder)}</div>
        </div>
        <div>
          <div className="text-[10.5px] tracking-[0.18em] uppercase mb-1" style={{ color: "#1E1A15", fontFamily: "'Geist Mono', monospace" }}>Ihr Kostenanteil</div>
          <div className="text-[15px]" style={{ fontFamily: "'Geist Mono', monospace", color: "#1E1A15", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{fmtEur(eigenanteil)}</div>
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
            border: "none", borderBottom: active ? "2.5px solid #B5623E" : "2.5px solid transparent",
            background: "transparent",
            color: active ? "#1E1A15" : "#6B6259",
            fontSize: 13.5, fontWeight: active ? 600 : 400,
            letterSpacing: "0.01em", cursor: "pointer",
            transition: "color 0.12s, border-color 0.12s",
          }}
          onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "#1E1A15"; }}
          onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "#6B6259"; }}
        >
          <span className="text-[10px] tracking-[0.18em]" style={{ color: active ? "#B5623E" : "#6B6259", fontFamily: "'Geist Mono', monospace", marginRight: 8 }}>
            {String(i + 1).padStart(2, "0")}
          </span>
          {t.label}
        </button>
      );
    })}
  </div>
);

// ═══ GEBÄUDE-BILD (decoratively) ════════════════════════════════════════
const GebaeudeBild = () => (
  <div className="relative overflow-hidden" style={{
    aspectRatio: "3/2",
    background: "linear-gradient(135deg, #E2DBD0 0%, #D3CAB9 100%)",
    borderRadius: 3, border: "1.25px solid #D3CAB9",
  }}>
    <svg viewBox="0 0 300 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{ opacity: 0.55 }}>
      <defs>
        <pattern id="windowPattern" x="0" y="0" width="22" height="28" patternUnits="userSpaceOnUse">
          <rect x="4" y="6" width="14" height="18" fill="#1E1A15" opacity="0.65" />
        </pattern>
      </defs>
      <rect x="30" y="80" width="80" height="120" fill="#6B6259" opacity="0.6"/>
      <rect x="30" y="80" width="80" height="120" fill="url(#windowPattern)" opacity="0.4"/>
      <rect x="100" y="45" width="140" height="155" fill="#3A332B"/>
      <rect x="100" y="45" width="140" height="155" fill="url(#windowPattern)" opacity="0.9"/>
      <rect x="96" y="40" width="148" height="8" fill="#1E1A15"/>
      <rect x="100" y="41" width="140" height="4" fill="#657E5E"/>
      <rect x="240" y="90" width="50" height="110" fill="#6B6259" opacity="0.7"/>
      <rect x="240" y="90" width="50" height="110" fill="url(#windowPattern)" opacity="0.3"/>
      <rect x="0" y="195" width="300" height="5" fill="#1E1A15"/>
    </svg>
  </div>
);

// ═══ ERGEBNIS-SECTION — Vorher/Nachher + Tabelle ════════════════════════
const EffizienzBadge = ({ klasse, size = "md" }) => {
  const farbe = EFFIZIENZ_FARBEN[klasse] || "#6B6259";
  const dim = size === "lg" ? 84 : size === "md" ? 60 : 36;
  const fs = size === "lg" ? 42 : size === "md" ? 28 : 16;
  return (
    <div className="inline-flex items-center justify-center font-serif"
      style={{ width: dim, height: dim, background: farbe,
               color: ["B","C","D"].includes(klasse) ? "#1E1A15" : "#FFFFFF",
               borderRadius: 3, fontSize: fs, fontWeight: 500 }}>{klasse}</div>
  );
};

const VorherNachher = ({ ist, k, heizkostenIst }) => (
  <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-6 items-center">
    <div style={{ background: "#FFFFFF", border: "1.25px solid #D3CAB9", borderRadius: 3, padding: "28px 26px" }}>
      <div className="flex items-center justify-between mb-5">
        <div className="text-[11px] tracking-[0.22em] uppercase" style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>Heute</div>
        <EffizienzBadge klasse={berechneEffizienzklasse(ist.primaerenergie)} size="md" />
      </div>
      <div className="space-y-3">
        {[
          ["Endenergie",      ist.endenergie, "kWh/(m²·a)"],
          ["Primärenergie",   ist.primaerenergie, "kWh/(m²·a)"],
          ["CO₂-Emissionen",  ist.co2, "kg/(m²·a)"],
          ["Heizkosten gesamt", fmt(heizkostenIst), "€/a"],
        ].map((r, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3"
               style={{ padding: "9px 0", borderBottom: i < 3 ? "1px solid #E2DBD0" : "none", fontSize: 13 }}>
            <span style={{ color: "#3A332B" }}>{r[0]}</span>
            <span style={valueStyle}>
              {r[1]}<span style={{ fontSize: 12, color: "#6B6259", marginLeft: 4 }}>{r[2]}</span>
            </span>
          </div>
        ))}
      </div>
    </div>

    <div className="flex flex-col items-center justify-center gap-2 py-4">
      <span className="font-serif text-[28px]" style={{ color: "#B5623E" }}>→</span>
      <span className="text-[10.5px] tracking-[0.22em] uppercase" style={{ color: "#B5623E", fontFamily: "'Geist Mono', monospace" }}>Sanierungsfahrplan</span>
    </div>

    <div style={{ background: EFFIZIENZ_FARBEN[k.effizienzklasse] || "#00843D", border: "1.25px solid #1E1A15", borderRadius: 3, padding: "28px 26px", color: ["B","C","D"].includes(k.effizienzklasse) ? "#1E1A15" : "#F8F5EF" }}>
      <div className="flex items-center justify-between mb-5">
        <div className="text-[11px] tracking-[0.22em] uppercase" style={{ color: ["B","C","D"].includes(k.effizienzklasse) ? "rgba(30,26,21,0.65)" : "rgba(248,245,239,0.75)", fontFamily: "'Geist Mono', monospace" }}>Ihr Haus in der Zukunft</div>
        <div className="inline-flex items-center justify-center font-serif"
             style={{ width: 60, height: 60, background: "#F8F5EF", color: EFFIZIENZ_FARBEN[k.effizienzklasse], borderRadius: 3, fontSize: 28, fontWeight: 500 }}>{k.effizienzklasse}</div>
      </div>
      <div className="space-y-3">
        {[
          ["Endenergie",    k.endenergie, "kWh/(m²·a)"],
          ["Primärenergie", k.primaerenergie, "kWh/(m²·a)"],
          ["CO₂-Emissionen",k.co2, "kg/(m²·a)"],
          ["Heizkosten gesamt", fmt(k.heizkosten_gesamt), "€/a"],
        ].map((r, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3"
               style={{ padding: "9px 0", borderBottom: i < 3 ? `1px solid ${["B","C","D"].includes(k.effizienzklasse) ? "rgba(30,26,21,0.18)" : "rgba(248,245,239,0.18)"}` : "none", fontSize: 13 }}>
            <span>{r[0]}</span>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontVariantNumeric: "tabular-nums", fontSize: 14 }}>
              {r[1]}<span style={{ fontSize: 12, opacity: 0.7, marginLeft: 4 }}>{r[2]}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const DeltaKPI = ({ label, vorher, nachher, unit }) => {
  const delta = nachher - vorher;
  const pct = vorher > 0 ? Math.round(Math.abs(delta) / vorher * 100) : 0;
  return (
    <div style={{ background: "#FFFFFF", border: "1.25px solid #D3CAB9", borderRadius: 3, padding: "22px 24px" }}>
      <div className="text-[11px] tracking-[0.22em] uppercase mb-3" style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>{label}</div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="font-serif" style={{ fontSize: 34, fontWeight: 500, color: "#1E1A15", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          −{pct}%
        </span>
        <span className="text-[12px]" style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>
          {fmt(vorher)}{unit && ` ${unit}`} → {fmt(nachher)}{unit && ` ${unit}`}
        </span>
      </div>
    </div>
  );
};

// ═══ KUMULIERT-TABELLE (BAFA-Logik) ═══════════════════════════════════
const KumuliertTabelle = ({ kumuliert, ist, heizkostenIst }) => (
  <div style={{ background: "#FFFFFF", border: "1.25px solid #D3CAB9", borderRadius: 3, padding: "24px 28px" }}>
    <div className="text-[11px] tracking-[0.22em] uppercase mb-4 flex items-center gap-2"
         style={{ color: "#B5623E", fontFamily: "'Geist Mono', monospace" }}>
      Kumulierte Wirkung pro Paket
      <Tooltip content="BAFA-Logik: jedes Paket wird auf dem Ergebnis des vorigen aufbauend berechnet. Zeigt den Fortschritt Schritt für Schritt.">
        <span><InfoIcon size={11} /></span>
      </Tooltip>
    </div>
    <table className="w-full text-[13px]" style={{ fontVariantNumeric: "tabular-nums" }}>
      <thead>
        <tr style={{ borderBottom: "1.25px solid #1E1A15" }}>
          <th className="text-left py-2.5 font-medium">Schritt</th>
          <th className="text-right py-2.5 font-medium">Endenergie</th>
          <th className="text-right py-2.5 font-medium">Primärenergie</th>
          <th className="text-right py-2.5 font-medium">CO₂</th>
          <th className="text-right py-2.5 font-medium">Klasse</th>
        </tr>
      </thead>
      <tbody>
        <tr style={{ borderBottom: "1px solid #E2DBD0", background: "#F8F5EF" }}>
          <td className="py-3">
            <span className="text-[11px] tracking-[0.18em] uppercase mr-2" style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>0</span>
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
                <span className="text-[11px] tracking-[0.18em] uppercase" style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>P{r.paket.nummer}</span>
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
);

// ═══ iSFP-STYLE PRINT REPORT ═══════════════════════════════════════════

const waermeEEK = (typ) => {
  if (!typ) return "D";
  if (/Wärmepumpe/i.test(typ)) return "A";
  if (/erneuerbar|Pellets|Biomasse/i.test(typ)) return "B";
  if (/Brennwert/i.test(typ)) return "D";
  if (/Niedertemperatur/i.test(typ)) return "E";
  if (/Heizöl|Öl/i.test(typ)) return "F";
  if (/Elektro/i.test(typ)) return "G";
  return "D";
};

const EnergyBar = ({ label, value, maxValue, unit, note }) => {
  const pct = Math.round(Math.min(100, (value / maxValue) * 100));
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 10, color: "#FFF" }}>
        <span>{label}</span>
        <span style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 500 }}>{fmt(value)} {unit}{note ? "  " + note : ""}</span>
      </div>
      <div style={{ height: 9, background: "rgba(0,0,0,0.22)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "rgba(255,255,255,0.82)", borderRadius: 2 }} />
      </div>
    </div>
  );
};

const ISFPPrintReport = ({ ist, k, heizkostenIst, aktivePakete, gebaeude, kumuliert }) => {
  const istKlasse = berechneEffizienzklasse(ist.primaerenergie);
  const aktivePaketeObj = MASSNAHMENPAKETE.filter(p => aktivePakete.includes(p.id));
  const co2Gesamt = Math.round(ist.co2 * gebaeude.gebaeudenutzflaeche);
  const co2Ziel = Math.round(k.co2 * gebaeude.gebaeudenutzflaeche);
  const textColorFor = (klasse) => ["B","C","D"].includes(klasse) ? "#1E1A15" : "#FFF";
  const kostenEinsparPct = heizkostenIst > 0 ? Math.round((1 - k.heizkosten_gesamt / heizkostenIst) * 100) : 0;

  return (
    <div className="print-only" style={{ fontFamily: "'Geist', sans-serif", color: "#1E1A15" }}>

      {/* ═══ SEITE 1: ÜBERBLICK ═══ */}
      <div style={{ padding: "18px 22px 16px", pageBreakAfter: "always", minHeight: "270mm", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.22em", color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>01</div>
          <div style={{ fontSize: 10, letterSpacing: "0.22em", color: "#B5623E", fontFamily: "'Geist Mono', monospace" }}>iSFP-SCHNELLCHECK · DEMONSTRATOR</div>
        </div>
        <div style={{ height: 2, background: "#1E1A15", marginBottom: 11 }} />

        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 21, fontWeight: 500, fontFamily: "'Fraunces', serif", letterSpacing: "-0.01em" }}>ÜBERBLICK</span>
          <span style={{ fontSize: 9.5, color: "#6B6259" }}>Kein offizieller BAFA-iSFP · nur Demonstrator</span>
        </div>
        <div style={{ fontSize: 10.5, color: "#3A332B", marginBottom: 12, fontFamily: "'Geist Mono', monospace" }}>
          {gebaeude.strasse} · {gebaeude.plz} {gebaeude.standort} · BJ {gebaeude.baujahr} · {fmt(gebaeude.wohnflaeche)} m² · {gebaeude.heizung_typ}
        </div>

        {/* HEUTE BOX */}
        <div style={{ display: "flex", background: EFFIZIENZ_FARBEN[istKlasse] || "#C0392B", marginBottom: 3, overflow: "hidden", borderRadius: "2px 2px 0 0" }}>
          <div style={{ width: 26, background: "rgba(0,0,0,0.20)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 8.5, letterSpacing: "0.38em", writingMode: "vertical-rl", transform: "rotate(180deg)", color: "#FFF", fontWeight: 600, fontFamily: "'Geist Mono', monospace" }}>H E U T E</span>
          </div>
          <div style={{ width: 68, display: "flex", alignItems: "center", justifyContent: "center", padding: "13px 6px", flexShrink: 0 }}>
            <div style={{ width: 52, height: 52, background: EFFIZIENZ_FARBEN[istKlasse] || "#C0392B", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", border: "2px solid rgba(255,255,255,0.35)" }}>
              <span style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Fraunces', serif", color: textColorFor(istKlasse), lineHeight: 1 }}>{istKlasse}</span>
              <span style={{ fontSize: 6.5, color: textColorFor(istKlasse), letterSpacing: "0.12em", marginTop: 1, opacity: 0.75 }}>EEK</span>
            </div>
          </div>
          <div style={{ flex: 1, padding: "13px 16px 11px" }}>
            <EnergyBar label="Jährliche Energiekosten" value={heizkostenIst} maxValue={heizkostenIst} unit="€/a" />
            <EnergyBar label={`CO₂-Emissionen (${fmt(gebaeude.gebaeudenutzflaeche)} m² AN)`} value={co2Gesamt} maxValue={co2Gesamt} unit="kg/a" />
            <div style={{ display: "flex", gap: 18, marginTop: 5, fontSize: 9, color: "#EEE", fontFamily: "'Geist Mono', monospace" }}>
              <span>Primärenergie: <b>{ist.primaerenergie} kWh/(m²·a)</b></span>
              <span>Endenergie: <b>{ist.endenergie} kWh/(m²·a)</b></span>
              <span>CO₂: <b>{ist.co2} kg/(m²·a)</b></span>
            </div>
          </div>
        </div>

        {/* KASKADE */}
        <div style={{ fontSize: 9, letterSpacing: "0.18em", color: "#6B6259", margin: "9px 0 5px", fontFamily: "'Geist Mono', monospace", textTransform: "uppercase" }}>
          Schrittweise Sanierung — {aktivePaketeObj.length} Maßnahmenpakete
        </div>

        {aktivePaketeObj.map((paket, i) => {
          const step = kumuliert[i];
          const nachherKlasse = step.nachher.effizienzklasse;
          const farbe = PAKET_FARBEN[paket.farbe];
          const summeInvest = paket.massnahmen.reduce((s, m) => s + m.investition, 0);
          const summeFoerder = Math.round(paket.massnahmen.reduce((s, m) => {
            const netto = m.investition - m.ohnehin_anteil;
            const quote = m.foerderquote > 0 ? Math.min(m.foerderquote + BEG_BONUS.isfp_bonus, 0.5) : 0;
            return s + netto * quote;
          }, 0));
          return (
            <div key={paket.id} style={{ display: "flex", alignItems: "stretch", marginBottom: 2, minHeight: 46 }}>
              <div style={{
                width: 58, flexShrink: 0,
                background: farbe.bg, color: farbe.text,
                clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 700, fontFamily: "'Fraunces', serif",
              }}>{paket.nummer}</div>
              <div style={{ width: 48, flexShrink: 0, background: farbe.hell, display: "flex", alignItems: "center", justifyContent: "center", borderTop: `1px solid rgba(0,0,0,0.08)`, borderBottom: `1px solid rgba(0,0,0,0.08)` }}>
                <div style={{ width: 30, height: 30, background: EFFIZIENZ_FARBEN[nachherKlasse], borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, fontFamily: "'Fraunces', serif", color: textColorFor(nachherKlasse) }}>{nachherKlasse}</div>
              </div>
              <div style={{ flex: 1, padding: "6px 11px", background: "#FFF", borderTop: "1px solid #E2DBD0", borderBottom: "1px solid #E2DBD0" }}>
                <div style={{ fontWeight: 600, fontSize: 11.5, color: "#1E1A15", marginBottom: 2 }}>{paket.titel}</div>
                <div style={{ fontSize: 9, color: "#6B6259", lineHeight: 1.35 }}>{paket.massnahmen.map(m => m.titel).join(" · ")}</div>
              </div>
              <div style={{ width: 192, flexShrink: 0, padding: "6px 11px", background: "#FFF", borderTop: "1px solid #E2DBD0", borderBottom: "1px solid #E2DBD0", borderRight: "1px solid #E2DBD0", fontFamily: "'Geist Mono', monospace", fontSize: 9.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ color: "#6B6259" }}>Investition</span>
                  <span>{fmtEur(summeInvest)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ color: "#00843D" }}>Förderung</span>
                  <span style={{ color: "#00843D" }}>− {fmtEur(summeFoerder)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600 }}>Eigenanteil</span>
                  <span style={{ fontWeight: 600 }}>{fmtEur(summeInvest - summeFoerder)}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* SANIERUNG IN EINEM ZUG — optional Alternativ-Box */}
        {aktivePaketeObj.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 0, background: "#F1EDE4", border: "1px solid #D3CAB9", marginTop: 5, marginBottom: 2 }}>
            <div style={{ flex: 1, padding: "9px 14px" }}>
              <div style={{ fontSize: 8.5, letterSpacing: "0.18em", color: "#6B6259", fontFamily: "'Geist Mono', monospace", textTransform: "uppercase", marginBottom: 3 }}>
                Alternativ: Sanierung in einem Zug
              </div>
              <div style={{ fontSize: 10, color: "#3A332B", lineHeight: 1.45 }}>
                Alle {aktivePaketeObj.length} Maßnahmen in einem Projekt — reduziert Baustellenkosten, vermeidet mehrfache Rüstzeiten und ermöglicht optimale Abstimmung der Gewerke aufeinander.
              </div>
            </div>
            <div style={{ flexShrink: 0, fontFamily: "'Geist Mono', monospace", fontSize: 9.5, padding: "9px 14px", borderLeft: "1px solid #D3CAB9", minWidth: 180 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 3 }}>
                <span style={{ color: "#6B6259" }}>Gesamt-Invest</span>
                <span style={{ color: "#1E1A15", fontWeight: 600 }}>{fmtEur(k.invest_gesamt)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 3 }}>
                <span style={{ color: "#00843D" }}>Förderung</span>
                <span style={{ color: "#00843D", fontWeight: 600 }}>− {fmtEur(k.foerderung_gesamt)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, borderTop: "1px solid #D3CAB9", paddingTop: 3 }}>
                <span style={{ color: "#1E1A15", fontWeight: 700 }}>Eigenanteil</span>
                <span style={{ color: "#1E1A15", fontWeight: 700 }}>{fmtEur(k.eigenanteil)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ZIEL BOX */}
        <div style={{ display: "flex", background: EFFIZIENZ_FARBEN[k.effizienzklasse] || "#27AE60", marginTop: 2, overflow: "hidden", borderRadius: "0 0 2px 2px" }}>
          <div style={{ width: 26, background: "rgba(0,0,0,0.20)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 8.5, letterSpacing: "0.38em", writingMode: "vertical-rl", transform: "rotate(180deg)", color: "#FFF", fontWeight: 600, fontFamily: "'Geist Mono', monospace" }}>Z I E L</span>
          </div>
          <div style={{ width: 68, display: "flex", alignItems: "center", justifyContent: "center", padding: "13px 6px", flexShrink: 0 }}>
            <div style={{ width: 52, height: 52, background: EFFIZIENZ_FARBEN[k.effizienzklasse] || "#27AE60", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", border: "2px solid rgba(255,255,255,0.35)" }}>
              <span style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Fraunces', serif", color: textColorFor(k.effizienzklasse), lineHeight: 1 }}>{k.effizienzklasse}</span>
              <span style={{ fontSize: 6.5, color: textColorFor(k.effizienzklasse), letterSpacing: "0.12em", marginTop: 1, opacity: 0.75 }}>EEK</span>
            </div>
          </div>
          <div style={{ flex: 1, padding: "13px 16px 11px" }}>
            <EnergyBar label="Jährliche Energiekosten (Ziel)" value={k.heizkosten_gesamt} maxValue={heizkostenIst} unit="€/a" note={`−${kostenEinsparPct} %`} />
            <EnergyBar label="CO₂-Emissionen (Ziel)" value={co2Ziel} maxValue={co2Gesamt} unit="kg/a" note={co2Gesamt > 0 ? `−${Math.round((1 - co2Ziel / co2Gesamt) * 100)} %` : ""} />
            <div style={{ display: "flex", gap: 18, marginTop: 5, fontSize: 9, color: "#EEE", fontFamily: "'Geist Mono', monospace" }}>
              <span>Primärenergie: <b>{k.primaerenergie} kWh/(m²·a)</b></span>
              <span>Endenergie: <b>{k.endenergie} kWh/(m²·a)</b></span>
              <span>CO₂: <b>{k.co2} kg/(m²·a)</b></span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "auto", paddingTop: 12, fontSize: 8, color: "#9B8E82", fontStyle: "italic", lineHeight: 1.5, borderTop: "1px solid #E2DBD0" }}>
          Demonstrator — kein offizieller BAFA-iSFP. Berechnungen nach TABULA-Baseline und BEG 2026. Für den rechtsverbindlichen iSFP ist ein gelisteter Energieeffizienz-Experte erforderlich.
        </div>
      </div>

      {/* ═══ SEITEN 2–N: DETAIL PRO PAKET ═══ */}
      {aktivePaketeObj.map((paket, i) => {
        const farbe = PAKET_FARBEN[paket.farbe];
        const step = kumuliert[i];
        const nachherKlasse = step.nachher.effizienzklasse;
        const gebaeudeEEK = berechneEffizienzklasse(step.nachher.endenergie);
        const p3Index = aktivePaketeObj.findIndex(p => p.id === "P3");
        const hatWPNachDiesemStep = aktivePakete.includes("P3") && (p3Index >= 0 && i >= p3Index);
        const heizTypFuerEEK = hatWPNachDiesemStep ? "Wärmepumpe Luft/Wasser" : gebaeude.heizung_typ;
        const waerveEEK = waermeEEK(heizTypFuerEEK);

        const summeInvest = paket.massnahmen.reduce((s, m) => s + m.investition, 0);
        const summeFoerderfaehig = paket.massnahmen.reduce((s, m) => s + (m.investition - m.ohnehin_anteil), 0);
        const summeFoerder = Math.round(paket.massnahmen.reduce((s, m) => {
          const netto = m.investition - m.ohnehin_anteil;
          const quote = m.foerderquote > 0 ? Math.min(m.foerderquote + BEG_BONUS.isfp_bonus, 0.5) : 0;
          return s + netto * quote;
        }, 0));
        const eigenanteil = summeInvest - summeFoerder;
        const foerderStellen = paket.massnahmen
          .map(m => `${m.foerderung_rechtsgrundlage} (${m.foerderung_stelle})`)
          .filter((v, idx, arr) => arr.indexOf(v) === idx)
          .join(" · ");

        return (
          <div key={paket.id} style={{ pageBreakBefore: "always", minHeight: "270mm", display: "flex", flexDirection: "column" }}>

            {/* Seitenkopf */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "14px 22px 5px" }}>
              <div style={{ fontSize: 10, letterSpacing: "0.22em", color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>{String(i + 2).padStart(2, "0")}</div>
              <div style={{ fontSize: 10, letterSpacing: "0.22em", color: "#B5623E", fontFamily: "'Geist Mono', monospace" }}>iSFP-SCHNELLCHECK · DETAIL</div>
            </div>
            <div style={{ height: 3, background: farbe.bg }} />

            {/* 2-Spalten-Body */}
            <div style={{ display: "flex", flex: 1 }}>

              {/* LINKE SIDEBAR */}
              <div style={{ width: 84, flexShrink: 0, background: farbe.bg, color: farbe.text, display: "flex", flexDirection: "column", alignItems: "center", padding: "18px 0 14px" }}>
                <div style={{ fontSize: 44, fontWeight: 700, fontFamily: "'Fraunces', serif", lineHeight: 1, marginBottom: 10 }}>{paket.nummer}</div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 8.5, letterSpacing: "0.22em", writingMode: "vertical-rl", transform: "rotate(180deg)", opacity: 0.92, fontWeight: 600, textTransform: "uppercase" }}>{paket.titel}</span>
                </div>
                <div style={{ fontSize: 7.5, opacity: 0.75, letterSpacing: "0.1em", marginTop: 10, textAlign: "center", padding: "0 6px", lineHeight: 1.4 }}>{paket.zeitraum}</div>
              </div>

              {/* RECHTER INHALT */}
              <div style={{ flex: 1, padding: "0 20px 18px", display: "flex", flexDirection: "column", minWidth: 0 }}>

                {/* EEK-Badges + Energiekennzahlen */}
                <div style={{ background: farbe.hell, padding: "12px 14px", marginBottom: 12, borderBottom: `2px solid ${farbe.bg}` }}>
                  <div style={{ fontSize: 8.5, letterSpacing: "0.18em", color: "#6B6259", fontFamily: "'Geist Mono', monospace", textTransform: "uppercase", marginBottom: 9 }}>
                    Energieeffizienz nach Schritt {paket.nummer}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
                    {/* 3 EEK-Badges */}
                    {[
                      { label: "Gesamt-EEK", klasse: nachherKlasse },
                      { label: "Gebäude-EEK", klasse: gebaeudeEEK },
                      { label: "Wärmeversorgung", klasse: waerveEEK },
                    ].map(({ label, klasse }, bi) => (
                      <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginRight: 14 }}>
                        <div style={{ width: 42, height: 42, background: EFFIZIENZ_FARBEN[klasse] || "#6B6259", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, fontFamily: "'Fraunces', serif", color: textColorFor(klasse) }}>{klasse}</div>
                        <span style={{ fontSize: 7.5, color: "#6B6259", textAlign: "center", lineHeight: 1.25, maxWidth: 52 }}>{label}</span>
                      </div>
                    ))}
                    {/* Divider */}
                    <div style={{ width: 1, background: "#D3CAB9", alignSelf: "stretch", margin: "0 14px 0 4px" }} />
                    {/* Primär + Endenergie */}
                    {[
                      { label: "Primärenergie", value: step.nachher.primaerenergie },
                      { label: "Endenergie", value: step.nachher.endenergie },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display: "flex", flexDirection: "column", gap: 1, marginRight: 20 }}>
                        <span style={{ fontSize: 8, color: "#6B6259", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
                        <span style={{ fontSize: 26, fontFamily: "'Geist Mono', monospace", fontWeight: 500, color: "#1E1A15", lineHeight: 1 }}>{value}</span>
                        <span style={{ fontSize: 7.5, color: "#6B6259" }}>kWh/(m²·a)</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Maßnahmen */}
                <div style={{ marginBottom: 11 }}>
                  <div style={{ fontSize: 8.5, letterSpacing: "0.18em", color: "#B5623E", fontFamily: "'Geist Mono', monospace", textTransform: "uppercase", marginBottom: 5 }}>Maßnahmen</div>
                  {paket.massnahmen.map(m => (
                    <div key={m.id} style={{ paddingLeft: 14, position: "relative", marginBottom: 6, fontSize: 11, lineHeight: 1.5 }}>
                      <span style={{ position: "absolute", left: 0, color: farbe.bg, fontWeight: 700 }}>→</span>
                      <span style={{ fontWeight: 600, color: "#1E1A15" }}>{m.titel}</span>
                      {m.beschreibung && <span style={{ color: "#3A332B" }}> — {m.beschreibung}</span>}
                    </div>
                  ))}
                </div>

                {/* Investition & Förderung */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 8.5, letterSpacing: "0.18em", color: "#B5623E", fontFamily: "'Geist Mono', monospace", textTransform: "uppercase", marginBottom: 5 }}>Investition &amp; Förderung</div>
                  <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, border: "1px solid #E2DBD0" }}>
                    {[
                      { label: "Investitionskosten gesamt", val: fmtEur(summeInvest), color: "#1E1A15", bg: "#F8F5EF" },
                      { label: "Davon Energiesparmaßnahmen (förderfähig)", val: fmtEur(summeFoerderfaehig), color: "#1E1A15", bg: "#FFF" },
                      { label: `Förderung inkl. iSFP-Bonus 5 % · ${foerderStellen}`, val: `− ${fmtEur(summeFoerder)}`, color: "#00843D", bg: "#F1F7F1" },
                      { label: "Ihr Eigenanteil", val: fmtEur(eigenanteil), color: "#1E1A15", bg: "#F8F5EF", bold: true },
                    ].map(({ label, val, color, bg, bold }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 11px", background: bg, borderBottom: "1px solid #E2DBD0" }}>
                        <span style={{ color: "#3A332B", fontSize: bold ? 11.5 : 10.5, fontWeight: bold ? 600 : 400, flex: 1, marginRight: 8 }}>{label}</span>
                        <span style={{ color, fontWeight: bold ? 700 : 500, fontSize: bold ? 12.5 : 11, whiteSpace: "nowrap" }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Freitextfelder */}
                {[
                  { label: "Begründung", text: paket.begruendung },
                  { label: "Zu beachten", text: paket.zu_beachten },
                  { label: "Komfortsteigerung", text: paket.komfortsteigerung },
                ].map(({ label, text }) => text ? (
                  <div key={label} style={{ marginBottom: 9 }}>
                    <div style={{ fontSize: 8.5, letterSpacing: "0.18em", color: "#B5623E", fontFamily: "'Geist Mono', monospace", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 10.5, color: "#3A332B", lineHeight: 1.55 }}>{text}</div>
                  </div>
                ) : null)}

                <div style={{ marginTop: "auto", paddingTop: 9, fontSize: 7.5, color: "#9B8E82", borderTop: "1px solid #E2DBD0", fontStyle: "italic" }}>
                  Demonstrator — kein offizieller BAFA-iSFP. Alle Angaben ohne Gewähr.
                </div>
              </div>
            </div>
          </div>
        );
      })}
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
  const [aktivePakete, setAktivePakete] = useState(MASSNAHMENPAKETE.map(p => p.id));
  const [extraction, setExtraction] = useState(null);
  const [activeTab, setActiveTab] = useState("gebaeude");

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
        setBauteile(ableiteBauteile(next.baujahr, next.heizung_typ, next.lueftung, next.warmwasser));
      }
      return next;
    });
  }, []);

  const updateIst = useCallback((field, value) => {
    setIst(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateBauteilNote = useCallback((id, note) => {
    setBauteile(prev => prev.map(b => b.id === id ? {
      ...b,
      note,
      info: (BAUTEIL_STUFEN[id] && BAUTEIL_STUFEN[id][note]) || b.info,
    } : b));
  }, []);

  const applyPreset = useCallback((id) => {
    const p = PRESETS[id];
    if (!p) return;
    setPresetId(id);
    setGebaeude(p.gebaeude);
    setIst(p.ist);
    setBauteile(ableiteBauteile(p.gebaeude.baujahr, p.gebaeude.heizung_typ, p.gebaeude.lueftung, p.gebaeude.warmwasser));
    setExtraction(null);
  }, []);

  const handleUpload = useCallback((result) => {
    if (result.gebaeude && Object.keys(result.gebaeude).length > 0) {
      setGebaeude(prev => {
        const next = { ...prev, ...result.gebaeude };
        setBauteile(ableiteBauteile(next.baujahr, next.heizung_typ, next.lueftung, next.warmwasser));
        return next;
      });
    }
    if (result.ist && Object.keys(result.ist).length > 0) {
      setIst(prev => ({ ...prev, ...result.ist }));
    }
    setPresetId(null);
    setExtraction(result);
  }, []);

  const scrollToTab = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 92;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const togglePaket = (id) => {
    setAktivePakete(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // ─── Derived values ──
  const heizkosten = useMemo(
    () => berechneHeizkosten(ist.endenergie, gebaeude.wohnflaeche, gebaeude.heizung_typ),
    [ist.endenergie, gebaeude.wohnflaeche, gebaeude.heizung_typ]
  );
  const heizkostenWE = useMemo(() => gebaeude.wohneinheiten > 0 ? Math.round(heizkosten / gebaeude.wohneinheiten) : 0, [heizkosten, gebaeude.wohneinheiten]);
  const effizienzklasse = useMemo(() => berechneEffizienzklasse(ist.primaerenergie), [ist.primaerenergie]);
  const k = useMemo(() => berechneNachMassnahmen(aktivePakete, ist, gebaeude), [aktivePakete, ist, gebaeude]);
  const kumuliert = useMemo(() => berechneKumuliert(aktivePakete, ist, gebaeude), [aktivePakete, ist, gebaeude]);

  const handleExport = () => {
    exportAsPDF();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F8F5EF", color: "#1E1A15" }}>
      {/* Header mit Sticky-Tabs */}
      <header className="print-hide" style={{
        borderBottom: "1px solid #D3CAB9",
        background: "rgba(248,245,239,0.96)",
        position: "sticky", top: 0, zIndex: 30,
        backdropFilter: "blur(8px)",
      }}>
        <div className="mx-auto max-w-[1180px]" style={{ padding: "14px 40px 0" }}>
          <div className="flex items-center justify-between gap-6 flex-wrap mb-3">
            <div className="flex items-center gap-3">
              <div style={{ color: "#B5623E" }}><MFHIcon size={26} /></div>
              <div>
                <div className="font-serif" style={{ fontSize: 18, fontWeight: 500, color: "#1E1A15", lineHeight: 1.1 }}>
                  iSFP-Schnellcheck
                </div>
                <div className="text-[10.5px] tracking-[0.22em] uppercase mt-0.5" style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>
                  Demonstrator · v3.1 · EFH
                </div>
              </div>
            </div>
            <button onClick={handleExport}
              style={{ padding: "9px 18px", background: "#1E1A15", color: "#F8F5EF",
                       borderRadius: 3, fontSize: 13, fontWeight: 500, border: "none",
                       cursor: "pointer", transition: "background 0.12s" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#B5623E"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#1E1A15"}>
              Als PDF exportieren →
            </button>
          </div>
          <StickyTabs activeId={activeTab} onClick={scrollToTab} />
        </div>
      </header>

      {/* Print-Title (nur im PDF) */}
      <ISFPPrintReport ist={ist} k={k} heizkostenIst={heizkosten} aktivePakete={aktivePakete} gebaeude={gebaeude} kumuliert={kumuliert} />

      <main className="mx-auto max-w-[1180px] print-hide" style={{ padding: "36px 40px 80px" }}>

        {/* Preset-Picker */}
        <Section id="presets" eyebrow="Schnellstart">
          <div className="flex items-center justify-between gap-4 mb-5 print-hide">
            <h2 className="font-serif leading-[1.05]" style={{ fontSize: 22, fontWeight: 500, color: "#1E1A15" }}>
              Preset wählen oder eigenen Energieausweis hochladen
            </h2>
          </div>
          <PresetPicker activeId={presetId} onPick={applyPreset} />
        </Section>

        {/* Gebäude & Bestand */}
        <Section id="gebaeude" eyebrow="Schritt 1 · Erfassung" title="Ihr Gebäude heute"
          subtitle="Alle Felder editierbar. Laden Sie einen Energieausweis hoch, oder passen Sie die Werte manuell an. Alle Änderungen wirken sofort auf den Fahrplan und das Ergebnis.">
          <div className="grid grid-cols-1 md:grid-cols-[1.05fr,1fr] gap-8 mb-10">
            <GebaeudeBild />
            <UploadZone onUpload={handleUpload} extraction={extraction} onDismiss={() => setExtraction(null)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <Card>
              <CardEyebrow>Stammdaten</CardEyebrow>
              <TextInput   label="Standort"             value={gebaeude.standort}            onChange={v => updateGebaeude("standort", v)} />
              <TextInput   label="Adresse"              value={gebaeude.strasse}             onChange={v => updateGebaeude("strasse", v)} />
              <TextInput   label="PLZ"                  value={gebaeude.plz}                 onChange={v => updateGebaeude("plz", v)} />
              <SelectInput label="Gebäudetyp"           value={gebaeude.typ}                 onChange={v => updateGebaeude("typ", v)} options={OPTIONS_GEBAEUDETYP} />
              <NumberInput label="Baujahr"              value={gebaeude.baujahr}             onChange={v => updateGebaeude("baujahr", v)} min={1700} max={2030}
                tooltip="Wird zur automatischen Ableitung der Bauteil-Noten verwendet (TABULA-Baualtersklassen)." />
              <NumberInput label="Wohneinheiten"        value={gebaeude.wohneinheiten}       onChange={v => updateGebaeude("wohneinheiten", v)} min={1} max={1000} />
              <NumberInput label="Wohnfläche"           value={gebaeude.wohnflaeche}         onChange={v => updateGebaeude("wohnflaeche", v)} unit="m²" min={20} />
              <NumberInput label="Gebäudenutzfläche AN" value={gebaeude.gebaeudenutzflaeche} onChange={v => updateGebaeude("gebaeudenutzflaeche", v)} unit="m²" min={20}
                tooltip="Bezugsfläche für Kennzahlen nach GEG. Typisch 1,3 × Wohnfläche." />
            </Card>

            <Card>
              <CardEyebrow>Anlagentechnik</CardEyebrow>
              <SelectInput label="Heizung"           value={gebaeude.heizung_typ} onChange={v => updateGebaeude("heizung_typ", v)} options={OPTIONS_HEIZUNG}
                tooltip="Bestimmt Primärenergiefaktor und Heizkosten-Tarif. Änderung setzt auch die Bauteil-Note 'Heizung' zurück." />
              <NumberInput label="Baujahr Heizung"   value={gebaeude.heizung_bj}  onChange={v => updateGebaeude("heizung_bj", v)} min={1950} max={2030} />
              <SelectInput label="Warmwasser"        value={gebaeude.warmwasser}  onChange={v => updateGebaeude("warmwasser", v)} options={OPTIONS_WARMWASSER} />
              <SelectInput label="Lüftung"           value={gebaeude.lueftung}    onChange={v => updateGebaeude("lueftung", v)} options={OPTIONS_LUEFTUNG} />
              <SelectInput label="Erneuerbare"       value={gebaeude.erneuerbare} onChange={v => updateGebaeude("erneuerbare", v)} options={OPTIONS_ERNEUERBARE}
                tooltip="Wird automatisch vorgeschlagen, wenn Heizung auf Wärmepumpe oder Pellets steht. Manuelle Überschreibung möglich." />
              <SelectInput label="Dach"              value={gebaeude.dach}        onChange={v => updateGebaeude("dach", v)} options={OPTIONS_DACH} />
              <SelectInput label="Keller"            value={gebaeude.keller}      onChange={v => updateGebaeude("keller", v)} options={OPTIONS_KELLER} />
              <NumberInput label="Vollgeschosse"     value={gebaeude.vollgeschosse} onChange={v => updateGebaeude("vollgeschosse", v)} min={1} max={30} />
            </Card>

            <Card>
              <CardEyebrow>Energie­kennzahlen (Ist)</CardEyebrow>
              <NumberInput label="Endenergie"       value={ist.endenergie}     onChange={v => updateIst("endenergie", v)} unit="kWh/(m²·a)" min={0} max={600}
                tooltip="Die dem Gebäude zugeführte Energie. Basis für Heizkosten-Berechnung." />
              <NumberInput label="Primärenergie"    value={ist.primaerenergie} onChange={v => updateIst("primaerenergie", v)} unit="kWh/(m²·a)" min={0} max={700}
                tooltip="Berücksichtigt die 'Vorkette' (Energieträger-Gewinnung, Transport). Basis für die Effizienzklasse nach GEG §86." />
              <NumberInput label="CO₂-Emissionen"   value={ist.co2}            onChange={v => updateIst("co2", v)} unit="kg/(m²·a)" min={0} max={200} step={0.1} />
              <ComputedRow label="Effizienzklasse"  value={effizienzklasse}
                tooltip="Nach iSFP-Bewertungsschema aus Primärenergie (nicht Endenergie!)." />
              <ComputedRow label="Heizkosten gesamt"   value={fmt(heizkosten)}   unit="€/a"
                tooltip="Endenergie × Wohnfläche × Tarif des Heizungstyps (Stand 04/2026)." />
              <ComputedRow label="Heizkosten je WE"    value={fmt(heizkostenWE)} unit="€/a" />
              <div style={{ height: 1, background: "#E2DBD0", margin: "16px 0" }} />
              <TextInput   label="Registriernummer" value={gebaeude.registriernummer} onChange={v => updateGebaeude("registriernummer", v)} />
            </Card>
          </div>
        </Section>

        {/* Energetischer Zustand — Bauteile */}
        <Section id="bauteile" eyebrow="Energetischer Zustand" title="Bauteilbewertung"
          subtitle="Noten 1 (rot, sehr schlecht) bis 7 (grün, sehr gut) — pro Bauteil mit benannten Stufen. Defaults werden aus Baujahr und Anlagentechnik abgeleitet, sind aber manuell anpassbar.">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[11px]" style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace", letterSpacing: "0.15em", textTransform: "uppercase" }}>sehr schlecht</span>
            <div style={{ flex: 1, height: 6, borderRadius: 100, background: "linear-gradient(to right, #E30613, #E3501C, #F07D00, #F6A400, #C5D62E, #34A030, #00843D)" }} />
            <span className="text-[11px]" style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace", letterSpacing: "0.15em", textTransform: "uppercase" }}>sehr gut</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {bauteile.map(b => <BauteilKachel key={b.id} bauteil={b} onNoteChange={updateBauteilNote} />)}
          </div>
        </Section>

        {/* Fahrplan */}
        <Section id="fahrplan" eyebrow="Schritt 2 · Fahrplan" title="Empfohlene Maßnahmenpakete"
          subtitle="Die Pakete sind nach iSFP-Logik zeitlich sinnvoll gestaffelt (Hülle vor Technik). Pakete können für Szenarienvergleich ausgeblendet werden.">
          <div className="mb-10">
            <div className="flex items-end justify-between gap-2 relative" style={{ padding: "0 12px" }}>
              <div className="absolute" style={{ left: 60, right: 60, bottom: 38, height: 2, background: "linear-gradient(to right, #E30613, #F07D00, #F6D400, #00843D)" }} />
              <div className="flex flex-col items-center gap-2 relative">
                <div style={{ width: 52, height: 56, background: "#6E2E1E", borderRadius: 3, border: "1.5px solid #1E1A15" }} />
                <div className="text-[10.5px] tracking-[0.18em] uppercase text-center" style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>Heute</div>
                <div className="text-[11.5px]" style={{ color: "#3A332B" }}>Klasse {effizienzklasse}</div>
              </div>
              {MASSNAHMENPAKETE.map(p => (
                <div key={p.id} className="flex flex-col items-center gap-2 relative" style={{ opacity: aktivePakete.includes(p.id) ? 1 : 0.3 }}>
                  <PaketHaus farbe={p.farbe} aktiv={aktivePakete.includes(p.id)} nummer={p.nummer} size={56} />
                  <div className="text-[10.5px] tracking-[0.18em] uppercase text-center" style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>{p.zeitraum}</div>
                  <div className="text-[11.5px] text-center max-w-[110px] leading-tight" style={{ color: "#3A332B" }}>{p.titel}</div>
                </div>
              ))}
              <div className="flex flex-col items-center gap-2 relative">
                <div style={{ width: 52, height: 56, background: EFFIZIENZ_FARBEN[k.effizienzklasse] || "#00843D", borderRadius: 3, border: "1.5px solid #1E1A15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="font-serif text-[18px]" style={{ color: ["B","C","D"].includes(k.effizienzklasse) ? "#1E1A15" : "#FFF" }}>{k.effizienzklasse}</span>
                </div>
                <div className="text-[10.5px] tracking-[0.18em] uppercase text-center" style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>Ziel</div>
                <div className="text-[11.5px]" style={{ color: "#3A332B" }}>Klasse {k.effizienzklasse}</div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {MASSNAHMENPAKETE.map(p => (
              <PaketBlock key={p.id} paket={p} aktiv={aktivePakete.includes(p.id)} onToggle={() => togglePaket(p.id)} />
            ))}
          </div>
        </Section>

        {/* Ergebnis (ehemals Cockpit + Zukunft) */}
        <Section id="ergebnis" eyebrow="Schritt 3 · Ergebnis" title="Ihr Gebäude nach der Sanierung"
          subtitle="Alle Kennzahlen, Einsparungen und Förderungen im Überblick. Kumulierte Wirkung nach BAFA-Logik: jedes Paket baut auf dem vorigen auf.">
          <VorherNachher ist={ist} k={k} heizkostenIst={heizkosten} />

          <div className="mt-10">
            <h3 className="font-serif mb-4" style={{ fontSize: 22, fontWeight: 500, color: "#1E1A15" }}>Einsparungen im Überblick</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <DeltaKPI label="Endenergie" vorher={ist.endenergie} nachher={k.endenergie} unit="kWh/(m²·a)" />
              <DeltaKPI label="CO₂-Emissionen" vorher={ist.co2} nachher={k.co2} unit="kg/(m²·a)" />
              <DeltaKPI label="Heizkosten" vorher={heizkosten} nachher={k.heizkosten_gesamt} unit="€/a" />
            </div>
          </div>

          <div className="mt-10">
            <h3 className="font-serif mb-4" style={{ fontSize: 22, fontWeight: 500, color: "#1E1A15" }}>Schritt-für-Schritt-Wirkung</h3>
            <KumuliertTabelle kumuliert={kumuliert} ist={ist} heizkostenIst={heizkosten} />
          </div>

          <div className="mt-10">
            <h3 className="font-serif mb-4" style={{ fontSize: 22, fontWeight: 500, color: "#1E1A15" }}>Investition & Förderung</h3>
            <div className="grid grid-cols-1 md:grid-cols-[1.2fr,1fr] gap-6">
              <div style={{ background: "#FFFFFF", border: "1.25px solid #D3CAB9", borderRadius: 3, padding: "24px 28px" }}>
                <div className="text-[11px] tracking-[0.22em] uppercase mb-4" style={{ color: "#B5623E", fontFamily: "'Geist Mono', monospace" }}>Aufteilung nach Paketen</div>
                <table className="w-full text-[13.5px]" style={{ fontVariantNumeric: "tabular-nums" }}>
                  <thead>
                    <tr style={{ borderBottom: "1.25px solid #1E1A15" }}>
                      <th className="text-left py-2.5 font-medium">Paket</th>
                      <th className="text-right py-2.5 font-medium">Invest</th>
                      <th className="text-right py-2.5 font-medium">Förderung</th>
                      <th className="text-right py-2.5 font-medium">Eigenanteil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MASSNAHMENPAKETE.map(p => {
                      const active = aktivePakete.includes(p.id);
                      const invest = active ? p.massnahmen.reduce((s, m) => s + m.investition, 0) : 0;
                      const foerd = active ? p.massnahmen.reduce((s, m) => {
                        const netto = m.investition - m.ohnehin_anteil;
                        const quote = m.foerderquote > 0 ? Math.min(m.foerderquote + BEG_BONUS.isfp_bonus, 0.5) : 0;
                        return s + netto * quote;
                      }, 0) : 0;
                      return (
                        <tr key={p.id} style={{ borderBottom: "1px solid #E2DBD0", opacity: active ? 1 : 0.4 }}>
                          <td className="py-3">
                            <div className="flex items-center gap-2.5">
                              <span style={{ width: 10, height: 10, borderRadius: 100, background: PAKET_FARBEN[p.farbe].bg, display: "inline-block" }} />
                              <span>{p.titel}</span>
                            </div>
                          </td>
                          <td className="text-right py-3" style={{ fontFamily: "'Geist Mono', monospace" }}>{active ? fmtEur(invest) : "—"}</td>
                          <td className="text-right py-3" style={{ fontFamily: "'Geist Mono', monospace", color: active && foerd > 0 ? "#00843D" : "#6B6259" }}>
                            {active ? (foerd > 0 ? `−${fmtEur(foerd)}` : "0 €") : "—"}
                          </td>
                          <td className="text-right py-3" style={{ fontFamily: "'Geist Mono', monospace" }}>{active ? fmtEur(invest - foerd) : "—"}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ borderTop: "1.5px solid #1E1A15" }}>
                      <td className="py-3 font-medium">Gesamt</td>
                      <td className="text-right py-3 font-medium" style={{ fontFamily: "'Geist Mono', monospace" }}>{fmtEur(k.invest_gesamt)}</td>
                      <td className="text-right py-3 font-medium" style={{ fontFamily: "'Geist Mono', monospace", color: "#00843D" }}>−{fmtEur(k.foerderung_gesamt)}</td>
                      <td className="text-right py-3 font-medium" style={{ fontFamily: "'Geist Mono', monospace" }}>{fmtEur(k.eigenanteil)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ background: "#F1EDE4", border: "1.25px solid #D3CAB9", borderRadius: 3, padding: "24px 28px" }}>
                <div className="text-[11px] tracking-[0.22em] uppercase mb-4" style={{ color: "#B5623E", fontFamily: "'Geist Mono', monospace" }}>Förderprogramm BEG 2026</div>
                <div className="text-[12.5px] leading-relaxed mb-4" style={{ color: "#3A332B" }}>
                  <b>BEG</b> (Bundesförderung für effiziente Gebäude) ist das Rahmenprogramm. <b>BAFA</b> und <b>KfW</b> sind die durchführenden Stellen:
                </div>
                <div className="space-y-3.5 text-[13.5px]">
                  {[
                    ["BEG EM Grundförderung (BAFA)", "15 %", "#1E1A15"],
                    ["BEG HZG Heizungstausch (KfW 458)", "bis 50 %", "#1E1A15"],
                    ["iSFP-Bonus (auf alle EM)", "+5 %", "#00843D"],
                  ].map((r, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3" style={{ paddingBottom: 10, borderBottom: "1px solid #D3CAB9" }}>
                      <span style={{ color: "#3A332B" }}>{r[0]}</span>
                      <span style={{ fontFamily: "'Geist Mono', monospace", color: r[2] }}>{r[1]}</span>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between gap-3 pt-2">
                    <span className="font-medium" style={{ color: "#1E1A15" }}>Effektive Förderquote</span>
                    <span className="font-serif" style={{ fontSize: 22, color: "#00843D", fontVariantNumeric: "tabular-nums" }}>
                      {k.invest_gesamt > k.instand_gesamt
                        ? `${Math.round(k.foerderung_gesamt / (k.invest_gesamt - k.instand_gesamt) * 100)} %`
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>

      </main>

      <footer className="print-hide" style={{ borderTop: "1px solid #D3CAB9", padding: "32px 40px", marginTop: 40 }}>
        <div className="mx-auto max-w-[1180px] flex items-center justify-between flex-wrap gap-4 text-[11.5px]"
             style={{ color: "#6B6259", fontFamily: "'Geist Mono', monospace", letterSpacing: "0.05em" }}>
          <span>Demonstrator · keine rechtsverbindliche Energieberatung</span>
          <span>Stand April 2026 · BEG + GEG · TABULA-Baseline</span>
        </div>
      </footer>

      {/* Print-Footer */}
      <div className="print-only" style={{ padding: "24px 40px", borderTop: "1px solid #D3CAB9", fontSize: 10, color: "#6B6259", fontFamily: "'Geist Mono', monospace", textAlign: "center" }}>
        Demonstrator — kein BAFA-iSFP. Stand April 2026.
      </div>
    </div>
  );
}
