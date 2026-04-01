import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Building2, UserCheck } from "lucide-react";
import { validateInviteToken } from "@/app/(dashboard)/dashboard/(services)/invite-tokens/actions";
import { BackgroundDots } from "@/app/(components)/BackgroundDots";
import { HBLogo } from "@/app/(components)/HBLogo";
import { ROLE_LABELS } from "@/utils/helpers/role";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InviteLandingPage({ params }: PageProps) {
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

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <HBLogo variant="dark" size="md" />
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border border-white/15 bg-white/8 p-8 backdrop-blur-2xl space-y-6"
          style={{
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-white">You&apos;re invited!</h1>
            <p className="text-white/70 text-sm">
              <span className="text-white font-medium">{invitedBy}</span> has invited you
              to join HB Medical Portal.
            </p>
          </div>

          {/* Details */}
          <div className="space-y-3">
            {inviteToken.facility && (
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <Building2 className="w-4 h-4 text-white/60 shrink-0" />
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wide font-medium">
                    Practice
                  </p>
                  <p className="text-sm text-white font-medium">{inviteToken.facility.name}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
              <UserCheck className="w-4 h-4 text-white/60 shrink-0" />
              <div>
                <p className="text-xs text-white/50 uppercase tracking-wide font-medium">
                  Role
                </p>
                <p className="text-sm text-white font-medium">
                  {ROLE_LABELS[inviteToken.role_type]}
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <Link
            href={`/invite/${token}/signup`}
            className="block w-full text-center rounded-xl bg-[#e8821a] hover:bg-[#e8821a]/90 text-white font-semibold py-3 text-sm transition-colors"
          >
            Accept &amp; Create Account
          </Link>

          <p className="text-center text-xs text-white/40">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-white/70 hover:text-white underline transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
