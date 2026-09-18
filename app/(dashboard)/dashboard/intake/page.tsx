import { redirect } from "next/navigation";
import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { PageHeader } from "@/app/(components)/PageHeader";
import { getIntakeDocuments } from "./(services)/actions";
import {
  getUploadableFacilities,
  getActiveApprovers,
} from "../ivrs/(services)/actions";
import { IntakeProviders } from "./(sections)/Providers";
import { IntakeList } from "./(components)/IntakeList";

export const metadata: Metadata = {
  title: "Fax Intake",
};

export const dynamic = "force-dynamic";

export default async function IntakePage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!role) redirect("/sign-in");
  // RLS on intake_documents allows only admin + support, but we also
  // gate rendering at the page level so non-admin users landing here
  // via a stale bookmark get a clean redirect instead of an empty page.
  if (role !== "admin" && role !== "support_staff") {
    redirect("/dashboard");
  }

  // Fetch intake + the shared IVR / order dropdown data server-side —
  // the detail modal's "Build IVR" handoff needs facilities + approvers,
  // and pre-fetching keeps the first paint fully hydrated.
  const [intake, facilities, approvers] = await Promise.all([
    getIntakeDocuments(),
    getUploadableFacilities(),
    getActiveApprovers(),
  ]);

  return (
    <IntakeProviders intake={intake}>
      <div className="select-none">
        <PageHeader
          title="Fax Intake"
          subtitle="Inbound faxes waiting to be built into IVRs or orders."
        />
        <IntakeList facilities={facilities} approvers={approvers} />
      </div>
    </IntakeProviders>
  );
}
