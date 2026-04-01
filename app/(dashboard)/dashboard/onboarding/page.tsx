import { Share2, Link2, Users } from "lucide-react";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { getMyInviteTokens } from "@/app/(dashboard)/dashboard/(services)/invite-tokens/actions";
import { getAccounts } from "@/app/(dashboard)/dashboard/(services)/accounts/actions";
import { GenerateInviteForm } from "@/app/(dashboard)/dashboard/(sections)/onboarding/GenerateInviteForm";
import { InviteTokenCard } from "@/app/(dashboard)/dashboard/(sections)/onboarding/InviteTokenCard";
import { ReferralLinkBox } from "@/app/(dashboard)/dashboard/(sections)/onboarding/ReferralLinkBox";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  await getUserRole(supabase); // ensures authenticated

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const [tokens, accounts] = await Promise.all([
    getMyInviteTokens(),
    getAccounts(),
  ]);

  const signUpUrl = `${baseUrl}/sign-up`;

  return (
    <div className="p-4 md:p-8 mx-auto max-w-3xl space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#15689E]/10 flex items-center justify-center shrink-0">
          <Share2 className="w-5 h-5 text-[#15689E]" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Onboarding</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Share referral links and invite clinic staff to the portal
          </p>
        </div>
      </div>

      {/* ── Provider Referral Link ── */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[#15689E]" />
          <h2 className="text-base font-semibold text-slate-800">Provider Referral Link</h2>
        </div>
        <p className="text-sm text-slate-500">
          Share this link with new clinics or physicians to create their account on the portal.
        </p>
        <div suppressHydrationWarning>
          <ReferralLinkBox url={signUpUrl} />
        </div>
      </section>

      {/* ── Invite Clinic Staff ── */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#15689E]" />
          <h2 className="text-base font-semibold text-slate-800">Invite Clinic Staff</h2>
        </div>
        <p className="text-sm text-slate-500">
          Generate a one-time invite link to add staff members to an existing clinic account.
        </p>
        <div suppressHydrationWarning>
          <GenerateInviteForm accounts={accounts} baseUrl={baseUrl} />
        </div>
      </section>

      {/* ── Existing Invite Links ── */}
      {tokens.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Your invite links ({tokens.length})
          </h2>
          <div className="space-y-2" suppressHydrationWarning>
            {tokens.map((token) => (
              <InviteTokenCard key={token.id} token={token} baseUrl={baseUrl} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
