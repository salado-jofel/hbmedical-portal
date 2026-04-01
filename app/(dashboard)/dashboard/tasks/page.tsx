import { CheckSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin as checkIsAdmin } from "@/utils/helpers/role";
import { getTasks } from "@/app/(dashboard)/dashboard/(services)/tasks/actions";
import { getAccounts } from "@/app/(dashboard)/dashboard/(services)/accounts/actions";
import { getSalesReps } from "@/app/(dashboard)/dashboard/(services)/accounts/actions";
import Providers from "./(sections)/Providers";
import { TasksBoard } from "@/app/(dashboard)/dashboard/(sections)/tasks/TasksBoard";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  const admin = checkIsAdmin(role);

  const [tasks, accounts, salesReps] = await Promise.all([
    getTasks(),
    getAccounts(),
    admin ? getSalesReps() : Promise.resolve([]),
  ]);

  return (
    <div className="p-4 md:p-8 mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#15689E]/10 flex items-center justify-center shrink-0">
          <CheckSquare className="w-5 h-5 text-[#15689E]" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Tasks</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Track follow-ups and action items
          </p>
        </div>
      </div>

      {/* ── Board ── */}
      <Providers tasks={tasks}>
        <TasksBoard accounts={accounts} salesReps={salesReps} isAdmin={admin} />
      </Providers>
    </div>
  );
}
