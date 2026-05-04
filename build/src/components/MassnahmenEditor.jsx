import React, { useState } from "react";
// intentional: uses raw MASSNAHMENPAKETE — editor must show pre-override base values
import { MASSNAHMENPAKETE, PAKET_FARBEN } from "../data.js";

const MassnahmenEditor = ({ overrides, onUpdate, onReset }) => {
  const [open, setOpen] = useState(false);
  const allM = MASSNAHMENPAKETE.flatMap(paket => paket.massnahmen.map(massnahme => ({ ...massnahme, paketFarbe: paket.farbe })));
  return (
    <div style={{ marginTop: 32, border: "1.25px solid #D3CAB9", borderRadius: 3, background: "#FFF" }}>
      <button onClick={() => setOpen(o => !o)} className="print-hide"
        style={{ width: "100%", padding: "15px 24px", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="text-[11px] tracking-[0.22em] uppercase" style={{ color: "#B5623E", fontFamily: "'Geist Mono', monospace" }}>
          Maßnahmen-Datenbank · Kosten &amp; Förderung anpassen
        </div>
        <span style={{ fontSize: 11, color: "#6B6259", fontFamily: "'Geist Mono', monospace" }}>{open ? "▲ Schließen" : "▼ Bearbeiten"}</span>
      </button>
      {open && (
        <div style={{ borderTop: "1.25px solid #D3CAB9" }}>
          <table className="w-full text-[12.5px]" style={{ fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr style={{ borderBottom: "1.25px solid #E2DBD0", background: "#F8F5EF" }}>
                <th className="text-left py-2.5 px-5 font-medium" style={{ color: "#3A332B" }}>Maßnahme</th>
                <th className="text-right py-2.5 px-3 font-medium" style={{ color: "#3A332B" }}>Investition</th>
                <th className="text-right py-2.5 px-3 font-medium" style={{ color: "#3A332B" }}>Förderquote</th>
                <th className="py-2.5 px-4" />
              </tr>
            </thead>
            <tbody>
              {allM.map(massnahme => {
                const ov = overrides[massnahme.id] || {};
                const invest = ov.investition !== undefined ? ov.investition : massnahme.investition;
                const quote = ov.foerderquote !== undefined ? ov.foerderquote : massnahme.foerderquote;
                const changed = ov.investition !== undefined || ov.foerderquote !== undefined;
                return (
                  <tr key={massnahme.id} style={{ borderBottom: "1px solid #E2DBD0" }}>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <span style={{ width: 8, height: 8, borderRadius: 100, background: PAKET_FARBEN[massnahme.paketFarbe].bg, flexShrink: 0, display: "inline-block" }} />
                        <span style={{ color: "#1E1A15", lineHeight: 1.3 }}>{massnahme.titel}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-baseline justify-end gap-1.5">
                        <input type="number" min={0} step={500} value={invest}
                          onChange={e => onUpdate(massnahme.id, "investition", Math.max(0, parseInt(e.target.value, 10) || 0))}
                          style={{ width: 90, fontFamily: "'Geist Mono', monospace", fontSize: 12.5, textAlign: "right",
                            background: ov.investition !== undefined ? "#FFFBE6" : "transparent",
                            border: "1px solid #D3CAB9", borderRadius: 2, padding: "3px 6px", outline: "none" }} />
                        <span style={{ fontSize: 11, color: "#6B6259" }}>€</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-baseline justify-end gap-1.5">
                        {massnahme.foerderquote > 0 ? (
                          <>
                            <input type="number" min={0} max={50} step={1} value={Math.round(quote * 100)}
                              onChange={e => onUpdate(massnahme.id, "foerderquote", Math.max(0, Math.min(50, parseInt(e.target.value, 10) || 0)) / 100)}
                              style={{ width: 50, fontFamily: "'Geist Mono', monospace", fontSize: 12.5, textAlign: "right",
                                background: ov.foerderquote !== undefined ? "#FFFBE6" : "transparent",
                                border: "1px solid #D3CAB9", borderRadius: 2, padding: "3px 6px", outline: "none" }} />
                            <span style={{ fontSize: 11, color: "#6B6259" }}>%</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 11, color: "#9B8E82" }}>—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center" style={{ width: 48 }}>
                      {changed && (
                        <button onClick={() => onReset(massnahme.id)} title="Standardwert wiederherstellen"
                          style={{ fontSize: 14, color: "#B5623E", background: "transparent", border: "1px solid #D3CAB9", borderRadius: 2, padding: "1px 7px", cursor: "pointer" }}>
                          ↺
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: "9px 20px 11px", borderTop: "1px solid #E2DBD0", fontSize: 11, color: "#9B8E82", fontStyle: "italic" }}>
            Änderungen wirken sofort auf Fahrplan, Energiebilanz und Förderberechnung. Gelb hinterlegte Felder wurden geändert.
          </div>
        </div>
      )}
    </div>
  );
};

export default MassnahmenEditor;
