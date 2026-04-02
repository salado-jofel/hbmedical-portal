import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { getMyInviteTokens } from "@/app/(dashboard)/dashboard/onboarding/(services)/actions";
import { getAccounts } from "@/app/(dashboard)/dashboard/accounts/(services)/actions";
import Providers from "./(sections)/Providers";
import { OnboardingPageClient } from "./(sections)/OnboardingPageClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const [tokens, accounts] = await Promise.all([
    getMyInviteTokens(),
    getAccounts(),
  ]);

  return (
    <Providers tokens={tokens}>
      <OnboardingPageClient role={role} accounts={accounts} baseUrl={baseUrl} />
    </Providers>
  );
}
