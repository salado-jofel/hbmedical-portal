"use client";

import { useState } from "react";
import { User, Users, ShieldCheck } from "lucide-react";
import { cn } from "@/utils/utils";
import { ProfileTab } from "../(components)/ProfileTab";
import { TeamTab } from "../(components)/TeamTab";
import { CredentialsTab } from "../(components)/CredentialsTab";
import type { Profile } from "@/utils/interfaces/profiles";
import type { IFacilityMember } from "@/utils/interfaces/facility-members";
import type { IProviderCredentials } from "@/utils/interfaces/provider-credentials";

type TabKey = "profile" | "team" | "credentials";

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ElementType;
}

interface SettingsPageClientProps {
  profile: Profile;
  members: IFacilityMember[];
  credentials: IProviderCredentials | null;
  canManageTeam: boolean;
  showCredentials: boolean;
}

export function SettingsPageClient({
  profile,
  members,
  credentials,
  canManageTeam,
  showCredentials,
}: SettingsPageClientProps) {
  const tabs: Tab[] = [
    { key: "profile", label: "Profile", icon: User },
    { key: "team", label: "Team", icon: Users },
    ...(showCredentials
      ? [{ key: "credentials" as TabKey, label: "Credentials", icon: ShieldCheck }]
      : []),
  ];

  const [active, setActive] = useState<TabKey>("profile");

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex border-b border-[#E2E8F0] gap-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
              active === tab.key
                ? "text-[#15689E] border-b-2 border-[#15689E]"
                : "text-[#94A3B8] hover:text-[#64748B]",
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {active === "profile" && <ProfileTab profile={profile} />}
        {active === "team" && (
          <TeamTab members={members} canManage={canManageTeam} />
        )}
        {active === "credentials" && showCredentials && (
          <CredentialsTab credentials={credentials} />
        )}
      </div>
    </div>
  );
}
