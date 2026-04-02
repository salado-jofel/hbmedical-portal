"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, UserPlus, UserX, UserCheck, User, Trash2, Mail, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import toast from "react-hot-toast";
import { ROLE_LABELS } from "@/utils/helpers/role";
import { deactivateUser, reactivateUser, deleteUser, resendInvite } from "@/app/(dashboard)/dashboard/users/(services)/actions";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { updateUserInStore, removeUserFromStore } from "@/app/(dashboard)/dashboard/users/(redux)/users-slice";
import { CreateUserModal } from "../(components)/CreateUserModal";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { DataTable } from "@/app/(components)/DataTable";
import type { TableColumn } from "@/utils/interfaces/table-column";
import type { UserRole } from "@/utils/helpers/role";
import type { UserStatus } from "@/utils/interfaces/users";

const ROLE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All roles" },
  { value: "sales_representative", label: "Sales Rep" },
  { value: "support_staff", label: "Support Staff" },
  { value: "clinical_provider", label: "Clinical Provider" },
  { value: "clinical_staff", label: "Clinical Staff" },
];

const ROLE_COLORS: Record<
  NonNullable<UserRole>,
  { bg: string; text: string; dot: string }
> = {
  admin:                { bg: "bg-[#EFF6FF]",    text: "text-[#15689E]",  dot: "bg-[#15689E]"  },
  sales_representative: { bg: "bg-orange-50",    text: "text-orange-600", dot: "bg-orange-400" },
  support_staff:        { bg: "bg-purple-50",    text: "text-purple-700", dot: "bg-purple-400" },
  clinical_provider:    { bg: "bg-teal-50",      text: "text-teal-700",   dot: "bg-teal-400"   },
  clinical_staff:       { bg: "bg-[#F1F5F9]",   text: "text-[#64748B]",  dot: "bg-[#94A3B8]"  },
};

type StatusFilter = "all" | "active" | "pending" | "inactive";

export function UsersPageClient() {
  const dispatch = useAppDispatch();
  const users = useAppSelector((s) => s.users.items);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
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
        toast.success("User deleted.");
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

  // Columns defined inside component to close over pendingId + handlers
  const columns: TableColumn<(typeof users)[number]>[] = [
    {
      key: "user",
      label: "User",
      headerClassName: "pl-11",
      render: (user) => {
        const initials = `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
        const colors = ROLE_COLORS[user.role as NonNullable<UserRole>] ?? ROLE_COLORS.clinical_staff;
        return (
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colors.bg}`}>
              <span className={`text-xs font-semibold ${colors.text}`}>{initials}</span>
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-medium truncate ${user.is_active ? "text-[#0F172A]" : "text-[#94A3B8]"}`}>
                {user.first_name} {user.last_name}
              </p>
              <p className="text-xs text-[#94A3B8] truncate">
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
        <span className="text-sm text-[#64748B]">{user.email}</span>
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
        const STATUS_CONFIG: Record<UserStatus, { bg: string; text: string; dot: string; label: string }> = {
          active:   { bg: "bg-emerald-50",  text: "text-emerald-600", dot: "bg-emerald-500", label: "Active"   },
          pending:  { bg: "bg-amber-50",    text: "text-amber-600",   dot: "bg-amber-500",   label: "Pending"  },
          inactive: { bg: "bg-[#F1F5F9]",   text: "text-gray-500",    dot: "bg-gray-400",    label: "Inactive" },
        };
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
      render: (user) => {
        const isActing = pendingId === user.id;
        const isResending = loadingId === user.id;
        if (user.status === "pending") {
          return (
            <div className="inline-flex items-center gap-1 justify-end">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleResendInvite(user); }}
                disabled={isResending || isActing}
                className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[#15689E] hover:bg-[#EFF6FF] transition-all disabled:opacity-40 opacity-0 group-hover:opacity-100"
                title="Resend invite"
              >
                {isResending
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Mail className="w-3.5 h-3.5" />
                }
                <span className="hidden sm:inline">Resend</span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(user.id); }}
                disabled={isActing || isResending}
                className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-40 opacity-0 group-hover:opacity-100"
                title="Delete user"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        }
        if (user.status === "active") {
          return (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDeactivate(user.id); }}
              disabled={isActing}
              className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-40 opacity-0 group-hover:opacity-100"
              title="Deactivate user"
            >
              <UserX className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Deactivate</span>
            </button>
          );
        }
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleReactivate(user.id); }}
            disabled={isActing}
            className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-[#94A3B8] hover:text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-40 opacity-0 group-hover:opacity-100"
            title="Reactivate user"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reactivate</span>
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 pb-5 mb-6 border-b border-[#E2E8F0]">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Users</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Check and manage all HB Medical portal users</p>
        </div>
        <Button
          size="sm"
          className="h-9 bg-[#15689E] hover:bg-[#125d8e] text-white gap-1.5 shrink-0 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors"
          onClick={() => setShowCreate(true)}
        >
          <UserPlus className="w-3.5 h-3.5" />
          Create User
        </Button>
      </div>

      {/* ── Status filter tabs ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0]">
        {(
          [
            { key: "all",      label: "All Users", count: stats.total    },
            { key: "active",   label: "Active",    count: stats.active   },
            { key: "pending",  label: "Pending",   count: stats.pending  },
            { key: "inactive", label: "Inactive",  count: stats.inactive },
          ] as const
        ).map(({ key, label, count }) => {
          const isActive = statusFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors relative -mb-px ${
                isActive
                  ? "text-[#15689E] border-b-2 border-[#15689E]"
                  : "text-[#94A3B8] hover:text-[#64748B]"
              }`}
            >
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                isActive ? "bg-[#EFF6FF] text-[#15689E]" : "bg-[#F1F5F9] text-[#64748B]"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Search + role filter ── */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] pointer-events-none" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-white border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#15689E] focus:ring-2 focus:ring-[#15689E]/10 transition-colors"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-44 h-9 text-sm bg-white border-[#E2E8F0] rounded-lg text-[#0F172A]">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ── */}
      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={(u) => u.id}
        emptyMessage="No users found"
        emptyIcon={<User className="w-10 h-10 stroke-1" />}
        rowNumbered
        rowClassName="group"
      />

      <p className="text-xs text-[#94A3B8] text-right">
        {filtered.length} of {users.length} user{users.length !== 1 ? "s" : ""}
      </p>

      <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} />

      <ConfirmModal
        open={deleteConfirmId !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
        title="Delete pending user?"
        description="This will permanently delete this user's account. This action cannot be undone."
        confirmLabel="Delete User"
        isLoading={pendingId === deleteConfirmId && deleteConfirmId !== null}
        onConfirm={() => { if (deleteConfirmId) handleDelete(deleteConfirmId); }}
      />
    </div>
  );
}
