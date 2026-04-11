import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isSalesRep, isClinicalProvider } from "@/utils/helpers/role";
import { PageHeader } from "@/app/(components)/PageHeader";
import type { UserRole } from "@/utils/helpers/role";

export const metadata: Metadata = { title: "Settings" };
import {
  getMyProfile,
  getMyCredentials,
  getMyClinicAccounts,
  getMySubReps,
  getMyClinicMembers,
  getMyEnrollment,
} from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import { notFound } from "next/navigation";
import Providers from "./(sections)/Providers";
import { SettingsTabs } from "./(sections)/SettingsTabs";

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

  const [myClinicAccounts, mySubReps, myClinicMembers, credentials, enrollmentData, facility] =
    await Promise.all([
      repUser ? getMyClinicAccounts() : Promise.resolve([]),
      repUser ? getMySubReps() : Promise.resolve([]),
      providerUser ? getMyClinicMembers() : Promise.resolve([]),
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
    ]);

  const showEnrollment = providerUser;
  const facilityName = facility?.name ?? "";
  const providerName = `${profile.first_name} ${profile.last_name}`.trim();
  const providerNpi = credentials?.npi_number ?? "";

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your profile, team, and credentials" />
      <Providers>
        <SettingsTabs
          profile={profile}
          isRep={repUser}
          myClinicAccounts={myClinicAccounts}
          mySubReps={mySubReps}
          myClinicMembers={myClinicMembers}
          credentials={credentials}
          showTeamTab={showTeamTab}
          showCredentials={showCredentials}
          showEnrollment={showEnrollment}
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
