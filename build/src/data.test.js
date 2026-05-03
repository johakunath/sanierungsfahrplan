import { describe, it, expect } from "vitest";
import {
  ableiteBauteile,
  wpTypEmpfehlung,
  bewerteMassnahmen,
  berechneNachMassnahmen,
  berechneKumuliert,
  PRESETS,
  MASSNAHMENPAKETE,
  berechneEffizienzklasse,
} from "./data.js";

// ─── helpers ──────────────────────────────────────────────────────────────

function buildGebaeudeWithState(preset) {
  const { gebaeude, ist } = preset;
  const bauteile = ableiteBauteile(gebaeude.baujahr, gebaeude.heizung_typ, gebaeude.lueftung, gebaeude.warmwasser);
  const overrides = preset.bauteile_overrides || {};
  const bauteile_state = Object.fromEntries(bauteile.map(b => [b.id, overrides[b.id] ?? b.note]));
  return { gebaeude: { ...gebaeude, bauteile_state }, ist };
}

// ─── ableiteBauteile ──────────────────────────────────────────────────────

describe("ableiteBauteile", () => {
  it("1965 / Heizöl → waende note 2, dach note 2, heizung note 2", () => {
    const b = ableiteBauteile(1965, "Heizöl", "Fensterlüftung", "zentral, über Heizung");
    const byId = Object.fromEntries(b.map(x => [x.id, x]));
    expect(byId.waende.note).toBe(2);
    expect(byId.dach.note).toBe(2);
    expect(byId.heizung.note).toBe(2);
  });

  it("2015 / Wärmepumpe Luft/Wasser + WRG → heizung note 7, lueftung note 6", () => {
    const b = ableiteBauteile(2015, "Wärmepumpe Luft/Wasser", "Lüftungsanlage mit WRG", "zentral, über Heizung");
    const byId = Object.fromEntries(b.map(x => [x.id, x]));
    expect(byId.heizung.note).toBe(7);
    expect(byId.lueftung.note).toBe(6);
  });

  it("returns 8 entries with required ids", () => {
    const b = ableiteBauteile(1990, "Erdgas Brennwert", "Fensterlüftung", "zentral, über Heizung");
    const ids = b.map(x => x.id);
    for (const id of ["waende", "dach", "boden", "fenster", "lueftung", "heizung", "warmwasser", "verteilung"]) {
      expect(ids).toContain(id);
    }
  });

  it("is deterministic — same args produce identical notes", () => {
    const a = ableiteBauteile(1978, "Erdgas Brennwert", "Fensterlüftung", "zentral, über Heizung");
    const b = ableiteBauteile(1978, "Erdgas Brennwert", "Fensterlüftung", "zentral, über Heizung");
    expect(a.map(x => x.note)).toEqual(b.map(x => x.note));
  });

  it("efhNachkrieg preset → IST EEK G", () => {
    const { gebaeude } = PRESETS.efhNachkrieg;
    const b = ableiteBauteile(gebaeude.baujahr, gebaeude.heizung_typ, gebaeude.lueftung, gebaeude.warmwasser);
    const byId = Object.fromEntries(b.map(x => [x.id, x]));
    expect(byId.waende.note).toBeLessThanOrEqual(3);
    expect(byId.dach.note).toBeLessThanOrEqual(3);
  });

  it("efh70er preset bauteile_overrides → fenster note 5", () => {
    const { gebaeude, bauteile_overrides } = PRESETS.efh70er;
    const b = ableiteBauteile(gebaeude.baujahr, gebaeude.heizung_typ, gebaeude.lueftung, gebaeude.warmwasser);
    const overrides = bauteile_overrides || {};
    const byId = Object.fromEntries(b.map(x => [x.id, { ...x, note: overrides[x.id] ?? x.note }]));
    expect(byId.fenster.note).toBe(5);
  });

  it("efh2000er preset → envelope notes higher than efhNachkrieg", () => {
    const b65 = ableiteBauteile(1965, "Heizöl", "Fensterlüftung", "zentral, über Heizung");
    const b00 = ableiteBauteile(2002, "Erdgas Brennwert", "Fensterlüftung", "zentral, über Heizung");
    const by65 = Object.fromEntries(b65.map(x => [x.id, x]));
    const by00 = Object.fromEntries(b00.map(x => [x.id, x]));
    expect(by00.waende.note).toBeGreaterThan(by65.waende.note);
    expect(by00.dach.note).toBeGreaterThan(by65.dach.note);
  });
});

// ─── wpTypEmpfehlung ──────────────────────────────────────────────────────

