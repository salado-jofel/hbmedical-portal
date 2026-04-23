import { redirect } from "next/navigation";
import { refreshConnectAccountStatus } from "@/app/(dashboard)/dashboard/settings/(services)/stripe-connect-actions";

export const dynamic = "force-dynamic";

// Stripe hosted onboarding redirects here after the rep finishes (or refreshes
// the link). Sync the latest account state, then send them to /dashboard. The
// dashboard layout's gate will re-route them back to /onboarding/payouts if
// details_submitted is still false (e.g. they bailed out partway through).

export default async function PayoutsGateReturnPage() {
  await refreshConnectAccountStatus();
  redirect("/dashboard");
}
