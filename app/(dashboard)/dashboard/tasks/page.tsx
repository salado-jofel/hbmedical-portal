import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin as checkIsAdmin } from "@/utils/helpers/role";
import { DashboardHeader } from "@/app/(components)/DashboardHeader";

export const metadata: Metadata = { title: "Tasks" };
import { getTasks } from "@/app/(dashboard)/dashboard/tasks/(services)/actions";
import {
  getAccounts,
  getSalesReps,
} from "@/app/(dashboard)/dashboard/accounts/(services)/actions";
import Providers from "./(sections)/Providers";
import { TasksBoard } from "./(sections)/TasksBoard";

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
    <div className="p-6 md:p-8 max-w-480 mx-auto space-y-6">
      <DashboardHeader title="Tasks" description="Track follow-ups and action items" />
      <Providers tasks={tasks}>
        <TasksBoard
          accounts={accounts}
          salesReps={salesReps}
          isAdmin={admin}
        />
      </Providers>
    </div>
  );
}
