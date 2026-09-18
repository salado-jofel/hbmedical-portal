import type { Metadata } from "next";
import { BackgroundDots } from "@/app/(components)/BackgroundDots";
import { getMaintenanceState } from "@/lib/flags/maintenance";
import { MaintenanceCard } from "./(sections)/MaintenanceCard";

export const metadata: Metadata = {
  title: "Maintenance",
  description: "Meridian Portal is temporarily unavailable for scheduled maintenance.",
  robots: { index: false, follow: false },
};

// Read the flag on every request so an operator's message edit shows up
// without a redeploy. Only Global Config is read here — never Supabase.
export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const { message } = await getMaintenanceState();
  return (
    <main className="relative min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] flex items-center justify-center p-4">
      <BackgroundDots />
      <div className="relative w-full max-w-md">
        <MaintenanceCard message={message} />
      </div>
    </main>
  );
}
