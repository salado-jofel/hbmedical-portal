"use client";

import { useMemo, useState, useTransition } from "react";
import { UserPlus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { deactivateUser, reactivateUser, deleteUser, resendInvite } from "@/app/(dashboard)/dashboard/users/(services)/actions";
import { adminResetProviderPin } from "@/app/(dashboard)/dashboard/settings/(services)/actions";
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

export function UsersList() {
  const dispatch = useAppDispatch();
  const users = useAppSelector((s) => s.users.items);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [resetPinUserId, setResetPinUserId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

  const columns: TableColumn<(typeof users)[number]>[] = [
    {
      key: "user",
      label: "User",
      headerClassName: "pl-11",
      render: (user) => {
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
      },
    },
    {
      key: "email",
      label: "Email",
      headerClassName: "hidden sm:table-cell",
      cellClassName: "hidden sm:table-cell",
      render: (user) => (
        <span className="text-sm text-[var(--text2)]">{user.email}</span>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (user) => {
        const colors = ROLE_COLORS[user.role as NonNullable<UserRole>] ?? ROLE_COLORS.clinical_staff;
        const roleLabel = ROLE_LABELS[user.role as NonNullable<UserRole>] ?? user.role;
        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
            {roleLabel}
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      headerClassName: "hidden sm:table-cell",
      cellClassName: "hidden sm:table-cell",
      render: (user) => {
        const cfg = STATUS_CONFIG[user.status] ?? STATUS_CONFIG.inactive;
        return (
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: "action",
      label: "",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (user) => (
        <UserRowActions
          user={user}
          pendingId={pendingId}
          loadingId={loadingId}
          onDeactivate={handleDeactivate}
          onReactivate={handleReactivate}
          onResendInvite={handleResendInvite}
          onDeleteClick={setDeleteConfirmId}
          onResetPin={(u) => setResetPinUserId(u.id)}
        />
      ),
    },
  ];

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
        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(u) => u.id}
          emptyMessage="No users found"
          emptyIcon={<User className="w-10 h-10 stroke-1" />}
          rowNumbered
          rowClassName="group"
        />
      </div>

      <p className="text-xs text-[var(--text3)] text-right">
        {filtered.length} of {users.length} user{users.length !== 1 ? "s" : ""}
      </p>

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
    </div>
  );
}
