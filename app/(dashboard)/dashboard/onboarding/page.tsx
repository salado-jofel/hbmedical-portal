import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, getCurrentUserOrThrow } from "@/lib/supabase/auth";
import { isSalesRep } from "@/utils/helpers/role";
import { getMyInviteTokens } from "@/app/(dashboard)/dashboard/onboarding/(services)/actions";
import Providers from "./(sections)/Providers";
import { OnboardingPageClient } from "./(sections)/OnboardingPageClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  if (!isSalesRep(role)) redirect("/dashboard");

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const user = await getCurrentUserOrThrow(supabase);
  const { data: profile } = await supabase
    .from("profiles")
    .select("has_completed_setup")
    .eq("id", user.id)
    .single();

  const [tokens] = await Promise.all([getMyInviteTokens()]);

  return (
    <Providers tokens={tokens}>
      <OnboardingPageClient
        role={role}
        baseUrl={baseUrl}
        hasCompletedSetup={profile?.has_completed_setup ?? false}
      />
    </Providers>
  );
}
