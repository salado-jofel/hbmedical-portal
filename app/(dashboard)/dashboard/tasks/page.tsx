import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin as checkIsAdmin } from "@/utils/helpers/role";
import { getTasks } from "@/app/(dashboard)/dashboard/tasks/(services)/actions";
import { getAccounts, getSalesReps } from "@/app/(dashboard)/dashboard/accounts/(services)/actions";
import Providers from "./(sections)/Providers";
import { TasksPageClient } from "./(sections)/TasksPageClient";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  const admin = checkIsAdmin(role);

  if (!admin) redirect("/dashboard");

  const [tasks, accounts, salesReps] = await Promise.all([
    getTasks(),
    getAccounts(),
    admin ? getSalesReps() : Promise.resolve([]),
  ]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="pb-5 border-b border-[#E2E8F0]">
        <h1 className="text-xl font-semibold text-[#0F172A]">Tasks</h1>
        <p className="text-sm text-[#64748B] mt-1">
          Track follow-ups and action items
        </p>
      </div>

      {/* ── Board ── */}
      <Providers tasks={tasks}>
        <TasksPageClient accounts={accounts} salesReps={salesReps} isAdmin={admin} />
      </Providers>
    </div>
  );
}
