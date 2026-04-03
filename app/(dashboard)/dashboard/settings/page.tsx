import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isSalesRep, isClinicalProvider } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";
import {
  getMyProfile,
  getMyCredentials,
  getMyClinicAccounts,
  getMySubReps,
  getMyClinicMembers,
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

  const repUser = isSalesRep(role as UserRole);
  const providerUser = isClinicalProvider(role as UserRole);
  const showCredentials = providerUser;
  const showTeamTab = repUser || providerUser;
  // Admin manages all users via the Users page — no Team tab in Settings.
  // Support staff and clinical staff have no team management responsibilities.

  const [myClinicAccounts, mySubReps, myClinicMembers, credentials] =
    await Promise.all([
      repUser ? getMyClinicAccounts() : Promise.resolve([]),
      repUser ? getMySubReps() : Promise.resolve([]),
      providerUser ? getMyClinicMembers() : Promise.resolve([]),
      showCredentials ? getMyCredentials() : Promise.resolve(null),
    ]);

  return (
    <div className="p-6 md:p-8 max-w-480 mx-auto space-y-6">
      <div className="pb-5 border-b border-[#E2E8F0]">
        <h1 className="text-xl font-semibold text-[#0F172A]">Settings</h1>
        <p className="text-sm text-[#64748B] mt-1">
          Manage your profile, team, and credentials
        </p>
        <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
          {/* ── Header ── */}

          {/* ── Tabbed content ── */}
          <Providers>
            <SettingsPageClient
              profile={profile}
              isRep={repUser}
              myClinicAccounts={myClinicAccounts}
              mySubReps={mySubReps}
              myClinicMembers={myClinicMembers}
              credentials={credentials}
              showTeamTab={showTeamTab}
              showCredentials={showCredentials}
            />
          </Providers>
        </div>
      </div>
    </div>
  );
}
