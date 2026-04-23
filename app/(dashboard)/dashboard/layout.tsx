import { redirect } from "next/navigation";
import { TopBar } from "./(sections)/TopBar";
import { TabNav } from "./(sections)/TabNav";
import { getUserData } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import { isSalesRep } from "@/utils/helpers/role";

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
