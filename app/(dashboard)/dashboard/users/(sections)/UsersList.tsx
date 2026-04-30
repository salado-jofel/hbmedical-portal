"use client";

import { useMemo, useState, useTransition } from "react";
import { UserPlus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { deactivateUser, reactivateUser, deleteUser, resendInvite } from "@/app/(dashboard)/dashboard/users/(services)/actions";
import { adminResetProviderPin } from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import { adminUnenrollUserMfa } from "@/app/(dashboard)/dashboard/settings/(services)/mfa-actions";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { updateUserInStore, removeUserFromStore } from "@/app/(dashboard)/dashboard/users/(redux)/users-slice";
import { CreateUserModal } from "../(components)/CreateUserModal";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { DataTable } from "@/app/(components)/DataTable";
import { UserRowActions, ROLE_COLORS, STATUS_CONFIG } from "../(components)/UserRow";
import { UsersFilters } from "../(components)/UsersFilters";
import { PageHeader } from "@/app/(components)/PageHeader";
import type { StatusFilter } from "@/utils/interfaces/users";
import type { TableColumn } from "@/utils/interfaces/table-column";
import type { UserRole } from "@/utils/helpers/role";
import { ROLE_LABELS } from "@/utils/helpers/role";
import { useTableRealtimeRefresh } from "@/utils/hooks/useOrderRealtime";
import { useListParams } from "@/utils/hooks/useListParams";
import { useBriefBusy } from "@/utils/hooks/useBriefBusy";
import { Pagination } from "@/app/(components)/Pagination";
import { SortableHeader } from "@/app/(components)/SortableHeader";
import { TableBusyBar } from "@/app/(components)/TableBusyBar";
import { USER_SORT_COLUMNS } from "@/utils/constants/users-list";
import { pageToRange } from "@/utils/interfaces/paginated";
import { cn } from "@/utils/utils";

export function UsersList() {
  const dispatch = useAppDispatch();
  const users = useAppSelector((s) => s.users.items);

  // Search is ephemeral (can contain a patient-facing user's name, so keep
  // out of URL).
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [resetPinUserId, setResetPinUserId] = useState<string | null>(null);
  const [resetMfaUserId, setResetMfaUserId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Live user list — reflects invites, status changes, role edits from
  // other admins (or from the user completing setup themselves).
  useTableRealtimeRefresh("profiles");

  // URL-backed list params. Stats row below reads Redux's full list, so it
  // always reflects the global totals regardless of pagination.
  const listParams = useListParams<
    typeof USER_SORT_COLUMNS,
    readonly ["role", "status"]
  >({
    defaultSort: "created_at",
    defaultDir: "desc",
    allowedSorts: USER_SORT_COLUMNS,
    filterKeys: ["role", "status"] as const,
  });

  const roleFilter = listParams.filters.role ?? "all";
  const statusFilter = (listParams.filters.status as StatusFilter | null) ?? "all";
  const setRoleFilter = (v: string) =>
    listParams.setFilter("role", v === "all" ? null : v);
  const setStatusFilter = (v: StatusFilter) =>
    listParams.setFilter("status", v === "all" ? null : v);

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === "active").length,
      pending: users.filter((u) => u.status === "pending").length,
      inactive: users.filter((u) => u.status === "inactive").length,
    }),
    [users],
  );

  const filtered = useMemo(() => {
    let result = users;
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter(
        (u) =>
          u.first_name.toLowerCase().includes(term) ||
          u.last_name.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term),
      );
    }
    if (roleFilter !== "all") result = result.filter((u) => u.role === roleFilter);
    if (statusFilter !== "all")
      result = result.filter((u) => u.status === statusFilter);
    return result;
  }, [users, search, roleFilter, statusFilter]);

  // Apply sort (client-side — same rationale as Accounts: full-list stats
  // require hydrating everything, so paginating in-memory is a wash).
  const sorted = useMemo(() => {
    const asc = listParams.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let primary = 0;
      switch (listParams.sort) {
        case "first_name":
          primary =
            `${a.first_name} ${a.last_name}`.localeCompare(
              `${b.first_name} ${b.last_name}`,
            ) * asc;
          break;
        case "role":
          primary = (a.role ?? "").localeCompare(b.role ?? "") * asc;
          break;
        case "status":
          primary = (a.status ?? "").localeCompare(b.status ?? "") * asc;
          break;
        case "created_at":
          primary =
            (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) *
            asc;
          break;
      }
      return primary !== 0
        ? primary
        : `${a.first_name} ${a.last_name}`.localeCompare(
            `${b.first_name} ${b.last_name}`,
          );
    });
  }, [filtered, listParams.sort, listParams.dir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / listParams.pageSize));
  const clampedPage = Math.min(listParams.page, pageCount);
  const { from, to } = pageToRange(clampedPage, listParams.pageSize);
  const pageRows = sorted.slice(from, to + 1);

  // listParams.isPending fires synchronously on click; search busy covers
  // the non-URL-backed input.
  const searchBusy = useBriefBusy([search], 250);
  const isBusy = listParams.isPending || searchBusy;

  function handleDeactivate(userId: string) {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    setPendingId(userId);
    startTransition(async () => {
      try {
        await deactivateUser(userId);
        dispatch(updateUserInStore({ ...user, is_active: false, status: "inactive" }));
        toast.success("User deactivated.");
      } catch {
        toast.error("Failed to deactivate user.");
      } finally {
        setPendingId(null);
      }
    });
  }

  function handleReactivate(userId: string) {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    setPendingId(userId);
    startTransition(async () => {
      try {
        await reactivateUser(userId);
        dispatch(updateUserInStore({ ...user, is_active: true, status: "active" }));
        toast.success("User reactivated.");
      } catch {
        toast.error("Failed to reactivate user.");
      } finally {
        setPendingId(null);
      }
    });
  }

  function handleDelete(userId: string) {
    setPendingId(userId);
    startTransition(async () => {
      try {
        const result = await deleteUser(userId);
        if (!result.success) {
          toast.error(result.error ?? "Failed to delete user.");
          return;
        }
        dispatch(removeUserFromStore(userId));
        if (result.warning) {
          // Long-duration warning toast — user was deleted but a side effect
          // (e.g. orphan Stripe Connect account) needs admin attention.
          toast(result.warning, {
            duration: 15000,
            icon: "⚠️",
            style: { border: "1px solid #f59e0b", background: "#fffbeb", color: "#78350f" },
          });
        } else {
          toast.success("User deleted.");
        }
        setDeleteConfirmId(null);
      } catch {
        toast.error("Failed to delete user.");
      } finally {
        setPendingId(null);
      }
    });
  }

  async function handleResendInvite(user: (typeof users)[number]) {
    setLoadingId(user.id);
    try {
      const result = await resendInvite(user.id, user.email, user.first_name, user.role);
      if (result.success) {
        toast.success("Invite resent.");
      } else {
        toast.error(result.error ?? "Failed to resend invite.");
      }
    } catch {
      toast.error("Failed to resend invite.");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleResetPin(userId: string) {
    setPendingId(userId);
    try {
      const result = await adminResetProviderPin(userId);
      if (result.success) {
        toast.success("PIN reset. Provider will set a new PIN on their next signing.");
      } else {
        toast.error(result.error ?? "Failed to reset PIN.");
      }
    } catch {
      toast.error("Failed to reset PIN.");
    } finally {
      setPendingId(null);
      setResetPinUserId(null);
    }
  }

  async function handleResetMfa(userId: string) {
    setPendingId(userId);
    try {
      const result = await adminUnenrollUserMfa(userId);
      if (result.success) {
        toast.success(
          "MFA reset. The user will set up a new authenticator on their next sign-in.",
        );
      } else {
        toast.error(result.error ?? "Failed to reset MFA.");
      }
    } catch {
      toast.error("Failed to reset MFA.");
    } finally {
      setPendingId(null);
      setResetMfaUserId(null);
    }
  }

  // Columns are now inlined in the <tbody> render below (needed for sortable
  // headers wired to useListParams). Keeping the helpers that compose a cell.
  function renderUserCell(user: (typeof users)[number]) {
    const isPendingSetup = user.first_name === "Pending" && user.last_name === "Setup";
    const displayName = isPendingSetup ? user.email : `${user.first_name} ${user.last_name}`;
    const initials = isPendingSetup
      ? (user.email?.[0] ?? "U").toUpperCase()
      : `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
    const colors = ROLE_COLORS[user.role as NonNullable<UserRole>] ?? ROLE_COLORS.clinical_staff;
    return (
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colors.bg}`}>
          <span className={`text-xs font-semibold ${colors.text}`}>{initials}</span>
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-medium truncate ${user.is_active ? "text-[var(--navy)]" : "text-[var(--text3)]"}`}>
            {displayName}
          </p>
          <p className="text-xs text-[var(--text3)] truncate">
            {user.facility?.name ?? <span className="italic">No facility</span>}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <PageHeader
        title="Users"
        subtitle="Check and manage all HB Medical portal users"
        action={
          <Button
            size="sm"
            className="h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white gap-1.5 shrink-0 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors"
            onClick={() => setShowCreate(true)}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Create User
          </Button>
        }
      />

      <UsersFilters
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        stats={stats}
        search={search}
        onSearchChange={setSearch}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
      />

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
        <TableBusyBar busy={isBusy} />
        {pageRows.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-[var(--text3)]">
            No users found
          </div>
        ) : (
          <div className={cn("overflow-x-auto transition-opacity", isBusy && "opacity-70")}>
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-[var(--bg)] border-b border-[var(--border)]">
                  <th className="px-4 py-[9px] pl-11">
                    <SortableHeader
                      label="User"
                      column="first_name"
                      currentSort={listParams.sort}
                      currentDir={listParams.dir}
                      onToggle={(c) =>
                        listParams.toggleSort(
                          c as typeof USER_SORT_COLUMNS[number],
                        )
                      }
                    />
                  </th>
                  <th className="px-4 py-[9px] text-[10px] uppercase tracking-[0.6px] font-semibold text-[var(--text3)] hidden sm:table-cell">
                    Email
                  </th>
                  <th className="px-4 py-[9px]">
                    <SortableHeader
                      label="Role"
                      column="role"
                      currentSort={listParams.sort}
                      currentDir={listParams.dir}
                      onToggle={(c) =>
                        listParams.toggleSort(
                          c as typeof USER_SORT_COLUMNS[number],
                        )
                      }
                    />
                  </th>
                  <th className="px-4 py-[9px] hidden sm:table-cell">
                    <SortableHeader
                      label="Status"
                      column="status"
                      currentSort={listParams.sort}
                      currentDir={listParams.dir}
                      onToggle={(c) =>
                        listParams.toggleSort(
                          c as typeof USER_SORT_COLUMNS[number],
                        )
                      }
                    />
                  </th>
                  <th className="px-4 py-[9px] text-right text-[10px] uppercase tracking-[0.6px] font-semibold text-[var(--text3)]"></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((user) => {
                  const roleColors =
                    ROLE_COLORS[user.role as NonNullable<UserRole>] ??
                    ROLE_COLORS.clinical_staff;
                  const roleLabel =
                    ROLE_LABELS[user.role as NonNullable<UserRole>] ?? user.role;
                  const statusCfg =
                    STATUS_CONFIG[user.status] ?? STATUS_CONFIG.inactive;
                  return (
                    <tr
                      key={user.id}
                      className="group border-b border-[var(--border)] last:border-0"
                    >
                      <td className="px-4 py-2.5 pl-4">{renderUserCell(user)}</td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <span className="text-sm text-[var(--text2)]">
                          {user.email}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${roleColors.bg} ${roleColors.text}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${roleColors.dot}`}
                          />
                          {roleLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`}
                          />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <UserRowActions
                          user={user}
                          pendingId={pendingId}
                          loadingId={loadingId}
                          onDeactivate={handleDeactivate}
                          onReactivate={handleReactivate}
                          onResendInvite={handleResendInvite}
                          onDeleteClick={setDeleteConfirmId}
                          onResetPin={(u) => setResetPinUserId(u.id)}
                          onResetMfa={(u) => setResetMfaUserId(u.id)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={clampedPage}
          pageSize={listParams.pageSize}
          total={sorted.length}
          onPageChange={listParams.setPage}
          onPageSizeChange={listParams.setPageSize}
        />
      </div>

      <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} />

      <ConfirmModal
        open={deleteConfirmId !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
        title="Delete User?"
        description="This will permanently remove this user and all their associated data. This action cannot be undone."
        confirmLabel="Delete User"
        isLoading={pendingId === deleteConfirmId && deleteConfirmId !== null}
        onConfirm={() => { if (deleteConfirmId) handleDelete(deleteConfirmId); }}
      />

      <ConfirmModal
        open={resetPinUserId !== null}
        onOpenChange={(open) => { if (!open) setResetPinUserId(null); }}
        title="Reset provider PIN?"
        description="This will clear this provider's signing PIN. They'll be prompted to set a new one the next time they sign an order. An email notification will be sent to them."
        confirmLabel="Reset PIN"
        isLoading={pendingId === resetPinUserId && resetPinUserId !== null}
        onConfirm={() => { if (resetPinUserId) handleResetPin(resetPinUserId); }}
      />

      <ConfirmModal
        open={resetMfaUserId !== null}
        onOpenChange={(open) => { if (!open) setResetMfaUserId(null); }}
        title="Reset two-factor authentication?"
        description="This wipes ALL of the user's authenticator factors AND every backup recovery code, signs out every active session they have, and forces them to set up MFA from scratch on next sign-in. Use only when the user has lost their authenticator AND their backup codes. This action is logged to the audit trail."
        confirmLabel="Reset MFA"
        isLoading={pendingId === resetMfaUserId && resetMfaUserId !== null}
        onConfirm={() => { if (resetMfaUserId) handleResetMfa(resetMfaUserId); }}
      />
    </div>
  );
}
