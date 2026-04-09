import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
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
import { AdminDashboard } from "./(sections)/AdminDashboard";
import { ClinicDashboard } from "./(sections)/ClinicDashboard";
import { RepDashboard } from "./(sections)/RepDashboard";
import { SupportDashboard } from "./(sections)/SupportDashboard";
import type { IUser } from "@/utils/interfaces/users";
import type { IAccount } from "@/utils/interfaces/accounts";
import type { ITask } from "@/utils/interfaces/tasks";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const role = (await getUserRole(supabase)) as UserRole;

  const adminUser = isAdmin(role);
  const repUser = isSalesRep(role);

  const [allOrders, users, accounts, tasks] = await Promise.all([
    getAllOrders(),
    adminUser ? getUsers() : Promise.resolve([] as IUser[]),
    repUser ? getAccounts() : Promise.resolve([] as IAccount[]),
    repUser ? getTasks() : Promise.resolve([] as ITask[]),
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
        <RepDashboard orders={allOrders} tasks={tasks} accounts={accounts} />
      )}
      {isSupport(role) && (
        <SupportDashboard orders={allOrders} />
      )}
    </div>
  );
}
