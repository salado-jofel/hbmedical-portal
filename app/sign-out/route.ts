import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revokeCurrentSmsMfaSession } from "@/lib/supabase/sms-mfa-session";

/* GET|POST /sign-out — the escape hatch.
 *
 * The dashboard layout has four hard gates (contracts, payouts, phone/SMS
 * MFA, PIN) and the middleware has a fifth (sales-rep setup). Each redirects
 * to a screen outside the dashboard, and those screens are the only thing the
 * user can see. If the sign-out button on one of them is missing or fails,
 * there is no way back out: a signed-in user cannot reach /sign-in either,
 * because the middleware bounces /sign-in to /dashboard and the gate bounces
 * /dashboard straight back to the gate screen. The session has to be cleared
 * by hand in devtools to recover.
 *
 * This route is that recovery path, and it is a plain URL on purpose — it
 * works when typed into the address bar, with no button, no client JS and no
 * server action involved. The middleware already allowlisted "/sign-out" in
 * both its deactivated-user and setup guards, which is where this was always
 * meant to be; until now the path did not exist and those two checks were
 * dead.
 *
 * Clearing cookies needs a route handler: a Server Component cannot write
 * them, so this cannot be a page.
 *
 * GET is accepted deliberately. It makes logout CSRF-able — a third party can
 * cause a logout with an <img> tag — which is the accepted trade for a
 * recovery URL that a stuck user can type. Logging someone out destroys no
 * data and reveals nothing; being unable to log out is the bug being fixed.
 */
async function handleSignOut(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Best-effort, same as the signOut server action: never let bookkeeping
    // stop the sign-out, or this escape hatch has the failure mode it exists
    // to rescue people from.
    try {
      await revokeCurrentSmsMfaSession();
    } catch (err) {
      console.error("[sign-out route] SMS MFA session revoke failed", err);
    }
    await supabase.auth.signOut();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "?signedOut=1";
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  return handleSignOut(request);
}

export async function POST(request: NextRequest) {
  return handleSignOut(request);
}
