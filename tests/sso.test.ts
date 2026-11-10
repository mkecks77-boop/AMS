import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/secretbox";
import { finishSso, passwordLoginBlocked, saveSsoConfig, startSso } from "@/lib/sso";
import { resetDb, twoOrgs } from "./helpers";

process.env.SSO_SECRET_KEY = randomBytes(32).toString("base64");
process.env.APP_URL = "http://localhost:3000";

/** Minimaler OpenID-Provider für Tests */
let server: Server;
let issuer = "";
let privateKey: CryptoKey;
let jwk: JWK;
const codes = new Map<string, { nonce: string; challenge: string; claims: Record<string, unknown> }>();
let nextClaims: Record<string, unknown> = {};
let tamperAud = false;

beforeAll(async () => {
  const kp = await generateKeyPair("RS256");
  privateKey = kp.privateKey as CryptoKey;
  jwk = { ...(await exportJWK(kp.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  server = createServer(async (req, res) => {
    const url = new URL(req.url!, issuer);
    if (url.pathname === "/.well-known/openid-configuration") {
      res.end(JSON.stringify({ issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks` }));
    } else if (url.pathname === "/jwks") {
      res.end(JSON.stringify({ keys: [jwk] }));
    } else if (url.pathname === "/token") {
      let body = "";
      for await (const c of req) body += c;
      const p = new URLSearchParams(body);
      const entry = codes.get(p.get("code")!);
      const ok = entry && p.get("client_secret") === "geheim" &&
        createHash("sha256").update(p.get("code_verifier")!).digest("base64url") === entry.challenge;
      if (!ok) { res.statusCode = 400; res.end("{}"); return; }
      const idToken = await new SignJWT({ nonce: entry!.nonce, ...entry!.claims })
        .setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer(issuer).setAudience(tamperAud ? "andere-app" : "client-1")
        .setSubject("u1").setIssuedAt().setExpirationTime("5m").sign(privateKey);
      res.end(JSON.stringify({ id_token: idToken }));
    } else { res.statusCode = 404; res.end(); }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.close();
  await resetDb();
  await db.ssoState.deleteMany();
  await db.$disconnect();
});

beforeEach(async () => {
  await resetDb();
  await db.ssoState.deleteMany();
  codes.clear();
  tamperAud = false;
});

/** simuliert den Browser: Login beim Provider, gibt code+state zurück */
async function loginAtProvider(email: string, claims: Record<string, unknown>) {
  const url = new URL(await startSso(email));
  const code = randomBytes(8).toString("hex");
  codes.set(code, { nonce: url.searchParams.get("nonce")!, challenge: url.searchParams.get("code_challenge")!, claims });
  nextClaims = claims;
  return { code, state: url.searchParams.get("state")!, url };
}

async function setup(autoProvision = true) {
  const { actor, orgA, orgB } = await twoOrgs();
  await saveSsoConfig(actor, orgA, { issuer, clientId: "client-1", clientSecret: "geheim", emailDomains: ["firma.de"], autoProvision, enforce: true, enabled: true });
  return { actor, orgA, orgB };
}

describe("Verschlüsselung", () => {
  it("AES-GCM rund und manipulationssicher", () => {
    const box = encrypt("geheim");
    expect(box).not.toContain("geheim");
    expect(decrypt(box)).toBe("geheim");
    const [iv, tag, data] = box.split(".");
    expect(() => decrypt([iv, tag, Buffer.from("x" + data).toString("base64")].join("."))).toThrow();
  });
});

describe("Single Sign-on", () => {
  it("Konfiguration: Domain-Prüfung, Secret verschlüsselt, Domain nur einmal vergeben", async () => {
    const { actor, orgB } = await setup();
    const cfg = await db.ssoConfig.findFirstOrThrow();
    expect(cfg.clientSecretEnc).not.toContain("geheim");
    await expect(saveSsoConfig(actor, orgB, { issuer, clientId: "x", clientSecret: "y", emailDomains: ["firma.de"], autoProvision: false, enforce: false, enabled: true })).rejects.toThrow("bereits");
    await expect(saveSsoConfig(actor, orgB, { issuer: "http://evil.example", clientId: "x", clientSecret: "y", emailDomains: ["b.de"], autoProvision: false, enforce: false, enabled: true })).rejects.toThrow("https");
    expect(await passwordLoginBlocked("max@FIRMA.de")).toBe(true);
    expect(await passwordLoginBlocked("max@andere.de")).toBe(false);
  });

  it("Erfolgreiche Anmeldung mit PKCE: Konto wird angelegt (autoProvision), state nur einmal gültig", async () => {
    const { orgA } = await setup(true);
    const { code, state, url } = await loginAtProvider("max@firma.de", { email: "Max@Firma.de", name: "Max Muster" });
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/sso/callback");
    const r = await finishSso({ code, state });
    expect(r.organizationId).toBe(orgA);
    const u = await db.user.findUniqueOrThrow({ where: { id: r.userId }, include: { memberships: true } });
    expect(u).toMatchObject({ email: "max@firma.de", name: "Max Muster", passwordHash: null });
    expect(u.memberships[0]).toMatchObject({ organizationId: orgA, role: "EMPLOYEE" });
    await expect(finishSso({ code, state })).rejects.toThrow("abgelaufen");
  });

  it("Ohne autoProvision nur bestehende Mitglieder; Entra-Claim preferred_username", async () => {
    const { orgA } = await setup(false);
    let x = await loginAtProvider("neu@firma.de", { preferred_username: "neu@firma.de" });
    await expect(finishSso(x)).rejects.toThrow("noch nicht zugeordnet");
    const u = await db.user.create({ data: { email: "anna@firma.de", name: "Anna" } });
    await db.membership.create({ data: { userId: u.id, organizationId: orgA, role: "ORG_ADMIN" } });
    x = await loginAtProvider("anna@firma.de", { preferred_username: "anna@firma.de" });
    expect((await finishSso(x)).userId).toBe(u.id);
  });

  it("Abgelehnt: falsche Audience, fremde Domain, unbestätigte E-Mail, Fehler vom Provider", async () => {
    await setup(true);
    tamperAud = true;
    let x = await loginAtProvider("max@firma.de", { email: "max@firma.de" });
    await expect(finishSso(x)).rejects.toThrow("ungültig");
    tamperAud = false;
    x = await loginAtProvider("max@firma.de", { email: "boss@andere.de" });
    await expect(finishSso(x)).rejects.toThrow("Domain");
    x = await loginAtProvider("max@firma.de", { email: "max@firma.de", email_verified: false });
    await expect(finishSso(x)).rejects.toThrow("nicht bestätigt");
    await expect(finishSso({ error: "access_denied" })).rejects.toThrow("abgelehnt");
    await expect(startSso("x@unbekannt.de")).rejects.toThrow("keine Unternehmensanmeldung");
  });
});
