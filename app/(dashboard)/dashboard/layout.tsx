import { redirect } from "next/navigation";
import { TopBar } from "./(sections)/TopBar";
import { TabNav } from "./(sections)/TabNav";
import { getUserData } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import { isSalesRep } from "@/utils/helpers/role";
import { evaluateMfaGate } from "@/lib/supabase/mfa-gate";
import { evaluateContractsGate } from "@/lib/supabase/contracts-gate";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userData = await getUserData();

  // Hard gate #1: required onboarding contracts. Catches legacy users (created
  // before the contracts feature existed, or before a new doc like the DME
  // Compliance Policy was added) who skipped one or more documents. Runs
  // BEFORE the payouts gate so the rep reads what they're agreeing to before
  // setting up their bank account. Off by default — flip CONTRACTS_GATE_ENABLED
  // env var to "true" to activate.
  if (userData?.userId && userData.role) {
    const decision = await evaluateContractsGate(userData.userId, userData.role);
    if (decision.kind === "must_sign") {
      redirect("/onboarding/contracts");
    }
  }

  // Hard gate #2: sales reps (top-level + sub) must finish Stripe Connect
  // onboarding before they can use the portal. Sub-reps share the same role,
  // so isSalesRep covers both. Other roles are unaffected.
  if (
    userData &&
    isSalesRep(userData.role) &&
    !userData.stripeDetailsSubmitted
  ) {
    redirect("/onboarding/payouts");
  }

  // HIPAA MFA gate. Decision routes vary by factor type:
  //   TOTP path (admin/support/clinical) → /sign-in/mfa for both enroll + challenge
  //   SMS path  (sales reps)             → /onboarding/phone (enroll) or
  //                                         /sign-in/sms-mfa (challenge)
  // All four target routes live outside the dashboard layout so they can't
  // trigger this gate themselves and create a redirect loop.
  if (userData?.role) {
    const decision = await evaluateMfaGate(userData.role);
    switch (decision.kind) {
      case "must_enroll_totp":
      case "must_challenge_totp":
        redirect("/sign-in/mfa");
      case "must_enroll_phone":
        redirect("/onboarding/phone");
      case "must_challenge_sms":
        redirect("/sign-in/sms-mfa");
      case "ok":
        break;
    }
  }

  return (
    <Providers userData={userData}>
      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        {/* ── Sticky header: TopBar + TabNav ── */}
        <header
          className="sticky top-0 z-50 px-4 pt-5"
          style={{ background: "var(--bg)" }}
        >
          <div className="mx-auto max-w-7xl">
            <TopBar />
            <TabNav />
          </div>
        </header>

        {/* ── Page content ── */}
        <div className=" px-4 pb-5">
          <main className="mx-auto max-w-7xl">{children}</main>
        </div>
      </div>
    </Providers>
  );
}
