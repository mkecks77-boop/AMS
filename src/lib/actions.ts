import type { FormState } from "./form";
import type { OrgContext } from "./session";
import { UserError, type Actor } from "./users";

export function actorOf(ctx: OrgContext): Actor {
  return { userId: ctx.user.id, isPlatformAdmin: ctx.user.isPlatformAdmin };
}

/** Wandelt fachliche Fehler in eine Formularmeldung um. */
export async function run(fn: () => Promise<FormState | void>, ok = "Gespeichert."): Promise<FormState> {
  try {
    return (await fn()) ?? { message: ok };
  } catch (e) {
    if (e instanceof UserError) return { error: e.message };
    throw e;
  }
}
