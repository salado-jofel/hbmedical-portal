"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useIdleLogout } from "@/utils/hooks/useIdleLogout";
import { signOut } from "../(services)/actions";

interface IdleLogoutSentinelProps {
  /** When false (e.g. user is signed out / on a public path), the timer doesn't run. */
  enabled: boolean;
}

/**
 * HIPAA automatic-logoff control. Mounted inside the dashboard layout so it
 * only runs for signed-in users. After 20 minutes of inactivity, signs the
 * user out + redirects to /sign-in. Brief toast for context so the user
 * doesn't think they were forcibly kicked.
 *
 * The 20-minute window matches industry norms for clinical apps. Adjust by
 * passing a different `timeoutMs` if a particular workflow needs longer.
 */
const IDLE_TIMEOUT_MS = 20 * 60 * 1000;

export function IdleLogoutSentinel({ enabled }: IdleLogoutSentinelProps) {
  const router = useRouter();

  useIdleLogout({
    enabled,
    timeoutMs: IDLE_TIMEOUT_MS,
    onTimeout: async () => {
      toast("Signed out due to inactivity.", { duration: 4000 });
      try {
        // Server action signs out via Supabase + redirects to /sign-in.
        // If the redirect throws (Next App Router), we still trigger a
        // client navigation as a fallback.
        await signOut();
      } catch {
        router.replace("/sign-in");
      }
    },
  });

  return null;
}
