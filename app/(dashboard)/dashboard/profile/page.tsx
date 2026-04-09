export const dynamic = "force-dynamic";

import { getProfile } from "./(services)/actions";
import { PageHeader } from "@/app/(components)/PageHeader";
import Providers from "./(sections)/Providers";
import ProfileForm from "./(sections)/ProfileForm";
import { notFound } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const profile = await getProfile();

  if (!profile) notFound();

  return (
    <>
      <PageHeader title="My Profile" subtitle="Manage your account" />
      <Providers profile={profile}>
        <ProfileForm />
      </Providers>
    </>
  );
}
