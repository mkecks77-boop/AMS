/** CSV für Excel (deutsch): Semikolon, BOM, Felder bei Bedarf in Anführungszeichen. */
export function toCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    let s = String(v);
    // Formel-Injektion in Excel verhindern
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n") + "\r\n";
}
