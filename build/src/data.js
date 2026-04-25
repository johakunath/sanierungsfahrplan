// ============================================================================
// SANIERUNGSFAHRPLAN MFH — Datenmodell & Logik (v3.0)
// - iSFP-Klassifizierung auf Primärenergie-Basis
// - Realistische Förderquoten (Konjunktur-Booster entfernt)
// - BEG = Programm, BAFA/KfW = durchführende Stellen
// - 3 Presets, Auto-Derive Bauteile aus Baujahr
// ============================================================================

// ─── Options für Dropdowns ────────────────────────────────────────────────
export const OPTIONS_GEBAEUDETYP = [
  "Mehrfamilienhaus", "Einfamilienhaus", "Zweifamilienhaus", "Reihenhaus",
];

export const OPTIONS_HEIZUNG = [
  "Fernwärme (Gas-KWK)", "Fernwärme (erneuerbar)",
  "Erdgas Brennwert", "Erdgas Niedertemperatur", "Heizöl",
  "Wärmepumpe Luft/Wasser", "Wärmepumpe Sole/Wasser",
  "Biomasse (Pellets)", "Elektroheizung",
];

export const OPTIONS_DACH = [
  "Flachdach (begrünt)", "Flachdach", "Satteldach", "Walmdach", "Pultdach", "Mansarddach",
];

export const OPTIONS_KELLER = ["beheizt", "unbeheizt", "teilunterkellert", "kein Keller"];

export const OPTIONS_LUEFTUNG = [
  "Fensterlüftung", "Schachtlüftung",
  "Lüftungsanlage mit WRG", "Lüftungsanlage ohne WRG",
];

export const OPTIONS_WARMWASSER = [
  "zentral, über Heizung", "dezentral, elektrisch", "Solarthermie + zentral",
];

export const OPTIONS_ERNEUERBARE = [
  "keine", "Solarthermie", "Photovoltaik", "Wärmepumpe",
  "Biomasse / Holz", "Kombination mehrerer",
];

// Benannte Slider-Stufen für Bauteile — pro Kategorie spezifisch
export const BAUTEIL_STUFEN = {
  waende: {
    1: "Ungedämmt, kalt, Schimmelgefahr",
    2: "Ungedämmt, unsaniert",
    3: "Leichte Innendämmung",
    4: "Teildämmung vorhanden",
    5: "WDVS 8–12 cm",
    6: "WDVS 14–18 cm, modernisiert",
    7: "Passivhaus-Standard, U<0,15",
  },
  dach: {
    1: "Ungedämmt, durchfeuchtet",
    2: "Ungedämmt, trocken",
    3: "Dünn gedämmt (<10 cm)",
    4: "Teildämmung 10–14 cm",
    5: "16–20 cm Dämmung",
    6: "22 cm + Gründach",
    7: "Passivhaus-Standard",
  },
  boden: {
    1: "Ungedämmt, Erdkontakt",
    2: "Alte Bodenplatte, ungedämmt",
    3: "Minimale Dämmung Kellerdecke",
    4: "Kellerdecke gedämmt (6–10 cm)",
    5: "Moderne Dämmung 12–16 cm",
    6: "Hocheffizient, Perimeter",
    7: "Passivhaus-Standard",
  },
  fenster: {
    1: "Einfachverglasung, Zugluft",
    2: "Alte Isolierverglasung, undicht",
    3: "Isolierglas 2-fach, Uw≈1,8",
    4: "Isolierglas 2-fach, Uw≈1,3",
    5: "3-fach Wärmeschutz, Uw≈1,0",
    6: "3-fach modern, Uw≤0,9",
    7: "Passivhausfenster, Uw<0,8",
  },
  lueftung: {
    1: "Undichte Fenster, Zugluft",
    2: "Fensterlüftung manuell",
    3: "Fensterlüftung mit Dichtungen",
    4: "Schachtlüftung / Abluft",
    5: "Lüftungsanlage ohne WRG",
    6: "Zentrale KWL mit WRG 70 %",
    7: "KWL mit WRG >85 %",
  },
  heizung: {
    1: "Alter Standardkessel >25 J.",
    2: "Niedertemperatur >15 J.",
    3: "Gas-Brennwert 10–15 J.",
    4: "Fernwärme Gas-KWK, modern",
    5: "Gas-Brennwert + Solar",
    6: "Hybrid (WP + Gas)",
    7: "Monovalente Wärmepumpe",
  },
  warmwasser: {
    1: "Elektroboiler dezentral",
    2: "Zentral über alte Heizung",
    3: "Zentral über moderne Heizung",
    4: "Zirkulation gedämmt",
    5: "Solarthermie-Unterstützung",
    6: "WP-Warmwasser",
    7: "Vollversorgung regenerativ",
  },
  verteilung: {
    1: "Einrohr, ungedämmt",
    2: "Zweirohr, teils ungedämmt",
    3: "Zweirohr, gedämmt",
    4: "Hydraulischer Abgleich vorhanden",
    5: "Effizienzpumpen + Abgleich",
    6: "Niedertemperaturnetz 45/35 °C",
    7: "Flächenheizung, Systemtemperatur <40 °C",
  },
};

