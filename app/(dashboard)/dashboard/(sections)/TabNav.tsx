"use client";

import { useEffect, useMemo, useState } from "react";
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

/**
 * Grouped top nav (Option A design, 2026-08-01):
 *
 *   Dashboard    Work ▾    Directory ▾    Catalog ▾    Reports ▾   Compliance ▾
 *
 * Previously we flattened every NAV_GROUPS item into a single horizontal
 * strip and let it overflow-scroll. That worked with 5-6 items but hit
 * ~12 items after the fax + IVR features shipped, and users on 1400px
 * screens saw the first tab clipped ("board" instead of "Dashboard").
 *
 * The new layout keeps the shared NAV_GROUPS definition as the source
 * of truth, but renders groups as top-level buttons:
 *   - group with 0 visible items → hidden entirely
 *   - group with 1 visible item  → direct link, shows the ITEM label + icon
 *   - group with 2+ visible items → Popover-dropdown, shows the GROUP label
 *
 * Mobile (<md) collapses everything into a single "Menu" button that
 * opens the full flat list — same behavior as the previous mobile mode.
 */

function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

// Friendlier top-nav labels for multi-item groups. Keys match the
// `label` field in NAV_GROUPS; groups not listed here fall back to the
// original label. Single-item groups always use the item's own label
// (so "Overview" → "Dashboard") regardless of this map.
const GROUP_DISPLAY: Record<string, string> = {
  Clinic: "Work",
  Management: "Directory",
  Sales: "Reports",
};

// Items that live outside the tab bar entirely (they're in the avatar
// menu, or role-gated pages we don't want cluttering the nav). Same
// list the old TabNav filtered.
const EXCLUDED_HREFS = new Set<string>([
  "/dashboard/settings",
  "/dashboard/tasks",
  "/dashboard/onboarding",
]);

export function TabNav() {
  const pathname = usePathname();
  const role = useAppSelector((state) => state.dashboard.role) as UserRole;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  // Resolve display label for an item (rep-performance renames per role).
  function labelFor(href: string, label: string): string {
    if (href === "/dashboard/rep-performance") {
      return isSalesRep(role) ? "My Performance" : "Rep Performance";
    }
    return label;
  }

  // Filter every group by role visibility + excluded hrefs. Groups where
  // no items are visible drop out entirely.
  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          role && item.visible(role) && !EXCLUDED_HREFS.has(item.href),
      ),
    })).filter((group) => group.items.length > 0);
  }, [role]);

  // Flat list for the mobile menu (all visible items, no grouping).
  const flatVisibleItems = useMemo(
    () => visibleGroups.flatMap((g) => g.items),
    [visibleGroups],
  );

  const activeFlatItem = flatVisibleItems.find((i) => isActive(i.href, pathname));

  // Close any open dropdown when the route changes.
  useEffect(() => {
    setOpenGroup(null);
  }, [pathname]);

  // SSR-safe placeholder — the role comes from Redux and isn't populated
  // until after hydration. Keeps a stable header height during first
  // paint so the sticky nav doesn't reflow.
  if (!mounted) {
    return (
      <div
        className="mb-5 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-1"
        style={{ minHeight: 40 }}
      />
    );
  }

  if (visibleGroups.length === 0) return null;

  return (
    <div className="mb-5">
      {/* ── Mobile (<md): single collapsed menu button ───────────── */}
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
                {activeFlatItem ? (
                  <activeFlatItem.icon
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
                  {activeFlatItem
                    ? labelFor(activeFlatItem.href, activeFlatItem.label)
                    : "Menu"}
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
            className={cn(
              "z-[70]",
              "w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-16px)]",
              "max-h-[min(70vh,480px)] overflow-y-auto",
              "rounded-[var(--r)] border border-[var(--border)]",
              "bg-white shadow-lg p-1",
            )}
          >
            {visibleGroups.map((group) => (
              <div key={group.label} className="mb-1 last:mb-0">
                <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)]">
                  {group.label}
                </div>
                <ul className="flex flex-col">
                  {group.items.map((item) => {
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
                          <Icon
                            className="h-4 w-4 shrink-0"
                            strokeWidth={1.8}
                          />
                          <span className="truncate">
                            {labelFor(item.href, item.label)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* ── Tablet + Desktop (md+): grouped tabs ─────────────────────
          Layout: each top-level button gets `flex-1` so they share the
          bar's width equally. `min-w-max` stops long labels from
          getting truncated when the total would need to shrink below
          their intrinsic widths — in that case the row grows past the
          container and, in extreme cases, the whole thing would scroll
          (unlikely with 5–6 groups even on small tablets).
          `justify-center` centers each tab's label + chevron inside
          its allocated slot so a wider slot doesn't look off-balance. */}
      <div
        className={cn(
          "hidden md:flex items-stretch gap-1",
          "rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-1",
        )}
      >
        {visibleGroups.map((group) => {
          // Single-item group → render as a direct link showing the
          // item's own label + icon. Skips the dropdown noise for
          // things like Dashboard.
          if (group.items.length === 1) {
            const item = group.items[0];
            const Icon = item.icon;
            const active = isActive(item.href, pathname);
            const label = labelFor(item.href, item.label);
            return (
              <Link
                key={group.label}
                href={item.href}
                title={label}
                className={cn(
                  "flex-1 min-w-max inline-flex items-center justify-center gap-1.5",
                  "whitespace-nowrap rounded-[7px] px-3 py-[7px]",
                  "text-[12.5px] font-medium transition-colors duration-150",
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
          }

          // Multi-item group → dropdown. Highlight the whole button
          // when any child is active so the user sees where they are.
          const groupLabel = GROUP_DISPLAY[group.label] ?? group.label;
          const anyChildActive = group.items.some((i) =>
            isActive(i.href, pathname),
          );
          const isOpen = openGroup === group.label;
          return (
            <Popover
              key={group.label}
              open={isOpen}
              onOpenChange={(next) => setOpenGroup(next ? group.label : null)}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex-1 min-w-max inline-flex items-center justify-center gap-1.5",
                    "whitespace-nowrap rounded-[7px] px-3 py-[7px]",
                    "text-[12.5px] font-medium transition-colors duration-150",
                    anyChildActive
                      ? "bg-[var(--navy)] text-white"
                      : "text-[var(--text2)] hover:bg-[var(--bg)]",
                  )}
                >
                  <span>{groupLabel}</span>
                  <ChevronDown
                    className={cn(
                      "h-[13px] w-[13px] shrink-0 transition-transform",
                      isOpen && "rotate-180",
                      anyChildActive ? "opacity-90" : "opacity-70",
                    )}
                    strokeWidth={2}
                    aria-hidden
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                collisionPadding={12}
                className={cn(
                  "z-[70] min-w-[220px] max-w-[calc(100vw-16px)]",
                  "rounded-[var(--r)] border border-[var(--border)]",
                  "bg-white shadow-lg p-1",
                )}
              >
                <ul className="flex flex-col">
                  {group.items.map((item) => {
                    const active = isActive(item.href, pathname);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpenGroup(null)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-[6px]",
                            "px-3 py-2 text-[13px] font-medium transition-colors",
                            active
                              ? "bg-[var(--navy)] text-white"
                              : "text-[var(--text)] hover:bg-[var(--bg)]",
                          )}
                        >
                          <Icon
                            className="h-4 w-4 shrink-0"
                            strokeWidth={1.8}
                          />
                          <span className="truncate">
                            {labelFor(item.href, item.label)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}
