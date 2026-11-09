import { describe, expect, it } from "vitest";
import { addMonths, classifyDue, parseDate } from "@/lib/dates";
import { countByStatus, groupByMonth } from "@/lib/deadlines";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("addMonths", () => {
  it("addiert Monate und Jahre", () => {
    expect(addMonths(d("2026-01-15"), 12)).toEqual(d("2027-01-15"));
    expect(addMonths(d("2026-11-09"), 3)).toEqual(d("2027-02-09"));
  });
  it("kürzt auf den Monatsletzten", () => {
    expect(addMonths(d("2026-01-31"), 1)).toEqual(d("2026-02-28"));
    expect(addMonths(d("2027-08-31"), 6)).toEqual(d("2028-02-29"));
  });
});

describe("classifyDue (Ampel)", () => {
  const now = d("2026-11-09");
  it("ordnet Fälligkeiten zu", () => {
    expect(classifyDue(d("2026-11-08"), now)).toBe("overdue");
    expect(classifyDue(d("2026-11-09"), now)).toBe("due30");
    expect(classifyDue(d("2026-12-09"), now)).toBe("due30");
    expect(classifyDue(d("2026-12-10"), now)).toBe("due90");
    expect(classifyDue(d("2027-02-07"), now)).toBe("due90");
    expect(classifyDue(d("2027-02-08"), now)).toBe("ok");
  });
  it("ignoriert die Uhrzeit", () => {
    expect(classifyDue(new Date("2026-11-09T00:00:00Z"), new Date("2026-11-09T23:59:00Z"))).toBe("due30");
  });
});

describe("Hilfen", () => {
  it("parseDate", () => {
    expect(parseDate("2026-02-30")?.toISOString().slice(0, 10)).toBe("2026-03-02");
    expect(parseDate("")).toBeNull();
    expect(parseDate("09.11.2026")).toBeNull();
  });
  it("zählt und gruppiert", () => {
    const items = [
      { status: "overdue" as const, dueAt: d("2026-10-01") },
      { status: "due30" as const, dueAt: d("2026-11-20") },
      { status: "due30" as const, dueAt: d("2026-11-25") },
    ];
    expect(countByStatus(items)).toEqual({ overdue: 1, due30: 2, due90: 0, ok: 0 });
    expect(groupByMonth(items).map(([k, v]) => [k, v.length])).toEqual([["2026-10", 1], ["2026-11", 2]]);
  });
});

import { toCsv } from "@/lib/csv";

describe("CSV-Export", () => {
  it("Semikolon, Anführungszeichen, Schutz vor Formeln", () => {
    const csv = toCsv([["a;b", 'x"y', "=SUMME(A1)", 3]]);
    expect(csv).toBe('﻿"a;b";"x""y";\'=SUMME(A1);3\r\n');
  });
});
