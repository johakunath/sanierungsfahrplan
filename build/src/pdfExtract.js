// ============================================================================
// PDF-EXTRAKTION für Energieausweis / Exposé / Gebäudedatenblatt
// Strategy: PDF.js (CDN) → Textextraktion → Regex-Matching auf Standard-Felder
// ============================================================================

// Lazy-load PDF.js (v3.11 UMD — läuft als script-tag, keine ESM-Probleme)
const PDFJS_VERSION = "3.11.174";
const PDFJS_CDNS = [
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`,
  `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build`,
];

let _pdfjsPromise = null;
let _loadedPdfJsBase = null;

const setWorkerFromBase = (base) => {
  if (!window.pdfjsLib || !base) return;
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.js`;
  _loadedPdfJsBase = base;
};

const loadScript = (src) => new Promise((resolve, reject) => {
  const s = document.createElement("script");
  s.src = src;
  s.onload = resolve;
  s.onerror = reject;
  document.head.appendChild(s);
});

export function loadPdfJs() {
  if (window.pdfjsLib) {
    if (_loadedPdfJsBase) setWorkerFromBase(_loadedPdfJsBase);
    return Promise.resolve(window.pdfjsLib);
  }
  if (_pdfjsPromise) return _pdfjsPromise;

  _pdfjsPromise = (async () => {
    let lastErr = null;
    for (const base of PDFJS_CDNS) {
      try {
        await loadScript(`${base}/pdf.min.js`);
        if (!window.pdfjsLib) throw new Error("pdfjsLib nicht verfügbar nach Laden");
        setWorkerFromBase(base);
        return window.pdfjsLib;
      } catch (e) {
        lastErr = e;
      }
    }
    throw new Error(`PDF.js konnte nicht geladen werden (${PDFJS_CDNS.join(" oder ")})${lastErr ? `: ${lastErr.message || lastErr}` : ""}`);
  })().catch((err) => {
    _pdfjsPromise = null;
    return Promise.reject(err);
  });

  return _pdfjsPromise;
}

// Hauptfunktion: File → { fields: {...}, rawText, matched: [...], missed: [...] }
export async function extractFromPDF(file) {
  const pdfjs = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map(it => it.str).join(" ") + "\n";
  }

  return parseEnergieausweisText(fullText);
}

