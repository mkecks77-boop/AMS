export interface FormState {
  error?: string;
  message?: string;
  /** z. B. Einladungslink zum Kopieren */
  link?: string;
  /** Anmeldung: Zwei-Faktor-Code erforderlich */
  needCode?: boolean;
}

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function appUrl(path: string) {
  return `${process.env.APP_URL ?? "http://localhost:3000"}${path}`;
}

export function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === "on" || fd.get(key) === "true";
}

export function int(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}
