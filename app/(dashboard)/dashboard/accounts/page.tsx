import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { PageHeader } from "@/app/(components)/PageHeader";
import Providers from "./(sections)/Providers";
import { AccountsList } from "./(sections)/AccountsList";
import {
  getAccountsWithMetrics,
  getSalesReps,
} from "@/app/(dashboard)/dashboard/accounts/(services)/actions";
import type { AccountPeriod } from "@/utils/interfaces/accounts";

export const metadata: Metadata = { title: "Accounts" };
export const dynamic = "force-dynamic";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string }>;
}) {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  const admin = isAdmin(role);

  if (!admin && !isSalesRep(role)) redirect("/dashboard");

  const params = (await searchParams) ?? {};
  const period = (params.period ?? "this_month") as AccountPeriod;

  const [accounts, salesReps] = await Promise.all([
    getAccountsWithMetrics(period),
    admin ? getSalesReps() : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Accounts" subtitle="Manage clinic accounts and facilities" />
      <Providers accounts={accounts}>
        <AccountsList salesReps={salesReps} isAdmin={admin} period={period} />
      </Providers>
    </>
  );
}
