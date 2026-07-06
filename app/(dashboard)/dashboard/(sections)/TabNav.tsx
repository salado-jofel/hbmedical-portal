"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { cn } from "@/utils/utils";
import type { UserRole } from "@/utils/helpers/role";
import { isSalesRep } from "@/utils/helpers/role";
import { NAV_GROUPS } from "./Sidebar";
import { ChevronDown, Menu } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Dashboard-wide top navigation. Two rendering modes, hard-swapped by
 * viewport width so each mode can be optimized for its ergonomics:
 *
 *   - < md (mobile / small tablet): a single "menu button" shows the
 *     current tab; tapping opens a full-width popover with every visible
 *     nav item stacked vertically. Cleaner than horizontal-scroll on a
 *     phone, and works with one thumb.
 *
 *   - >= md (tablet / desktop): the horizontal scrollable tab bar. Items
 *     take intrinsic width, container scrolls when they overflow the row,
 *     scroll-shadow gradients appear on either side only while there's
 *     more content in that direction, and the active tab auto-scrolls
 *     into view on route change.
 *
 * Roles with a short nav (rep, provider, clinic) never need to scroll on
 * desktop; admin/support who have 11+ items get the scroll UI.
 */
export function TabNav() {
  const pathname = usePathname();
  const role = useAppSelector((state) => state.dashboard.role) as UserRole;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Flatten NAV_GROUPS → items visible to this role (Settings/Profile
  // live in the avatar dropdown, Tasks/Onboarding are excluded here to
  // match the pre-existing behavior).
  const visibleItems = useMemo(
    () =>
      NAV_GROUPS.flatMap((group) =>
        group.items.filter((item) => role && item.visible(role)),
      ).filter(
        (item) =>
          item.href !== "/dashboard/settings" &&
          item.href !== "/dashboard/tasks" &&
          item.href !== "/dashboard/onboarding",
      ),
    [role],
  );

  // Resolve display label — reused between mobile and desktop.
  function labelFor(item: (typeof visibleItems)[number]): string {
    if (item.href === "/dashboard/rep-performance") {
      return isSalesRep(role) ? "My Performance" : "Rep Performance";
    }
    return item.label;
  }

  const activeItem = visibleItems.find((i) => isActive(i.href, pathname));

  // Measure horizontal overflow so the scroll-shadow indicators only
  // appear when they actually mean something.
  useEffect(() => {
    if (!mounted) return;
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => {
      const canScrollLeft = el.scrollLeft > 4;
      const canScrollRight =
        el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      setOverflow({ left: canScrollLeft, right: canScrollRight });
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [mounted, visibleItems.length]);

  // Auto-scroll the active tab into view on route change — supports the
  // deep-link case where you land on `/dashboard/transfers-of-value` and
  // the tab is off-screen for admin.
  useEffect(() => {
    if (!mounted) return;
    const el = scrollerRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLAnchorElement>('[data-active="true"]');
    active?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "smooth",
    });
  }, [mounted, pathname]);

  // SSR-safe placeholder — matches roughly-the-same height so the sticky
  // header doesn't reflow when hydration finishes populating the tabs.
  if (!mounted) {
    return (
      <div
        className="mb-5 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-1"
        style={{ minHeight: 40 }}
      />
    );
  }

  if (visibleItems.length === 0) return null;

  return (
    <div className="mb-5">
      {/* ── Mobile (< md): collapsed dropdown ────────────────────── */}
      <div className="md:hidden">
        <Popover open={mobileOpen} onOpenChange={setMobileOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Open navigation menu"
              className={cn(
                "w-full flex items-center justify-between gap-2",
                "rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]",
                "px-3 py-2.5 text-[13px] font-medium text-[var(--text)]",
                "hover:bg-[var(--bg)] transition-colors",
              )}
            >
              <span className="flex items-center gap-2 min-w-0">
                {activeItem ? (
                  <activeItem.icon
                    className="h-4 w-4 shrink-0 text-[var(--navy)]"
                    strokeWidth={1.8}
                  />
                ) : (
                  <Menu
                    className="h-4 w-4 shrink-0 text-[var(--navy)]"
                    strokeWidth={1.8}
                  />
                )}
                <span className="truncate">
                  {activeItem ? labelFor(activeItem) : "Menu"}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-[var(--text3)] transition-transform",
                  mobileOpen && "rotate-180",
                )}
              />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={6}
            collisionPadding={12}
            // Solid background + border + shadow because the shared
            // PopoverContent primitive is transparent by default (it
            // just sets z-50 + open/close animations). Without these
            // the nav items float over the page as unreadable text.
            // z-[70] beats the sticky header (z-50) so the popover
            // sits ABOVE it instead of being clipped.
            className={cn(
              "z-[70]",
              "w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-16px)]",
              "max-h-[min(70vh,480px)] overflow-y-auto",
              "rounded-[var(--r)] border border-[var(--border)]",
              "bg-white shadow-lg p-1",
            )}
          >
            <ul className="flex flex-col">
              {visibleItems.map((item) => {
                const active = isActive(item.href, pathname);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-[6px] px-3 py-2.5 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-[var(--navy)] text-white"
                          : "text-[var(--text)] hover:bg-[var(--bg)]",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                      <span className="truncate">{labelFor(item)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
      </div>

      {/* ── Tablet + Desktop (>= md): horizontal scroll bar ────── */}
      <div className="hidden md:block relative">
        {overflow.left && (
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-6 z-10 pointer-events-none rounded-l-[var(--r)]"
            style={{
              background:
                "linear-gradient(to right, var(--surface), rgba(255,255,255,0))",
            }}
          />
        )}
        {overflow.right && (
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 w-6 z-10 pointer-events-none rounded-r-[var(--r)]"
            style={{
              background:
                "linear-gradient(to left, var(--surface), rgba(255,255,255,0))",
            }}
          />
        )}
        <div
          ref={scrollerRef}
          className={cn(
            "no-scrollbar rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-1",
            "flex items-center gap-[3px] overflow-x-auto",
          )}
          style={
            {
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
            } as React.CSSProperties
          }
        >
          {visibleItems.map((item) => {
            const active = isActive(item.href, pathname);
            const Icon = item.icon;
            const label = labelFor(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active}
                title={label}
                // flex-1 → items GROW to fill leftover space evenly, so
                //   the row is centrally distributed when there's slack.
                // min-w-max → items never SHRINK below their intrinsic
                //   width, which is what caused the old label-clipping
                //   bug (e.g. "Rep Performanc"). When the total exceeds
                //   the container, the parent's overflow-x-auto kicks
                //   in and the row becomes horizontally scrollable.
                className={cn(
                  "flex-1 min-w-max inline-flex items-center justify-center gap-1.5",
                  "whitespace-nowrap rounded-[7px] transition-colors duration-150",
                  "px-3 py-[7px] text-[12px] font-medium",
                  active
                    ? "bg-[var(--navy)] text-white"
                    : "text-[var(--text2)] hover:bg-[var(--bg)]",
                )}
              >
                <Icon
                  className="h-[14px] w-[14px] shrink-0"
                  strokeWidth={1.8}
                  aria-hidden
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
