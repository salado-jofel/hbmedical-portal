import { Sidebar } from "./(sections)/Sidebar";
import { MobileTopBar } from "./(sections)/MobileTopBar";
import { BottomNav } from "./(sections)/BottomNav";
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
        color="#15689E"
        shadow="0 0 10px #15689E, 0 0 5px #15689E"
        height={2}
        showSpinner={false}
      />

      <div className="flex min-h-screen bg-[#F8FAFC]">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <MobileTopBar />
          <main className="flex-1 pt-16 md:pt-0 pb-16 md:pb-0 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
      <BottomNav />
    </Providers>
  );
}
