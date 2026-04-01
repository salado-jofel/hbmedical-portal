import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin as checkIsAdmin } from "@/utils/helpers/role";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";
import {
  getAccountById,
  getSalesReps,
} from "@/app/(dashboard)/dashboard/(services)/accounts/actions";
import { getContactsByFacility } from "@/app/(dashboard)/dashboard/(services)/contacts/actions";
import { getActivitiesByFacility } from "@/app/(dashboard)/dashboard/(services)/activities/actions";
import Providers from "./(sections)/Providers";
import { AccountHeader } from "@/app/(dashboard)/dashboard/(sections)/account-detail/AccountHeader";
import { AccountTabs } from "@/app/(dashboard)/dashboard/(sections)/account-detail/AccountTabs";
import { mapDashboardOrders } from "@/utils/helpers/orders";
import type { RawOrderRecord } from "@/utils/interfaces/orders";
import {
  ORDER_TABLE,
  ORDER_WITH_RELATIONS_SELECT,
} from "@/utils/constants/orders";

export const dynamic = "force-dynamic";

async function getFacilityOrders(facilityId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(ORDER_TABLE)
    .select(ORDER_WITH_RELATIONS_SELECT)
    .eq("facility_id", facilityId)
    .order("placed_at", { ascending: false });

  if (error) {
    console.error("[getFacilityOrders] Error:", error);
    return [];
  }

  return mapDashboardOrders((data ?? []) as unknown as RawOrderRecord[]);
}

interface AccountDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountDetailPage({
  params,
}: AccountDetailPageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const [role, user] = await Promise.all([
    getUserRole(supabase),
    getCurrentUserOrThrow(supabase),
  ]);

  const admin = checkIsAdmin(role);

  const [account, salesReps] = await Promise.all([
    getAccountById(id),
    admin ? getSalesReps() : Promise.resolve([]),
  ]);

  if (!account) {
    notFound();
  }

  const [contacts, orders, activities] = await Promise.all([
    getContactsByFacility(account.id),
    getFacilityOrders(account.id),
    getActivitiesByFacility(account.id),
  ]);

  const isAssignedRep = account.assigned_rep === user.id;

  return (
    <div className="p-4 md:p-8 mx-auto space-y-6">
      <Providers account={account} contacts={contacts} activities={activities}>
        <AccountHeader
          accountId={account.id}
          isAdmin={admin}
          salesReps={salesReps}
        />
        <AccountTabs
          account={account}
          contacts={contacts}
          orders={orders}
          isAdmin={admin}
          isAssignedRep={isAssignedRep}
          salesReps={salesReps}
        />
      </Providers>
    </div>
  );
}
