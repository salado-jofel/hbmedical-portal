import { createServerClient } from "@supabase/ssr";
import { jwtDecode } from "jwt-decode";
import { type NextRequest, NextResponse } from "next/server";
import { isSalesRep } from "@/utils/helpers/role";
import type { UserRole } from "@/utils/helpers/role";

export async function updateSession(request: NextRequest) {
  // Forward the current pathname into the request as an `x-pathname` header
  // so server components / layouts can inspect it without sniffing internal
  // Next.js APIs. Used by the dashboard layout's MFA gate.
  //
  // Mutating `request.headers` directly does NOT propagate to downstream
  // server components in Next 16 / Turbopack — the request object passed
  // into `NextResponse.next({ request })` is a new wrapper. To make the
  // header visible, we have to clone Headers and pass it explicitly.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set({ name, value, ...options }),
          );

          // Reuse the cloned headers so x-pathname survives the cookie
          // refresh that happens during sign-in / token rotation.
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // getSession() gives us the access token so we can decode the JWT and read
  // the AMR (Authentication Method Reference) claim. The AMR claim is embedded
  // inside the JWT itself — it is NOT exposed as a property on the Session
  // object by the Supabase JS client, so (session as any)?.amr is always
  // undefined. We must decode the token directly.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const currentPath = request.nextUrl.pathname;

  // ── Recovery session guard ────────────────────────────────────────────────
  // After a password-reset email link is clicked, Supabase creates a recovery
  // session. Its JWT contains amr: [{ method: "recovery" }]. This session must
  // only be valid on /reset-password. Any other route — including /sign-in and
  // /dashboard — must redirect back to /reset-password to force the user to
  // complete the password change before doing anything else.
  if (session?.access_token) {
    try {
      const decoded = jwtDecode<{ amr?: { method: string }[] }>(
        session.access_token,
      );
      const isRecoverySession =
        decoded?.amr?.some((a) => a.method === "recovery") ?? false;

      if (isRecoverySession) {
        if (!currentPath.startsWith("/reset-password")) {
          const url = request.nextUrl.clone();
          url.pathname = "/reset-password";
          url.search = ""; // don't carry over query params from the original URL
          return NextResponse.redirect(url);
        }
        return supabaseResponse;
      }
    } catch {
      // Malformed token — fall through and treat as no session
    }
  }

  // ── Normal session logic ──────────────────────────────────────────────────

  // Login/registration pages — redirect logged-in users away from these.
  // /verify-email is special: logged-in users with an UNCONFIRMED email
  // legitimately need to see it (they just signed up). Only redirect them
  // away once their email is confirmed — otherwise the freshly-created user
  // gets bounced back to the invite signup page and sees "Invite already used".
  const emailConfirmed = Boolean(user?.email_confirmed_at);
  const isLoginPage =
    currentPath === "/sign-in" ||
    currentPath === "/sign-up" ||
    (currentPath === "/verify-email" && emailConfirmed);

  // /forgot-password and /reset-password are public — accessible to anyone.
  // They are intentionally excluded from isLoginPage so that a logged-in user
  // can still reach them (e.g. account settings → change password flow).

  // Logged-in user visits login/registration pages → redirect away
  if (user && isLoginPage) {
    const referer = request.headers.get("referer");
    const refererUrl = referer ? new URL(referer) : null;
    const isComingFromLanding = refererUrl?.pathname === "/";

    if (
      !referer ||
      isComingFromLanding ||
      referer.includes("/sign-in") ||
      referer.includes("/sign-up")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    return NextResponse.redirect(referer);
  }

  if (!user && currentPath.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", currentPath);
    return NextResponse.redirect(url);
  }

  if (user) {
    // Fetch role + setup flag with the SAME supabase client that validated the
    // user above — avoids a second client / cookie race that causes Server
    // Action POSTs to misfire on Vercel Edge runtime.
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("role, has_completed_setup")
      .eq("id", user.id)
      .maybeSingle();

    const userRole = profileRow?.role as UserRole | undefined;
    const hasCompletedSetup = profileRow?.has_completed_setup;

    // ── Setup guard ───────────────────────────────────────────────────────────
    // Sales reps who haven't completed facility setup must finish before
    // accessing any other route.
    if (isSalesRep(userRole as UserRole)) {
      const needsSetup = hasCompletedSetup === false;
      const isSetupPath = currentPath.startsWith("/onboarding/setup");
      const isAuthPath =
        currentPath === "/sign-in" ||
        currentPath === "/sign-out" ||
        currentPath.startsWith("/api/");

      if (needsSetup && !isSetupPath && !isAuthPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding/setup";
        return NextResponse.redirect(url);
      }
    }

    // Non-Admin Restricted Routes
    const nonAdminForbidden = ["/dashboard/products"];

    if (userRole !== "admin") {
      if (nonAdminForbidden.some((path) => currentPath.startsWith(path))) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
