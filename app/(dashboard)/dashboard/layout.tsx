import { redirect } from "next/navigation";
import { TopBar } from "./(sections)/TopBar";
import { TabNav } from "./(sections)/TabNav";
import { getUserData } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import { isSalesRep } from "@/utils/helpers/role";
import { evaluateMfaGate } from "@/lib/supabase/mfa-gate";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userData = await getUserData();

  // Hard gate: sales reps (top-level + sub) must finish Stripe Connect
  // onboarding before they can use the portal. Sub-reps share the same role,
  // so isSalesRep covers both. Other roles are unaffected.
  if (
    userData &&
    isSalesRep(userData.role) &&
    !userData.stripeDetailsSubmitted
  ) {
    redirect("/onboarding/payouts");
  }

  // HIPAA MFA gate: admin and clinical_provider roles require TOTP enrolled
  // and the current session at AAL2. Both unsatisfied states redirect to
  // /sign-in/mfa, which lives outside the dashboard layout — that page
  // shows enrollment if the user has no factor, or a challenge prompt if
  // the user has a factor but is still at aal1. Routing both cases to the
  // same route avoids any chance of a layout-redirect loop.
  if (userData?.role) {
    const decision = await evaluateMfaGate(userData.role);
    if (decision.kind !== "ok") {
      redirect("/sign-in/mfa");
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
