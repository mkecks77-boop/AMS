"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/lib/form";
import { login } from "../actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});
  // kontrollierte Felder: React setzt Formulare nach einer Server Action sonst zurück
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">E-Mail</label>
        <input id="email" name="email" type="email" required autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">Passwort</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {state.needCode && (
        <div>
          <label className="label" htmlFor="code">Code aus der Authenticator-App</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus className="input tracking-widest" />
        </div>
      )}
      {state.error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      <button type="submit" className="btn" disabled={pending}>{pending ? "Bitte warten …" : "Anmelden"}</button>
    </form>
  );
}
