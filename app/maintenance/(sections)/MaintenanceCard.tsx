import { Wrench } from "lucide-react";
import { MeridianLogo } from "@/app/(components)/MeridianLogo";

/**
 * Static maintenance card. Deliberately has NO auth, NO Supabase and NO
 * Redux — it must render while the database is being migrated.
 * `MeridianLogo` is rendered with asLink={false}: the middleware would
 * bounce "/" straight back here anyway, so a link is just a dead click.
 */
export function MaintenanceCard({ message }: { message: string | null }) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] border border-[#E2E8F0] p-8 w-full max-w-md select-none text-center">
      <div className="mb-6 flex items-center justify-center">
        <MeridianLogo variant="light" size="lg" asLink={false} />
      </div>

      <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-6">
        <Wrench className="w-8 h-8 text-amber-600" />
      </div>

      <h1 className="text-2xl font-bold text-[#0F172A] mb-3">
        Scheduled maintenance
      </h1>

      <p className="text-sm text-[#64748B] leading-relaxed">
        <span className="text-[var(--navy)] font-medium">Meridian Portal</span>{" "}
        is temporarily unavailable while we perform updates. Your data is
        safe and nothing is lost — please check back shortly.
      </p>

      {message && (
        <p className="mt-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] px-4 py-3 text-sm font-medium text-[#0F172A]">
          {message}
        </p>
      )}

      <p className="mt-8 text-xs text-[#94A3B8]">
        Urgent? Contact your Meridian representative directly.
      </p>
    </div>
  );
}