describe("wpTypEmpfehlung", () => {
  it("≤40 °C + envAvg ≥ 4 → Monovalent", () => {
    expect(wpTypEmpfehlung(35, 5).typ).toBe("Monovalent");
  });

  it("≤50 °C + envAvg ≥ 3 → Monovalent / Monoenergetic", () => {
    expect(wpTypEmpfehlung(50, 3).typ).toBe("Monovalent / Monoenergetic");
  });

  it("≤55 °C → Monoenergetic", () => {
    expect(wpTypEmpfehlung(55, 2).typ).toBe("Monoenergetic");
  });

  it(">55 °C → Bivalent / Hybrid", () => {
    expect(wpTypEmpfehlung(65, 2).typ).toBe("Bivalent / Hybrid");
  });
});

// ─── bewerteMassnahmen ────────────────────────────────────────────────────

describe("bewerteMassnahmen", () => {
  const allMassnahmen = MASSNAHMENPAKETE.flatMap(p => p.massnahmen);

  it("empfohlen measures have score < 10.5", () => {
    const result = bewerteMassnahmen(allMassnahmen, {}, { wohnflaeche: 145 });
    result.filter(m => m.empfohlen).forEach(m => {
      expect(m.score).toBeLessThan(10.5);
    });
  });

  it("nichtEmpfohlen measures have score > 20 or Infinity", () => {
    const result = bewerteMassnahmen(allMassnahmen, {}, { wohnflaeche: 145 });
    result.filter(m => m.nichtEmpfohlen).forEach(m => {
      expect(!Number.isFinite(m.score) || m.score > 20.0).toBe(true);
    });
  });

  it("no measure is both empfohlen and nichtEmpfohlen", () => {
    const result = bewerteMassnahmen(allMassnahmen, {}, { wohnflaeche: 145 });
    result.forEach(m => {
      expect(m.empfohlen && m.nichtEmpfohlen).toBe(false);
    });
  });

  it("single BADGE_EXEMPT measure → neither empfohlen nor nichtEmpfohlen", () => {
    const single = [allMassnahmen[0]]; // M1 is pflichtschritt (BADGE_EXEMPT)
    const result = bewerteMassnahmen(single, {}, { wohnflaeche: 145 });
    expect(result[0].empfohlen).toBe(false);
    expect(result[0].nichtEmpfohlen).toBe(false);
  });

  it("efhNachkrieg: M2 + M3 + M5 are empfohlen (bad building → major renovation)", () => {
    const { gebaeude } = buildGebaeudeWithState(PRESETS.efhNachkrieg);
    const result = bewerteMassnahmen(allMassnahmen, gebaeude.bauteile_state, gebaeude);
    const byId = Object.fromEntries(result.map(m => [m.id, m]));
    expect(byId.M2.empfohlen).toBe(true);
    expect(byId.M3.empfohlen).toBe(true);
    expect(byId.M5.empfohlen).toBe(true);
  });

  it("efh70er (fenster=5): M3 is nichtEmpfohlen, M2 + M5 are empfohlen", () => {
    const { gebaeude } = buildGebaeudeWithState(PRESETS.efh70er);
    const result = bewerteMassnahmen(allMassnahmen, gebaeude.bauteile_state, gebaeude);
    const byId = Object.fromEntries(result.map(m => [m.id, m]));
    expect(byId.M3.nichtEmpfohlen).toBe(true);
    expect(byId.M2.empfohlen).toBe(true);
    expect(byId.M5.empfohlen).toBe(true);
  });

  it("efh2000er: M3 is nichtEmpfohlen, M6 is empfohlen (good building → minimal intervention)", () => {
    const { gebaeude } = buildGebaeudeWithState(PRESETS.efh2000er);
    const result = bewerteMassnahmen(allMassnahmen, gebaeude.bauteile_state, gebaeude);
    const byId = Object.fromEntries(result.map(m => [m.id, m]));
    expect(byId.M3.nichtEmpfohlen).toBe(true);
    expect(byId.M6.empfohlen).toBe(true);
  });
});

// ─── berechneNachMassnahmen ───────────────────────────────────────────────

