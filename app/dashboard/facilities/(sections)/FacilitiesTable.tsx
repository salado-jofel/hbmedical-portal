"use client";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  removeFacilityFromStore,
  setSearch,
  setTypeFilter,
} from "../(redux)/facilities-slice";
import { deleteFacility } from "../(services)/actions";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { Trash2, Building2 } from "lucide-react";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { EmptyState } from "@/app/(components)/EmptyState";
import { QBSyncBadge } from "@/app/(components)/QBSyncBadge";
import { NotSyncedBadge } from "@/app/(components)/NotSyncBadge";
import { TableToolbar } from "@/app/(components)/TableToolbar";
import { DataTable } from "@/app/(components)/DataTable";
import type { TableColumn } from "@/app/(interfaces)/table-column";
import type { Facility } from "@/app/(interfaces)/facility";
import { AddFacilityModal } from "./AddFacilityModal";

function StatusBadge({ status }: { status?: string }) {
  const cls =
    status === "Active"
      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
      : "bg-slate-100 text-slate-500 border border-slate-200";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}
    >
      {status}
    </span>
  );
}

export default function FacilitiesTable() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const items = useAppSelector((state) => state.facilities.items);
  const search = useAppSelector((state) => state.facilities.search);
  const typeFilter = useAppSelector((state) => state.facilities.typeFilter);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filterOptions = useMemo(() => {
    const types = Array.from(
      new Set(items.map((f: Facility) => f.type).filter(Boolean)),
    ) as string[];
    return ["All Types", ...types].map((t) => ({ label: t, value: t }));
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((f: Facility) => {
      const matchesSearch =
        !search ||
        f.name?.toLowerCase().includes(search.toLowerCase()) ||
        f.contact?.toLowerCase().includes(search.toLowerCase());
      const matchesType =
        !typeFilter || typeFilter === "All Types" || f.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [items, search, typeFilter]);

  async function handleDelete() {
    if (!confirmId) return;
    setDeletingId(confirmId);
    try {
      await deleteFacility(confirmId);
      dispatch(removeFacilityFromStore(confirmId));
      setConfirmId(null);
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeletingId(null);
    }
  }

  const columns: TableColumn<Facility>[] = [
    {
      key: "name",
      label: "Name",
      render: (facility) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#2db0b0]/10 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-[#2db0b0]" />
          </div>
          <span className="text-slate-700 font-medium text-sm">
            {facility.name}
          </span>
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (facility) => facility.type ?? "—",
    },
    {
      key: "contact",
      label: "Contact",
      render: (facility) => facility.contact ?? "—",
    },
    {
      key: "phone",
      label: "Phone",
      render: (facility) => facility.phone ?? "—",
    },
    {
      key: "status",
      label: "Status",
      render: (facility) => <StatusBadge status={facility.status} />,
    },
    {
      key: "qb_customer_id",
      label: "QuickBooks",
      render: (facility) => (
        // stopPropagation prevents row navigate when clicking the badge
        <div onClick={(e) => e.stopPropagation()}>
          {facility.qb_customer_id ? (
            <QBSyncBadge syncedAt={facility.qb_synced_at} />
          ) : (
            <NotSyncedBadge />
          )}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (facility) => (
        // stopPropagation prevents row navigate when clicking delete
        <div onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setConfirmId(facility.id!)}
            disabled={deletingId === facility.id}
            className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded disabled:opacity-40 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const confirmingFacility = items.find((f) => f.id === confirmId);

  return (
    <>
      <ConfirmModal
        open={!!confirmId}
        onOpenChange={(open) => {
          if (!deletingId && !open) setConfirmId(null);
        }}
        title="Delete Facility"
        description={`Are you sure you want to delete "${confirmingFacility?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        isLoading={!!deletingId}
        onConfirm={handleDelete}
      />

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[calc(100vh-172px)] md:h-[calc(100vh-219px)]">
        {/* ── Card Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-slate-700">
              All Facilities
            </h2>
            <p className="text-xs text-slate-400">
              Showing{" "}
              <span className="font-medium text-slate-600">
                {filtered.length}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-600">{items.length}</span>{" "}
              facilities
            </p>
          </div>
          <AddFacilityModal />
        </div>

        <TableToolbar
          searchValue={search}
          onSearchChange={(value) => dispatch(setSearch(value))}
          searchPlaceholder="Search facilities..."
          filterElement={
            <select
              value={typeFilter ?? "All Types"}
              onChange={(e) => dispatch(setTypeFilter(e.target.value))}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:outline-none focus:border-[#2db0b0] transition-colors cursor-pointer"
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          }
        />

        <div className="overflow-auto flex-1">
          <div className="md:hidden">
            {filtered.length === 0 ? (
              <EmptyState
                icon={
                  <Building2 className="w-10 h-10 mb-3 text-slate-300 opacity-30" />
                }
                message="No facilities found"
                description="Try adjusting your search or filter"
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {filtered.map((facility: Facility) => (
                  <div
                    key={facility.id}
                    onClick={() =>
                      router.push(`/dashboard/facilities/${facility.id}`)
                    }
                    className="p-4 flex flex-col gap-3 cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#2db0b0]/10 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4 text-[#2db0b0]" />
                        </div>
                        <span className="font-semibold text-slate-800 text-sm truncate">
                          {facility.name}
                        </span>
                      </div>
                      <StatusBadge status={facility.status} />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      {facility.type && <span>{facility.type}</span>}
                      {facility.type && facility.contact && (
                        <span className="text-slate-300">·</span>
                      )}
                      {facility.contact && <span>{facility.contact}</span>}
                    </div>

                    {facility.phone && (
                      <p className="text-xs text-slate-500">{facility.phone}</p>
                    )}

                    <div
                      className="flex items-center justify-between"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {facility.qb_customer_id ? (
                        <QBSyncBadge syncedAt={facility.qb_synced_at} />
                      ) : (
                        <NotSyncedBadge />
                      )}
                      <button
                        onClick={() => setConfirmId(facility.id!)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={filtered}
              keyExtractor={(f) => f.id!}
              emptyMessage="No facilities found"
              headerVariant="teal"
              onRowClick={(facility) =>
                router.push(`/dashboard/facilities/${facility.id}`)
              }
            />
          </div>
        </div>

        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 shrink-0">
          <p className="text-xs text-slate-400">
            Showing{" "}
            <span className="font-medium text-slate-600">
              {filtered.length}
            </span>{" "}
            of{" "}
            <span className="font-medium text-slate-600">{items.length}</span>{" "}
            facilities
          </p>
        </div>
      </div>
    </>
  );
}
