import { Building2 } from "lucide-react";
import {
  getAccounts,
  getSalesReps,
} from "@/app/(dashboard)/dashboard/accounts/(services)/actions";
import { getUserRole } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/utils/helpers/role";
import Providers from "./(sections)/Providers";
import { AccountsPageClient } from "./(sections)/AccountsPageClient";

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
      {/* ── Table with Redux hydration ── */}
      <Providers accounts={accounts}>
        <AccountsPageClient salesReps={salesReps} isAdmin={admin} />
      </Providers>
    </div>
  );
}
