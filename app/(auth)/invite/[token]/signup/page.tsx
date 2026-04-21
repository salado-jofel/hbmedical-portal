import Link from "next/link";
import { notFound } from "next/navigation";
import { XCircle, Clock } from "lucide-react";
import { getInviteTokenStatus } from "@/app/(dashboard)/dashboard/(services)/invite-tokens/actions";
import { HBLogo } from "@/app/(components)/HBLogo";
import { BackgroundDots } from "@/app/(components)/BackgroundDots";
import InviteSignUpForm from "./(sections)/InviteSignUpForm";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InviteSignUpPage({ params }: PageProps) {
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
            <HBLogo variant="light" size="md" />
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

  // Task 8D: clinical_staff invite MUST have a facility_id to join.
  // A null facility_id on a staff token means a broken/old invite — never show the form.
  if (inviteToken.role_type === "clinical_staff" && !inviteToken.facility_id) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center">
            <HBLogo variant="light" size="md" />
          </div>
          <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] border border-[#E2E8F0] p-8 space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-[#0F172A]">Invalid invite link</h1>
              <p className="text-sm text-[#64748B] leading-relaxed">
                This invite link is missing required information. Please request a new invite from your representative.
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

  const invitedBy = inviteToken.created_by_profile
    ? `${inviteToken.created_by_profile.first_name} ${inviteToken.created_by_profile.last_name}`
    : "HB Medical";

  // Contract preview URLs are fetched client-side on entering step 6, so the
  // user sees one loading state while MERIDIAN-prestamped PDFs are generated
  // rather than a stale SSR preview that flashes + reloads.
  // clinical_provider always creates their own clinic on signup.
  // The token's facility_id (when set) is the inviting rep's facility used only to
  // resolve assigned_rep on the server — never shown to the user or used to skip the Office step.
  const formFacilityId =
    inviteToken.role_type === "clinical_provider" ? null : inviteToken.facility_id;
  const formFacilityName = formFacilityId ? (inviteToken.facility?.name ?? null) : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full flex justify-center">
        <InviteSignUpForm
          token={token}
          role={inviteToken.role_type}
          facilityId={formFacilityId}
          facilityName={formFacilityName}
          invitedBy={invitedBy}
          invitedEmail={inviteToken.invited_email ?? null}
          baaUrl={null}
          productServicesUrl={null}
          contractsError={null}
        />
      </div>
    </main>
  );
}
