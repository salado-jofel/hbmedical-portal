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

const ROLE_BADGE_STYLES: Record<NonNullable<UserRole>, string> = {
  admin: "bg-blue-100 text-blue-700",
  sales_representative: "bg-orange-100 text-orange-700",
  support_staff: "bg-purple-100 text-purple-700",
  clinical_provider: "bg-teal-100 text-teal-700",
  clinical_staff: "bg-slate-100 text-slate-600",
};

export function UsersPageClient() {
  const dispatch = useAppDispatch();
  const users = useAppSelector((s) => s.users.items);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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
    return result;
  }, [users, search, roleFilter]);

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
    <div className="space-y-4">
      {/* ── Filters + Create ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-44 h-9 text-sm">
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

        <Button
          size="sm"
          className="h-9 bg-[#15689E] hover:bg-[#15689E]/90 text-white gap-1.5 shrink-0"
          onClick={() => setShowCreate(true)}
        >
          <UserPlus className="w-3.5 h-3.5" />
          Create User
        </Button>
      </div>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<User className="w-10 h-10 stroke-1" />}
          message="No users found"
        />
      ) : (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[2fr_1fr_auto] sm:grid-cols-[2fr_2fr_1fr_1fr_auto] bg-[#15689E] px-5 py-3">
            <span className="text-xs font-semibold text-white tracking-wide">User</span>
            <span className="text-xs font-semibold text-white tracking-wide hidden sm:block">Email</span>
            <span className="text-xs font-semibold text-white tracking-wide">Role</span>
            <span className="text-xs font-semibold text-white tracking-wide hidden sm:block">Status</span>
            <span className="text-xs font-semibold text-white tracking-wide text-right pl-4"></span>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="divide-y divide-slate-50"
          >
            {filtered.map((user) => {
              const initials =
                `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
              const badgeClass =
                ROLE_BADGE_STYLES[user.role as NonNullable<UserRole>] ??
                "bg-slate-100 text-slate-600";
              const roleLabel =
                ROLE_LABELS[user.role as NonNullable<UserRole>] ?? user.role;
              const isActing = pendingId === user.id;

              return (
                <motion.div
                  key={user.id}
                  variants={fadeUp}
                  className="grid grid-cols-[2fr_1fr_auto] sm:grid-cols-[2fr_2fr_1fr_1fr_auto] items-center px-5 py-3.5 hover:bg-slate-50 transition-colors"
                >
                  {/* Name + facility */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#15689E]/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-[#15689E]">{initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {user.first_name} {user.last_name}
                      </p>
                      {user.facility && (
                        <p className="text-xs text-slate-400 truncate">{user.facility.name}</p>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div className="hidden sm:block min-w-0">
                    <p className="text-sm text-slate-500 truncate">{user.email}</p>
                  </div>

                  {/* Role badge */}
                  <div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}
                    >
                      {roleLabel}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        user.is_active ? "bg-green-500" : "bg-slate-300"
                      }`}
                    />
                    <span className="text-xs text-slate-500">
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  {/* Action button */}
                  <div className="flex justify-end pl-4">
                    {user.is_active ? (
                      <button
                        type="button"
                        onClick={() => handleDeactivate(user.id)}
                        disabled={isActing}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                        title="Deactivate user"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleReactivate(user.id)}
                        disabled={isActing}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-40"
                        title="Reactivate user"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}

      <p className="text-xs text-slate-400 text-right">
        {filtered.length} of {users.length} user{users.length !== 1 ? "s" : ""}
      </p>

      <CreateUserModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}
