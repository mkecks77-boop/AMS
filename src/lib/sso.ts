import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "./db";
import { withoutTenant } from "./tenant";
import { audit } from "./audit";
import { decrypt, encrypt } from "./secretbox";
import { hashToken } from "./tokens";
import { normalizeEmail, UserError, type Actor } from "./users";

export function callbackUrl() {
  return `${process.env.APP_URL ?? "http://localhost:3000"}/api/auth/sso/callback`;
}

export function domainOf(email: string) {
  return normalizeEmail(email).split("@")[1] ?? "";
}

const b64url = (b: Buffer) => b.toString("base64url");

type Discovery = { issuer: string; authorization_endpoint: string; token_endpoint: string; jwks_uri: string };
const discoveryCache = new Map<string, { at: number; doc: Discovery }>();

export async function discover(issuer: string): Promise<Discovery> {
  const hit = discoveryCache.get(issuer);
  if (hit && Date.now() - hit.at < 3600_000) return hit.doc;
  const res = await fetch(`${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`);
  if (!res.ok) throw new UserError("Der Anmeldedienst ist nicht erreichbar (OpenID-Konfiguration).");
  const doc = (await res.json()) as Discovery;
  if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri) throw new UserError("Ungültige OpenID-Konfiguration.");
  discoveryCache.set(issuer, { at: Date.now(), doc });
  return doc;
}

export async function saveSsoConfig(
  actor: Actor,
  organizationId: string,
  input: { issuer: string; clientId: string; clientSecret?: string | null; emailDomains: string[]; autoProvision: boolean; enforce: boolean; enabled: boolean },
) {
  if (!/^https:\/\//.test(input.issuer) && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(input.issuer)) throw new UserError("Der Issuer muss eine https-Adresse sein.");
  if (!input.clientId) throw new UserError("Bitte die Client-ID angeben.");
  const domains = [...new Set(input.emailDomains.map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean))];
  if (!domains.length || domains.some((d) => !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d))) throw new UserError("Bitte gültige E-Mail-Domains angeben (z. B. firma.de).");
  // bewusst mandantenübergreifend: Domain darf nur einem Unternehmen gehören
  const taken = await withoutTenant(() => db.ssoConfig.findFirst({ where: { organizationId: { not: organizationId }, emailDomains: { hasSome: domains } } }));
  if (taken) throw new UserError("Eine der Domains ist bereits einem anderen Unternehmen zugeordnet.");
  const existing = await db.ssoConfig.findUnique({ where: { organizationId } });
  if (!existing && !input.clientSecret) throw new UserError("Bitte das Client-Secret angeben.");
  const data = {
    issuer: input.issuer.replace(/\/$/, ""),
    clientId: input.clientId,
    emailDomains: domains,
    autoProvision: input.autoProvision,
    enforce: input.enforce,
    enabled: input.enabled,
    ...(input.clientSecret ? { clientSecretEnc: encrypt(input.clientSecret) } : {}),
  };
  const c = existing
    ? await db.ssoConfig.update({ where: { organizationId }, data })
    : await db.ssoConfig.create({ data: { ...data, clientSecretEnc: encrypt(input.clientSecret!), organizationId } });
  await audit({ organizationId, userId: actor.userId, action: "sso.configured", entity: "SsoConfig", entityId: c.id, details: { issuer: c.issuer, domains, enabled: c.enabled } });
  return c;
}

export async function ssoForEmail(email: string) {
  const domain = domainOf(email);
  if (!domain) return null;
  return db.ssoConfig.findFirst({ where: { enabled: true, emailDomains: { has: domain }, organization: { active: true } } });
}

/** Startet die Anmeldung: liefert die Weiterleitungs-URL zum Anmeldedienst. */
export async function startSso(email: string, now = new Date()) {
  const cfg = await ssoForEmail(email);
  if (!cfg) throw new UserError("Für diese E-Mail-Domain ist keine Unternehmensanmeldung eingerichtet.");
  const d = await discover(cfg.issuer);
  const state = b64url(randomBytes(24));
  const nonce = b64url(randomBytes(24));
  const codeVerifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(codeVerifier).digest());
  await db.ssoState.deleteMany({ where: { expiresAt: { lt: now } } });
  await db.ssoState.create({ data: { stateHash: hashToken(state), configId: cfg.id, nonce, codeVerifier, expiresAt: new Date(now.getTime() + 10 * 60_000) } });
  const url = new URL(d.authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: callbackUrl(),
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    login_hint: normalizeEmail(email),
  }).toString();
  return url.toString();
}

