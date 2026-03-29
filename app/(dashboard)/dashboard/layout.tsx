import { Sidebar } from "./(sections)/Sidebar";
import { MobileTopBar } from "./(sections)/MobileTopBar";
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
        color="#f5a255"
        shadow="0 0 10px #f5a255, 0 0 5px #f5a255"
        height={3}
        showSpinner={false}
      />

      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />
        <div className="flex flex-col flex-1 md:ml-64 min-w-0">
          <MobileTopBar />
          <main className="flex-1 pt-16 md:pt-0 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </Providers>
  );
}
