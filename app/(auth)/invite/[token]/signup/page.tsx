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
    <main
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at top, #1a7ab8 0%, #15689E 35%, #0d4a72 70%, #082d47 100%)",
      }}
    >
      <BackgroundDots />

      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(232,130,26,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
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
