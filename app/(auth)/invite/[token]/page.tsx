import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle, UserCheck, XCircle, Clock } from "lucide-react";
import { getInviteTokenStatus } from "@/app/(dashboard)/dashboard/(services)/invite-tokens/actions";
import { MeridianLogo } from "@/app/(components)/MeridianLogo";
import { ROLE_LABELS } from "@/utils/helpers/role";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InviteLandingPage({ params }: PageProps) {
  const { token } = await params;

  const result = await getInviteTokenStatus(token);

  if (!result.valid) {
    if (result.reason === "not_found") {
      notFound();
    }

    const isExpired = result.reason === "expired";

    return (
      <main className="min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center">
            <MeridianLogo variant="light" size="md" />
          </div>
          <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] border border-[#E2E8F0] p-8 space-y-6 text-center">
            <div className="flex justify-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isExpired ? "bg-amber-50" : "bg-red-50"}`}>
                {isExpired
                  ? <Clock className="w-8 h-8 text-amber-500" />
                  : <XCircle className="w-8 h-8 text-red-500" />
                }
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-[#0F172A]">
                {isExpired ? "Invite link expired" : "Invite already used"}
              </h1>
              <p className="text-sm text-[#64748B] leading-relaxed">
                {isExpired
                  ? "This invite link has expired. Please ask your representative to send a new one."
                  : "This invite link has already been used to create an account."
                }
              </p>
            </div>
            <Link
              href="/sign-in"
              className="block w-full text-center rounded-lg bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white font-medium h-9 flex items-center justify-center text-sm transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { inviteToken } = result;

  const invitedBy = inviteToken.created_by_profile
    ? `${inviteToken.created_by_profile.first_name} ${inviteToken.created_by_profile.last_name}`
    : "Meridian Portal";

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <MeridianLogo variant="light" size="md" />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] border border-[#E2E8F0] p-8 space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-[#EFF6FF] flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-[var(--navy)]" />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-[#0F172A]">You&apos;re invited!</h1>
            <p className="text-[#64748B] text-sm">
              <span className="text-[#0F172A] font-medium">{invitedBy}</span> has invited you
              to join Meridian Portal.
            </p>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3">
              <UserCheck className="w-4 h-4 text-[#94A3B8] shrink-0" />
              <div>
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-widest font-semibold">
                  Role
                </p>
                <p className="text-sm text-[#0F172A] font-medium">
                  {ROLE_LABELS[inviteToken.role_type]}
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <Link
            href={`/invite/${token}/signup`}
            className="block w-full text-center rounded-lg bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white font-medium h-9 flex items-center justify-center text-sm transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
          >
            Accept &amp; Create Account
          </Link>

          <p className="text-center text-xs text-[#94A3B8]">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-[var(--navy)] hover:text-[#125d8e] font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