// ─── Regex-Patterns für EnEV/GEG-Energieausweis ───────────────────────────
export function parseEnergieausweisText(text) {
  // Normalisieren: mehrfache Whitespaces reduzieren, Komma durch Punkt NICHT global (nur bei Zahlen)
  const T = text.replace(/\s+/g, " ");

  const g_str = (re, idx = 1) => {
    const m = T.match(re);
    return m ? m[idx].trim() : null;
  };
  const g_num = (re, idx = 1) => {
    const m = T.match(re);
    if (!m) return null;
    const n = parseFloat(m[idx].replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const gebaeude_partial = {};
  const ist_partial = {};
  const matched = [];
  const missed = [];

  const tryGet = (label, fn, target, key) => {
    const v = fn();
    if (v !== null && v !== undefined && v !== "") {
      target[key] = v;
      matched.push({ label, value: v });
    } else {
      missed.push(label);
    }
  };

  // ─── Gebäude-Stammdaten ─────────────────────────────────────────
  tryGet("Gebäudetyp",
    () => g_str(/Gebäudetyp\s+(Einfamilienhaus|Zweifamilienhaus|Doppelhaushälfte|Reihenhaus)/i),
    gebaeude_partial, "typ");

  tryGet("Adresse",
    () => g_str(/Adresse\s+(.+?)\s+Gebäudeteil/i) ||
          g_str(/Adresse\s+(.+?)(?:\s{2,}|\s+Baujahr)/i),
    gebaeude_partial, "strasse_full");

  // Baujahr Gebäude (nicht Wärmeerzeuger)
  tryGet("Baujahr Gebäude",
    () => {
      const m = T.match(/Baujahr\s+Gebäude(?:\s*\d+)?\s*(?:,\s*\d+)?\s+(\d{4})/i);
      if (!m) return null;
      const y = parseInt(m[1], 10);
      return (y >= 1700 && y <= 2030) ? y : null;
    },
    gebaeude_partial, "baujahr");

  tryGet("Baujahr Wärmeerzeuger",
    () => {
      const m = T.match(/Baujahr\s+Wärmeerzeuger(?:\s*\d+)?\s*(?:,\s*\d+)?\s+(\d{4})/i);
      if (!m) return null;
      const y = parseInt(m[1], 10);
      return (y >= 1950 && y <= 2030) ? y : null;
    },
    gebaeude_partial, "heizung_bj");

  tryGet("Anzahl Wohnungen",
    () => g_num(/Anzahl\s+Wohnungen\s+(\d+)/i),
    gebaeude_partial, "wohneinheiten");

  tryGet("Gebäudenutzfläche",
    () => g_num(/Gebäudenutzfläche\s*\(?\s*A\s*[Nn]?\s*\)?\s+([\d\.,]+)\s*m/i),
    gebaeude_partial, "gebaeudenutzflaeche");

  // Energieträger → Heizungstyp-Vermutung
  tryGet("Energieträger Heizung",
    () => {
      const m = T.match(/(?:Wesentliche\s+)?Energieträger[^a-zA-ZÄÖÜ]*(?:für\s+)?Heizung[^a-zA-ZÄÖÜ]+(Erdgas|Fernwärme|Heizöl|Öl|Pellets|Biomasse|Holz|Strom|Wärmepumpe)/i);
      if (!m) return null;
      const raw = m[1];
      if (/Erdgas/i.test(raw))      return "Erdgas Brennwert";
      if (/Fernwärme/i.test(raw))   return "Fernwärme (Gas-KWK)";
      if (/Öl|Heizöl/i.test(raw))   return "Heizöl";
      if (/Pellets|Biomasse|Holz/i.test(raw)) return "Biomasse (Pellets)";
      if (/Wärmepumpe/i.test(raw))  return "Wärmepumpe Luft/Wasser";
      if (/Strom/i.test(raw))       return "Elektroheizung";
      return null;
    },
    gebaeude_partial, "heizung_typ");

  // Art der Lüftung (Checkbox-Heuristik)
  tryGet("Lüftung",
    () => {
      // Ohne Checkbox-Zeichen: nimm die am Anfang stehende Option
      if (/Fensterlüftung/i.test(T) && !/Lüftungsanlage\s+mit\s+Wärmerückgewinnung[^✓]*☑/i.test(T)) {
        return "Fensterlüftung";
      }
      if (/Lüftungsanlage\s+mit\s+Wärmerückgewinnung/i.test(T)) return "Lüftungsanlage mit WRG";
      if (/Schachtlüftung/i.test(T)) return "Schachtlüftung";
      return null;
    },
    gebaeude_partial, "lueftung");

  // Erneuerbare Energien
  tryGet("Erneuerbare Energien",
    () => {
      const m = T.match(/Erneuerbare\s+Energien[^\n]*?Art[:\s]+(keine|Solarthermie|Photovoltaik|Biomasse|Wärmepumpe|Holz)/i);
      return m ? m[1] : null;
    },
    gebaeude_partial, "erneuerbare");

  // Registriernummer
  tryGet("Registriernummer",
    () => g_str(/Registriernummer(?:\s*[²2])?\s*([A-Z]{2}-\d{4}-\d+)/),
    gebaeude_partial, "registriernummer");

  // ─── Energetische Kennzahlen ────────────────────────────────────
  // Endenergie (verbrauch oder bedarf — beides akzeptiert)
  tryGet("Endenergie",
    () => {
      const m = T.match(/Endenergie(?:verbrauch|bedarf)\s+dieses\s+Gebäudes[^\d]*?(\d+[,.]?\d*)\s*kWh/i);
      if (m) return parseFloat(m[1].replace(",", "."));
      const m2 = T.match(/Endenergie(?:verbrauch|bedarf)[^\d]*?(\d+[,.]?\d*)\s*kWh\/\(\s*m/i);
      return m2 ? parseFloat(m2[1].replace(",", ".")) : null;
    },
    ist_partial, "endenergie");

  tryGet("Primärenergie",
    () => {
      const m = T.match(/Primärenergie(?:verbrauch|bedarf)\s+dieses\s+Gebäudes[^\d]*?(\d+[,.]?\d*)\s*kWh/i);
      if (m) return parseFloat(m[1].replace(",", "."));
      const m2 = T.match(/Primärenergie(?:verbrauch|bedarf)[^\d]*?(\d+[,.]?\d*)\s*kWh\/\(\s*m/i);
      return m2 ? parseFloat(m2[1].replace(",", ".")) : null;
    },
    ist_partial, "primaerenergie");

  // CO₂-Emissionen (optional - häufig leer)
  tryGet("CO₂-Emissionen",
    () => {
      const m = T.match(/CO[₂2]?\s*[-–]?\s*Emissionen[^\d]{1,20}(\d+[,.]?\d*)\s*kg/i);
      return m ? parseFloat(m[1].replace(",", ".")) : null;
    },
    ist_partial, "co2");

  // ─── Rundung der Zahlen ──────────────────────────────────────────
  if (ist_partial.endenergie)     ist_partial.endenergie     = Math.round(ist_partial.endenergie);
  if (ist_partial.primaerenergie) ist_partial.primaerenergie = Math.round(ist_partial.primaerenergie);
  if (ist_partial.co2)            ist_partial.co2            = Math.round(ist_partial.co2 * 10) / 10;
  if (gebaeude_partial.gebaeudenutzflaeche) gebaeude_partial.gebaeudenutzflaeche = Math.round(gebaeude_partial.gebaeudenutzflaeche);

  // Adresse splitten in Straße + PLZ wenn möglich
  if (gebaeude_partial.strasse_full) {
    const addr = gebaeude_partial.strasse_full;
    const plzMatch = addr.match(/(.+?)\s*,?\s*(\d{5})\s+(.+)/);
    if (plzMatch) {
      gebaeude_partial.strasse = plzMatch[1].trim();
      gebaeude_partial.plz = plzMatch[2];
      gebaeude_partial.standort = plzMatch[3].trim();
    } else {
      gebaeude_partial.strasse = addr;
    }
    delete gebaeude_partial.strasse_full;
  }

  // Wohnfläche heuristisch: GNF / 1.3 wenn nicht anders gegeben
  if (gebaeude_partial.gebaeudenutzflaeche && !gebaeude_partial.wohnflaeche) {
    gebaeude_partial.wohnflaeche = Math.round(gebaeude_partial.gebaeudenutzflaeche / 1.3);
  }

  return {
    gebaeude: gebaeude_partial,
    ist: ist_partial,
    matched,
    missed,
    rawTextLength: text.length,
  };
}
