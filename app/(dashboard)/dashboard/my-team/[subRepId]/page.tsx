import { type Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { getSubRepDetail } from "../(services)/actions";
import {
  getCommissionRates,
  getRepCommissionSummary,
} from "@/app/(dashboard)/dashboard/commissions/(services)/actions";
import Providers from "./(sections)/Providers";
import SubRepHero from "./(sections)/SubRepHero";
import SubRepQuotaSection from "./(sections)/SubRepQuotaSection";
import SubRepKpiRow from "./(sections)/SubRepKpiRow";
import SubRepRateSection from "./(sections)/SubRepRateSection";
import SubRepCalculator from "./(sections)/SubRepCalculator";
import SubRepAccounts from "./(sections)/SubRepAccounts";
import SubRepCommissionHistory from "./(sections)/SubRepCommissionHistory";

export const metadata: Metadata = { title: "Sub-Rep Detail" };
export const dynamic = "force-dynamic";

export default async function SubRepDetailPage({
  params,
}: {
  params: Promise<{ subRepId: string }>;
}) {
  const { subRepId } = await params;
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  if (!isAdmin(role) && !isSalesRep(role)) redirect("/dashboard");

  const [detail, rates, summary] = await Promise.all([
    getSubRepDetail(subRepId),
    getCommissionRates(),
    getRepCommissionSummary(),
  ]);
  if (!detail) notFound();

  return (
    <Providers detail={detail} rates={rates} summary={summary}>
      <div className="mx-auto space-y-6">
        <SubRepHero />
        <SubRepQuotaSection />
        <SubRepKpiRow />
        <SubRepRateSection />
        <SubRepCalculator />
        <SubRepAccounts />
        <SubRepCommissionHistory />
      </div>
    </Providers>
  );
}
