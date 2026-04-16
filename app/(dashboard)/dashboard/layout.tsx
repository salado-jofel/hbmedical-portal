import { TopBar } from "./(sections)/TopBar";
import { TabNav } from "./(sections)/TabNav";
import { getUserData } from "./(services)/actions";
import Providers from "./(sections)/Providers";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userData = await getUserData();

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
