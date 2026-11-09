import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { UserError } from "./users";

/** AES-256-GCM für gespeicherte Geheimnisse (z. B. SSO-Client-Secret). Schlüssel: SSO_SECRET_KEY (32 Byte, Base64). */
function key(): Buffer {
  const k = process.env.SSO_SECRET_KEY;
  if (!k) throw new UserError("SSO ist nicht eingerichtet: Umgebungsvariable SSO_SECRET_KEY fehlt (32 Byte, Base64).");
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) throw new UserError("SSO_SECRET_KEY muss 32 Byte (Base64) lang sein.");
  return buf;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decrypt(box: string): string {
  const [iv, tag, data] = box.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
