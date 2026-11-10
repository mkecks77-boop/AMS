import nodemailer from "nodemailer";
import { db } from "./db";

/**
 * E-Mail-Versand über SMTP (SMTP_URL, z. B. smtps://user:pass@smtp.example.com:465, und MAIL_FROM).
 * Ohne SMTP_URL wird nichts versendet, aber im Versandprotokoll vermerkt.
 */
export function mailConfigured() {
  return !!process.env.SMTP_URL;
}

let transport: nodemailer.Transporter | null = null;

export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!mailConfigured()) {
    await db.emailLog.create({ data: { to, subject, sent: false, error: "SMTP nicht konfiguriert" } });
    return false;
  }
  try {
    transport ??= nodemailer.createTransport(process.env.SMTP_URL!);
    await transport.sendMail({ from: process.env.MAIL_FROM ?? "AMS <no-reply@localhost>", to, subject, text });
    await db.emailLog.create({ data: { to, subject, sent: true } });
    return true;
  } catch (e) {
    await db.emailLog.create({ data: { to, subject, sent: false, error: e instanceof Error ? e.message.slice(0, 500) : "Fehler" } });
    return false;
  }
}
