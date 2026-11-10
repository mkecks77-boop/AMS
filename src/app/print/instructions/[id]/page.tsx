import { notFound } from "next/navigation";
import { InstructionSheet } from "@/components/InstructionSheet";
import { PrintButton } from "@/components/PrintButton";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/session";

export const metadata = { title: "Betriebsanweisung drucken" };

export default async function PrintInstruction({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg("instructions.view");
  const { id } = await params;
  const i = await db.operatingInstruction.findFirst({
    where: { id, organizationId: ctx.organization.id, ...(ctx.can("instructions.edit") ? {} : { status: "RELEASED" }) },
  });
  if (!i) notFound();
  const releasedBy = i.releasedById ? await db.user.findUnique({ where: { id: i.releasedById }, select: { name: true } }) : null;
  return (
    <main className="bg-white p-4 print:p-0">
      <div className="mx-auto mb-4 flex max-w-[800px] justify-end print:hidden"><PrintButton /></div>
      <InstructionSheet instruction={i} organizationName={ctx.organization.name} releasedByName={releasedBy?.name} />
    </main>
  );
}
