import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/auth";
import { getUsers } from "@/app/(dashboard)/dashboard/users/(services)/actions";
import Providers from "./(sections)/Providers";
import { UsersPageClient } from "./(sections)/UsersPageClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  if (role !== "admin") {
    redirect("/dashboard");
  }

  const users = await getUsers();

  return (
    <div className="p-6 md:p-8 max-w-480 mx-auto space-y-6">
      <Providers users={users}>
        <UsersPageClient />
      </Providers>
    </div>
  );
}
