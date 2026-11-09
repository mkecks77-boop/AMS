/**
 * Piktogramme für Betriebsanweisungen.
 * GHS = Gefahrenpiktogramme, ISO 7010: M = Gebot, P = Verbot, W = Warnung, E = Rettung/Erste Hilfe.
 * Darstellung erfolgt vereinfacht (Form und Farbe nach Norm, Text statt Grafik).
 */
import { GHS_PICTOGRAMS } from "./ghs";

export const ISO7010: Record<string, string> = {
  M001: "Allgemeines Gebotszeichen",
  M002: "Gebrauchsanweisung beachten",
  M003: "Gehörschutz benutzen",
  M004: "Augenschutz benutzen",
  M008: "Fußschutz benutzen",
  M009: "Handschutz benutzen",
  M010: "Schutzkleidung benutzen",
  M013: "Gesichtsschutz benutzen",
  M014: "Kopfschutz benutzen",
  M016: "Maske benutzen",
  M017: "Atemschutz benutzen",
  M018: "Auffanggurt benutzen",
  M011: "Hände waschen",
  M020: "Rückhaltesystem benutzen",
  P002: "Rauchen verboten",
  P003: "Keine offene Flamme; Feuer, offene Zündquelle und Rauchen verboten",
  P010: "Berühren verboten",
  P011: "Mit Wasser löschen verboten",
  P012: "Keine schwere Last",
  P022: "Essen und Trinken verboten",
  P028: "Benutzen von Handschuhen verboten",
  W001: "Allgemeines Warnzeichen",
  W002: "Warnung vor explosionsgefährlichen Stoffen",
  W012: "Warnung vor elektrischer Spannung",
  W014: "Warnung vor Flurförderzeugen",
  W015: "Warnung vor schwebender Last",
  W017: "Warnung vor heißer Oberfläche",
  W019: "Warnung vor Quetschgefahr",
  W021: "Warnung vor feuergefährlichen Stoffen",
  W023: "Warnung vor ätzenden Stoffen",
  W024: "Warnung vor Handverletzungen",
  W026: "Warnung vor Gefahren durch Batterien",
  W027: "Warnung vor optischer Strahlung",
  E003: "Erste Hilfe",
  E004: "Notruftelefon",
  E011: "Augenspüleinrichtung",
  E012: "Notdusche",
  E013: "Krankentrage",
};

export type PictoKind = "ghs" | "mandatory" | "prohibition" | "warning" | "safe";

export function pictoKind(code: string): PictoKind | null {
  if (code in GHS_PICTOGRAMS) return "ghs";
  if (!(code in ISO7010)) return null;
  return ({ M: "mandatory", P: "prohibition", W: "warning", E: "safe" } as const)[code[0] as "M" | "P" | "W" | "E"];
}

export function pictoLabel(code: string): string {
  return GHS_PICTOGRAMS[code] ?? ISO7010[code] ?? code;
}

export const ALL_PICTOGRAMS = [...Object.keys(GHS_PICTOGRAMS), ...Object.keys(ISO7010)];
