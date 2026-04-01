import { Building2 } from "lucide-react";
import { getAccounts } from "@/app/(dashboard)/dashboard/(services)/accounts/actions";
import { getSalesReps } from "@/app/(dashboard)/dashboard/(services)/accounts/actions";
import { getUserRole } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/utils/helpers/role";
import Providers from "./(sections)/Providers";
import { AccountsTable } from "@/app/(dashboard)/dashboard/(sections)/accounts/AccountsTable";

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
    <div className="p-4 md:p-8 mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#15689E]/10 flex items-center justify-center shrink-0">
          <Building2 className="w-5 h-5 text-[#15689E]" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Accounts</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage your facilities and prospects
          </p>
        </div>
      </div>

      {/* ── Table with Redux hydration ── */}
      <Providers accounts={accounts}>
        <AccountsTable salesReps={salesReps} isAdmin={admin} />
      </Providers>
    </div>
  );
}
