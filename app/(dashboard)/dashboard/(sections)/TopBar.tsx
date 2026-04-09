"use client";

import { useAppSelector } from "@/store/hooks";
import { HBLogo } from "@/app/(components)/HBLogo";
import { NotificationBell } from "@/app/(dashboard)/(components)/NotificationBell";

export function TopBar() {
  const userData = useAppSelector((state) => state.dashboard);

  const isPendingSetup = !userData.name || userData.name === "Pending Setup";
  const initials = isPendingSetup
    ? (userData.email?.[0] ?? "U").toUpperCase()
    : userData.initials;
  const displayName = isPendingSetup ? (userData.email ?? "User") : userData.name;

  return (
    <div
      className="mb-5 flex items-center justify-between rounded-[12px] px-[14px] py-[10px]"
      style={{ background: "var(--navy)" }}
    >
      {/* ── Left: icon + title ── */}
      <div className="flex items-center gap-[10px]">
        {/* Icon box — text part of HBLogo is hidden */}
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

        {/* User avatar */}
        <div
          className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full text-[12px] font-semibold text-white"
          style={{ background: "rgba(255,255,255,0.2)" }}
          title={displayName}
        >
          {initials}
        </div>
      </div>
    </div>
  );
}
