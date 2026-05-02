import React from "react";
import { fmt, fmtEur, textColorFor, waermeEEK, EnergyBar } from "../helpers.jsx";
import { MASSNAHMENPAKETE, EFFIZIENZ_FARBEN, PAKET_FARBEN, BEG_BONUS, berechneEffizienzklasse } from "../data.js";

const ISFPPrintReport = ({ ist, k, heizkostenIst, aktivePakete, aktiveMassnahmen, gebaeude, kumuliert, effectivePakete = MASSNAHMENPAKETE }) => {
  const istKlasse = berechneEffizienzklasse(ist.primaerenergie);
  const aktivePaketeObj = effectivePakete.filter(p => aktivePakete.includes(p.id));
  const co2Gesamt = Math.round(ist.co2 * gebaeude.gebaeudenutzflaeche);
  const co2Ziel = Math.round(k.co2 * gebaeude.gebaeudenutzflaeche);
  const kostenEinsparPct = heizkostenIst > 0 ? Math.round((1 - k.heizkosten_gesamt / heizkostenIst) * 100) : 0;

  return (
    <div className="print-only" style={{ fontFamily: "'Geist', sans-serif", color: "#1E1A15" }}>

      {/* ═══ SEITE 1: ÜBERBLICK ═══ */}
      <div style={{ padding: "18px 22px 16px", marginBottom: "16mm", pageBreakInside: "avoid", display: "flex", flexDirection: "column" }}>

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
            const netto = m.investition - (m.ohnehin_anteil ?? 0);
            const quote = m.foerderquote > 0 ? Math.min(m.foerderquote + BEG_BONUS.isfp_bonus, 0.5) : 0;
            return s + netto * quote;
          }, 0));
          return (
            <div key={paket.id} style={{ display: "flex", alignItems: "stretch", marginBottom: 2, minHeight: 46 }}>
              <div style={{
                width: 58, flexShrink: 0,
                background: farbe.bg, color: farbe.text,
                clipPath: "polygon(0 0, 82.76% 0, 100% 50%, 82.76% 100%, 0 100%)",
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
        const hatWPNachDiesemStep = aktiveMassnahmen.includes("M4") && (p3Index >= 0 && i >= p3Index);
        const heizTypFuerEEK = hatWPNachDiesemStep ? "Wärmepumpe Luft/Wasser" : gebaeude.heizung_typ;
        const waerveEEK = waermeEEK(heizTypFuerEEK);

        const summeInvest = paket.massnahmen.reduce((s, m) => s + m.investition, 0);
        const summeFoerderfaehig = paket.massnahmen.reduce((s, m) => s + (m.investition - (m.ohnehin_anteil ?? 0)), 0);
        const summeFoerder = Math.round(paket.massnahmen.reduce((s, m) => {
          const netto = m.investition - (m.ohnehin_anteil ?? 0);
          const quote = m.foerderquote > 0 ? Math.min(m.foerderquote + BEG_BONUS.isfp_bonus, 0.5) : 0;
          return s + netto * quote;
        }, 0));
        const eigenanteil = summeInvest - summeFoerder;
        const foerderStellen = paket.massnahmen
          .map(m => `${m.foerderung_rechtsgrundlage} (${m.foerderung_stelle})`)
          .filter((v, idx, arr) => arr.indexOf(v) === idx)
          .join(" · ");

        return (
          <div key={paket.id} style={{ marginBottom: "12mm", pageBreakInside: "avoid", display: "flex", flexDirection: "column" }}>

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
                    <div key={m.id} style={{ paddingLeft: 14, position: "relative", marginBottom: 6, fontSize: 13, lineHeight: 1.5 }}>
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

export default ISFPPrintReport;
