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
    <div className="p-4 md:p-8 mx-auto max-w-5xl space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#15689E]/10 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-[#15689E]" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Users</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage HB Medical portal users
          </p>
        </div>
      </div>

      <Providers users={users}>
        <UsersPageClient />
      </Providers>
    </div>
  );
}
