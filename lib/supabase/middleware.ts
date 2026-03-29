import { createServerClient } from "@supabase/ssr";
import { jwtDecode } from "jwt-decode";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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

          supabaseResponse = NextResponse.next({ request });

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
  const isLoginPage =
    currentPath === "/sign-in" ||
    currentPath === "/sign-up" ||
    currentPath === "/verify-email";

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

  return supabaseResponse;
}
