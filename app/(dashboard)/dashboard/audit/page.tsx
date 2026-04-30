import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import { PageHeader } from "@/app/(components)/PageHeader";
import { AuditLogTable } from "./(sections)/AuditLogTable";

export const metadata: Metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isAdmin(role as UserRole)) redirect("/dashboard");

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Every PHI access — required by HIPAA Security Rule §164.312(b)"
      />
      <AuditLogTable />
    </>
  );
}
