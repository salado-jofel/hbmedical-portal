import { TopBar } from "./(sections)/TopBar";
import { TabNav } from "./(sections)/TabNav";
import NextTopLoader from "nextjs-toploader";
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
      <NextTopLoader
        color="#0f2d4a"
        shadow="0 0 10px #0f2d4a, 0 0 5px #0f2d4a"
        height={2}
        showSpinner={false}
      />

      <div className="min-h-screen" style={{ background: "var(--bg)" }}>
        {/* ── Sticky header: TopBar + TabNav ── */}
        <header
          className="sticky top-0 z-50 px-4 pt-5"
          style={{ background: "var(--bg)" }}
        >
          <div className="mx-auto max-w-[1120px]">
            <TopBar />
            <TabNav />
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="mx-auto max-w-[1120px] px-4 pb-12">
          {children}
        </main>
      </div>
    </Providers>
  );
}
