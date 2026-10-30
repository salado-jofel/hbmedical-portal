import { ShieldAlert, LogIn } from "lucide-react";
import { devSignIn } from "../(services)/actions";
import type { IDevAccount } from "@/utils/interfaces/dev-login";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  clinical_provider: "Clinical Provider",
  clinical_staff: "Clinical Staff",
  sales_representative: "Sales Representative",
  support_staff: "Support Staff",
};

export function DevAccountList({ accounts }: { accounts: IDevAccount[] }) {
  const byRole = accounts.reduce<Record<string, IDevAccount[]>>((acc, a) => {
    (acc[a.role] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <div className="mb-6 flex items-start gap-3 rounded-[10px] border border-amber-300 bg-amber-50 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
        <div className="text-[13px] leading-relaxed text-amber-900">
          <p className="font-semibold">Local development only</p>
          <p>
            Signs in as any account with no password and no MFA. Requires
            <code className="mx-1 rounded bg-amber-100 px-1">
              ENABLE_DEV_LOGIN=true
            </code>
            , a non-production build and a loopback host — it returns 404
            otherwise.
          </p>
        </div>
      </div>

      <h1 className="text-[20px] font-semibold">Dev account switcher</h1>
      <p className="mb-6 text-[13px] text-[var(--text3)]">
        {accounts.length} account{accounts.length === 1 ? "" : "s"}
      </p>

      {Object.entries(byRole).map(([role, list]) => (
        <section key={role} className="mb-7">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text3)]">
            {ROLE_LABELS[role] ?? role} · {list.length}
          </h2>
          <ul className="divide-y divide-[var(--border)] rounded-[10px] border border-[var(--border)]">
            {list.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between gap-4 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">
                    {account.name ?? account.email}
                  </p>
                  <p className="truncate text-[12px] text-[var(--text3)]">
                    {account.email}
                    {account.status !== "active" && ` · ${account.status}`}
                  </p>
                </div>
                <form action={devSignIn}>
                  <input type="hidden" name="email" value={account.email} />
                  <button
                    type="submit"
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-[7px] bg-[var(--navy)] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[var(--navy)]/90"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Sign in
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