// ─── PRESETS ───────────────────────────────────────────────────────────────
export const PRESETS = {
  efhNachkrieg: {
    id: "efhNachkrieg",
    label: "EFH Nachkriegszeit 1965",
    beschreibung: "1 WE · 145 m² · Heizöl · Klasse F/G · typisches Sanierungsobjekt",
    gebaeude: {
      standort: "München", strasse: "Musterweg 12", plz: "81675",
      baujahr: 1965, typ: "Einfamilienhaus",
      wohneinheiten: 1, wohnflaeche: 145, gebaeudenutzflaeche: 180,
      vollgeschosse: 2, keller: "teilunterkellert", dach: "Satteldach",
      heizung_bj: 2008, heizung_typ: "Heizöl",
      warmwasser: "zentral, über Heizung", lueftung: "Fensterlüftung",
      erneuerbare: "keine", denkmalschutz: false, registriernummer: "—",
    },
    ist: { endenergie: 215, primaerenergie: 236, co2: 63 },
  },
  efh70er: {
    id: "efh70er",
    label: "EFH 70er-Jahre",
    beschreibung: "1 WE · 160 m² · Erdgas · Klasse E · Fenster bereits getauscht",
    gebaeude: {
      standort: "Hannover", strasse: "Birkenallee 8", plz: "30519",
      baujahr: 1978, typ: "Einfamilienhaus",
      wohneinheiten: 1, wohnflaeche: 160, gebaeudenutzflaeche: 200,
      vollgeschosse: 2, keller: "unbeheizt", dach: "Satteldach",
      heizung_bj: 2015, heizung_typ: "Erdgas Brennwert",
      warmwasser: "zentral, über Heizung", lueftung: "Fensterlüftung",
      erneuerbare: "keine", denkmalschutz: false, registriernummer: "—",
    },
    ist: { endenergie: 155, primaerenergie: 172, co2: 41 },
  },
  efh2000er: {
    id: "efh2000er",
    label: "EFH 2000er",
    beschreibung: "1 WE · 150 m² · Gas-Brennwert · Klasse C/D · solide Grundlage",
    gebaeude: {
      standort: "Stuttgart", strasse: "Eichenweg 23", plz: "70569",
      baujahr: 2002, typ: "Einfamilienhaus",
      wohneinheiten: 1, wohnflaeche: 150, gebaeudenutzflaeche: 188,
      vollgeschosse: 2, keller: "beheizt", dach: "Satteldach",
      heizung_bj: 2002, heizung_typ: "Erdgas Brennwert",
      warmwasser: "zentral, über Heizung", lueftung: "Fensterlüftung",
      erneuerbare: "keine", denkmalschutz: false, registriernummer: "—",
    },
    ist: { endenergie: 98, primaerenergie: 118, co2: 25 },
  },
};

