import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Mandanten-Kontext. Ist er gesetzt, schränkt PostgreSQL (Row-Level Security) alle Abfragen auf
 * dieses Unternehmen ein – zusätzlich zu den Filtern im Code.
 *
 * Zwei Quellen:
 * 1. explizit über runWithTenant / withoutTenant (Tests, Hintergrundprozesse, bewusste Ausnahmen)
 * 2. je HTTP-Anfrage: requireOrg() registriert das Unternehmen am Request-Objekt von Next.js
 *    (das Cookie-Objekt ist innerhalb einer Anfrage stabil). Ein Kontext aus AsyncLocalStorage.enterWith
 *    würde nicht zur aufrufenden Seite zurückfließen und ist daher nicht geeignet.
 */
type Ctx = { orgId: string | null; inTransaction?: boolean };
const store = new AsyncLocalStorage<Ctx>();
const byRequest = new WeakMap<object, string>();

async function requestKey(): Promise<object | null> {
  try {
    const { cookies } = await import("next/headers");
    return await cookies();
  } catch {
    return null; // außerhalb einer Anfrage (Skripte, Tests)
  }
}

export async function currentTenant(): Promise<string | null> {
  const ctx = store.getStore();
  if (ctx) return ctx.orgId;
  const key = await requestKey();
  return key ? byRequest.get(key) ?? null : null;
}

export function inTransaction(): boolean {
  return !!store.getStore()?.inTransaction;
}

/** Registriert den Mandanten für die laufende HTTP-Anfrage (aufgerufen von requireOrg). */
export async function enterTenant(orgId: string) {
  const key = await requestKey();
  if (key) byRequest.set(key, orgId);
}

// Prisma-Abfragen starten erst beim Abwarten – deshalb innerhalb des Kontexts mit await auflösen.
export function runWithTenant<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
  return store.run({ orgId }, async () => await fn());
}

/**
 * Bewusst mandantenübergreifend – nur für Prüfungen, die andere Unternehmen sehen MÜSSEN
 * (z. B. „gehört diese Person noch anderen Unternehmen an?“). Sparsam verwenden.
 */
export function withoutTenant<T>(fn: () => Promise<T>): Promise<T> {
  return store.run({ orgId: null }, async () => await fn());
}

export function runInTransaction<T>(orgId: string | null, fn: () => Promise<T>): Promise<T> {
  return store.run({ orgId, inTransaction: true }, async () => await fn());
}
