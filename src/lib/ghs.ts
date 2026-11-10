/**
 * GHS/CLP-Stammdaten (Verordnung (EG) Nr. 1272/2008), deutsche Texte.
 * Enthalten sind die gebräuchlichen H- und P-Sätze; unbekannte Codes werden nur als Code angezeigt.
 */

export const GHS_PICTOGRAMS: Record<string, string> = {
  GHS01: "Explodierende Bombe",
  GHS02: "Flamme",
  GHS03: "Flamme über einem Kreis",
  GHS04: "Gasflasche",
  GHS05: "Ätzwirkung",
  GHS06: "Totenkopf mit gekreuzten Knochen",
  GHS07: "Ausrufezeichen",
  GHS08: "Gesundheitsgefahr",
  GHS09: "Umwelt",
};

export const H_STATEMENTS: Record<string, string> = {
  H200: "Instabil, explosiv.",
  H201: "Explosiv; Gefahr der Massenexplosion.",
  H220: "Extrem entzündbares Gas.",
  H221: "Entzündbares Gas.",
  H222: "Extrem entzündbares Aerosol.",
  H223: "Entzündbares Aerosol.",
  H224: "Flüssigkeit und Dampf extrem entzündbar.",
  H225: "Flüssigkeit und Dampf leicht entzündbar.",
  H226: "Flüssigkeit und Dampf entzündbar.",
  H228: "Entzündbarer Feststoff.",
  H229: "Behälter steht unter Druck: Kann bei Erwärmung bersten.",
  H230: "Kann auch in Abwesenheit von Luft explosionsartig reagieren.",
  H240: "Erwärmung kann Explosion verursachen.",
  H241: "Erwärmung kann Brand oder Explosion verursachen.",
  H242: "Erwärmung kann Brand verursachen.",
  H250: "Entzündet sich in Berührung mit Luft von selbst.",
  H251: "Selbsterhitzungsfähig; kann in Brand geraten.",
  H260: "In Berührung mit Wasser entstehen entzündbare Gase, die sich spontan entzünden können.",
  H261: "In Berührung mit Wasser entstehen entzündbare Gase.",
  H270: "Kann Brand verursachen oder verstärken; Oxidationsmittel.",
  H271: "Kann Brand oder Explosion verursachen; starkes Oxidationsmittel.",
  H272: "Kann Brand verstärken; Oxidationsmittel.",
  H280: "Enthält Gas unter Druck; kann bei Erwärmung explodieren.",
  H281: "Enthält tiefgekühltes Gas; kann Kälteverbrennungen oder -verletzungen verursachen.",
  H290: "Kann gegenüber Metallen korrosiv sein.",
  H300: "Lebensgefahr bei Verschlucken.",
  H301: "Giftig bei Verschlucken.",
  H302: "Gesundheitsschädlich bei Verschlucken.",
  H304: "Kann bei Verschlucken und Eindringen in die Atemwege tödlich sein.",
  H310: "Lebensgefahr bei Hautkontakt.",
  H311: "Giftig bei Hautkontakt.",
  H312: "Gesundheitsschädlich bei Hautkontakt.",
  H314: "Verursacht schwere Verätzungen der Haut und schwere Augenschäden.",
  H315: "Verursacht Hautreizungen.",
  H317: "Kann allergische Hautreaktionen verursachen.",
  H318: "Verursacht schwere Augenschäden.",
  H319: "Verursacht schwere Augenreizung.",
  H330: "Lebensgefahr bei Einatmen.",
  H331: "Giftig bei Einatmen.",
  H332: "Gesundheitsschädlich bei Einatmen.",
  H334: "Kann bei Einatmen Allergie, asthmaartige Symptome oder Atembeschwerden verursachen.",
  H335: "Kann die Atemwege reizen.",
  H336: "Kann Schläfrigkeit und Benommenheit verursachen.",
  H340: "Kann genetische Defekte verursachen.",
  H341: "Kann vermutlich genetische Defekte verursachen.",
  H350: "Kann Krebs erzeugen.",
  H350i: "Kann bei Einatmen Krebs erzeugen.",
  H351: "Kann vermutlich Krebs erzeugen.",
  H360: "Kann die Fruchtbarkeit beeinträchtigen oder das Kind im Mutterleib schädigen.",
  H360D: "Kann das Kind im Mutterleib schädigen.",
  H360F: "Kann die Fruchtbarkeit beeinträchtigen.",
  H360FD: "Kann die Fruchtbarkeit beeinträchtigen. Kann das Kind im Mutterleib schädigen.",
  H361: "Kann vermutlich die Fruchtbarkeit beeinträchtigen oder das Kind im Mutterleib schädigen.",
  H361d: "Kann vermutlich das Kind im Mutterleib schädigen.",
  H361f: "Kann vermutlich die Fruchtbarkeit beeinträchtigen.",
  H362: "Kann Säuglinge über die Muttermilch schädigen.",
  H370: "Schädigt die Organe.",
  H371: "Kann die Organe schädigen.",
  H372: "Schädigt die Organe bei längerer oder wiederholter Exposition.",
  H373: "Kann die Organe schädigen bei längerer oder wiederholter Exposition.",
  H400: "Sehr giftig für Wasserorganismen.",
  H410: "Sehr giftig für Wasserorganismen mit langfristiger Wirkung.",
  H411: "Giftig für Wasserorganismen, mit langfristiger Wirkung.",
  H412: "Schädlich für Wasserorganismen, mit langfristiger Wirkung.",
  H413: "Kann für Wasserorganismen schädlich sein, mit langfristiger Wirkung.",
  H420: "Schädigt die öffentliche Gesundheit und die Umwelt durch Ozonabbau in der äußeren Atmosphäre.",
  EUH066: "Wiederholter Kontakt kann zu spröder oder rissiger Haut führen.",
  EUH208: "Enthält einen sensibilisierenden Stoff. Kann allergische Reaktionen hervorrufen.",
};

