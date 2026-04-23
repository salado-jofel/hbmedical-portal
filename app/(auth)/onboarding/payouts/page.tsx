import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isSalesRep } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import { getMyConnectStatus } from "@/app/(dashboard)/dashboard/settings/(services)/stripe-connect-actions";
import PayoutsGateForm from "./(sections)/PayoutsGateForm";

export const metadata: Metadata = { title: "Set Up Payouts" };
export const dynamic = "force-dynamic";

export default async function PayoutsGatePage() {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  // Non-reps shouldn't ever see this page. Bounce them home.
  if (!isSalesRep(role as UserRole)) {
    redirect("/dashboard");
  }

  const status = await getMyConnectStatus();

  // If a rep somehow lands here after finishing setup (stale cache, manual
  // URL), forward them to the dashboard — gate would no-op anyway.
  if (status.detailsSubmitted) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <PayoutsGateForm
          hasAccount={status.hasAccount}
          email={user.email ?? ""}
        />
      </div>
    </main>
  );
}
