import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSmsMfaSession } from "@/lib/supabase/sms-mfa-session";
import { isMfaMandatoryRole } from "@/lib/supabase/mfa-gate";
import { isValidE164 } from "@/utils/helpers/phone";
import type { UserRole } from "@/utils/helpers/role";
import ResetPasswordForm from "./(sections)/ResetPasswordForm";
import { Metadata } from "next";

export const metadata: Metadata = { title: "Reset Password" };
export const dynamic = "force-dynamic";

/**
 * Page-level MFA gate. If the recovery session belongs to an MFA-mandatory
 * role with a verified phone, divert through the SMS challenge first so the
 * password update server action (which checks for an sms_mfa_sessions row)
 * succeeds instead of erroring on submit. Users without an enrolled phone
 * — or roles where MFA isn't mandatory — go straight to the form.
 *
 * If there's no recovery session at all, fall through to the form so it can
 * render its existing "Link expired" UI; redirecting from here would lose
 * that explanation.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, phone, phone_verified_at")
      .eq("id", user.id)
      .maybeSingle();

    const role = (profile?.role ?? null) as UserRole;
    const phone = profile?.phone ?? null;
    const phoneVerified =
      !!phone && !!profile?.phone_verified_at && isValidE164(phone);

    if (isMfaMandatoryRole(role) && phoneVerified) {
      const hasSession = await hasActiveSmsMfaSession(user.id);
      if (!hasSession) {
        redirect("/sign-in/sms-mfa?returnTo=/reset-password");
      }
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
