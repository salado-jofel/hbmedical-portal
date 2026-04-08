import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin } from "@/utils/helpers/role";
import { DashboardHeader } from "@/app/(components)/DashboardHeader";

export const metadata: Metadata = { title: "Users" };
import { getUsers } from "@/app/(dashboard)/dashboard/users/(services)/actions";
import Providers from "./(sections)/Providers";
import { UsersList } from "./(sections)/UsersList";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  if (!isAdmin(role)) {
    redirect("/dashboard");
  }

  const users = await getUsers();

  return (
    <div className="p-6 md:p-8 max-w-480 mx-auto space-y-6">
      <DashboardHeader title="Users" description="Manage user access and roles" />
      <Providers users={users}>
        <UsersList />
      </Providers>
    </div>
  );
}
