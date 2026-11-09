import type { InspectorType } from "@prisma/client";

/**
 * Prüfkatalog: Vorschläge für typische Prüfpflichten.
 * Die Intervalle sind übliche Richtwerte – maßgeblich ist die Gefährdungsbeurteilung (§ 3 Abs. 6 BetrSichV).
 */
export interface CatalogEntry {
  key: string;
  title: string;
  category: string;
  legalBasis: string;
  intervalMonths: number;
  inspectorType: InspectorType;
}

export const INSPECTION_CATALOG: CatalogEntry[] = [
  { key: "e-mobil", title: "Prüfung ortsveränderlicher elektrischer Betriebsmittel", category: "Elektrische Betriebsmittel", legalBasis: "DGUV V3, BetrSichV", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" },
  { key: "e-fest", title: "Prüfung ortsfester elektrischer Anlagen", category: "Elektrische Anlagen", legalBasis: "DGUV V3, BetrSichV", intervalMonths: 48, inspectorType: "COMPETENT_PERSON" },
  { key: "leiter", title: "Prüfung Leitern und Tritte", category: "Leitern und Tritte", legalBasis: "BetrSichV, DGUV I 208-016", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" },
  { key: "regal", title: "Inspektion Regalanlage", category: "Regale", legalBasis: "DIN EN 15635, BetrSichV", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" },
  { key: "loescher", title: "Prüfung Feuerlöscher", category: "Brandschutz", legalBasis: "ASR A2.2, DIN 14406-4", intervalMonths: 24, inspectorType: "EXTERNAL" },
  { key: "tor", title: "Prüfung kraftbetätigte Tore und Türen", category: "Tore und Türen", legalBasis: "ASR A1.7", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" },
  { key: "kran", title: "Prüfung Krananlage", category: "Krane", legalBasis: "BetrSichV, DGUV V52", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" },
  { key: "ffz", title: "Prüfung Flurförderzeug (Stapler)", category: "Flurförderzeuge", legalBasis: "BetrSichV, DGUV V68", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" },
  { key: "hubarbeitsbuehne", title: "Prüfung Hubarbeitsbühne", category: "Hebebühnen", legalBasis: "BetrSichV, DGUV G 308-008", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" },
  { key: "lastaufnahme", title: "Prüfung Lastaufnahme- und Anschlagmittel", category: "Lastaufnahmemittel", legalBasis: "BetrSichV, DGUV R 109-017", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" },
  { key: "druckbehaelter-innen", title: "Innere Prüfung Druckbehälter", category: "Druckanlagen", legalBasis: "BetrSichV Anhang 2 Abschn. 4", intervalMonths: 60, inspectorType: "ZUS" },
  { key: "druckbehaelter-aussen", title: "Äußere Prüfung Druckbehälter", category: "Druckanlagen", legalBasis: "BetrSichV Anhang 2 Abschn. 4", intervalMonths: 24, inspectorType: "COMPETENT_PERSON" },
  { key: "aufzug", title: "Hauptprüfung Aufzugsanlage", category: "Aufzüge", legalBasis: "BetrSichV Anhang 2 Abschn. 2", intervalMonths: 24, inspectorType: "ZUS" },
  { key: "lueftung", title: "Prüfung Raumlufttechnische Anlage", category: "Lüftung und Absaugung", legalBasis: "ASR A3.6", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" },
  { key: "absaugung", title: "Prüfung Absauganlage (Wirksamkeit)", category: "Lüftung und Absaugung", legalBasis: "GefStoffV § 7, TRGS 500", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" },
  { key: "notbeleuchtung", title: "Prüfung Sicherheitsbeleuchtung", category: "Notfalleinrichtungen", legalBasis: "ASR A3.4/7, DIN EN 50172", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" },
  { key: "erste-hilfe", title: "Kontrolle Erste-Hilfe-Material", category: "Notfalleinrichtungen", legalBasis: "DGUV V1 § 25, ASR A4.3", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" },
  { key: "psaga", title: "Prüfung PSA gegen Absturz", category: "PSA", legalBasis: "DGUV R 112-198", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" },
  { key: "maschine", title: "Wiederkehrende Prüfung Maschine (Schutzeinrichtungen)", category: "Maschinen", legalBasis: "BetrSichV § 14", intervalMonths: 12, inspectorType: "COMPETENT_PERSON" },
];

export const INSPECTOR_TYPE_LABELS: Record<InspectorType, string> = {
  COMPETENT_PERSON: "befähigte Person",
  EXTERNAL: "externer Dienstleister",
  ZUS: "Zugelassene Überwachungsstelle",
  EXPERT: "Sachverständige/r",
};

export const EQUIPMENT_CATEGORIES = Array.from(new Set(INSPECTION_CATALOG.map((e) => e.category)))
  .concat(["Sonstiges"]);

export function findCatalogEntry(key: string) {
  return INSPECTION_CATALOG.find((e) => e.key === key);
}
