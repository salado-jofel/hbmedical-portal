import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Per client request: the public landing page is retired. Visiting the root
 * URL bounces straight to the auth flow — signed-in users skip the sign-in
 * step and land on the dashboard, signed-out users see the sign-in form.
 *
 * The original landing-page sections (Hero, WhyUs, Testimonials, etc.) still
 * live under `app/(sections)/` and can be re-enabled by swapping this file
 * back to importing + rendering them.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/dashboard" : "/sign-in");
}
