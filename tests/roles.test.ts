import { describe, expect, it } from "vitest";
import { can, canResetPasswordFor, isRole, wouldRemoveLastAdmin } from "@/lib/roles";
import { slugify } from "@/lib/slug";
import { hashToken, generateToken } from "@/lib/tokens";
import { validatePassword } from "@/lib/password";

describe("Berechtigungen", () => {
  it("Unternehmens-Admin darf Nutzer verwalten, Sifa nicht", () => {
    expect(can({ isPlatformAdmin: false, role: "ORG_ADMIN" }, "users.manage")).toBe(true);
    expect(can({ isPlatformAdmin: false, role: "SAFETY_OFFICER" }, "users.manage")).toBe(false);
    expect(can({ isPlatformAdmin: false, role: "SAFETY_OFFICER" }, "audit.view")).toBe(true);
  });
  it("ohne Mitgliedschaft keine Rechte, Plattform-Admin alle", () => {
    expect(can({ isPlatformAdmin: false, role: null }, "dashboard.view")).toBe(false);
    expect(can({ isPlatformAdmin: true, role: null }, "users.manage")).toBe(true);
  });
  it("isRole prüft gültige Rollen", () => {
    expect(isRole("MANAGER")).toBe(true);
    expect(isRole("ROOT")).toBe(false);
  });
});

describe("letzter Admin", () => {
  it("verhindert Herabstufen oder Deaktivieren des letzten Admins", () => {
    expect(wouldRemoveLastAdmin(["a"], "a", "EMPLOYEE")).toBe(true);
    expect(wouldRemoveLastAdmin(["a"], "a", null)).toBe(true);
    expect(wouldRemoveLastAdmin(["a"], "a", "ORG_ADMIN")).toBe(false);
    expect(wouldRemoveLastAdmin(["a", "b"], "a", null)).toBe(false);
    expect(wouldRemoveLastAdmin(["a"], "x", null)).toBe(false);
  });
});

describe("Passwort zurücksetzen", () => {
  const actor = { isPlatformAdmin: false, adminOrgIds: ["org1"] };
  it("nur für Personen ausschließlich aus eigenen Unternehmen", () => {
    expect(canResetPasswordFor(actor, ["org1"])).toBe(true);
    expect(canResetPasswordFor(actor, ["org1", "org2"])).toBe(false);
    expect(canResetPasswordFor(actor, [])).toBe(false);
    expect(canResetPasswordFor({ isPlatformAdmin: true, adminOrgIds: [] }, ["x"])).toBe(true);
  });
});

describe("Hilfsfunktionen", () => {
  it("slugify ersetzt Umlaute", () => {
    expect(slugify("Müller & Söhne GmbH")).toBe("mueller-soehne-gmbh");
    expect(slugify("  Straße 1 ")).toBe("strasse-1");
  });
  it("Tokens sind zufällig, Hash deterministisch", () => {
    const t = generateToken();
    expect(t).not.toBe(generateToken());
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toHaveLength(64);
  });
  it("Passwortregeln", () => {
    expect(validatePassword("kurz1")).not.toBeNull();
    expect(validatePassword("nurbuchstaben")).not.toBeNull();
    expect(validatePassword("gutesPasswort1")).toBeNull();
  });
});