// ─── Auto-Derive Bauteile aus Baujahr ──────────────────────────────────────
export function ableiteBauteile(baujahr, heizungTyp, lueftung, warmwasser) {
  const bj = Number(baujahr) || 1970;
  // Grundlogik: älter = schlechter
  // Baujahr-Mapping (grobe TABULA-Orientierung):
  // <1948: 1-2 · 1948-1978: 2 · 1979-1994: 3 · 1995-2009: 4 · 2010-2019: 5 · 2020+: 6
  const alterNote = bj < 1948 ? 2 : bj < 1979 ? 2 : bj < 1995 ? 3 : bj < 2010 ? 4 : bj < 2020 ? 5 : 6;

  const heizungNote =
    /Wärmepumpe/i.test(heizungTyp) ? 7 :
    /erneuerbar/i.test(heizungTyp) ? 6 :
    /Pellets|Biomasse/i.test(heizungTyp) ? 6 :
    /Fernwärme/i.test(heizungTyp) ? 4 :
    /Brennwert/i.test(heizungTyp) ? 4 :
    /Niedertemperatur/i.test(heizungTyp) ? 3 :
    /Heizöl/i.test(heizungTyp) ? 2 :
    /Elektro/i.test(heizungTyp) ? 2 : 3;

  const lueftungNote =
    /WRG/i.test(lueftung) ? 6 :
    /Lüftungsanlage/i.test(lueftung) ? 5 :
    /Schacht/i.test(lueftung) ? 4 : 2;

  const warmwasserNote =
    /Solarthermie/i.test(warmwasser) ? 5 : 3;

  return [
    { id: "waende",     label: "Wände",           note: alterNote,    info: `Baualtersklasse ${bj < 1979 ? "vor 1979" : bj < 2010 ? "1979–2009" : "ab 2010"}` },
    { id: "dach",       label: "Dach",            note: alterNote,    info: `Dämmstandard typisch für BJ ${bj}` },
    { id: "boden",      label: "Boden",           note: alterNote,    info: `Kellerdecke/Bodenplatte BJ ${bj}` },
    { id: "fenster",    label: "Fenster",         note: Math.min(alterNote + 1, 6), info: "Fenster häufig einmal erneuert" },
    { id: "lueftung",   label: "Lüftung",         note: lueftungNote, info: lueftung || "Fensterlüftung" },
    { id: "heizung",    label: "Heizung",         note: heizungNote,  info: heizungTyp },
    { id: "warmwasser", label: "Warmwasser",      note: warmwasserNote, info: warmwasser },
    { id: "verteilung", label: "Wärmeverteilung", note: Math.max(alterNote - 1, 2), info: "Abhängig von Heizungs-Modernisierungsstand" },
  ];
}

// ─── Energiepreise (Stand April 2026) ─────────────────────────────────────
export const ENERGIEPREISE = {
  fernwaerme_gas: 0.13, strom_wp: 0.28, erdgas: 0.11, heizoel: 0.11, biomasse: 0.08,
};

// ─── Impact helper (stufe 1–7 lookup table) ───────────────────────────────
const _imp = (tbl, stufe) => {
  const s = Math.max(0, Math.min(6, Math.round(stufe || 2) - 1));
  const [ee, pe, co2] = tbl[s];
  return { endenergie_delta: ee, primaerenergie_delta: pe, co2_reduktion: co2 };
};

