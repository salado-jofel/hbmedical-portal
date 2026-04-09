"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, LogOut, CheckSquare, UserPlus } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { HBLogo } from "@/app/(components)/HBLogo";
import { NotificationBell } from "@/app/(dashboard)/(components)/NotificationBell";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ROLE_LABELS, type UserRole, isSalesRep, isAdmin } from "@/utils/helpers/role";
import { signOut } from "../(services)/actions";

export function TopBar() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const userData = useAppSelector((state) => state.dashboard);

  const isPendingSetup = !userData.name || userData.name === "Pending Setup";
  const initials = isPendingSetup
    ? (userData.email?.[0] ?? "U").toUpperCase()
    : (userData.initials ?? "U");
  const displayName = isPendingSetup ? (userData.email ?? "User") : userData.name;
  const role = userData.role as UserRole;
  const roleLabel = role ? (ROLE_LABELS[role] ?? role) : "";

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  async function handleSignOut() {
    setOpen(false);
    await signOut();
  }

  return (
    <div
      className="mb-5 flex items-center justify-between rounded-[12px] px-[14px] py-[10px]"
      style={{ background: "var(--navy)" }}
    >
      {/* ── Left: icon + title ── */}
      <div className="flex items-center gap-[10px]">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] [&>span>span:last-child]:hidden"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <HBLogo variant="dark" size="sm" asLink={false} />
        </div>
        <div>
          <p
            className="text-[15px] font-semibold leading-none text-white"
            style={{ letterSpacing: "-0.2px" }}
          >
            HB Medical Portal
          </p>
          <p className="mt-[1px] text-[11px]" style={{ color: "#7fb3cc" }}>
            hbmedicalportal.com
          </p>
        </div>
      </div>

      {/* ── Right: notifications + avatar ── */}
      <div className="flex items-center gap-2">
        {/* Notification bell — color overrides for navy bg */}
        <div className="[&_button]:!text-white/70 [&_button:hover]:!bg-white/10 [&_button:hover]:!text-white [&_svg]:!text-white/60">
          <NotificationBell
            currentUserId={userData.userId ?? ""}
            collapsed={true}
          />
        </div>

        {/* Avatar trigger + dropdown */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2.5 rounded-lg px-1 py-0.5 transition hover:bg-white/10 focus:outline-none"
            >
              {/* 36px avatar circle */}
              <div
                className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full text-[13px] font-semibold text-white"
                style={{ background: "rgba(255,255,255,0.2)" }}
              >
                {initials}
              </div>
              {/* Name + role — desktop only */}
              <div className="hidden text-left sm:block">
                <p className="text-[13px] font-semibold leading-none text-white">
                  {displayName}
                </p>
                {roleLabel && (
                  <p
                    className="mt-[3px] text-[11px] leading-none"
                    style={{ color: "#7fb3cc" }}
                  >
                    {roleLabel}
                  </p>
                )}
              </div>
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-[220px] rounded-[10px] border border-[var(--border)] bg-white p-0 shadow-lg"
          >
            {/* User info header */}
            <div className="flex items-center gap-2.5 px-3 py-3">
              <div
                className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={{ background: "var(--navy)" }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-none text-[var(--navy)]">
                  {displayName}
                </p>
                {roleLabel && (
                  <p className="mt-[3px] text-[11px] leading-none text-[var(--text3)]">
                    {roleLabel}
                  </p>
                )}
                {userData.email && (
                  <p className="mt-[2px] truncate text-[11px] text-[var(--text3)]">
                    {userData.email}
                  </p>
                )}
              </div>
            </div>

            <div className="h-px bg-[var(--border)]" />

            {/* Role-gated nav items */}
            {(isSalesRep(role) || isAdmin(role)) && (
              <div className="p-1">
                {isSalesRep(role) && (
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/tasks")}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-[7px] px-3 py-2 text-[13px] font-medium text-[var(--navy)] transition hover:bg-[var(--bg)]"
                  >
                    <CheckSquare className="h-4 w-4 shrink-0" />
                    Tasks
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate("/dashboard/onboarding")}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-[7px] px-3 py-2 text-[13px] font-medium text-[var(--navy)] transition hover:bg-[var(--bg)]"
                >
                  <UserPlus className="h-4 w-4 shrink-0" />
                  Onboarding
                </button>
              </div>
            )}

            <div className="h-px bg-[var(--border)]" />

            {/* Settings */}
            <div className="p-1">
              <button
                type="button"
                onClick={() => navigate("/dashboard/settings")}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-[7px] px-3 py-2 text-[13px] font-medium text-[var(--navy)] transition hover:bg-[var(--bg)]"
              >
                <Settings className="h-4 w-4 shrink-0" />
                Settings
              </button>
            </div>

            <div className="h-px bg-[var(--border)]" />

            {/* Sign out */}
            <div className="p-1">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-[7px] px-3 py-2 text-[13px] font-medium text-[#dc2626] transition hover:bg-[#fef2f2]"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sign out
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
