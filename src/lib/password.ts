import bcrypt from "bcryptjs";

export const MIN_PASSWORD_LENGTH = 10;

export function validatePassword(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH)
    return `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`;
  if (!/[A-Za-zÄÖÜäöüß]/.test(pw) || !/[0-9]/.test(pw))
    return "Das Passwort muss Buchstaben und Ziffern enthalten.";
  return null;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
