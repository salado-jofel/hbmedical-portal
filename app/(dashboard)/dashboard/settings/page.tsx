import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { getProfile } from "@/app/(dashboard)/dashboard/profile/(services)/actions";
import { getFacilityMembers } from "@/app/(dashboard)/dashboard/(services)/facility-members/actions";
import { getMyCredentials } from "@/app/(dashboard)/dashboard/(services)/provider-credentials/actions";
import { SettingsClient } from "@/app/(dashboard)/dashboard/(sections)/settings/SettingsClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  const profile = await getProfile();
  if (!profile) notFound();

  const showCredentials =
    role === "doctor" ||
    role === "clinical_provider" ||
    role === "supervisor";

  const canManageTeam =
    role === "admin" ||
    role === "sales_representative" ||
    role === "doctor";

  const [members, credentials] = await Promise.all([
    getFacilityMembers(),
    showCredentials ? getMyCredentials() : Promise.resolve(null),
  ]);

  return (
    <div className="p-4 md:p-8 mx-auto max-w-2xl space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#15689E]/10 flex items-center justify-center shrink-0">
          <Settings className="w-5 h-5 text-[#15689E]" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Settings</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage your profile, team, and credentials
          </p>
        </div>
      </div>

      {/* ── Tabbed content ── */}
      <SettingsClient
        profile={profile}
        members={members}
        credentials={credentials}
        canManageTeam={canManageTeam}
        showCredentials={showCredentials}
      />
    </div>
  );
}