export const P_STATEMENTS: Record<string, string> = {
  P101: "Ist ärztlicher Rat erforderlich, Verpackung oder Kennzeichnungsetikett des Produkts bereithalten.",
  P102: "Darf nicht in die Hände von Kindern gelangen.",
  P201: "Vor Gebrauch besondere Anweisungen einholen.",
  P210: "Von Hitze, heißen Oberflächen, Funken, offenen Flammen und anderen Zündquellen fernhalten. Nicht rauchen.",
  P211: "Nicht gegen offene Flamme oder andere Zündquelle sprühen.",
  P233: "Behälter dicht verschlossen halten.",
  P240: "Behälter und zu befüllende Anlage erden.",
  P241: "Explosionsgeschützte elektrische Geräte/Lüftungsanlagen/Beleuchtung verwenden.",
  P242: "Funkenarmes Werkzeug verwenden.",
  P243: "Maßnahmen gegen elektrostatische Entladungen treffen.",
  P251: "Nicht durchstechen oder verbrennen, auch nicht nach Gebrauch.",
  P260: "Staub/Rauch/Gas/Nebel/Dampf/Aerosol nicht einatmen.",
  P261: "Einatmen von Staub/Rauch/Gas/Nebel/Dampf/Aerosol vermeiden.",
  P264: "Nach Gebrauch Hände gründlich waschen.",
  P270: "Bei Gebrauch nicht essen, trinken oder rauchen.",
  P271: "Nur im Freien oder in gut belüfteten Räumen verwenden.",
  P272: "Kontaminierte Arbeitskleidung nicht außerhalb des Arbeitsplatzes tragen.",
  P273: "Freisetzung in die Umwelt vermeiden.",
  P280: "Schutzhandschuhe/Schutzkleidung/Augenschutz/Gesichtsschutz/Gehörschutz tragen.",
  P284: "Atemschutz tragen.",
  P301_P310: "Bei Verschlucken: Sofort Giftinformationszentrum oder Arzt anrufen.",
  P301_P330_P331: "Bei Verschlucken: Mund ausspülen. Kein Erbrechen herbeiführen.",
  P302_P352: "Bei Berührung mit der Haut: Mit viel Wasser waschen.",
  P303_P361_P353: "Bei Berührung mit der Haut (oder dem Haar): Alle kontaminierten Kleidungsstücke sofort ausziehen. Haut mit Wasser abwaschen oder duschen.",
  P304_P340: "Bei Einatmen: Die Person an die frische Luft bringen und für ungehinderte Atmung sorgen.",
  P305_P351_P338: "Bei Kontakt mit den Augen: Einige Minuten lang behutsam mit Wasser spülen. Eventuell vorhandene Kontaktlinsen nach Möglichkeit entfernen. Weiter spülen.",
  P308_P313: "Bei Exposition oder falls betroffen: Ärztlichen Rat einholen/ärztliche Hilfe hinzuziehen.",
  P310: "Sofort Giftinformationszentrum oder Arzt anrufen.",
  P312: "Bei Unwohlsein Giftinformationszentrum oder Arzt anrufen.",
  P333_P313: "Bei Hautreizung oder -ausschlag: Ärztlichen Rat einholen/ärztliche Hilfe hinzuziehen.",
  P337_P313: "Bei anhaltender Augenreizung: Ärztlichen Rat einholen/ärztliche Hilfe hinzuziehen.",
  P362_P364: "Kontaminierte Kleidung ausziehen und vor erneutem Tragen waschen.",
  P370_P378: "Bei Brand: Geeignete Löschmittel zum Löschen verwenden.",
  P391: "Verschüttete Mengen aufnehmen.",
  P403_P233: "An einem gut belüfteten Ort aufbewahren. Behälter dicht verschlossen halten.",
  P403_P235: "An einem gut belüfteten Ort aufbewahren. Kühl halten.",
  P405: "Unter Verschluss aufbewahren.",
  P410_P412: "Vor Sonnenbestrahlung schützen. Nicht Temperaturen über 50 °C aussetzen.",
  P501: "Inhalt/Behälter einer zugelassenen Entsorgung zuführen.",
};

