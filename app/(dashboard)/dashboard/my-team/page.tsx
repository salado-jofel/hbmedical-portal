import { type Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isSalesRep, isAdmin } from "@/utils/helpers/role";
import { PageHeader } from "@/app/(components)/PageHeader";
import Providers from "./(sections)/Providers";
import { TeamView } from "./(sections)/TeamView";
import { RepTree } from "./(sections)/RepTree";
import { getMySubReps, getRepTree } from "./(services)/actions";

export const metadata: Metadata = { title: "My Team" };
export const dynamic = "force-dynamic";

export default async function MyTeamPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  if (!isSalesRep(role) && !isAdmin(role)) redirect("/dashboard");

  if (isAdmin(role)) {
    const tree = await getRepTree();
    return (
      <div className="p-4 md:p-8 mx-auto space-y-6">
        <PageHeader
          title="Sales Reps"
          subtitle="Review all sales representatives and manage their commission rates"
          className="pb-4"
        />
        <RepTree tree={tree} />
      </div>
    );
  }

  const subReps = await getMySubReps();
  return (
    <Providers subReps={subReps}>
      <div className="p-4 md:p-8 mx-auto space-y-6">
        <PageHeader
          title="My Team"
          subtitle="Manage your sub-representatives and their accounts"
          className="pb-4"
        />
        <TeamView />
      </div>
    </Providers>
  );
}
