import type { MedicalKind, MedicalOutcome } from "@prisma/client";
import { db, transaction } from "./db";
import { audit } from "./audit";
import { addMonths } from "./dates";
import { trainingStatus, type TrainingStatus } from "./trainings";
import { UserError, type Actor } from "./users";

export const MEDICAL_KIND_LABELS: Record<MedicalKind, string> = {
  MANDATORY: "Pflichtvorsorge",
  OFFER: "Angebotsvorsorge",
  WISH: "Wunschvorsorge",
};

export const OUTCOME_LABELS: Record<MedicalOutcome, string> = {
  DONE: "durchgeführt (Bescheinigung liegt vor)",
  DECLINED: "angeboten, nicht wahrgenommen",
};

/** Häufige Anlässe nach Anhang ArbMedVV (Intervalle nach AMR 2.1, vereinfacht) */
export const DEFAULT_MEDICAL_TYPES: { name: string; kind: MedicalKind; reason: string; intervalMonths: number }[] = [
  { name: "Lärm (Pflicht)", kind: "MANDATORY", reason: "Lärmexposition ≥ 85 dB(A) (Anhang Teil 3 Abs. 1 Nr. 3)", intervalMonths: 36 },
  { name: "Lärm (Angebot)", kind: "OFFER", reason: "Lärmexposition ≥ 80 dB(A) (Anhang Teil 3 Abs. 2 Nr. 1)", intervalMonths: 36 },
  { name: "Feuchtarbeit (Pflicht)", kind: "MANDATORY", reason: "Feuchtarbeit > 4 h täglich (Anhang Teil 1 Abs. 1 Nr. 2)", intervalMonths: 36 },
  { name: "Atemschutzgeräte Gruppe 2/3", kind: "MANDATORY", reason: "Tragen von Atemschutzgeräten der Gruppen 2 und 3 (Anhang Teil 4 Abs. 1 Nr. 1)", intervalMonths: 36 },
  { name: "Bildschirmarbeit", kind: "OFFER", reason: "Tätigkeiten an Bildschirmgeräten (Anhang Teil 4 Abs. 2 Nr. 1)", intervalMonths: 36 },
  { name: "Hautgefährdung / Feuchtarbeit 2–4 h", kind: "OFFER", reason: "Feuchtarbeit > 2 h täglich (Anhang Teil 1 Abs. 2 Nr. 2)", intervalMonths: 36 },
  { name: "Schweißrauche", kind: "OFFER", reason: "Schweißen und Trennen von Metallen (Anhang Teil 1 Abs. 2 Nr. 2)", intervalMonths: 36 },
  { name: "Hitzearbeit", kind: "OFFER", reason: "Tätigkeiten mit extremer Hitzebelastung (Anhang Teil 3 Abs. 2 Nr. 2)", intervalMonths: 36 },
];

export async function ensureDefaultMedicalTypes(organizationId: string) {
  if (await db.medicalCheckType.count({ where: { organizationId } })) return;
  await db.medicalCheckType.createMany({ data: DEFAULT_MEDICAL_TYPES.map((t) => ({ ...t, organizationId })), skipDuplicates: true });
}

export async function setMedicalRequirements(actor: Actor, organizationId: string, typeId: string, input: { allEmployees: boolean; departmentIds: string[] }) {
  if (!(await db.medicalCheckType.count({ where: { id: typeId, organizationId } }))) throw new UserError("Vorsorgeanlass nicht gefunden.");
  const deps = input.allEmployees ? [] : input.departmentIds;
  if (deps.length && (await db.department.count({ where: { id: { in: deps }, organizationId } })) !== deps.length) throw new UserError("Abteilung nicht gefunden.");
  await transaction(async (tx) => {
    await tx.medicalRequirement.deleteMany({ where: { typeId } });
    for (const r of input.allEmployees ? [{ departmentId: null }] : deps.map((d) => ({ departmentId: d }))) {
      await tx.medicalRequirement.create({ data: { typeId, ...r } });
    }
  });
  await audit({ organizationId, userId: actor.userId, action: "medical.requirements", entity: "MedicalCheckType", entityId: typeId });
}

export async function recordMedical(
  actor: Actor,
  organizationId: string,
  input: { typeId: string; employeeId: string; date: Date; outcome: MedicalOutcome },
  now = new Date(),
) {
  if (input.date > now) throw new UserError("Das Datum darf nicht in der Zukunft liegen.");
  const [type, employee] = await Promise.all([
    db.medicalCheckType.findFirst({ where: { id: input.typeId, organizationId } }),
    db.employee.findFirst({ where: { id: input.employeeId, organizationId } }),
  ]);
  if (!type) throw new UserError("Vorsorgeanlass nicht gefunden.");
  if (!employee) throw new UserError("Mitarbeiter/in nicht gefunden.");
  if (type.kind === "MANDATORY" && input.outcome === "DECLINED") {
    throw new UserError("Pflichtvorsorge kann nicht abgelehnt werden – ohne sie darf die Tätigkeit nicht ausgeübt werden (§ 4 Abs. 2 ArbMedVV).");
  }
  const r = await db.medicalRecord.create({
    data: { typeId: type.id, employeeId: employee.id, date: input.date, outcome: input.outcome, nextDue: addMonths(input.date, type.intervalMonths) },
  });
  // keine Gesundheitsdaten im Protokoll – nur Art und Person
  await audit({ organizationId, userId: actor.userId, action: "medical.recorded", entity: "MedicalRecord", entityId: r.id, details: { type: type.name } });
  return r;
}

export type MedicalCell = { typeId: string; required: boolean; status: TrainingStatus | null; nextDue: Date | null; blocked: boolean };

/** Vorsorgeübersicht: Pflichtvorsorge fehlt oder abgelaufen → Tätigkeitsverbot */
export async function medicalOverview(organizationId: string, now = new Date()) {
  const [types, employees] = await Promise.all([
    db.medicalCheckType.findMany({ where: { organizationId, active: true, requirements: { some: {} } }, include: { requirements: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    db.employee.findMany({ where: { organizationId, active: true }, include: { medicalRecords: { orderBy: { date: "desc" } } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
  ]);
  const rows = employees.map((e) => {
    const cells: MedicalCell[] = types.map((t) => {
      const required = t.requirements.some((r) => !r.departmentId || r.departmentId === e.departmentId);
      if (!required) return { typeId: t.id, required, status: null, nextDue: null, blocked: false };
      const rec = e.medicalRecords.find((r) => r.typeId === t.id) ?? null;
      const status = trainingStatus(rec ? { validUntil: rec.nextDue } : null, now);
      return { typeId: t.id, required, status, nextDue: rec?.nextDue ?? null, blocked: t.kind === "MANDATORY" && (status === "missing" || status === "overdue") };
    });
    return { employee: e, cells, blocked: cells.some((c) => c.blocked) };
  });
  return { types, rows };
}
