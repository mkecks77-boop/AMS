"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/form";

export function ActionForm({
  action,
  children,
  submitLabel,
  className,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className ?? "space-y-4"}>
      {children}
      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.message && (
        <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          <p>{state.message}</p>
          {state.link && (
            <input
              readOnly
              value={state.link}
              onFocus={(e) => e.currentTarget.select()}
              className="input mt-2 font-mono text-xs"
            />
          )}
        </div>
      )}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? "Bitte warten …" : submitLabel}
      </button>
    </form>
  );
}
