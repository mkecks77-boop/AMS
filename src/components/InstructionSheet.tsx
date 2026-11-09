import type { OperatingInstruction } from "@prisma/client";
import { Pictogram } from "./Pictogram";
import { pictoKind } from "@/lib/pictograms";
import { SECTION_LABELS, TYPE_COLORS, TYPE_LEGAL } from "@/lib/instructions";
import { formatDate } from "@/lib/dates";

type Props = {
  instruction: Pick<OperatingInstruction, "type" | "title" | "scope" | "hazards" | "protectiveMeasures" | "malfunctions" | "firstAid" | "maintenance" | "pictograms" | "emergencyPhone" | "version" | "releasedAt" | "status">;
  organizationName: string;
  releasedByName?: string | null;
};

/** Betriebsanweisung im üblichen Layout: farbige Balken, Piktogramme links, Text rechts. */
export function InstructionSheet({ instruction: i, organizationName, releasedByName }: Props) {
  const color = TYPE_COLORS[i.type];
  const byKind = (...kinds: string[]) => i.pictograms.filter((p) => kinds.includes(pictoKind(p) ?? ""));
  const sections: { key: keyof typeof SECTION_LABELS; picto: string[] }[] = [
    { key: "hazards", picto: byKind("ghs", "warning") },
    { key: "protectiveMeasures", picto: byKind("mandatory", "prohibition") },
    { key: "malfunctions", picto: [] },
    { key: "firstAid", picto: byKind("safe") },
    { key: "maintenance", picto: [] },
  ];
  return (
    <article className="mx-auto max-w-[800px] border-4 bg-white text-[13px] leading-snug text-black" style={{ borderColor: color }}>
      <header className="grid grid-cols-[1fr_auto] gap-2 border-b-4 p-3" style={{ borderColor: color }}>
        <div>
          <p className="text-xs">{organizationName}</p>
          <h1 className="text-2xl font-extrabold tracking-wide">BETRIEBSANWEISUNG</h1>
          <p className="text-xs">{TYPE_LEGAL[i.type]}</p>
        </div>
        <div className="text-right text-xs">
          <p>Version {i.version}</p>
          <p>{i.status === "RELEASED" ? `Freigabe: ${formatDate(i.releasedAt)}` : "ENTWURF – nicht aushängen"}</p>
          {releasedByName && <p>durch {releasedByName}</p>}
        </div>
      </header>
      <Bar color={color}>Anwendungsbereich</Bar>
      <div className="p-3 text-center">
        <p className="text-lg font-bold">{i.title}</p>
        {i.scope && <p>{i.scope}</p>}
      </div>
      {sections.map(({ key, picto }) => (
        <section key={key}>
          <Bar color={color}>{SECTION_LABELS[key]}</Bar>
          <div className="grid grid-cols-[96px_1fr] gap-3 p-3">
            <div className="flex flex-col items-center gap-2">{picto.map((p) => <Pictogram key={p} code={p} size={72} />)}</div>
            <div className="whitespace-pre-line">
              {i[key]}
              {key === "firstAid" && i.emergencyPhone && <p className="mt-2 font-bold">Notruf: {i.emergencyPhone}</p>}
            </div>
          </div>
        </section>
      ))}
    </article>
  );
}

function Bar({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <h2 className="px-3 py-1 text-center text-sm font-bold uppercase tracking-wide text-white" style={{ backgroundColor: color, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
      {children}
    </h2>
  );
}
