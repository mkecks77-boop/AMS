import { randomBytes } from "node:crypto";

/** Kurze, sortierfreie ID für Gruppierungen (z. B. Versionsreihen) */
export function createId(): string {
  return "s" + randomBytes(12).toString("hex");
}