// ─── Maßnahmenpakete ──────────────────────────────────────────────────────
// foerderquote = BEG-Grundförderung (realistisch, ohne Konjunktur-Booster)
// kfw_programm = durchführende Stelle (BAFA für EM, KfW für WG/HZG)
export const MASSNAHMENPAKETE = [
  {
    id: "P1", nummer: 1, titel: "Sofortmaßnahmen", zeitraum: "Heute – 2026", farbe: "rot",
    begruendung: "Geringe Investition, schnelle Wirkung. Voraussetzung für weitere BEG-Anträge.",
    zu_beachten: "Hydraulischer Abgleich erfordert Bestandspläne der Heizungsanlage. Terminkoordination mit Heizungsbauer mind. 4 Wochen im Voraus. BEG-Antrag muss vor Beauftragung gestellt werden.",
    komfortsteigerung: "Gleichmäßigere Wärmeverteilung im gesamten Gebäude. Kein Überheizen einzelner Räume. Geringere Geräuschentwicklung durch niedrigere Pumpenleistung.",
    massnahmen: [
      { id: "M1", titel: "Hydraulischer Abgleich + Heizungsoptimierung",
        beschreibung: "Verfahren B nach VdZ, Pumpentausch, Voreinstellung Thermostatventile, Heizkurvenanpassung.",
        investition: 1800, ohnehin_anteil: 300, foerderquote: 0.15,
        co2_reduktion: 3.5, endenergie_delta: -12, primaerenergie_delta: -14,
        foerderung_rechtsgrundlage: "BEG EM", foerderung_stelle: "BAFA",
        kostenherleitung: "~600 € Planung · ~1.200 € Umsetzung (Hocheffizienzpumpe + Ventile + Abgleich) für EFH",
        impact: bs => _imp([[-15,-18,4.5],[-12,-14,3.5],[-8,-10,2.5],[-4,-5,1.5],[-2,-3,0.8],[-1,-1,0.3],[0,0,0]], (bs||{}).heizung) },
    ],
  },
  {
    id: "P2", nummer: 2, titel: "Hülle & Fenster", zeitraum: "2027 – 2029", farbe: "orange",
    begruendung: "Dach ist bei EFH der größte Wärmeverlustbereich. Fenster im Paket mindert Wärmebrücken.",
    zu_beachten: "Dachdämmung erfordert statische Prüfung bei alter Dachkonstruktion. Fenstertausch koordiniert mit Dachabdichtung planen. Baugenehmigung je nach Denkmalzone erforderlich. Schimmelrisiko durch erhöhte Luftdichtheit prüfen.",
    komfortsteigerung: "Deutlich wärmere Wandoberflächen und Fenster — keine Kaltluftabfälle mehr. Spürbare Reduktion von Lärmdurchdringung durch neue Fenster (Schallschutz Rw ≥ 33 dB). Kein Zugluft-Effekt durch Fensterfugen.",
    massnahmen: [
      { id: "M2", titel: "Dachdämmung Obergeschoss-Decke (22 cm Mineralwolle)",
        beschreibung: "Aufsparren- oder Zwischensparrendämmung, neue Dampfbremse, Luftdichtheitsschicht.",
        investition: 22000, ohnehin_anteil: 4500, foerderquote: 0.15,
        co2_reduktion: 4.2, endenergie_delta: -22, primaerenergie_delta: -26,
        foerderung_rechtsgrundlage: "BEG EM", foerderung_stelle: "BAFA",
        kostenherleitung: "~180 €/m² Dachfläche (~120 m² EFH-Dach) · 20 % davon sind sowieso fällige Dachneueindeckung (nicht förderfähig)",
        impact: bs => _imp([[-26,-31,5.0],[-22,-26,4.2],[-14,-17,2.7],[-7,-8,1.3],[-2,-2,0.3],[-1,-1,0.1],[0,0,0]], (bs||{}).dach) },
      { id: "M3", titel: "Fenstertausch (3-fach Verglasung, Uw ≤ 0,95)",
        beschreibung: "Komplettaustausch, RC2-Beschlag, Einbruchhemmung.",
        investition: 19000, ohnehin_anteil: 6500, foerderquote: 0.15,
        co2_reduktion: 3.0, endenergie_delta: -15, primaerenergie_delta: -18,
        foerderung_rechtsgrundlage: "BEG EM", foerderung_stelle: "BAFA",
        kostenherleitung: "~750 €/m² Fensterfläche (~25 m² EFH) · 35 % davon sind Fenster-Lebenszyklus-Erneuerung (nicht förderfähig)",
        impact: bs => _imp([[-20,-24,4.0],[-17,-20,3.4],[-15,-18,3.0],[-8,-10,1.6],[-2,-2,0.4],[-1,-1,0.1],[0,0,0]], (bs||{}).fenster) },
    ],
  },
  {
    id: "P3", nummer: 3, titel: "Wärmeerzeugung & Fassade", zeitraum: "2030 – 2032", farbe: "gelb",
    begruendung: "Umstieg auf Wärmepumpe wirtschaftlich erst nach Hüllsanierung sinnvoll. KfW 458 verfügbar.",
    zu_beachten: "Wärmepumpe benötigt ausreichend Aufstellfläche außen (mind. 2 m² Abstand zu Grundstücksgrenze, je nach Bundesland). Schallschutzgutachten empfohlen. Heizkörper auf Niedertemperatur-Tauglichkeit prüfen. GEG §71 ab 2026 zwingend bei Heizungstausch.",
    komfortsteigerung: "Wärmepumpe liefert konstante Vorlauftemperaturen — kein Aufheizen nach Nachtabsenkung spürbar. Fassade schützt vor Sommerhitze (Phasenverschiebung). Wertsteigerung durch modernes Erscheinungsbild.",
    massnahmen: [
      { id: "M4", titel: "Luft-Wasser-Wärmepumpe (12 kW, monovalent)",
        beschreibung: "Monoblock-WP außen, neuer Pufferspeicher 300 L, Heizkörpertausch wo nötig.",
        investition: 32000, ohnehin_anteil: 5000, foerderquote: 0.30,
        co2_reduktion: 22, endenergie_delta: -70, primaerenergie_delta: -55,
        foerderung_rechtsgrundlage: "BEG EM / KfW 458", foerderung_stelle: "KfW",
        kostenherleitung: "~2.700 €/kW Leistung EFH-typisch · 16 % davon sind Ersatz der alten Heizung (nicht förderfähig). Grundförderung 30 % + Klimageschwindigkeit 20 % möglich → max. 50 %",
        impact: bs => _imp([[-75,-60,24],[-70,-55,22],[-55,-43,17],[-40,-32,12],[-20,-16,6],[-8,-6,2],[0,0,0]], (bs||{}).heizung) },
      { id: "M5", titel: "Fassadendämmung (WDVS 18 cm Mineralwolle)",
        beschreibung: "Wärmedämmverbundsystem U<0,20, neue Fassadenfarbe, Fensterlaibungen.",
        investition: 38000, ohnehin_anteil: 12000, foerderquote: 0.15,
        co2_reduktion: 6.5, endenergie_delta: -28, primaerenergie_delta: -33,
        foerderung_rechtsgrundlage: "BEG EM", foerderung_stelle: "BAFA",
        kostenherleitung: "~190 €/m² Fassade (~200 m² EFH) · 32 % davon sind sowieso fällige Putzerneuerung + Anstrich (nicht förderfähig)",
        impact: bs => _imp([[-34,-40,7.8],[-28,-33,6.5],[-18,-21,4.1],[-9,-11,2.1],[-2,-3,0.5],[-1,-1,0.1],[0,0,0]], (bs||{}).waende) },
    ],
  },
  {
    id: "P4", nummer: 4, titel: "Eigenstrom", zeitraum: "2030 – 2033", farbe: "gruen",
    begruendung: "PV senkt Strombezug der Wärmepumpe signifikant. Unabhängig von Hüllsanierung umsetzbar.",
    zu_beachten: "Statik des Dachs für PV-Zusatzlast prüfen (ca. 15 kg/m²). Netzanmeldung beim Netzbetreiber mind. 8 Wochen vor Inbetriebnahme. Speicher erfordert separaten Zählerschrank. Marktstammdatenregister-Anmeldung Pflicht.",
    komfortsteigerung: "Weitgehende Unabhängigkeit von Strompreissteigerungen. Wallbox ermöglicht Laden mit Eigenstrom. Monitoring-System gibt Überblick über Energieflüsse in Echtzeit.",
    massnahmen: [
      { id: "M6", titel: "PV-Anlage (10 kWp, Aufdach) + 8 kWh Speicher",
        beschreibung: "Süd- oder Ost-West-Ausrichtung, Lithium-Speicher, Wallbox-Vorbereitung.",
        investition: 18000, ohnehin_anteil: 0, foerderquote: 0,
        co2_reduktion: 4.0, endenergie_delta: 0, primaerenergie_delta: -12,
        foerderung_rechtsgrundlage: "KfW 270 (Kredit) + EEG-Einspeisung", foerderung_stelle: "KfW",
        kostenherleitung: "~1.500 €/kWp inkl. Speicher und Montage · keine nicht-förderfähigen Anteile (Neuinvestition)",
        impact: () => ({ endenergie_delta: 0, primaerenergie_delta: -12, co2_reduktion: 4.0 }) },
    ],
  },
];

