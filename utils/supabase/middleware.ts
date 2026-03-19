import { createServerClient } from "@supabase/ssr";
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

  const currentPath = request.nextUrl.pathname;

  const isAuthPage =
    currentPath === "/sign-in" ||
    currentPath === "/sign-up" ||
    currentPath === "/verify-email";

  // ── LOGIC A: Logged-in user visits an auth page → send to dashboard ───────
  if (user && isAuthPage) {
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

  // ── LOGIC B: Unauthenticated user visits /dashboard → send to sign-in ─────
  if (!user && currentPath.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", currentPath);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
