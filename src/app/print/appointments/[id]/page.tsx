import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { APPOINTMENT_ROLES } from "@/lib/appointments";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "Bestellung" };

/** Schriftliche Bestellung bzw. Pflichtenübertragung zum Unterschreiben */
export default async function PrintAppointment({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("appointments.view");
  const { id } = await params;
  const a = await db.appointment.findFirst({ where: { id, organizationId: ctx.organization.id }, include: { employee: true, site: true } });
  if (!a) notFound();
  const role = APPOINTMENT_ROLES[a.role] ?? APPOINTMENT_ROLES.OTHER;
  const duty = a.role === "DUTY_TRANSFER";
  return (
    <main className="mx-auto max-w-[700px] bg-white p-10 text-sm leading-relaxed text-black print:p-0">
      <div className="mb-6 flex justify-end print:hidden"><PrintButton /></div>
      <p>{ctx.organization.name}</p>
      <h1 className="my-6 text-center text-xl font-bold">{duty ? "Übertragung von Unternehmerpflichten" : `Bestellung zur/zum ${role.label}`}</h1>
      {role.legal && <p className="mb-6 text-center text-xs">gemäß {role.legal}</p>}
      <p>
        Hiermit wird <strong>{a.employee.firstName} {a.employee.lastName}</strong>{a.employee.jobTitle && `, ${a.employee.jobTitle},`} mit Wirkung vom <strong>{formatDate(a.appointedAt)}</strong>
        {a.validUntil && <> bis zum <strong>{formatDate(a.validUntil)}</strong></>}
        {duty ? " beauftragt, " : ` zur/zum ${role.label} bestellt. Sie/Er hat die Aufgabe, `}
        {role.text || "die nachfolgend beschriebenen Aufgaben wahrzunehmen"}.
      </p>
      {(a.site || a.scope) && <p className="mt-4"><strong>Bereich / Aufgaben:</strong> {[a.site?.name, a.scope].filter(Boolean).join(" – ")}</p>}
      {duty && (
        <p className="mt-4">
          Dazu gehört insbesondere, Einrichtungen zu schaffen und zu erhalten, Anweisungen zu geben und sonstige Maßnahmen zu treffen, ärztliche Untersuchungen zu veranlassen sowie eine wirksame Erste Hilfe sicherzustellen. Hierfür werden folgende Befugnisse und ein Budget im Rahmen der betrieblichen Regelungen eingeräumt.
        </p>
      )}
      {!duty && <p className="mt-4">Die/Der Beauftragte darf wegen der Erfüllung der übertragenen Aufgaben nicht benachteiligt werden. Sie/Er ist bei der Erfüllung ihrer/seiner Aufgaben zu unterstützen.</p>}
      <div className="mt-16 grid grid-cols-2 gap-10 text-xs">
        <p className="border-t border-black pt-1">Ort, Datum, Unternehmer/in</p>
        <p className="border-t border-black pt-1">Ort, Datum, {duty ? "Verpflichtete/r" : "Beauftragte/r"}</p>
      </div>
    </main>
  );
}
