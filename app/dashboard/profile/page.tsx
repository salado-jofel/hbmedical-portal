export const dynamic = "force-dynamic";

import { getProfile } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import Header from "./(sections)/Header";
import ProfileForm from "./(sections)/ProfileForm";
import { notFound } from "next/navigation";

export default async function ProfilePage() {
  const profile = await getProfile();

  if (!profile) notFound();

  return (
    <Providers profile={profile}>
      <div className="p-4 md:p-8 mx-auto space-y-6">
        <Header />
        <ProfileForm />
      </div>
    </Providers>
  );
}