/**
 * Callback: Code einlösen, ID-Token prüfen (Signatur, Issuer, Audience, Ablauf, Nonce),
 * Person zuordnen bzw. anlegen. Liefert Nutzer und Unternehmen für die Sitzung.
 */
export async function finishSso(params: { code?: string | null; state?: string | null; error?: string | null }, now = new Date()) {
  if (params.error) throw new UserError(`Der Anmeldedienst hat die Anmeldung abgelehnt (${params.error}).`);
  if (!params.code || !params.state) throw new UserError("Unvollständige Antwort des Anmeldedienstes.");
  const st = await db.ssoState.findUnique({ where: { stateHash: hashToken(params.state) } });
  if (!st || st.expiresAt < now) throw new UserError("Die Anmeldung ist abgelaufen. Bitte erneut versuchen.");
  await db.ssoState.delete({ where: { id: st.id } }); // nur einmal verwendbar
  const cfg = await db.ssoConfig.findUnique({ where: { id: st.configId }, include: { organization: true } });
  if (!cfg || !cfg.enabled || !cfg.organization.active) throw new UserError("Die Unternehmensanmeldung ist deaktiviert.");
  const d = await discover(cfg.issuer);

  const tokenRes = await fetch(d.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: callbackUrl(),
      client_id: cfg.clientId,
      client_secret: decrypt(cfg.clientSecretEnc),
      code_verifier: st.codeVerifier,
    }),
  });
  if (!tokenRes.ok) throw new UserError("Der Anmeldecode konnte nicht eingelöst werden.");
  const { id_token } = (await tokenRes.json()) as { id_token?: string };
  if (!id_token) throw new UserError("Kein ID-Token erhalten.");

  const { payload } = await jwtVerify(id_token, createRemoteJWKSet(new URL(d.jwks_uri)), {
    issuer: d.issuer,
    audience: cfg.clientId,
    currentDate: now,
  }).catch(() => {
    throw new UserError("Das Anmeldetoken ist ungültig.");
  });
  if (payload.nonce !== st.nonce) throw new UserError("Das Anmeldetoken ist ungültig (nonce).");
  // Entra ID liefert die Adresse je nach Konfiguration in email, preferred_username oder upn
  const rawEmail = [payload.email, payload.preferred_username, payload.upn].find((v): v is string => typeof v === "string" && v.includes("@"));
  if (!rawEmail) throw new UserError("Der Anmeldedienst hat keine E-Mail-Adresse übermittelt.");
  if (payload.email_verified === false) throw new UserError("Die E-Mail-Adresse ist beim Anmeldedienst nicht bestätigt.");
  const email = normalizeEmail(rawEmail);
  if (!cfg.emailDomains.includes(domainOf(email))) throw new UserError("Die E-Mail-Domain gehört nicht zu diesem Unternehmen.");

  const orgId = cfg.organizationId;
  let user = await db.user.findUnique({ where: { email }, include: { memberships: { where: { organizationId: orgId } } } });
  if (user && !user.active) throw new UserError("Ihr Konto ist gesperrt.");
  const membership = user?.memberships[0];
  if (membership && !membership.active) throw new UserError("Ihr Zugang zu diesem Unternehmen ist deaktiviert.");
  if (!membership) {
    if (!cfg.autoProvision) throw new UserError("Sie sind diesem Unternehmen noch nicht zugeordnet. Bitte wenden Sie sich an Ihre Administration.");
    const name = typeof payload.name === "string" && payload.name ? payload.name : email.split("@")[0];
    user ??= await db.user.create({ data: { email, name }, include: { memberships: { where: { organizationId: orgId } } } });
    await db.membership.create({ data: { userId: user.id, organizationId: orgId, role: "EMPLOYEE" } });
    await audit({ organizationId: orgId, userId: user.id, action: "sso.provisioned", entity: "User", entityId: user.id, details: { email } });
  }
  await db.user.update({ where: { id: user!.id }, data: { lastLoginAt: now } });
  await audit({ organizationId: orgId, userId: user!.id, action: "login.sso", entity: "User", entityId: user!.id });
  return { userId: user!.id, organizationId: orgId };
}

/** Passwort-Anmeldung gesperrt, wenn die Domain SSO erzwingt */
export async function passwordLoginBlocked(email: string) {
  const cfg = await ssoForEmail(email);
  return !!cfg?.enforce;
}
