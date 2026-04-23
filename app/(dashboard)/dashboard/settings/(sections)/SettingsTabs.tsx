"use client";

import { useState } from "react";
import { User, Users, ShieldCheck, ClipboardList, Banknote } from "lucide-react";
import { cn } from "@/utils/utils";
import { ProfileTab } from "../(components)/ProfileTab";
import { TeamTab } from "../(components)/TeamTab";
import { CredentialsTab } from "../(components)/CredentialsTab";
import { EnrollmentTab } from "../(components)/EnrollmentTab";
import { PayoutsTab } from "../(components)/PayoutsTab";
import type { Profile } from "@/utils/interfaces/profiles";
import type { IFacilityMember } from "@/utils/interfaces/facility-members";
import type { IProviderCredentials } from "@/utils/interfaces/provider-credentials";
import type { ISubRep } from "@/utils/interfaces/sub-reps";
import type { IClinicAccount } from "@/utils/interfaces/settings";
import type {
  FacilityEnrollmentData,
  IAssignedRep,
  IMyClinic,
} from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import type { ConnectStatus } from "@/app/(dashboard)/dashboard/settings/(services)/stripe-connect-actions";

type TabKey = "profile" | "team" | "credentials" | "enrollment" | "payouts";

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ElementType;
}

interface SettingsTabsProps {
  profile: Profile;
  myClinic: IMyClinic | null;
  isRep: boolean;
  myClinicAccounts: IClinicAccount[];
  mySubReps: ISubRep[];
  myClinicMembers: IFacilityMember[];
  myAssignedRep: IAssignedRep | null;
  credentials: IProviderCredentials | null;
  showTeamTab: boolean;
  showCredentials: boolean;
  showEnrollment: boolean;
  showPayouts: boolean;
  connectStatus: ConnectStatus | null;
  initialTab?: TabKey;
  enrollmentData: FacilityEnrollmentData | null;
  facilityName: string;
  providerName: string;
  providerNpi: string;
  billingAddressPrefill: string;
  billingCityPrefill: string;
  billingStatePrefill: string;
  billingZipPrefill: string;
  billingPhonePrefill: string;
}

export function SettingsTabs({
  profile,
  myClinic,
  isRep,
  myClinicAccounts,
  mySubReps,
  myClinicMembers,
  myAssignedRep,
  credentials,
  showTeamTab,
  showCredentials,
  showEnrollment,
  showPayouts,
  connectStatus,
  initialTab,
  enrollmentData,
  facilityName,
  providerName,
  providerNpi,
  billingAddressPrefill,
  billingCityPrefill,
  billingStatePrefill,
  billingZipPrefill,
  billingPhonePrefill,
}: SettingsTabsProps) {
  const tabs: Tab[] = [
    { key: "profile", label: "Profile", icon: User },
    ...(showTeamTab
      ? [{ key: "team" as TabKey, label: "Team", icon: Users }]
      : []),
    ...(showCredentials
      ? [{ key: "credentials" as TabKey, label: "Credentials", icon: ShieldCheck }]
      : []),
    ...(showEnrollment
      ? [{ key: "enrollment" as TabKey, label: "Enrollment", icon: ClipboardList }]
      : []),
    ...(showPayouts
      ? [{ key: "payouts" as TabKey, label: "Payouts", icon: Banknote }]
      : []),
  ];

  const [active, setActive] = useState<TabKey>(initialTab ?? "profile");

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-[3px] overflow-x-auto rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 py-[6px] text-[12px] font-medium transition-all duration-150",
              active === tab.key
                ? "bg-[var(--navy)] text-white"
                : "text-[var(--text2)] hover:bg-[var(--bg)]",
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — all tabs stay MOUNTED; we only hide the inactive ones.
          Unmounting on tab-switch would wipe in-memory form state (Enrollment
          especially — its initial values come from a server-rendered prop that
          doesn't refresh until a full page reload). */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r)] p-5">
        <div hidden={active !== "profile"}>
          <ProfileTab profile={profile} clinic={myClinic} />
        </div>
        {showTeamTab && (
          <div hidden={active !== "team"}>
            <TeamTab
              isRep={isRep}
              myClinicAccounts={myClinicAccounts}
              mySubReps={mySubReps}
              myClinicMembers={myClinicMembers}
              myAssignedRep={myAssignedRep}
            />
          </div>
        )}
        {showCredentials && (
          <div hidden={active !== "credentials"}>
            <CredentialsTab credentials={credentials} />
          </div>
        )}
        {showEnrollment && (
          <div hidden={active !== "enrollment"}>
            <EnrollmentTab
              enrollmentData={enrollmentData}
              facilityName={facilityName}
              providerName={providerName}
              providerNpi={providerNpi}
              billingAddressPrefill={billingAddressPrefill}
              billingCityPrefill={billingCityPrefill}
              billingStatePrefill={billingStatePrefill}
              billingZipPrefill={billingZipPrefill}
              billingPhonePrefill={billingPhonePrefill}
            />
          </div>
        )}
        {showPayouts && connectStatus && (
          <div hidden={active !== "payouts"}>
            <PayoutsTab status={connectStatus} />
          </div>
        )}
      </div>
    </div>
  );
}
