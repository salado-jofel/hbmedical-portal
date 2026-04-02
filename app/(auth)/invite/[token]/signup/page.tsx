import { notFound } from "next/navigation";
import { BackgroundDots } from "@/app/(components)/BackgroundDots";
import { validateInviteToken } from "@/app/(dashboard)/dashboard/(services)/invite-tokens/actions";
import InviteSignUpForm from "./(sections)/InviteSignUpForm";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InviteSignUpPage({ params }: PageProps) {
  const { token } = await params;

  const inviteToken = await validateInviteToken(token);

  if (!inviteToken) {
    notFound();
  }

  const invitedBy = inviteToken.created_by_profile
    ? `${inviteToken.created_by_profile.first_name} ${inviteToken.created_by_profile.last_name}`
    : "HB Medical";

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <InviteSignUpForm
          token={token}
          role={inviteToken.role_type}
          facilityId={inviteToken.facility_id}
          facilityName={inviteToken.facility?.name ?? null}
          invitedBy={invitedBy}
        />
      </div>
    </main>
  );
}