// Nur iSFP-Bonus, kein Konjunktur-Booster mehr
export const BEG_BONUS = { isfp_bonus: 0.05 };

// ─── Berechnung ───────────────────────────────────────────────────────────

// iSFP-Klassifizierung: basiert auf PRIMÄRENERGIE (nicht Endenergie)
// Quelle: GEG §86 / BAFA iSFP-Bewertungsschema
export function berechneEffizienzklasse(primaerenergie) {
  if (primaerenergie <= 30)  return "A+";
  if (primaerenergie <= 50)  return "A";
  if (primaerenergie <= 75)  return "B";
  if (primaerenergie <= 100) return "C";
  if (primaerenergie <= 130) return "D";
  if (primaerenergie <= 160) return "E";
  if (primaerenergie <= 200) return "F";
  if (primaerenergie <= 250) return "G";
  return "H";
}

export function preisFuerHeizung(typ) {
  if (!typ) return ENERGIEPREISE.fernwaerme_gas;
  if (typ.includes("Fernwärme"))   return ENERGIEPREISE.fernwaerme_gas;
  if (typ.includes("Wärmepumpe"))  return ENERGIEPREISE.strom_wp;
  if (typ.includes("Öl") || typ.includes("Heizöl")) return ENERGIEPREISE.heizoel;
  if (typ.includes("Erdgas") || typ.includes("Gas"))return ENERGIEPREISE.erdgas;
  if (typ.includes("Biomasse") || typ.includes("Pellets")) return ENERGIEPREISE.biomasse;
  return ENERGIEPREISE.fernwaerme_gas;
}

