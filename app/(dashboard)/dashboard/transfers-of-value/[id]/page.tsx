import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { getValueReport } from "../(services)/actions";
import { getTransferEntries } from "../(services)/transfer-entry-actions";
import { getGroupMealEntries } from "../(services)/group-meal-actions";
import { getSampleEntries } from "../(services)/sample-actions";
import Providers from "./(sections)/Providers";
import { ReportHeader } from "./(sections)/ReportHeader";
import { ReportDetail } from "./(sections)/ReportDetail";

export const metadata: Metadata = { title: "Transfer of Value Report" };
export const dynamic = "force-dynamic";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isSalesRep(role) && !isAdmin(role)) redirect("/dashboard");

  const report = await getValueReport(id);
  if (!report) notFound();

  const [transferEntries, groupMealEntries, sampleEntries] = await Promise.all([
    getTransferEntries(id),
    getGroupMealEntries(id),
    getSampleEntries(id),
  ]);

  const admin = isAdmin(role);
  const canEdit = !admin && report.status === "draft";

  return (
    <Providers
      report={report}
      transferEntries={transferEntries}
      groupMealEntries={groupMealEntries}
      sampleEntries={sampleEntries}
    >
      <div className=" mx-auto space-y-6">
        <ReportHeader admin={admin} canEdit={canEdit} />
        <ReportDetail canEdit={canEdit} />
      </div>
    </Providers>
  );
}
