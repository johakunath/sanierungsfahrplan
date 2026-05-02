import React from "react";

export const fmt = (n) => new Intl.NumberFormat("de-DE").format(Math.round(n));
export const fmtEur = (n) => fmt(n) + " €";

export const waermeEEK = (typ) => {
  if (!typ) return "D";
  if (/Wärmepumpe/i.test(typ)) return "A";
  if (/erneuerbar|Pellets|Biomasse/i.test(typ)) return "B";
  if (/Brennwert/i.test(typ)) return "D";
  if (/Niedertemperatur/i.test(typ)) return "E";
  if (/Heizöl|Öl/i.test(typ)) return "F";
  if (/Elektro/i.test(typ)) return "G";
  return "D";
};

export const textColorFor = (klasse) => ["C", "D", "E"].includes(klasse) ? "#1E1A15" : "#FFF";

export const EnergyBar = ({ label, value, maxValue, unit, note }) => {
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