export function berechneHeizkosten(endenergie, wohnflaeche, heizungTyp) {
  return Math.round(endenergie * wohnflaeche * preisFuerHeizung(heizungTyp));
}

// aktiveMassnahmen = array of measure IDs e.g. ["M1","M2","M4"]
// gebaeude.bauteile_state = { waende, dach, fenster, keller, heizung, warmwasser } (stufe 1–7)
export function berechneNachMassnahmen(aktiveMassnahmen, ist, gebaeude) {
  let endenergie = ist.endenergie;
  let primaerenergie = ist.primaerenergie;
  let co2 = ist.co2;
  let invest_gesamt = 0;
  let instand_gesamt = 0;
  let foerderung_gesamt = 0;
  const bs = gebaeude.bauteile_state || null;

  MASSNAHMENPAKETE.forEach(paket => {
    paket.massnahmen.forEach(m => {
      if (!aktiveMassnahmen.includes(m.id)) return;
      const imp = m.impact ? m.impact(bs) : { endenergie_delta: m.endenergie_delta, primaerenergie_delta: m.primaerenergie_delta, co2_reduktion: m.co2_reduktion };
      endenergie     += imp.endenergie_delta;
      primaerenergie += imp.primaerenergie_delta;
      co2            -= imp.co2_reduktion;
      invest_gesamt  += m.investition;
      instand_gesamt += m.ohnehin_anteil;
      const netto = m.investition - m.ohnehin_anteil;
      const bonus = BEG_BONUS.isfp_bonus;
      const effektive_quote = m.foerderquote > 0 ? Math.min(m.foerderquote + bonus, 0.50) : 0;
      foerderung_gesamt += Math.max(0, netto * effektive_quote);
    });
  });

  endenergie = Math.max(endenergie, 25);
  primaerenergie = Math.max(primaerenergie, 20);
  co2 = Math.max(co2, 2);

  const hatWP = aktiveMassnahmen.includes("M4");
  const heizungTyp = hatWP ? "Wärmepumpe Luft/Wasser" : gebaeude.heizung_typ;

  return {
    endenergie: Math.round(endenergie),
    primaerenergie: Math.round(primaerenergie),
    co2: Math.round(co2 * 10) / 10,
    effizienzklasse: berechneEffizienzklasse(primaerenergie),
    invest_gesamt: Math.round(invest_gesamt),
    instand_gesamt: Math.round(instand_gesamt),
    foerderung_gesamt: Math.round(foerderung_gesamt),
    eigenanteil: Math.round(invest_gesamt - foerderung_gesamt),
    heizkosten_gesamt: berechneHeizkosten(endenergie, gebaeude.wohnflaeche, heizungTyp),
  };
}

