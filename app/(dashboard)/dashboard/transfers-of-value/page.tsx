import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { DashboardHeader } from "@/app/(components)/DashboardHeader";
import { getSalesReps } from "@/app/(dashboard)/dashboard/accounts/(services)/actions";
import Providers from "./(sections)/Providers";
import { Header } from "./(sections)/Header";
import { ReportsList } from "./(sections)/ReportsList";
import { getMyValueReports } from "./(services)/actions";

export const metadata: Metadata = { title: "Transfers of Value" };
export const dynamic = "force-dynamic";

export default async function TransfersOfValuePage({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string }>;
}) {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  if (!isSalesRep(role) && !isAdmin(role)) {
    redirect("/dashboard");
  }
// test
  const admin = isAdmin(role);
  const sp = await searchParams;
  const selectedRepId = admin ? (sp.rep ?? null) : null;

  const [reports, reps] = await Promise.all([
    getMyValueReports(selectedRepId),
    admin ? getSalesReps() : Promise.resolve([]),
  ]);

  return (
    <Providers reports={reports}>
      <div className=" mx-auto space-y-6">
        <DashboardHeader
          title="Transfers of Value"
          description="Monthly Sunshine Act / Open Payments tracking. Log every transfer of value to a Covered Recipient and submit by the 10th of the following month."
        />
        <Header
          canCreate={isSalesRep(role)}
          admin={admin}
          reps={reps}
          selectedRepId={selectedRepId}
        />
        <ReportsList showRepName={admin} />
      </div>
    </Providers>
  );
}
