import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin } from "@/utils/helpers/role";

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
    <Providers users={users}>
      <UsersList />
    </Providers>
  );
}