export const SIGNAL_WORD_LABELS = { DANGER: "Gefahr", WARNING: "Achtung", NONE: "kein Signalwort" } as const;

export const WATER_HAZARD_CLASSES = ["nwg", "1", "2", "3"];

/** Lagerklassen nach TRGS 510 */
export const STORAGE_CLASSES: Record<string, string> = {
  "1": "Explosive Gefahrstoffe",
  "2A": "Gase",
  "2B": "Aerosolpackungen und Feuerzeuge",
  "3": "Entzündbare Flüssigkeiten",
  "4.1A": "Sonstige explosionsgefährliche Gefahrstoffe",
  "4.1B": "Entzündbare feste Gefahrstoffe",
  "4.2": "Pyrophore oder selbsterhitzungsfähige Gefahrstoffe",
  "4.3": "Gefahrstoffe, die in Berührung mit Wasser entzündbare Gase entwickeln",
  "5.1A": "Stark oxidierende Gefahrstoffe",
  "5.1B": "Oxidierende Gefahrstoffe",
  "5.1C": "Ammoniumnitrat und ammoniumnitrathaltige Zubereitungen",
  "5.2": "Organische Peroxide und selbstzersetzliche Gefahrstoffe",
  "6.1A": "Brennbare, akut toxische Kat. 1 und 2 / sehr giftige Gefahrstoffe",
  "6.1B": "Nicht brennbare, akut toxische Kat. 1 und 2 / sehr giftige Gefahrstoffe",
  "6.1C": "Brennbare, akut toxische Kat. 3 / giftige oder chronisch wirkende Gefahrstoffe",
  "6.1D": "Nicht brennbare, akut toxische Kat. 3 / giftige oder chronisch wirkende Gefahrstoffe",
  "6.2": "Ansteckungsgefährliche Stoffe",
  "7": "Radioaktive Stoffe",
  "8A": "Brennbare ätzende Gefahrstoffe",
  "8B": "Nicht brennbare ätzende Gefahrstoffe",
  "10": "Brennbare Flüssigkeiten, die keiner der vorgenannten Lagerklassen zuzuordnen sind",
  "11": "Brennbare Feststoffe",
  "12": "Nicht brennbare Flüssigkeiten",
  "13": "Nicht brennbare Feststoffe",
};

/** Normalisiert Eingaben wie "h225, H319 ;P210 + P233" → ["H225","H319"] / ["P210_P233"] */
export function parseStatements(input: string, prefix: "H" | "P"): string[] {
  const re = prefix === "H" ? /\b(EUH\d{3}|H\d{3}[A-Za-z]{0,2})\b/gi : /\bP\d{3}(?:\s*\+\s*P\d{3})*/gi;
  const out = new Set<string>();
  for (const m of input.match(re) ?? []) {
    let code = m.replace(/\s+/g, "");
    if (prefix === "P") code = code.toUpperCase().replace(/\+/g, "_");
    else code = code.slice(0, 4).toUpperCase() + code.slice(4); // H350i, H361d bleiben erhalten
    out.add(code);
  }
  return [...out];
}

export function statementText(code: string): string {
  return H_STATEMENTS[code] ?? P_STATEMENTS[code] ?? "";
}

export function formatStatement(code: string): string {
  const t = statementText(code);
  return `${code.replace(/_/g, " + ")}${t ? ` – ${t}` : ""}`;
}

/** CMR-Einstufung (krebserzeugend, keimzellmutagen, reproduktionstoxisch) – Kategorie 1A/1B bzw. 2 */
export function cmrCategory(h: string[]): "1" | "2" | null {
  if (h.some((c) => /^H3(40|50|60)/.test(c))) return "1";
  if (h.some((c) => /^H3(41|51|61)/.test(c))) return "2";
  return null;
}

export function isCmr(h: string[]) {
  return cmrCategory(h) !== null;
}

/** Signalwort-Vorschlag aus Piktogrammen/H-Sätzen */
export function suggestSignalWord(pictograms: string[], h: string[]): "DANGER" | "WARNING" | "NONE" {
  const danger = /^H(200|201|220|222|224|225|230|240|241|250|260|271|300|304|310|314|318|330|334|340|350|360|370|372)/;
  if (h.some((c) => danger.test(c))) return "DANGER";
  if (h.length > 0 || pictograms.length > 0) return "WARNING";
  return "NONE";
}
