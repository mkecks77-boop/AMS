/** Demodaten zum Ausprobieren. Passwort für alle: Demo-Passwort1 */
import { PrismaClient, type InspectorType, type Role } from "@prisma/client";
import { addMonths } from "../src/lib/dates";
import { draftFromSubstance } from "../src/lib/instructions";
import { createId } from "../src/lib/id";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword("Demo-Passwort1");
  const orgs = await Promise.all(
    [
      { name: "Muster Metallbau GmbH", slug: "muster-metallbau" },
      { name: "Beispiel Logistik AG", slug: "beispiel-logistik" },
    ].map((o) => db.organization.upsert({ where: { slug: o.slug }, create: o, update: {} })),
  );

  const users: { email: string; name: string; platform?: boolean; m: [number, Role, boolean][] }[] = [
    { email: "betreiber@example.com", name: "Paula Plattform", platform: true, m: [] },
    { email: "sifa@example.com", name: "Erik Extern", m: [[0, "SAFETY_OFFICER", true], [1, "SAFETY_OFFICER", true]] },
    { email: "admin@metallbau.example.com", name: "Anna Admin", m: [[0, "ORG_ADMIN", false]] },
    { email: "meister@metallbau.example.com", name: "Max Meister", m: [[0, "MANAGER", false]] },
    { email: "admin@logistik.example.com", name: "Lea Logistik", m: [[1, "ORG_ADMIN", false]] },
  ];

  for (const u of users) {
    const user = await db.user.upsert({
      where: { email: u.email },
      create: { email: u.email, name: u.name, passwordHash, isPlatformAdmin: !!u.platform },
      update: {},
    });
    for (const [i, role, external] of u.m) {
      await db.membership.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: orgs[i].id } },
        create: { userId: user.id, organizationId: orgs[i].id, role, external },
        update: {},
      });
    }
  }
  // Stammdaten, Anlagen und Prüfpflichten für Muster Metallbau
  const org = orgs[0];
  if ((await db.site.count({ where: { organizationId: org.id } })) === 0) {
    const werk = await db.site.create({ data: { organizationId: org.id, name: "Werk Nord", address: "Industriestr. 1, 12345 Musterstadt" } });
    const lager = await db.site.create({ data: { organizationId: org.id, name: "Lager Süd" } });
    const fertigung = await db.department.create({ data: { organizationId: org.id, name: "Fertigung", siteId: werk.id } });
    const logistik = await db.department.create({ data: { organizationId: org.id, name: "Logistik", siteId: lager.id } });
    const people = [
      ["1001", "Max", "Meister", "Meister Fertigung", werk.id, fertigung.id, false],
      ["1002", "Tom", "Dreher", "Zerspanungsmechaniker", werk.id, fertigung.id, false],
      ["1003", "Lisa", "Lager", "Fachkraft Lagerlogistik", lager.id, logistik.id, false],
      ["1004", "Jan", "Jung", "Auszubildender Metallbau", werk.id, fertigung.id, true],
    ] as const;
    const emps = [];
    for (const [nr, first, last, job, siteId, depId, azubi] of people) {
      emps.push(await db.employee.create({
        data: { organizationId: org.id, personnelNumber: nr, firstName: first, lastName: last, jobTitle: job, siteId, departmentId: depId, apprentice: azubi },
      }));
    }
    const now = new Date();
    const day = (n: number) => new Date(now.getTime() + n * 86400000);
    const machines: [string, string, string, string, string, [string, number, InspectorType, Date][]][] = [
      ["M-001", "CNC-Drehmaschine", "Maschinen", werk.id, emps[1].id, [
        ["Wiederkehrende Prüfung Maschine (Schutzeinrichtungen)", 12, "COMPETENT_PERSON", day(-12)],
        ["Prüfung ortsfester elektrischer Anlagen", 48, "COMPETENT_PERSON", day(200)],
      ]],
      ["S-001", "Gabelstapler Linde H25", "Flurförderzeuge", lager.id, emps[2].id, [
        ["Prüfung Flurförderzeug (Stapler)", 12, "COMPETENT_PERSON", day(18)],
      ]],
      ["R-001", "Palettenregal Halle 2", "Regale", lager.id, emps[2].id, [
        ["Inspektion Regalanlage", 12, "COMPETENT_PERSON", day(60)],
      ]],
      ["L-001", "Stehleiter 6 Stufen", "Leitern und Tritte", werk.id, emps[0].id, [
        ["Prüfung Leitern und Tritte", 12, "COMPETENT_PERSON", day(150)],
      ]],
      ["K-001", "Brückenkran 5 t", "Krane", werk.id, emps[0].id, [
        ["Prüfung Krananlage", 12, "COMPETENT_PERSON", day(25)],
        ["Prüfung Lastaufnahme- und Anschlagmittel", 12, "COMPETENT_PERSON", day(-3)],
      ]],
    ];
    for (const [inv, name, category, siteId, responsibleId, obs] of machines) {
      const eq = await db.equipment.create({
        data: { organizationId: org.id, inventoryNumber: inv, name, category, siteId, responsibleId, ceMarked: true, hasOperatingManual: true },
      });
      for (const [title, intervalMonths, inspectorType, nextDueAt] of obs) {
        await db.inspectionObligation.create({
          data: { organizationId: org.id, equipmentId: eq.id, title, intervalMonths, inspectorType, nextDueAt, lastInspectedAt: addMonths(nextDueAt, -intervalMonths) },
        });
      }
    }
  }

  // Gefahrstoffe und Betriebsanweisungen für Muster Metallbau
  if ((await db.hazardousSubstance.count({ where: { organizationId: org.id } })) === 0) {
    const sifa = await db.user.findUniqueOrThrow({ where: { email: "sifa@example.com" } });
    const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@metallbau.example.com" } });
    const werk = await db.site.findFirstOrThrow({ where: { organizationId: org.id, name: "Werk Nord" } });
    const now = new Date();
    const substances = [
      {
        name: "Aceton technisch", manufacturer: "Chemiehandel Muster GmbH", casNumber: "67-64-1", usage: "Reinigen und Entfetten von Metallteilen",
        pictograms: ["GHS02", "GHS07"], signalWord: "DANGER" as const, hStatements: ["H225", "H319", "H336", "EUH066"],
        pStatements: ["P210", "P233", "P240", "P280", "P305_P351_P338", "P403_P233", "P501"], storageClass: "3", waterHazardClass: "1",
        sdsDate: addMonths(now, -8), sdsReviewDue: addMonths(now, 4), ppe: "Nitrilhandschuhe (0,4 mm), Schutzbrille",
        substitutionChecked: true, substitutionNotes: "Wässriger Reiniger geprüft, Reinigungswirkung bei Harzrückständen unzureichend.",
        status: "APPROVED" as const, use: ["Teilereinigung Halle 1", 20, "l"] as const, release: true,
      },
      {
        name: "Kühlschmierstoff Cool 500", manufacturer: "Lubri AG", casNumber: null, usage: "Kühlschmierstoff für CNC-Bearbeitung (wassermischbar)",
        pictograms: ["GHS07"], signalWord: "WARNING" as const, hStatements: ["H315", "H317", "H412"],
        pStatements: ["P261", "P272", "P280", "P302_P352", "P333_P313", "P501"], storageClass: "10", waterHazardClass: "2",
        sdsDate: addMonths(now, -14), sdsReviewDue: addMonths(now, -1), ppe: "Hautschutzplan beachten, Nitrilhandschuhe bei Konzentratkontakt",
        substitutionChecked: true, substitutionNotes: "Nitrit- und borfreier KSS gewählt.",
        status: "APPROVED" as const, use: ["CNC-Drehmaschine M-001", 200, "l"] as const, release: false,
      },
      {
        name: "Bremsenreiniger Spray", manufacturer: "AutoPflege KG", casNumber: null, usage: "Reinigung in der Instandhaltung",
        pictograms: ["GHS02", "GHS07", "GHS09"], signalWord: "DANGER" as const, hStatements: ["H222", "H229", "H315", "H336", "H411"],
        pStatements: ["P210", "P211", "P251", "P271", "P410_P412"], storageClass: "2B", waterHazardClass: "2",
        sdsDate: addMonths(now, -2), sdsReviewDue: null, ppe: "Schutzhandschuhe", substitutionChecked: false, substitutionNotes: null,
        status: "REQUESTED" as const, use: null, release: false,
      },
    ];
    for (const { use, release, ...data } of substances) {
      const sub = await db.hazardousSubstance.create({ data: { ...data, organizationId: org.id, requestedById: admin.id, decidedById: data.status === "APPROVED" ? sifa.id : null, decidedAt: data.status === "APPROVED" ? addMonths(now, -6) : null } });
      if (use) await db.substanceUse.create({ data: { substanceId: sub.id, siteId: werk.id, workArea: use[0], quantity: use[1], unit: use[2] } });
      if (data.status === "APPROVED") {
        const releasedAt = addMonths(now, -6);
        await db.operatingInstruction.create({
          data: {
            ...draftFromSubstance(sub), organizationId: org.id, seriesId: createId(), substanceId: sub.id,
            authorId: sifa.id, lastEditorId: sifa.id, postings: use ? use[0] : null,
            ...(release ? { status: "RELEASED", releasedById: admin.id, releasedAt, reviewDue: addMonths(releasedAt, 24) } : {}),
          },
        });
      }
    }
    const cnc = await db.equipment.findFirst({ where: { organizationId: org.id, inventoryNumber: "M-001" } });
    if (cnc) {
      const releasedAt = addMonths(now, -23);
      await db.operatingInstruction.create({
        data: {
          organizationId: org.id, seriesId: createId(), type: "MACHINE", title: "CNC-Drehmaschine", scope: "Halle 1, Arbeitsplatz M-001",
          equipmentId: cnc.id, authorId: sifa.id, lastEditorId: sifa.id, status: "RELEASED", releasedById: admin.id, releasedAt, reviewDue: addMonths(releasedAt, 24),
          pictograms: ["W024", "M004", "M008", "M003", "P028", "E003"], emergencyPhone: "112", postings: "An der Maschine M-001",
          hazards: "• Erfassen und Aufwickeln durch rotierende Teile (Futter, Werkstück)\n• Wegfliegende Späne und Werkstücke\n• Schnittverletzungen an Spänen und Werkzeugen\n• Hautkontakt mit Kühlschmierstoff\n• Lärm",
          protectiveMeasures: "• Bedienung nur durch unterwiesene und beauftragte Personen\n• Schutztür vor dem Start schließen, Verriegelung nicht überbrücken\n• Keine Handschuhe beim Arbeiten an der laufenden Maschine\n• Eng anliegende Kleidung, lange Haare zusammenbinden, keinen Schmuck tragen\n• Schutzbrille, Sicherheitsschuhe, bei Bedarf Gehörschutz tragen\n• Späne nur mit Spänehaken entfernen, nie mit der Hand\n• Hautschutzplan beachten",
          malfunctions: "• Bei Störungen NOT-HALT betätigen\n• Maschine stillsetzen und gegen Wiedereinschalten sichern\n• Vorgesetzte informieren, Störung nicht selbst beheben",
          firstAid: "• Ersthelfer heranziehen\n• Bei Verletzungen Maschine sofort stillsetzen\n• Notruf 112\n• Jeden Unfall melden und im Verbandbuch eintragen",
          maintenance: "• Instandhaltung nur durch beauftragte Fachkräfte bei abgeschalteter und gesicherter Maschine\n• Schutzeinrichtungen täglich vor Arbeitsbeginn auf Funktion prüfen\n• Späne und KSS-Reste getrennt entsorgen",
        },
      });
    }
  }

  // Unterweisungen und Qualifikationen für Muster Metallbau
  if ((await db.trainingTopic.count({ where: { organizationId: org.id } })) === 0) {
    const now = new Date();
    const emps = await db.employee.findMany({ where: { organizationId: org.id }, orderBy: { personnelNumber: "asc" } });
    const fert = await db.department.findFirst({ where: { organizationId: org.id, name: "Fertigung" } });
    const general = await db.trainingTopic.create({
      data: {
        organizationId: org.id, title: "Allgemeine Arbeitsschutzunterweisung", kind: "INSTRUCTION", intervalMonths: 12, legalBasis: "§ 12 ArbSchG, § 4 DGUV V1",
        content: "• Verhalten im Brandfall und Fluchtwege\n• Erste Hilfe und Unfallmeldung\n• Verkehrswege und Ordnung\n• Persönliche Schutzausrüstung\n• Meldung von Mängeln",
        requirements: { create: [{ departmentId: null }] },
      },
    });
    const cncBa = await db.operatingInstruction.findFirst({ where: { organizationId: org.id, title: "CNC-Drehmaschine", status: "RELEASED" } });
    const cnc = await db.trainingTopic.create({
      data: {
        organizationId: org.id, title: "Unterweisung: CNC-Drehmaschine", kind: "INSTRUCTION", intervalMonths: 12, legalBasis: "§ 12 BetrSichV",
        instructionId: cncBa?.id ?? null, content: "Inhalte gemäß Betriebsanweisung CNC-Drehmaschine",
        requirements: { create: fert ? [{ departmentId: fert.id }] : [] },
      },
    });
    const s1 = await db.trainingSession.create({ data: { topicId: general.id, date: addMonths(now, -11), trainer: "Erik Extern", location: "Besprechungsraum" } });
    for (const e of emps) {
      await db.trainingRecord.create({ data: { topicId: general.id, employeeId: e.id, sessionId: s1.id, completedAt: s1.date, validUntil: addMonths(s1.date, e.apprentice ? 6 : 12) } });
    }
    const s2 = await db.trainingSession.create({ data: { topicId: cnc.id, date: addMonths(now, -3), trainer: "Max Meister", location: "Halle 1" } });
    const dreher = emps.find((e) => e.lastName === "Dreher");
    if (dreher) await db.trainingRecord.create({ data: { topicId: cnc.id, employeeId: dreher.id, sessionId: s2.id, completedAt: s2.date, validUntil: addMonths(s2.date, 12) } });

    const types = [
      { name: "Ersthelfer/in", category: "FIRST_AID" as const, validityMonths: 24, legalBasis: "DGUV V1 § 26" },
      { name: "Brandschutzhelfer/in", category: "FIRE_WARDEN" as const, validityMonths: 36, legalBasis: "ASR A2.2" },
      { name: "Fahrausweis Flurförderzeuge (Stapler)", category: "OTHER" as const, validityMonths: null, legalBasis: "DGUV V68 § 7" },
      { name: "Kranführer/in", category: "OTHER" as const, validityMonths: null, legalBasis: "DGUV V52 § 29" },
    ];
    const t: Record<string, string> = {};
    for (const x of types) t[x.name] = (await db.qualificationType.create({ data: { ...x, organizationId: org.id } })).id;
    const by = (n: string) => emps.find((e) => e.lastName === n)!;
    await db.qualification.createMany({
      data: [
        { typeId: t["Ersthelfer/in"], employeeId: by("Meister").id, acquiredAt: addMonths(now, -23), validUntil: addMonths(now, 1), issuer: "DRK" },
        { typeId: t["Brandschutzhelfer/in"], employeeId: by("Dreher").id, acquiredAt: addMonths(now, -12), validUntil: addMonths(now, 24) },
        { typeId: t["Fahrausweis Flurförderzeuge (Stapler)"], employeeId: by("Lager").id, acquiredAt: addMonths(now, -40) },
        { typeId: t["Kranführer/in"], employeeId: by("Meister").id, acquiredAt: addMonths(now, -60) },
      ],
    });
  }

  // Unfälle, Verbandbuch, Maßnahmen für Muster Metallbau
  if ((await db.incident.count({ where: { organizationId: org.id } })) === 0) {
    const now = new Date();
    const y = now.getUTCFullYear();
    const sifa = await db.user.findUniqueOrThrow({ where: { email: "sifa@example.com" } });
    const werk = await db.site.findFirstOrThrow({ where: { organizationId: org.id, name: "Werk Nord" } });
    const lager = await db.site.findFirstOrThrow({ where: { organizationId: org.id, name: "Lager Süd" } });
    const by = async (n: string) => db.employee.findFirstOrThrow({ where: { organizationId: org.id, lastName: n } });
    const dreher = await by("Dreher"), lagerE = await by("Lager"), meister = await by("Meister");
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
    const i1 = await db.incident.create({ data: {
      organizationId: org.id, number: `${y}-001`, type: "ACCIDENT", occurredAt: daysAgo(60), siteId: werk.id, location: "Halle 1, M-001", employeeId: dreher.id,
      activity: "Werkstückwechsel an der CNC-Drehmaschine", description: "Beim Entfernen von Spänen mit der Hand Schnittverletzung am Zeigefinger.",
      injury: "Schnittwunde", bodyPart: "rechter Zeigefinger", firstAider: "Max Meister", doctorVisit: true, lostDays: 5, reportedToBgAt: daysAgo(58),
      causeCategory: "PERSONAL", rootCause: "Späne mit der Hand entfernt – Spänehaken nicht griffbereit, Unterweisung lag 11 Monate zurück.", status: "INVESTIGATING", reporterId: sifa.id,
    } });
    await db.incident.create({ data: {
      organizationId: org.id, number: `${y}-002`, type: "NEAR_MISS", occurredAt: daysAgo(20), siteId: lager.id, location: "Halle 2, Gang 3", employeeId: lagerE.id,
      description: "Stapler beim Rückwärtsfahren – Fußgänger konnte gerade noch ausweichen.", reporterId: sifa.id,
    } });
    await db.incident.create({ data: {
      organizationId: org.id, number: `${y}-003`, type: "ACCIDENT", occurredAt: daysAgo(2), siteId: lager.id, location: "Rampe 1", employeeId: lagerE.id,
      description: "Beim Abstieg von der Ladebrücke umgeknickt.", injury: "Distorsion", bodyPart: "linkes Sprunggelenk", lostDays: 7, reporterId: sifa.id,
    } });
    await db.action.createMany({ data: [
      { organizationId: org.id, title: "Spänehaken an jeder Drehmaschine fest anbringen", level: "TECHNICAL", priority: "HIGH", responsibleId: meister.id, dueDate: daysAgo(30), status: "DONE", completedAt: daysAgo(35), sourceType: "INCIDENT", incidentId: i1.id, createdById: sifa.id },
      { organizationId: org.id, title: "Unterweisung CNC: Späne nur mit Spänehaken entfernen", level: "ORGANIZATIONAL", priority: "MEDIUM", responsibleId: meister.id, dueDate: daysAgo(5), sourceType: "INCIDENT", incidentId: i1.id, createdById: sifa.id },
      { organizationId: org.id, title: "Verkehrswege Halle 2: Fußgängerwege markieren", level: "TECHNICAL", priority: "HIGH", responsibleId: lagerE.id, dueDate: daysAgo(-20), sourceType: "OTHER", createdById: sifa.id },
    ] });
    await db.firstAidEntry.createMany({ data: [
      { organizationId: org.id, occurredAt: daysAgo(15), siteId: werk.id, location: "Halle 1", employeeId: dreher.id, description: "Metallsplitter beim Entgraten", injury: "Splitter im Daumen", measures: "Splitter entfernt, Pflaster", firstAider: "Max Meister" },
      { organizationId: org.id, occurredAt: daysAgo(4), siteId: lager.id, location: "Kommissionierung", employeeId: lagerE.id, description: "Papierschnitt beim Öffnen eines Kartons", injury: "Schnitt Handfläche", measures: "gereinigt, Pflaster", firstAider: "Tom Dreher" },
    ] });
  }

  // Gefährdungsbeurteilung, Begehung, PSA, Beauftragte für Muster Metallbau
  if ((await db.riskAssessment.count({ where: { organizationId: org.id } })) === 0) {
    const now = new Date();
    const werk = await db.site.findFirstOrThrow({ where: { organizationId: org.id, name: "Werk Nord" } });
    const fert = await db.department.findFirst({ where: { organizationId: org.id, name: "Fertigung" } });
    const sifa = await db.user.findUniqueOrThrow({ where: { email: "sifa@example.com" } });
    const by = async (n: string) => db.employee.findFirstOrThrow({ where: { organizationId: org.id, lastName: n } });
    const meister = await by("Meister"), dreher = await by("Dreher"), lagerE = await by("Lager");
    const released = addMonths(now, -22);
    await db.riskAssessment.create({ data: {
      organizationId: org.id, title: "CNC-Drehmaschine M-001", kind: "GENERAL", siteId: werk.id, departmentId: fert?.id, scope: "Rüsten, Bedienen, Reinigen", participants: "Max Meister, Erik Extern (Sifa), Tom Dreher",
      responsibleId: meister.id, status: "RELEASED", releasedAt: released, releasedById: sifa.id, reviewDue: addMonths(released, 24),
      hazards: { create: [
        { factor: "1", description: "Erfassen durch rotierendes Futter", probability: 3, severity: 5, measures: "Verriegelte Schutztür, Not-Halt, Unterweisung, keine Handschuhe an laufender Maschine", residualProbability: 1, residualSeverity: 5, sortOrder: 0 },
        { factor: "1", description: "Schnittverletzungen durch Späne", probability: 4, severity: 2, measures: "Spänehaken, Schnittschutzhandschuhe beim Spänewechsel (Maschine steht)", residualProbability: 2, residualSeverity: 2, sortOrder: 1 },
        { factor: "3", description: "Hautkontakt mit Kühlschmierstoff", probability: 4, severity: 2, measures: "Hautschutzplan, KSS-Pflege nach TRGS 611, Angebotsvorsorge Hauterkrankungen", residualProbability: 2, residualSeverity: 2, sortOrder: 2 },
        { factor: "7", description: "Lärm > 80 dB(A)", probability: 3, severity: 3, measures: "Gehörschutz bereitstellen, Lärmbereich kennzeichnen", residualProbability: 2, residualSeverity: 2, sortOrder: 3 },
      ] },
    } });
    await db.riskAssessment.create({ data: {
      organizationId: org.id, title: "Psychische Belastung Fertigung", kind: "PSYCHOLOGICAL", siteId: werk.id, departmentId: fert?.id, responsibleId: meister.id,
      hazards: { create: [{ factor: "10", description: "Zeitdruck durch Eilaufträge", probability: 4, severity: 3, measures: "", sortOrder: 0 }] },
    } });
    const tpl = await db.checklistTemplate.create({ data: {
      organizationId: org.id, title: "Allgemeine Betriebsbegehung", description: "Grundcheckliste",
      items: { create: [
        { section: "Verkehrs- und Fluchtwege", text: "Fluchtwege und Notausgänge frei", sortOrder: 0 },
        { section: "Brandschutz", text: "Feuerlöscher vorhanden, zugänglich und geprüft", sortOrder: 1 },
        { section: "Erste Hilfe", text: "Verbandkasten vollständig", sortOrder: 2 },
        { section: "Arbeitsmittel", text: "Schutzeinrichtungen vorhanden und wirksam", sortOrder: 3 },
        { section: "Ordnung", text: "Keine Stolperstellen", sortOrder: 4 },
      ] },
    }, include: { items: true } });
    const w = await db.walkthrough.create({ data: { organizationId: org.id, templateId: tpl.id, siteId: werk.id, area: "Halle 1", plannedAt: addMonths(now, -1), performedAt: addMonths(now, -1), auditor: "Erik Extern", participants: "Max Meister", status: "DONE", summary: "Insgesamt guter Zustand." } });
    for (const it of tpl.items) {
      const defect = it.sortOrder === 2;
      await db.walkthroughAnswer.create({ data: { walkthroughId: w.id, itemId: it.id, result: defect ? "DEFECT" : "OK", note: defect ? "Pflaster und Einmalhandschuhe fehlen" : null } });
    }
    await db.action.create({ data: { organizationId: org.id, title: "Verbandkasten Halle 1 auffüllen", level: "ORGANIZATIONAL", priority: "MEDIUM", responsibleId: meister.id, dueDate: addMonths(now, 0), sourceType: "AUDIT", walkthroughId: w.id, createdById: sifa.id } });
    await db.walkthrough.create({ data: { organizationId: org.id, templateId: tpl.id, siteId: (await db.site.findFirstOrThrow({ where: { organizationId: org.id, name: "Lager Süd" } })).id, area: "Halle 2", plannedAt: new Date(now.getTime() + 10 * 86400000), auditor: "Erik Extern" } });
    const shoes = await db.ppeItem.create({ data: { organizationId: org.id, name: "Sicherheitsschuhe S3", category: "Fußschutz", standard: "DIN EN ISO 20345", replaceMonths: 12 } });
    const glasses = await db.ppeItem.create({ data: { organizationId: org.id, name: "Schutzbrille", category: "Augen- und Gesichtsschutz", standard: "DIN EN 166" } });
    await db.ppeIssue.createMany({ data: [
      { itemId: shoes.id, employeeId: dreher.id, size: "43", issuedAt: addMonths(now, -11), replaceDue: addMonths(now, 1), receiptSigned: true },
      { itemId: shoes.id, employeeId: lagerE.id, size: "39", issuedAt: addMonths(now, -2), replaceDue: addMonths(now, 10), receiptSigned: false },
      { itemId: glasses.id, employeeId: dreher.id, issuedAt: addMonths(now, -11), receiptSigned: true },
    ] });
    await db.appointment.createMany({ data: [
      { organizationId: org.id, employeeId: meister.id, role: "DUTY_TRANSFER", siteId: werk.id, scope: "Fertigung Halle 1 inkl. Instandhaltung", appointedAt: addMonths(now, -30), signed: true },
      { organizationId: org.id, employeeId: dreher.id, role: "SAFETY_REP", siteId: werk.id, appointedAt: addMonths(now, -20), validUntil: addMonths(now, 2), signed: true },
    ] });
  }

  // ASA-Sitzungen und Einsatzzeit für Muster Metallbau
  if ((await db.asaMeeting.count({ where: { organizationId: org.id } })) === 0) {
    const now = new Date();
    const sifa = await db.user.findUniqueOrThrow({ where: { email: "sifa@example.com" } });
    await db.organization.update({ where: { id: org.id }, data: { sifaHoursTarget: 60 } });
    await db.asaMeeting.create({ data: {
      organizationId: org.id, date: addMonths(now, -2), location: "Besprechungsraum", status: "DONE",
      participants: "Geschäftsführung, Betriebsrat (2), Betriebsärztin, Erik Extern (Sifa), Tom Dreher (SiBe)",
      agenda: "1. Begrüßung\n2. Stand der Maßnahmen\n3. Unfallgeschehen\n4. Bericht Sifa\n5. Bericht Betriebsärztin\n6. Verschiedenes",
      minutes: "TOP 3: Schnittverletzung an M-001 besprochen, Spänehaken werden beschafft.\nTOP 4: Begehung Halle 1 ohne wesentliche Mängel.\nTOP 6: Nächste Sitzung in drei Monaten.",
    } });
    const cats = ["WALK", "RISK", "ADVICE", "INCIDENT", "TRAINING", "ASA", "DOCS"];
    for (let i = 0; i < 14; i++) {
      await db.timeEntry.create({ data: { organizationId: org.id, userId: sifa.id, date: addMonths(now, -Math.floor(i / 2)), minutes: 60 + (i % 4) * 30, category: cats[i % cats.length], description: null } });
    }
  }

  console.log("Demodaten angelegt. Passwort: Demo-Passwort1");
}

main().finally(() => db.$disconnect());
