import { describe, expect, it } from "vitest";
import { cmrCategory, formatStatement, parseStatements, suggestSignalWord } from "@/lib/ghs";
import { canRelease, draftFromSubstance } from "@/lib/instructions";
import { pictoKind } from "@/lib/pictograms";
import { can } from "@/lib/roles";

describe("H- und P-Sätze", () => {
  it("liest Codes aus freier Eingabe", () => {
    expect(parseStatements("h225, H319;H336 EUH066", "H")).toEqual(["H225", "H319", "H336", "EUH066"]);
    expect(parseStatements("H350i H361d", "H")).toEqual(["H350i", "H361d"]);
    expect(parseStatements("P210, P305+P351+P338, p501", "P")).toEqual(["P210", "P305_P351_P338", "P501"]);
  });
  it("formatiert mit deutschem Text", () => {
    expect(formatStatement("H225")).toBe("H225 – Flüssigkeit und Dampf leicht entzündbar.");
    expect(formatStatement("P305_P351_P338")).toMatch(/^P305 \+ P351 \+ P338 – Bei Kontakt mit den Augen/);
    expect(formatStatement("H999")).toBe("H999");
  });
  it("erkennt CMR-Stoffe", () => {
    expect(cmrCategory(["H225", "H350"])).toBe("1");
    expect(cmrCategory(["H361d"])).toBe("2");
    expect(cmrCategory(["H315"])).toBeNull();
  });
  it("schlägt das Signalwort vor", () => {
    expect(suggestSignalWord(["GHS02"], ["H225"])).toBe("DANGER");
    expect(suggestSignalWord(["GHS07"], ["H315"])).toBe("WARNING");
    expect(suggestSignalWord([], [])).toBe("NONE");
  });
});

describe("Betriebsanweisung", () => {
  it("Entwurf aus Gefahrstoff enthält Gefahren, Maßnahmen, Erste Hilfe und Gebotszeichen", () => {
    const d = draftFromSubstance({
      name: "Aceton",
      usage: "Reinigen von Metallteilen",
      pictograms: ["GHS02", "GHS07"],
      hStatements: ["H225", "H319", "H336"],
      pStatements: ["P210", "P280", "P305_P351_P338", "P403_P233", "P501"],
      ppe: "Nitrilhandschuhe, Schutzbrille",
      storageClass: "3",
    });
    expect(d.type).toBe("HAZARDOUS_SUBSTANCE");
    expect(d.hazards).toContain("H225 – Flüssigkeit und Dampf leicht entzündbar.");
    expect(d.protectiveMeasures).toContain("Von Hitze, heißen Oberflächen");
    expect(d.protectiveMeasures).toContain("Nitrilhandschuhe");
    expect(d.firstAid).toContain("Bei Kontakt mit den Augen");
    expect(d.maintenance).toContain("Lagerklasse 3");
    expect(d.pictograms).toEqual(expect.arrayContaining(["GHS02", "GHS07", "M009", "M004", "P003"]));
  });
  it("CMR-Hinweis im Entwurf", () => {
    const d = draftFromSubstance({ name: "X", usage: null, pictograms: ["GHS08"], hStatements: ["H350"], pStatements: [], ppe: null, storageClass: null });
    expect(d.hazards).toContain("CMR-Stoff (Kategorie 1)");
  });
  it("Vier-Augen-Prinzip", () => {
    expect(canRelease({ status: "IN_REVIEW", lastEditorId: "a" }, "b").ok).toBe(true);
    expect(canRelease({ status: "IN_REVIEW", lastEditorId: "a" }, "a").ok).toBe(false);
    expect(canRelease({ status: "DRAFT", lastEditorId: "a" }, "b").ok).toBe(false);
  });
  it("Piktogramm-Arten", () => {
    expect(pictoKind("GHS05")).toBe("ghs");
    expect(pictoKind("M009")).toBe("mandatory");
    expect(pictoKind("P003")).toBe("prohibition");
    expect(pictoKind("W012")).toBe("warning");
    expect(pictoKind("E003")).toBe("safe");
    expect(pictoKind("X1")).toBeNull();
  });
  it("Mitarbeitende dürfen BA lesen, aber nicht freigeben", () => {
    expect(can({ isPlatformAdmin: false, role: "EMPLOYEE" }, "instructions.view")).toBe(true);
    expect(can({ isPlatformAdmin: false, role: "EMPLOYEE" }, "instructions.release")).toBe(false);
    expect(can({ isPlatformAdmin: false, role: "MANAGER" }, "substances.approve")).toBe(false);
  });
});
