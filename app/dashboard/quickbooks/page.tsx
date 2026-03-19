// app/dashboard/quickbooks/page.tsx  ← UPDATE

export const dynamic = "force-dynamic";

import QuickBooksClient from "./(sections)/QuickBooksClient";
import { getQuickBooksConnection, redirectToQuickBooks } from "./actions";

export default async function QuickBooksPage() {
  // ✅ read-only — safe during render
  const connection = await getQuickBooksConnection();

  return (
    <div className="p-4 md:p-8 w-full mx-auto space-y-6 select-none h-full overflow-y-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
          QuickBooks
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Connect your QuickBooks account to sync orders, invoices, and
          payments.
        </p>
      </div>

      {/* ✅ pass the Server Action down instead of a pre-built URL */}
      <QuickBooksClient
        connectAction={redirectToQuickBooks}
        connection={connection}
      />
    </div>
  );
}
