"use client";

import { useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Search, UserPlus, UserX, UserCheck, User } from "lucide-react";
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
import { staggerContainer, fadeUp } from "@/components/ui/animations";
import { ROLE_LABELS } from "@/utils/helpers/role";
import { deactivateUser, reactivateUser } from "@/app/(dashboard)/dashboard/users/(services)/actions";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { updateUserInStore } from "@/app/(dashboard)/dashboard/users/(redux)/users-slice";
import { CreateUserModal } from "../(components)/CreateUserModal";
import { EmptyState } from "@/app/(components)/EmptyState";
import type { UserRole } from "@/utils/helpers/role";

const ROLE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All roles" },
  { value: "sales_representative", label: "Sales Rep" },
  { value: "support_staff", label: "Support Staff" },
  { value: "clinical_provider", label: "Clinical Provider" },
  { value: "clinical_staff", label: "Clinical Staff" },
];

const ROLE_COLORS: Record<
  NonNullable<UserRole>,
  { bg: string; text: string; dot: string; avatarFrom: string; avatarTo: string }
> = {
  admin: {
    bg: "bg-[#15689E]/10",
    text: "text-[#15689E]",
    dot: "bg-[#15689E]",
    avatarFrom: "from-[#15689E]/20",
    avatarTo: "to-[#15689E]/10",
  },
  sales_representative: {
    bg: "bg-orange-100",
    text: "text-[#e8821a]",
    dot: "bg-[#e8821a]",
    avatarFrom: "from-orange-200",
    avatarTo: "to-orange-100",
  },
  support_staff: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    dot: "bg-purple-500",
    avatarFrom: "from-purple-200",
    avatarTo: "to-purple-100",
  },
  clinical_provider: {
    bg: "bg-teal-100",
    text: "text-teal-700",
    dot: "bg-teal-500",
    avatarFrom: "from-teal-200",
    avatarTo: "to-teal-100",
  },
  clinical_staff: {
    bg: "bg-[#F1F5F9]",
    text: "text-[#64748B]",
    dot: "bg-[#94A3B8]",
    avatarFrom: "from-[#E2E8F0]",
    avatarTo: "to-[#F1F5F9]",
  },
};

type StatusFilter = "all" | "active" | "inactive";

export function UsersPageClient() {
  const dispatch = useAppDispatch();
  const users = useAppSelector((s) => s.users.items);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.is_active).length,
      inactive: users.filter((u) => !u.is_active).length,
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
    if (roleFilter !== "all") {
      result = result.filter((u) => u.role === roleFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((u) =>
        statusFilter === "active" ? u.is_active : !u.is_active,
      );
    }
    return result;
  }, [users, search, roleFilter, statusFilter]);

  function handleDeactivate(userId: string) {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    setPendingId(userId);
    startTransition(async () => {
      try {
        await deactivateUser(userId);
        dispatch(updateUserInStore({ ...user, is_active: false }));
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
        dispatch(updateUserInStore({ ...user, is_active: true }));
        toast.success("User reactivated.");
      } catch {
        toast.error("Failed to reactivate user.");
      } finally {
        setPendingId(null);
      }
    });
  }

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

      {/* ── Top bar: status filter chips ── */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: "all", label: "All Users", count: stats.total },
            { key: "active", label: "Active", count: stats.active },
            { key: "inactive", label: "Inactive", count: stats.inactive },
          ] as const
        ).map(({ key, label, count }) => {
          const isActive = statusFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "text-[#15689E] border-b-2 border-[#15689E]"
                  : "text-[#94A3B8] hover:text-[#64748B]"
              }`}
            >
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isActive ? "bg-[#EFF6FF] text-[#15689E]" : "bg-[#F1F5F9] text-[#64748B]"}`}>
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
      {filtered.length === 0 ? (
        <EmptyState
          icon={<User className="w-10 h-10 stroke-1" />}
          message="No users found"
        />
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          {/* Column headers */}
          <div className="grid grid-cols-[28px_2fr_1fr_auto] sm:grid-cols-[28px_2.5fr_2fr_1.3fr_1fr_auto] px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">#</span>
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">User</span>
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider hidden sm:block">Email</span>
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Role</span>
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider hidden sm:block">Status</span>
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider text-right">Action</span>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {filtered.map((user, index) => {
              const initials =
                `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
              const colors =
                ROLE_COLORS[user.role as NonNullable<UserRole>] ??
                ROLE_COLORS.clinical_staff;
              const roleLabel =
                ROLE_LABELS[user.role as NonNullable<UserRole>] ?? user.role;
              const isActing = pendingId === user.id;

              return (
                <motion.div
                  key={user.id}
                  variants={fadeUp}
                  className="grid grid-cols-[28px_2fr_1fr_auto] sm:grid-cols-[28px_2.5fr_2fr_1.3fr_1fr_auto] items-center px-4 py-3.5 border-b border-[#F1F5F9] last:border-0 hover:bg-[#FAFBFC] transition-colors group"
                >
                  {/* Row number */}
                  <span className="text-xs font-medium text-[#94A3B8] select-none">
                    {index + 1}
                  </span>

                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colors.bg}`}
                    >
                      <span className={`text-xs font-semibold ${colors.text}`}>
                        {initials}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          user.is_active ? "text-[#0F172A]" : "text-[#94A3B8]"
                        }`}
                      >
                        {user.first_name} {user.last_name}
                      </p>
                      {user.facility ? (
                        <p className="text-xs text-[#94A3B8] truncate">
                          {user.facility.name}
                        </p>
                      ) : (
                        <p className="text-xs text-[#94A3B8] truncate italic">
                          No facility
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div className="hidden sm:block min-w-0">
                    <p className="text-sm text-[#64748B] truncate">{user.email}</p>
                  </div>

                  {/* Role badge */}
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                    >
                      {roleLabel}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="hidden sm:block">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-[#F1F5F9] text-[#64748B]"
                      }`}
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Action — revealed on row hover */}
                  <div className="flex items-center justify-end">
                    {user.is_active ? (
                      <button
                        type="button"
                        onClick={() => handleDeactivate(user.id)}
                        disabled={isActing}
                        className="h-7 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium text-[#64748B] hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 opacity-0 group-hover:opacity-100"
                        title="Deactivate user"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Deactivate</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleReactivate(user.id)}
                        disabled={isActing}
                        className="h-7 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium text-[#64748B] hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40 opacity-0 group-hover:opacity-100"
                        title="Reactivate user"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Reactivate</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}

      <p className="text-xs text-[#94A3B8] text-right">
        {filtered.length} of {users.length} user{users.length !== 1 ? "s" : ""}
      </p>

      <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
