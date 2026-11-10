import { db } from "./db";
import { getMatrix } from "./trainings";
import { incidentStats } from "./incidents";
import { timeSummary } from "./timelog";
import { complianceRate } from "./walkthroughs";

/** Daten für den Jahresbericht der Fachkraft für Arbeitssicherheit / Managementbewertung */
export async function annualReport(organizationId: string, year: number, now = new Date()) {
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const period = { gte: from, lt: to };
  const [org, incidents, time, matrix, inspections, inspectionsFailed, overdueObligations, risks, risksOverdue, walks, actionsCreated, actionsDone, actionsOpenOverdue, asa, substances, cmr, instructionsReleased, firstAidQuals] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    incidentStats(organizationId, year),
    timeSummary(organizationId, year),
    getMatrix(organizationId, {}, now),
    db.inspection.count({ where: { performedAt: period, obligation: { organizationId } } }),
    db.inspection.count({ where: { performedAt: period, result: "FAILED", obligation: { organizationId } } }),
    db.inspectionObligation.count({ where: { organizationId, active: true, nextDueAt: { lt: now }, equipment: { status: { notIn: ["DECOMMISSIONED", "SCRAPPED"] } } } }),
    db.riskAssessment.count({ where: { organizationId, status: "RELEASED" } }),
    db.riskAssessment.count({ where: { organizationId, status: "RELEASED", reviewDue: { lt: now } } }),
    db.walkthrough.findMany({ where: { organizationId, status: "DONE", performedAt: period }, include: { answers: true } }),
    db.action.count({ where: { organizationId, createdAt: period } }),
    db.action.count({ where: { organizationId, completedAt: period } }),
    db.action.count({ where: { organizationId, status: { in: ["OPEN", "IN_PROGRESS"] }, dueDate: { lt: now } } }),
    db.asaMeeting.count({ where: { organizationId, status: "DONE", date: period } }),
    db.hazardousSubstance.count({ where: { organizationId, status: "APPROVED" } }),
    db.hazardousSubstance.findMany({ where: { organizationId, status: "APPROVED" }, select: { hStatements: true } }),
    db.operatingInstruction.count({ where: { organizationId, status: "RELEASED" } }),
    db.qualification.count({ where: { employee: { organizationId, active: true }, type: { category: "FIRST_AID" }, OR: [{ validUntil: null }, { validUntil: { gte: now } }] } }),
  ]);
  const rates = walks.map((w) => complianceRate(w.answers)).filter((r): r is number => r != null);
  return {
    organization: org,
    year,
    incidents,
    time,
    trainingRate: matrix.rate,
    inspections,
    inspectionsFailed,
    overdueObligations,
    risks,
    risksOverdue,
    walkthroughs: walks.length,
    avgCompliance: rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null,
    actionsCreated,
    actionsDone,
    actionsOpenOverdue,
    asaMeetings: asa,
    substances,
    cmrSubstances: cmr.filter((s) => s.hStatements.some((h) => /^H3(40|41|50|51|60|61)/.test(h))).length,
    instructionsReleased,
    firstAiders: firstAidQuals,
  };
}
