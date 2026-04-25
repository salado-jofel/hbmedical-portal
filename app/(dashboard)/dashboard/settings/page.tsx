import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isSalesRep, isClinicalProvider, isAdmin } from "@/utils/helpers/role";
import { PageHeader } from "@/app/(components)/PageHeader";
import type { UserRole } from "@/utils/helpers/role";

export const metadata: Metadata = { title: "Settings" };
import {
  getMyProfile,
  getMyCredentials,
  getMyClinicAccounts,
  getMySubReps,
  getMyClinicMembers,
  getMyAssignedRep,
  getMyEnrollment,
  getMyClinic,
} from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import {
  getMyConnectStatus,
  getMyLastPayout,
} from "@/app/(dashboard)/dashboard/settings/(services)/stripe-connect-actions";
import { notFound } from "next/navigation";
import Providers from "./(sections)/Providers";
import { SettingsTabs } from "./(sections)/SettingsTabs";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  const profile = await getMyProfile();
  if (!profile) notFound();

  const repUser = isSalesRep(role as UserRole);
  const providerUser = isClinicalProvider(role as UserRole);
  const showCredentials = providerUser;
  const showTeamTab = repUser || providerUser;
  const showPayouts = repUser;
  // Admin manages all users via the Users page — no Team tab in Settings.
  // Support staff and clinical staff have no team management responsibilities.

  const [
    myClinicAccounts,
    mySubReps,
    myClinicMembers,
    myAssignedRep,
    credentials,
    enrollmentData,
    facility,
    connectStatus,
    myClinic,
    lastPayout,
  ] = await Promise.all([
      repUser ? getMyClinicAccounts() : Promise.resolve([]),
      repUser ? getMySubReps() : Promise.resolve([]),
      providerUser ? getMyClinicMembers() : Promise.resolve([]),
      providerUser ? getMyAssignedRep() : Promise.resolve(null),
      showCredentials ? getMyCredentials() : Promise.resolve(null),
      providerUser ? getMyEnrollment() : Promise.resolve(null),
      providerUser
        ? supabase
            .from("facilities")
            .select("name, address_line_1, city, state, postal_code, phone")
            .eq("user_id", profile.id)
            .maybeSingle()
            .then((r) => r.data)
        : Promise.resolve(null),
      showPayouts ? getMyConnectStatus() : Promise.resolve(null),
      providerUser ? getMyClinic() : Promise.resolve(null),
      showPayouts ? getMyLastPayout() : Promise.resolve(null),
    ]);

  const showEnrollment = providerUser;
  const facilityName = facility?.name ?? "";
  const providerName = `${profile.first_name} ${profile.last_name}`.trim();
  const providerNpi = credentials?.npi_number ?? "";

  // Roles that mandate MFA per the dashboard gate. Keep in sync with
  // MFA_MANDATORY_ROLES in lib/supabase/mfa-gate.ts.
  const mfaMandatory = isAdmin(role as UserRole) || providerUser;

  const { tab } = await searchParams;
  const validTabs = [
    "profile",
    "team",
    "credentials",
    "enrollment",
    "payouts",
    "security",
  ] as const;
  const initialTab = validTabs.includes(tab as (typeof validTabs)[number])
    ? (tab as (typeof validTabs)[number])
    : undefined;

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your profile, team, and credentials" />
      <Providers>
        <SettingsTabs
          profile={profile}
          myClinic={myClinic}
          isRep={repUser}
          myClinicAccounts={myClinicAccounts}
          mySubReps={mySubReps}
          myClinicMembers={myClinicMembers}
          myAssignedRep={myAssignedRep}
          credentials={credentials}
          showTeamTab={showTeamTab}
          showCredentials={showCredentials}
          showEnrollment={showEnrollment}
          showPayouts={showPayouts}
          connectStatus={connectStatus}
          lastPayout={lastPayout}
          mfaMandatory={mfaMandatory}
          initialTab={initialTab}
          enrollmentData={enrollmentData}
          facilityName={facilityName}
          providerName={providerName}
          providerNpi={providerNpi}
          billingAddressPrefill={facility?.address_line_1 ?? ""}
          billingCityPrefill={facility?.city ?? ""}
          billingStatePrefill={facility?.state ?? ""}
          billingZipPrefill={facility?.postal_code ?? ""}
          billingPhonePrefill={facility?.phone ?? ""}
        />
      </Providers>
    </>
  );
}
