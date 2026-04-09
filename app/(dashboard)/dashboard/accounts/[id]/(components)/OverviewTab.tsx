import { MapPin, Phone, Mail, User, Calendar } from "lucide-react";
import type { IAccount, IRepProfile } from "@/utils/interfaces/accounts";

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg bg-[var(--navy)]/8 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-[var(--navy)]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[var(--text3)]">{label}</p>
        <p className="text-sm text-[var(--text2)] mt-0.5">{value}</p>
      </div>
    </div>
  );
}

interface OverviewTabProps {
  account: IAccount;
  salesReps: IRepProfile[];
}

export function OverviewTab({ account }: OverviewTabProps) {
  const address = [
    account.address_line_1,
    account.address_line_2,
    `${account.city}, ${account.state} ${account.postal_code}`,
    account.country,
  ]
    .filter(Boolean)
    .join("\n");

  const repName = account.assigned_rep_profile
    ? `${account.assigned_rep_profile.first_name} ${account.assigned_rep_profile.last_name}`
    : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* ── Contact & Address ── */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h3 className="text-sm font-semibold text-[var(--navy)]">Facility Details</h3>
        <div className="space-y-3">
          <InfoRow icon={User} label="Primary Contact" value={account.contact} />
          <InfoRow icon={Phone} label="Phone" value={account.phone} />
          <InfoRow
            icon={MapPin}
            label="Address"
            value={address}
          />
        </div>
      </div>

      {/* ── Assigned Rep ── */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h3 className="text-sm font-semibold text-[var(--navy)]">Sales Representative</h3>
        {account.assigned_rep_profile ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-[var(--navy)]">
                {account.assigned_rep_profile.first_name[0]}
                {account.assigned_rep_profile.last_name[0]}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--navy)]">{repName}</p>
              <p className="text-xs text-[var(--text3)] mt-0.5">
                {account.assigned_rep_profile.email}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--text3)]">No rep assigned yet.</p>
        )}

        {/* ── Timeline ── */}
        <div className="pt-2 border-t border-[var(--border)] space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[var(--text3)]" />
            <span className="text-xs text-[var(--text3)]">
              Created{" "}
              {new Date(account.created_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[var(--text3)]" />
            <span className="text-xs text-[var(--text3)]">
              Updated{" "}
              {new Date(account.updated_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
