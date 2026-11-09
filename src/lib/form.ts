export interface FormState {
  error?: string;
  message?: string;
  /** z. B. Einladungslink zum Kopieren */
  link?: string;
}

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function appUrl(path: string) {
  return `${process.env.APP_URL ?? "http://localhost:3000"}${path}`;
}
