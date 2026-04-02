import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, getCurrentUserOrThrow } from "@/lib/supabase/auth";
import { isSalesRep, isAdmin } from "@/utils/helpers/role";
import {
  getMyInviteTokens,
  getSalesRepsWithFacilities,
  type RepWithFacility,
} from "@/app/(dashboard)/dashboard/onboarding/(services)/actions";
import Providers from "./(sections)/Providers";
import { OnboardingPageClient } from "./(sections)/OnboardingPageClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  const adminUser = isAdmin(role);
  if (!isSalesRep(role) && !adminUser) redirect("/dashboard");

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const user = await getCurrentUserOrThrow(supabase);

  let hasCompletedSetup = true;
  if (!adminUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("has_completed_setup")
      .eq("id", user.id)
      .single();
    hasCompletedSetup = profile?.has_completed_setup ?? false;
  }

  const [tokens, repsWithFacilities] = await Promise.all([
    getMyInviteTokens(),
    adminUser ? getSalesRepsWithFacilities() : Promise.resolve([] as RepWithFacility[]),
  ]);

  return (
    <Providers tokens={tokens}>
      <OnboardingPageClient
        role={role}
        baseUrl={baseUrl}
        hasCompletedSetup={hasCompletedSetup}
        isAdmin={adminUser}
        repsWithFacilities={repsWithFacilities}
      />
    </Providers>
  );
}
