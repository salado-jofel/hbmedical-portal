import { redirect } from "next/navigation";
import { refreshConnectAccountStatus } from "@/app/(dashboard)/dashboard/settings/(services)/stripe-connect-actions";

export const dynamic = "force-dynamic";

// Stripe hosted onboarding redirects here when the rep finishes (status=complete)
// or refreshes their link (status=refresh). We sync the latest account state
// from Stripe into the profile row, then bounce back to the Payouts tab.

export default async function ConnectReturnPage() {
  await refreshConnectAccountStatus();
  redirect("/dashboard/settings?tab=payouts");
}
