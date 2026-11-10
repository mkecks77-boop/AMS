import type { Prisma } from "@prisma/client";
import { db } from "./db";

export async function audit(entry: {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Prisma.InputJsonValue;
}) {
  await db.auditLog.create({ data: entry });
}