describe("berechneNachMassnahmen (efhNachkrieg, all measures)", () => {
  const { gebaeude, ist } = buildGebaeudeWithState(PRESETS.efhNachkrieg);
  const allIds = MASSNAHMENPAKETE.flatMap(p => p.massnahmen.map(m => m.id));
  const k = berechneNachMassnahmen(allIds, ist, gebaeude);

  it("PE = 86 kWh/(m²·a)", () => {
    expect(k.primaerenergie).toBe(86);
  });

  it("EEK is C", () => {
    expect(k.effizienzklasse).toBe("C");
  });

  it("Eigenanteil = 116.850 € (incl. Klimageschwindigkeitsbonus for Heizöl→WP)", () => {
    expect(k.eigenanteil).toBe(116850);
  });

  it("invest_gesamt > foerderung_gesamt", () => {
    expect(k.invest_gesamt).toBeGreaterThan(k.foerderung_gesamt);
  });

  it("eigenanteil = invest_gesamt - foerderung_gesamt", () => {
    expect(k.eigenanteil).toBe(k.invest_gesamt - k.foerderung_gesamt);
  });
});

// ─── berechneNachMassnahmen: efh70er ─────────────────────────────────────

describe("berechneNachMassnahmen (efh70er, all measures, fenster=5 override)", () => {
  const { gebaeude, ist } = buildGebaeudeWithState(PRESETS.efh70er);
  const allIds = MASSNAHMENPAKETE.flatMap(p => p.massnahmen.map(m => m.id));
  const k = berechneNachMassnahmen(allIds, ist, gebaeude);

  it("PE = 65 kWh/(m²·a) — M3 saves little because fenster already at note 5", () => {
    expect(k.primaerenergie).toBe(65);
  });

  it("EEK is B", () => {
    expect(k.effizienzklasse).toBe("B");
  });

  it("Eigenanteil = 116.850 € (incl. Klimageschwindigkeitsbonus for Erdgas→WP)", () => {
    expect(k.eigenanteil).toBe(116850);
  });

  it("eigenanteil = invest_gesamt - foerderung_gesamt", () => {
    expect(k.eigenanteil).toBe(k.invest_gesamt - k.foerderung_gesamt);
  });
});

// ─── berechneNachMassnahmen: no measures ─────────────────────────────────

describe("berechneNachMassnahmen (no measures active)", () => {
  const { gebaeude, ist } = buildGebaeudeWithState(PRESETS.efhNachkrieg);
  const k = berechneNachMassnahmen([], ist, gebaeude);

  it("PE matches IST", () => {
    expect(k.primaerenergie).toBe(ist.primaerenergie);
  });

  it("EEK matches IST EEK", () => {
    expect(k.effizienzklasse).toBe(berechneEffizienzklasse(ist.primaerenergie));
  });

  it("invest, foerderung, eigenanteil all zero", () => {
    expect(k.invest_gesamt).toBe(0);
    expect(k.foerderung_gesamt).toBe(0);
    expect(k.eigenanteil).toBe(0);
  });
});

// ─── berechneNachMassnahmen: idempotency ─────────────────────────────────

describe("berechneNachMassnahmen is deterministic", () => {
  it("same inputs always produce same output", () => {
    const { gebaeude, ist } = buildGebaeudeWithState(PRESETS.efhNachkrieg);
    const allIds = MASSNAHMENPAKETE.flatMap(p => p.massnahmen.map(m => m.id));
    const r1 = berechneNachMassnahmen(allIds, ist, gebaeude);
    const r2 = berechneNachMassnahmen(allIds, ist, gebaeude);
    expect(r1.primaerenergie).toBe(r2.primaerenergie);
    expect(r1.eigenanteil).toBe(r2.eigenanteil);
    expect(r1.effizienzklasse).toBe(r2.effizienzklasse);
  });
});

// ─── berechneKumuliert ────────────────────────────────────────────────────

describe("berechneKumuliert (efhNachkrieg, all measures)", () => {
  const { gebaeude, ist } = buildGebaeudeWithState(PRESETS.efhNachkrieg);
  const allIds = MASSNAHMENPAKETE.flatMap(p => p.massnahmen.map(m => m.id));
  const steps = berechneKumuliert(allIds, ist, gebaeude);
  const k = berechneNachMassnahmen(allIds, ist, gebaeude);

  it("step count equals number of active packages", () => {
    const activePkgs = MASSNAHMENPAKETE.filter(p => p.massnahmen.some(m => allIds.includes(m.id)));
    expect(steps.length).toBe(activePkgs.length);
  });

  it("last step PE equals berechneNachMassnahmen PE", () => {
    const last = steps[steps.length - 1].nachher;
    expect(last.primaerenergie).toBe(k.primaerenergie);
  });

  it("PE decreases or stays flat across steps", () => {
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].nachher.primaerenergie).toBeLessThanOrEqual(steps[i - 1].nachher.primaerenergie);
    }
  });
});
