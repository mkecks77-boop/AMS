import { Prisma, PrismaClient } from "@prisma/client";
import { currentTenant, inTransaction, runInTransaction } from "./tenant";

const globalForPrisma = globalThis as unknown as { prismaBase?: PrismaClient };

/** Basis-Client ohne Mandanten-Logik (nur hier und für Transaktionen verwenden) */
const base = globalForPrisma.prismaBase ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prismaBase = base;

const setTenant = (orgId: string) => Prisma.sql`SELECT set_config('app.org_id', ${orgId}, TRUE)`;

/**
 * Jede Abfrage im Mandanten-Kontext läuft in einer kurzen Transaktion, die zuerst `app.org_id` setzt.
 * Die Row-Level-Security-Policies der Datenbank lassen dann nur Zeilen dieses Unternehmens zu.
 */
export const db = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        if (inTransaction()) return query(args);
        const orgId = await currentTenant();
        if (!orgId) return query(args);
        const [, result] = await base.$transaction([base.$executeRaw(setTenant(orgId)), query(args)]);
        return result;
      },
    },
  },
});

export type TxClient = Prisma.TransactionClient;

/**
 * Transaktion mit Mandanten-Kontext. Statt `db.$transaction` verwenden:
 * setzt `app.org_id` innerhalb der Transaktion, damit RLS auch hier greift.
 */
export async function transaction<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
  const orgId = await currentTenant();
  return runInTransaction(orgId, () =>
    base.$transaction(async (tx) => {
      if (orgId) await tx.$executeRaw(setTenant(orgId));
      return fn(tx);
    }),
  );
}

/** Warnt, wenn die Datenverbindung RLS umgeht (Superuser oder BYPASSRLS) */
let checked = false;
export async function checkRlsRole() {
  if (checked) return;
  checked = true;
  try {
    const [r] = await base.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    if (r?.rolsuper || r?.rolbypassrls) {
      console.warn("[AMS] Achtung: Die Datenbankverbindung nutzt eine Rolle mit Superuser/BYPASSRLS – die Mandantentrennung in der Datenbank (RLS) ist damit wirkungslos. Für den Betrieb eine eigene Rolle verwenden (siehe README).");
    }
  } catch {
    /* Prüfung ist nur ein Hinweis */
  }
}
