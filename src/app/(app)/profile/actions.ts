"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/session";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/password";
import { generateSecret, verifyTotp } from "@/lib/totp";
import { bool, str, type FormState } from "@/lib/form";

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const { user, id: sessionId } = await requireUser();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (!user.passwordHash || !(await verifyPassword(current, user.passwordHash))) return { error: "Das aktuelle Passwort ist falsch." };
  const err = validatePassword(next);
  if (err) return { error: err };
  if (next !== String(fd.get("repeat") ?? "")) return { error: "Die Wiederholung stimmt nicht überein." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  // andere Sitzungen abmelden
  await db.session.deleteMany({ where: { userId: user.id, id: { not: sessionId } } });
  await audit({ userId: user.id, action: "password.changed", entity: "User", entityId: user.id });
  return { message: "Passwort geändert. Andere Sitzungen wurden abgemeldet." };
}

export async function startTotp(): Promise<void> {
  const { user } = await requireUser();
  if (user.totpEnabled) return;
  await db.user.update({ where: { id: user.id }, data: { totpSecret: generateSecret() } });
  revalidatePath("/profile");
}

export async function confirmTotp(_: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireUser();
  if (!user.totpSecret) return { error: "Bitte zuerst die Einrichtung starten." };
  if (!verifyTotp(user.totpSecret, str(fd, "code"))) return { error: "Der Code ist ungültig. Bitte Uhrzeit des Geräts prüfen und erneut versuchen." };
  await db.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
  await audit({ userId: user.id, action: "totp.enabled", entity: "User", entityId: user.id });
  revalidatePath("/profile");
  return { message: "Zwei-Faktor-Anmeldung ist aktiv." };
}

export async function disableTotp(_: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireUser();
  if (!user.totpEnabled || !user.totpSecret) return { error: "Nicht aktiv." };
  if (!verifyTotp(user.totpSecret, str(fd, "code"))) return { error: "Der Code ist ungültig." };
  await db.user.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecret: null } });
  await audit({ userId: user.id, action: "totp.disabled", entity: "User", entityId: user.id });
  revalidatePath("/profile");
  return { message: "Zwei-Faktor-Anmeldung deaktiviert." };
}

export async function saveNotifications(_: FormState, fd: FormData): Promise<FormState> {
  const { user } = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { emailDigest: bool(fd, "emailDigest") } });
  return { message: "Gespeichert." };
}
