import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrg } from "@/lib/session";
import { EmployeeForm } from "../EmployeeForm";
import { siteAndDepartmentOptions } from "../options";

export const metadata = { title: "Mitarbeiter bearbeiten" };

export default async function EditEmployee({ params }: { params: Promise<{ id: string }> }) {
  const { organization } = await requireOrg("masterdata.manage");
  const { id } = await params;
  const employee = await db.employee.findFirst({ where: { id, organizationId: organization.id } });
  if (!employee) notFound();
  return (
    <div className="card">
      <h1 className="mb-4 text-2xl font-semibold">{employee.firstName} {employee.lastName}</h1>
      <EmployeeForm employee={employee} {...await siteAndDepartmentOptions(organization.id)} />
    </div>
  );
}
