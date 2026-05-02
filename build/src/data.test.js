import { describe, it, expect } from "vitest";
import {
  ableiteBauteile,
  wpTypEmpfehlung,
  bewerteMassnahmen,
  berechneNachMassnahmen,
  berechneKumuliert,
  PRESETS,
  MASSNAHMENPAKETE,
} from "./data.js";

// ─── helpers ──────────────────────────────────────────────────────────────

function buildGebaeudeWithState(preset) {
  const { gebaeude, ist } = preset;
  const bauteile = ableiteBauteile(gebaeude.baujahr, gebaeude.heizung_typ, gebaeude.lueftung, gebaeude.warmwasser);
  const bauteile_state = Object.fromEntries(bauteile.map(b => [b.id, b.note]));
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
  const { gebaeude } = buildGebaeudeWithState(PRESETS.efhNachkrieg).gebaeude ? buildGebaeudeWithState(PRESETS.efhNachkrieg) : {};
  const allMassnahmen = MASSNAHMENPAKETE.flatMap(p => p.massnahmen);

  it("empfohlen score < 0.75 × median", () => {
    const result = bewerteMassnahmen(allMassnahmen, {}, { wohnflaeche: 145 });
    const finite = result.filter(m => Number.isFinite(m.score));
    const sorted = [...finite].sort((a, b) => a.score - b.score);
    const median = sorted[Math.floor(sorted.length / 2)].score;
    result.filter(m => m.empfohlen).forEach(m => {
      expect(m.score).toBeLessThan(median * 0.75);
    });
  });

  it("nichtEmpfohlen score > 2 × median or Infinity", () => {
    const result = bewerteMassnahmen(allMassnahmen, {}, { wohnflaeche: 145 });
    const finite = result.filter(m => Number.isFinite(m.score));
    const sorted = [...finite].sort((a, b) => a.score - b.score);
    const median = sorted[Math.floor(sorted.length / 2)].score;
    result.filter(m => m.nichtEmpfohlen).forEach(m => {
      expect(!Number.isFinite(m.score) || m.score > median * 2.0).toBe(true);
    });
  });

  it("no measure is both empfohlen and nichtEmpfohlen", () => {
    const result = bewerteMassnahmen(allMassnahmen, {}, { wohnflaeche: 145 });
    result.forEach(m => {
      expect(m.empfohlen && m.nichtEmpfohlen).toBe(false);
    });
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

  it("Eigenanteil = 119.550 €", () => {
    expect(k.eigenanteil).toBe(119550);
  });

  it("invest_gesamt > foerderung_gesamt", () => {
    expect(k.invest_gesamt).toBeGreaterThan(k.foerderung_gesamt);
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
