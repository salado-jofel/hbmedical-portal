import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import type { UserRole } from "@/utils/helpers/role";
import { evaluateContractsGate } from "@/lib/supabase/contracts-gate";
import { getContractGateStatus } from "./(services)/actions";
import { ContractsGate } from "./(sections)/ContractsGate";

export const metadata: Metadata = { title: "Required Onboarding Documents" };
export const dynamic = "force-dynamic";

export default async function ContractsGatePage() {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = (await getUserRole(supabase)) as UserRole;

  // If the gate flag is off, OR the user has no missing contracts, bounce
  // them back to the dashboard. The page is purpose-built for incomplete
  // users; landing here with everything signed would be confusing.
  const decision = await evaluateContractsGate(user.id, role);
  if (decision.kind === "ok") {
    redirect("/dashboard");
  }

  const { status, error } = await getContractGateStatus();
  if (!status || error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-md text-center text-sm text-[#dc2626]">
          {error ?? "Could not load required documents."}
        </div>
      </main>
    );
  }

  const firstName = user.user_metadata?.first_name ?? "";
  const lastName = user.user_metadata?.last_name ?? "";

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <ContractsGate
          status={status}
          missingKeys={decision.missingKeys}
          email={user.email ?? ""}
          firstName={firstName}
          lastName={lastName}
        />
      </div>
    </main>
  );
}
