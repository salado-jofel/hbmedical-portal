import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import {
  getMyProfile,
  getMyCredentials,
  getFacilityMembers,
} from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import { notFound } from "next/navigation";
import Providers from "./(sections)/Providers";
import { SettingsPageClient } from "./(sections)/SettingsPageClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  const profile = await getMyProfile();
  if (!profile) notFound();

  const showCredentials = role === "clinical_provider";

  const canManageTeam =
    role === "admin" ||
    role === "sales_representative";

  const [members, credentials] = await Promise.all([
    getFacilityMembers(),
    showCredentials ? getMyCredentials() : Promise.resolve(null),
  ]);

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="pb-5 border-b border-[#E2E8F0]">
        <h1 className="text-xl font-semibold text-[#0F172A]">Settings</h1>
        <p className="text-sm text-[#64748B] mt-1">
          Manage your profile, team, and credentials
        </p>
      </div>

      {/* ── Tabbed content ── */}
      <Providers>
        <SettingsPageClient
          profile={profile}
          members={members}
          credentials={credentials}
          canManageTeam={canManageTeam}
          showCredentials={showCredentials}
        />
      </Providers>
    </div>
  );
}
