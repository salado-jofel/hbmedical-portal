import type { Metadata } from "next";

export const metadata: Metadata = { title: "Accounts" };
import {
  getAccounts,
  getSalesReps,
} from "@/app/(dashboard)/dashboard/accounts/(services)/actions";
import { getUserRole } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/utils/helpers/role";
import { PageHeader } from "@/app/(components)/PageHeader";
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
    <>
      <PageHeader title="Accounts" subtitle="Manage clinic accounts and facilities" />
      <Providers accounts={accounts}>
        <AccountsList salesReps={salesReps} isAdmin={admin} />
      </Providers>
    </>
  );
}
