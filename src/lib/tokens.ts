import { createHash, randomBytes } from "node:crypto";

/** Zufälliges, URL-sicheres Token (256 Bit). */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** In der Datenbank wird nur der Hash gespeichert. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const SESSION_DAYS = 14;
export const INVITATION_DAYS = 7;

export function daysFromNow(days: number, now = new Date()): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}
