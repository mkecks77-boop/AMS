import type { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ORG_ADMIN: "Unternehmens-Admin",
  SAFETY_OFFICER: "Fachkraft für Arbeitssicherheit",
  MANAGER: "Führungskraft",
  INSPECTOR: "Prüfer/in",
  EMPLOYEE: "Mitarbeiter/in",
};

export const ROLES = Object.keys(ROLE_LABELS) as Role[];

export type Permission =
  | "users.manage"
  | "audit.view"
  | "dashboard.view"
  /** Standorte, Abteilungen, Mitarbeiterstamm pflegen */
  | "masterdata.manage"
  | "masterdata.view"
  | "equipment.view"
  | "equipment.manage"
  | "inspections.record"
  | "deadlines.view"
  | "substances.view"
  /** Gefahrstoff beantragen / Daten pflegen */
  | "substances.edit"
  /** Gefahrstoff freigeben oder ablehnen */
  | "substances.approve"
  | "instructions.view"
  | "instructions.edit"
  | "instructions.release"
  | "trainings.view"
  | "trainings.manage";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ORG_ADMIN: [
    "users.manage", "audit.view", "dashboard.view", "masterdata.manage", "masterdata.view",
    "equipment.view", "equipment.manage", "inspections.record", "deadlines.view",
    "substances.view", "substances.edit", "substances.approve",
    "instructions.view", "instructions.edit", "instructions.release",
    "trainings.view", "trainings.manage",
  ],
  SAFETY_OFFICER: [
    "audit.view", "dashboard.view", "masterdata.manage", "masterdata.view",
    "equipment.view", "equipment.manage", "inspections.record", "deadlines.view",
    "substances.view", "substances.edit", "substances.approve",
    "instructions.view", "instructions.edit", "instructions.release",
    "trainings.view", "trainings.manage",
  ],
  MANAGER: [
    "dashboard.view", "masterdata.view", "equipment.view", "equipment.manage",
    "inspections.record", "deadlines.view",
    "substances.view", "substances.edit", "instructions.view", "instructions.edit", "instructions.release",
    "trainings.view", "trainings.manage",
  ],
  INSPECTOR: ["dashboard.view", "equipment.view", "inspections.record", "deadlines.view", "substances.view", "instructions.view"],
  EMPLOYEE: ["dashboard.view", "equipment.view", "substances.view", "instructions.view"],
};

export interface AccessContext {
  isPlatformAdmin: boolean;
  /** Rolle im aktuell gewählten Unternehmen, null = keine Mitgliedschaft */
  role: Role | null;
}

/** Plattform-Admins dürfen in jedem Unternehmen alles. */
export function can(ctx: AccessContext, permission: Permission): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (!ctx.role) return false;
  return ROLE_PERMISSIONS[ctx.role].includes(permission);
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

/**
 * Verhindert, dass ein Unternehmen ohne aktiven Admin zurückbleibt.
 * @param admins aktive Admin-Mitgliedschaften des Unternehmens (IDs)
 * @param membershipId die geänderte Mitgliedschaft
 * @param newRole neue Rolle (null = deaktiviert/entfernt)
 */
export function wouldRemoveLastAdmin(
  admins: string[],
  membershipId: string,
  newRole: Role | null,
): boolean {
  if (newRole === "ORG_ADMIN") return false;
  return admins.length === 1 && admins[0] === membershipId;
}

/**
 * Ein Unternehmens-Admin darf das Passwort nur für Personen zurücksetzen,
 * die ausschließlich Unternehmen angehören, die er selbst verwaltet.
 * So kann z. B. ein Kunde nicht das Konto der externen Sifa übernehmen.
 */
export function canResetPasswordFor(
  actor: { isPlatformAdmin: boolean; adminOrgIds: string[] },
  targetOrgIds: string[],
): boolean {
  if (actor.isPlatformAdmin) return true;
  if (targetOrgIds.length === 0) return false;
  return targetOrgIds.every((id) => actor.adminOrgIds.includes(id));
}