// Kumulierte Berechnung — zeigt Schritt-für-Schritt-Wirkung (BAFA-Muster)
export function berechneKumuliert(aktiveMassnahmen, ist, gebaeude) {
  const ergebnisse = [];
  let laufendeMassnahmen = [];
  for (const paket of MASSNAHMENPAKETE) {
    const aktivInPaket = paket.massnahmen.filter(m => aktiveMassnahmen.includes(m.id));
    if (aktivInPaket.length === 0) continue;
    laufendeMassnahmen = [...laufendeMassnahmen, ...aktivInPaket.map(m => m.id)];
    const k = berechneNachMassnahmen(laufendeMassnahmen, ist, gebaeude);
    ergebnisse.push({ paket, nachher: k });
  }
  return ergebnisse;
}

// ─── Maßnahmen-Bewertung (€/kWh Primärenergie) ────────────────────────────
// Returns measures sorted best-first (lowest cost per kWh saved).
// Top N can be used to show "Empfohlen" tags in the UI.
export function bewerteMassnahmen(massnahmen, bauteile_state, gebaeude) {
  const wf = (gebaeude && gebaeude.wohnflaeche) || 150;
  const bs = bauteile_state || {};
  return massnahmen
    .map(m => {
      const impact = m.impact ? m.impact(bs) : { primaerenergie_delta: m.primaerenergie_delta || 0 };
      const pe_saved = Math.abs(impact.primaerenergie_delta) * wf / 1000;
      const invest_netto = m.investition - m.ohnehin_anteil;
      const score = pe_saved > 0 ? invest_netto / pe_saved : Infinity;
      return { id: m.id, score, pe_saved, invest_netto };
    })
    .sort((a, b) => a.score - b.score);
}

// ─── Farbcodes ────────────────────────────────────────────────────────────
export const EFFIZIENZ_FARBEN = {
  "A+": "#00843D", "A": "#34A030", "B": "#95C11F",
  "C":  "#C5D62E", "D": "#F6D400", "E": "#F6A400",
  "F":  "#F07D00", "G": "#E3501C", "H": "#E30613",
};

export const NOTE_FARBEN = {
  1: "#E30613", 2: "#E3501C", 3: "#F07D00", 4: "#F6A400",
  5: "#C5D62E", 6: "#34A030", 7: "#00843D",
};

export const PAKET_FARBEN = {
  rot:    { bg: "#E30613", text: "#FFFFFF", hell: "#FADBD8" },
  orange: { bg: "#F07D00", text: "#FFFFFF", hell: "#FBE3CE" },
  gelb:   { bg: "#F6D400", text: "#1E1A15", hell: "#FBF2C2" },
  gruen:  { bg: "#00843D", text: "#FFFFFF", hell: "#D0E8D8" },
};
