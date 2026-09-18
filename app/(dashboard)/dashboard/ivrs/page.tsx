import { redirect } from "next/navigation";
import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import {
  getStandaloneIvrs,
  getUploadableFacilities,
  getActiveApprovers,
} from "./(services)/actions";
import { IvrsProviders } from "./(sections)/Providers";
import { IvrsPageShell } from "./(components)/IvrsPageShell";

export const metadata: Metadata = {
  title: "IVR Forms",
};

export const dynamic = "force-dynamic";

export default async function IvrsPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  // Anyone signed in with a portal role can see IVRs — RLS on the DB
  // narrows the visible set per role (rep sees their reps' facilities;
  // clinic sees their facility; admin/support see all).
  if (!role) {
    redirect("/sign-in");
  }

  // Fetch everything the page needs in parallel — server-side keeps the
  // client bundle small and gives the shell a fully-hydrated first paint.
  const [ivrs, facilities, approvers] = await Promise.all([
    getStandaloneIvrs(),
    getUploadableFacilities(),
    getActiveApprovers(),
  ]);

  return (
    <IvrsProviders ivrs={ivrs}>
      <IvrsPageShell facilities={facilities} approvers={approvers} />
    </IvrsProviders>
  );
}
