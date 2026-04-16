import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isSalesRep, isAdmin } from "@/utils/helpers/role";
import { PageHeader } from "@/app/(components)/PageHeader";
import Providers from "./(sections)/Providers";
import { RepListView } from "./(sections)/RepListView";
import { getRepList, getMyTeamKpis } from "./(services)/actions";
import type { AccountPeriod } from "@/utils/interfaces/accounts";

type StatusFilter = "all" | "active" | "inactive";
type ViewFilter = "all_sub_reps" | "direct_only";

export const metadata: Metadata = { title: "My Team" };
export const dynamic = "force-dynamic";

export default async function MyTeamPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; period?: string; view?: string }>;
}) {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isSalesRep(role) && !isAdmin(role)) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const status: StatusFilter =
    params.status === "active" || params.status === "inactive"
      ? params.status
      : "all";
  const period: AccountPeriod =
    params.period === "last_3_months" || params.period === "all_time"
      ? params.period
      : "this_month";
  const view: ViewFilter =
    params.view === "direct_only" ? "direct_only" : "all_sub_reps";

  let rows = await getRepList(period, status);
  if (isAdmin(role) && view === "direct_only") {
    rows = rows.filter((r) => r.isDirect);
  }
  const kpis = await getMyTeamKpis(period);

  const title = isAdmin(role) ? "Sales Reps" : "My Team";
  const subtitle = isAdmin(role)
    ? "Review all sales representatives and manage their commission rates"
    : "Manage your sub-representatives and their accounts";

  return (
    <Providers rows={rows} kpis={kpis}>
      <div className=" max-w-480 mx-auto space-y-6">
        <PageHeader title={title} subtitle={subtitle} className="pb-4" />
        <RepListView status={status} period={period} view={view} />
      </div>
    </Providers>
  );
}
