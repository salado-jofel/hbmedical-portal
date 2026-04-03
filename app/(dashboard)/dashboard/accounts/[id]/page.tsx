import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin as checkIsAdmin, isSalesRep, isSupport } from "@/utils/helpers/role";
import {
  getAccountById,
  getSalesReps,
} from "@/app/(dashboard)/dashboard/accounts/(services)/actions";
import { getContactsByFacility } from "@/app/(dashboard)/dashboard/(services)/contacts/actions";
import { getActivitiesByFacility } from "@/app/(dashboard)/dashboard/(services)/activities/actions";
import Providers from "./(sections)/Providers";
import { AccountHeader } from "./(sections)/AccountHeader";
import { AccountDetailClient } from "./(sections)/AccountDetailClient";
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
  const role = await getUserRole(supabase);

  const adminUser   = checkIsAdmin(role);
  const repUser     = isSalesRep(role);
  const supportUser = isSupport(role);
  const canEdit     = adminUser; // only admins may create / update / delete
  const showActivities = adminUser || repUser; // support staff cannot see activities

  const [account, salesReps] = await Promise.all([
    getAccountById(id),
    adminUser ? getSalesReps() : Promise.resolve([]),
  ]);

  if (!account) {
    notFound();
  }

  const [contacts, orders, activities] = await Promise.all([
    getContactsByFacility(account.id),
    getFacilityOrders(account.id),
    // Admin and reps may read activities; support staff cannot
    showActivities
      ? getActivitiesByFacility(account.id)
      : Promise.resolve([]),
  ]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <Providers account={account} contacts={contacts} activities={activities}>
        <AccountHeader
          accountId={account.id}
          isAdmin={adminUser}
          salesReps={salesReps}
        />
        <AccountDetailClient
          account={account}
          contacts={contacts}
          orders={orders}
          canEdit={canEdit}
          salesReps={salesReps}
          showActivities={showActivities}
        />
      </Providers>
    </div>
  );
}
