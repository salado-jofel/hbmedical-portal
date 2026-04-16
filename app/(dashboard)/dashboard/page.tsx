import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import {
  isAdmin,
  isSalesRep,
  isClinicalProvider,
  isClinicalStaff,
  isSupport,
  type UserRole,
} from "@/utils/helpers/role";
import { getAllOrders } from "./orders/(services)/order-read-actions";
import { getUsers } from "./users/(services)/actions";
import { getAccounts } from "./accounts/(services)/actions";
import { getTasks } from "./tasks/(services)/actions";
import { getRepCommissionSummary } from "./commissions/(services)/actions";
import { getMonthlyRevenue } from "./rep-performance/(services)/actions";
import { getTopAccountsByRep, type ITopAccount } from "./(services)/dashboard-actions";
import { AdminDashboard } from "./(sections)/AdminDashboard";
import { ClinicDashboard } from "./(sections)/ClinicDashboard";
import { RepDashboard } from "./(sections)/RepDashboard";
import { SupportDashboard } from "./(sections)/SupportDashboard";
import type { IUser } from "@/utils/interfaces/users";
import type { IAccount } from "@/utils/interfaces/accounts";
import type { ITask } from "@/utils/interfaces/tasks";
import type { ICommissionSummary } from "@/utils/interfaces/commissions";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

async function fetchCurrentQuota(repId: string): Promise<number | null> {
  const admin = createAdminClient();
  const d = new Date();
  const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const { data } = await admin
    .from("sales_quotas")
    .select("target_amount")
    .eq("rep_id", repId)
    .eq("period", period)
    .maybeSingle();
  return data ? Number(data.target_amount) : null;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const role = (await getUserRole(supabase)) as UserRole;

  const adminUser = isAdmin(role);
  const repUser = isSalesRep(role);

  const user = repUser ? await getCurrentUserOrThrow(supabase) : null;
  const adminClient = createAdminClient();

  const [
    allOrders,
    users,
    accounts,
    tasks,
    commissionSummary,
    monthlyRevenue,
    topAccounts,
    currentQuota,
  ] = await Promise.all([
    getAllOrders(),
    adminUser ? getUsers() : Promise.resolve([] as IUser[]),
    repUser ? getAccounts() : Promise.resolve([] as IAccount[]),
    repUser ? getTasks() : Promise.resolve([] as ITask[]),
    repUser ? getRepCommissionSummary().catch(() => null) : Promise.resolve(null as ICommissionSummary | null),
    repUser && user
      ? getMonthlyRevenue(user.id, adminClient).catch(() => [] as Array<{ period: string; revenue: number }>)
      : Promise.resolve([] as Array<{ period: string; revenue: number }>),
    repUser && user
      ? getTopAccountsByRep(user.id, 5).catch(() => [] as ITopAccount[])
      : Promise.resolve([] as ITopAccount[]),
    repUser && user ? fetchCurrentQuota(user.id).catch(() => null) : Promise.resolve(null as number | null),
  ]);

  return (
    <div className="select-none">
      {adminUser && (
        <AdminDashboard orders={allOrders} users={users} />
      )}
      {(isClinicalProvider(role) || isClinicalStaff(role)) && (
        <ClinicDashboard orders={allOrders} />
      )}
      {repUser && (
        <RepDashboard
          orders={allOrders}
          tasks={tasks}
          accounts={accounts}
          commissionSummary={commissionSummary}
          monthlyRevenue={monthlyRevenue}
          currentQuota={currentQuota}
          topAccounts={topAccounts}
        />
      )}
      {isSupport(role) && (
        <SupportDashboard orders={allOrders} />
      )}
    </div>
  );
}
