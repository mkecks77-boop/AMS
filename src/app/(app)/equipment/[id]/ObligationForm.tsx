"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { INSPECTION_CATALOG, INSPECTOR_TYPE_LABELS } from "@/lib/catalog";
import { addObligation } from "../actions";

export function ObligationForm({ equipmentId, category }: { equipmentId: string; category: string }) {
  const suggested = INSPECTION_CATALOG.filter((e) => e.category === category);
  const others = INSPECTION_CATALOG.filter((e) => e.category !== category);
  const [v, setV] = useState({ title: "", legalBasis: "", intervalMonths: "12", inspectorType: "COMPETENT_PERSON" });
  // key erzwingt Neuaufbau der Felder bei Vorlagenwahl
  const [key, setKey] = useState(0);

  function pick(k: string) {
    const e = INSPECTION_CATALOG.find((x) => x.key === k);
    if (!e) return;
    setV({ title: e.title, legalBasis: e.legalBasis, intervalMonths: String(e.intervalMonths), inspectorType: e.inspectorType });
    setKey((n) => n + 1);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="catalog">Vorlage aus dem Prüfkatalog</label>
        <select id="catalog" className="input" defaultValue="" onChange={(e) => pick(e.target.value)}>
          <option value="">– eigene Prüfpflicht –</option>
          {suggested.length > 0 && (
            <optgroup label={`Passend zu „${category}“`}>
              {suggested.map((e) => <option key={e.key} value={e.key}>{e.title}</option>)}
            </optgroup>
          )}
          <optgroup label="Weitere">
            {others.map((e) => <option key={e.key} value={e.key}>{e.title}</option>)}
          </optgroup>
        </select>
        <p className="mt-1 text-xs text-slate-500">Intervalle sind Richtwerte – maßgeblich ist die Gefährdungsbeurteilung (§ 3 Abs. 6 BetrSichV).</p>
      </div>
      <ActionForm action={addObligation} submitLabel="Prüfpflicht hinzufügen">
        <input type="hidden" name="equipmentId" value={equipmentId} />
        <div key={key} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">Prüfart *</label>
            <input id="title" name="title" required defaultValue={v.title} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="legalBasis">Rechtsgrundlage</label>
            <input id="legalBasis" name="legalBasis" defaultValue={v.legalBasis} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="intervalMonths">Intervall (Monate) *</label>
            <input id="intervalMonths" name="intervalMonths" type="number" min={1} max={120} required defaultValue={v.intervalMonths} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="inspectorType">Prüfer</label>
            <select id="inspectorType" name="inspectorType" defaultValue={v.inspectorType} className="input">
              {Object.entries(INSPECTOR_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="firstDueAt">Erste Fälligkeit</label>
            <input id="firstDueAt" name="firstDueAt" type="date" className="input" />
            <p className="mt-1 text-xs text-slate-500">leer = heute + Intervall</p>
          </div>
        </div>
      </ActionForm>
    </div>
  );
}
