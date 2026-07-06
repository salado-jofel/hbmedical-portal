import { redirect } from "next/navigation";
import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { PageHeader } from "@/app/(components)/PageHeader";
import { getApprovers } from "./(services)/actions";
import { ApproversProviders } from "./(sections)/Providers";
import { ApproversList } from "./(components)/ApproversList";
import { AddApproverModal } from "./(components)/AddApproverModal";

export const metadata: Metadata = {
  title: "External Approvers",
};

export const dynamic = "force-dynamic";

export default async function ApproversPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  // Managing the external-approver directory is an internal admin/support
  // task. Reps, clinical staff, and providers have no business here.
  if (role !== "admin" && role !== "support_staff") {
    redirect("/dashboard");
  }

  const approvers = await getApprovers();
  const activeCount = approvers.filter((a) => a.isActive).length;

  return (
    <ApproversProviders approvers={approvers}>
      <div className="select-none">
        <PageHeader
          title="External Approvers"
          subtitle={`${activeCount} active · ${approvers.length} total`}
          action={<AddApproverModal />}
        />
        <ApproversList />
      </div>
    </ApproversProviders>
  );
}
