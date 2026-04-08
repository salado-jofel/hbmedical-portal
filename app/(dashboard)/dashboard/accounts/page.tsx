import type { Metadata } from "next";

export const metadata: Metadata = { title: "Accounts" };
import {
  getAccounts,
  getSalesReps,
} from "@/app/(dashboard)/dashboard/accounts/(services)/actions";
import { getUserRole } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/utils/helpers/role";
import { DashboardHeader } from "@/app/(components)/DashboardHeader";
import Providers from "./(sections)/Providers";
import { AccountsList } from "./(sections)/AccountsList";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  const admin = isAdmin(role);

  const [accounts, salesReps] = await Promise.all([
    getAccounts(),
    admin ? getSalesReps() : Promise.resolve([]),
  ]);

  return (
    <div className="p-6 md:p-8 max-w-480 mx-auto space-y-6">
      <DashboardHeader title="Accounts" description="Manage your clinic accounts and activity" />
      <Providers accounts={accounts}>
        <AccountsList salesReps={salesReps} isAdmin={admin} />
      </Providers>
    </div>
  );
}
