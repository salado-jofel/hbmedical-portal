"use client";

import { useState, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  updateProductInStore,
  removeProductFromStore,
  setSearch,
} from "../(redux)/products-slice";
import { editProduct, deleteProduct } from "../(services)/actions";
import type { Product } from "@/utils/interfaces/products";
import { Input } from "@/components/ui/input";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { EmptyState } from "@/app/(components)/EmptyState";
import { TableToolbar } from "@/app/(components)/TableToolbar";
import { SortableHeader } from "@/app/(components)/SortableHeader";
import { TableBusyBar } from "@/app/(components)/TableBusyBar";
import { ProductCard } from "../(components)/ProductCard";
import { ProductRowActions } from "../(components)/ProductRowActions";
import type { RowEdit } from "@/utils/interfaces/products";
import { Package } from "lucide-react";
import toast from "react-hot-toast";
import { useTableRealtimeRefresh } from "@/utils/hooks/useOrderRealtime";
import { useListParams } from "@/utils/hooks/useListParams";
import { useBriefBusy } from "@/utils/hooks/useBriefBusy";
import { PRODUCT_SORT_COLUMNS } from "@/utils/constants/products-list";
import { cn } from "@/utils/utils";

export default function ProductsTable() {
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.products.items);
  const search = useAppSelector((state) => state.products.search);

  const [editingRows, setEditingRows] = useState<Record<string, RowEdit>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Catalog is admin-edited — keep the table live when another admin adds /
  // edits / deletes a product.
  useTableRealtimeRefresh("products");

  // URL-backed sort + filters. Search stays in Redux (existing slice).
  const listParams = useListParams<
    typeof PRODUCT_SORT_COLUMNS,
    readonly ["status", "category"]
  >({
    defaultSort: "name",
    defaultDir: "asc",
    allowedSorts: PRODUCT_SORT_COLUMNS,
    filterKeys: ["status", "category"] as const,
  });

  const statusFilter = listParams.filters.status ?? "all";
  const categoryFilter = listParams.filters.category ?? "all";

  // Distinct categories from the loaded catalog — feeds the filter dropdown.
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of items) if (p.category) set.add(p.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered: Product[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p: Product) => {
      if (statusFilter === "active" && !p.is_active) return false;
      if (statusFilter === "inactive" && p.is_active) return false;
      if (categoryFilter !== "all" && (p.category ?? "") !== categoryFilter)
        return false;
      if (!q) return true;
      return (
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q) ||
        (p.hcpcs_code ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, statusFilter, categoryFilter]);

  // Apply sort. Stable secondary by name so equal primary keys don't jitter.
  const sorted: Product[] = useMemo(() => {
    const asc = listParams.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let primary = 0;
      switch (listParams.sort) {
        case "name":
          primary = (a.name ?? "").localeCompare(b.name ?? "") * asc;
          break;
        case "sku":
          primary = (a.sku ?? "").localeCompare(b.sku ?? "") * asc;
          break;
        case "category":
          primary = (a.category ?? "").localeCompare(b.category ?? "") * asc;
          break;
        case "unit_price":
          primary = (Number(a.unit_price) - Number(b.unit_price)) * asc;
          break;
        case "is_active":
          primary = (Number(b.is_active) - Number(a.is_active)) * asc;
          break;
        case "created_at":
          primary =
            (new Date(a.created_at ?? 0).getTime() -
              new Date(b.created_at ?? 0).getTime()) *
            asc;
          break;
      }
      return primary !== 0 ? primary : (a.name ?? "").localeCompare(b.name ?? "");
    });
  }, [filtered, listParams.sort, listParams.dir]);

  // Visual feedback on filter / sort / search change.
  const searchBusy = useBriefBusy([search], 250);
  const isBusy = listParams.isPending || searchBusy;

  function startEditing(product: Product) {
    setEditingRows((prev) => ({
      ...prev,
      [product.id]: {
        sku: product.sku,
        name: product.name,
        category: product.category ?? "",
        hcpcs_code: product.hcpcs_code ?? "",
        unit_price: String(product.unit_price),
        is_active: product.is_active,
      },
    }));
  }

  function cancelEditing(id: string) {
    setEditingRows((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function updateField(
    id: string,
    field: keyof RowEdit,
    value: string | boolean,
  ) {
    setEditingRows((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  }

  async function handleSave(product: Product) {
    const edit = editingRows[product.id];
    if (!edit) return;

    setSavingId(product.id);

    try {
      const formData = new FormData();
      formData.set("sku", edit.sku);
      formData.set("name", edit.name);
      formData.set("category", edit.category);
      formData.set("hcpcs_code", edit.hcpcs_code);
      formData.set("unit_price", edit.unit_price);
      formData.set("is_active", String(edit.is_active));

      const updated = await editProduct(product.id, formData);
      dispatch(updateProductInStore(updated));
      cancelEditing(product.id);
      toast.success("Product updated successfully!");
    } catch (err) {
      console.error("[ProductsTable] Edit error:", err);
      toast.error("Failed to update product. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete() {
    if (!confirmId) return;

    const productName = items.find((p) => p.id === confirmId)?.name;
    setDeletingId(confirmId);

    try {
      await deleteProduct(confirmId);
      dispatch(removeProductFromStore(confirmId));
      setConfirmId(null);
      toast.success(`"${productName}" deleted successfully.`);
    } catch (err) {
      console.error("[ProductsTable] Delete error:", err);
      toast.error("Failed to delete product. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const confirmingProduct = items.find((p) => p.id === confirmId);

  return (
    <>
      <ConfirmModal
        open={!!confirmId}
        onOpenChange={(open) => {
          if (!deletingId && !open) setConfirmId(null);
        }}
        title="Delete Product?"
        description={`"${confirmingProduct?.name}" will be permanently removed. This action cannot be undone.`}
        confirmLabel="Delete"
        isLoading={!!deletingId}
        onConfirm={handleDelete}
      />

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r)] flex flex-col h-[calc(100vh-172px)] md:h-[calc(100vh-219px)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-[var(--border)] bg-[var(--bg)] shrink-0">
          <div className="space-y-0.5">
            <h2 className="text-[13px] font-semibold text-[var(--navy)]">
              All Products
            </h2>
            <p className="text-[11px] text-[var(--text3)]">
              Showing{" "}
              <span className="font-medium text-[var(--text2)]">
                {sorted.length}
              </span>{" "}
              of{" "}
              <span className="font-medium text-[var(--text2)]">{items.length}</span>{" "}
              products
            </p>
          </div>
        </div>

        <TableToolbar
          searchValue={search}
          onSearchChange={(value) => dispatch(setSearch(value))}
          searchPlaceholder="Search by SKU, name, category, HCPCS..."
          className="p-4 border-b border-[var(--border)]"
          filters={[
            {
              value: statusFilter,
              onChange: (v) =>
                listParams.setFilter("status", v === "all" ? null : v),
              options: [
                { value: "all", label: "All Statuses" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ],
              placeholder: "All Statuses",
              className: "w-full sm:w-40",
            },
            ...(categoryOptions.length > 0
              ? [
                  {
                    value: categoryFilter,
                    onChange: (v: string) =>
                      listParams.setFilter("category", v === "all" ? null : v),
                    options: [
                      { value: "all", label: "All Categories" },
                      ...categoryOptions.map((c) => ({ value: c, label: c })),
                    ],
                    placeholder: "All Categories",
                    className: "w-full sm:w-44",
                  },
                ]
              : []),
          ]}
        />

        <TableBusyBar busy={isBusy} />

        <div className={cn("overflow-auto flex-1 transition-opacity", isBusy && "opacity-70")}>
          {/* Mobile cards — same sorted order so the list matches the desktop table. */}
          <div className="md:hidden">
            {sorted.length === 0 ? (
              <EmptyState
                icon={
                  <Package className="w-10 h-10 mb-3 text-[var(--border)]" />
                }
                message="No Products Found"
                description="Try adjusting your search or filter"
              />
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {sorted.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>

          {/* Desktop sortable table — inline so column headers can wire up
              the SortableHeader component. */}
          <div className="hidden md:block">
            {sorted.length === 0 ? (
              <EmptyState
                icon={<Package className="w-10 h-10 mb-3 text-[var(--border)]" />}
                message="No Products Found"
                description="Try adjusting your search or filter"
              />
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[var(--bg)] border-b border-[var(--border)]">
                    <th className="px-4 py-[9px]">
                      <SortableHeader
                        label="SKU"
                        column="sku"
                        currentSort={listParams.sort}
                        currentDir={listParams.dir}
                        onToggle={(c) =>
                          listParams.toggleSort(c as typeof PRODUCT_SORT_COLUMNS[number])
                        }
                      />
                    </th>
                    <th className="px-4 py-[9px]">
                      <SortableHeader
                        label="Name"
                        column="name"
                        currentSort={listParams.sort}
                        currentDir={listParams.dir}
                        onToggle={(c) =>
                          listParams.toggleSort(c as typeof PRODUCT_SORT_COLUMNS[number])
                        }
                      />
                    </th>
                    <th className="px-4 py-[9px]">
                      <SortableHeader
                        label="Category"
                        column="category"
                        currentSort={listParams.sort}
                        currentDir={listParams.dir}
                        onToggle={(c) =>
                          listParams.toggleSort(c as typeof PRODUCT_SORT_COLUMNS[number])
                        }
                      />
                    </th>
                    <th className="px-4 py-[9px] text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
                      HCPCS
                    </th>
                    <th className="px-4 py-[9px]">
                      <SortableHeader
                        label="Unit Price"
                        column="unit_price"
                        currentSort={listParams.sort}
                        currentDir={listParams.dir}
                        onToggle={(c) =>
                          listParams.toggleSort(c as typeof PRODUCT_SORT_COLUMNS[number])
                        }
                      />
                    </th>
                    <th className="px-4 py-[9px]">
                      <SortableHeader
                        label="Status"
                        column="is_active"
                        currentSort={listParams.sort}
                        currentDir={listParams.dir}
                        onToggle={(c) =>
                          listParams.toggleSort(c as typeof PRODUCT_SORT_COLUMNS[number])
                        }
                      />
                    </th>
                    <th className="px-4 py-[9px] text-right text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((product) => {
                    const edit = editingRows[product.id];
                    const saving = savingId === product.id;
                    return (
                      <tr
                        key={product.id}
                        className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]"
                      >
                        <td className="px-4 py-[10px]">
                          {edit ? (
                            <Input
                              value={edit.sku}
                              onChange={(e) =>
                                updateField(product.id, "sku", e.target.value)
                              }
                              className="h-8 text-sm w-36"
                              disabled={saving}
                            />
                          ) : (
                            <span className="text-sm font-medium text-[var(--navy)]">
                              {product.sku}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-[10px]">
                          {edit ? (
                            <Input
                              value={edit.name}
                              onChange={(e) =>
                                updateField(product.id, "name", e.target.value)
                              }
                              className="h-8 text-sm min-w-[220px]"
                              disabled={saving}
                            />
                          ) : (
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-[var(--navy)]" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[var(--navy)] font-medium text-sm block">
                                  {product.name}
                                </span>
                                {product.description ? (
                                  <span className="text-[11px] text-[var(--text3)] block truncate max-w-[260px]">
                                    {product.description}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-[10px]">
                          {edit ? (
                            <Input
                              value={edit.category}
                              onChange={(e) =>
                                updateField(product.id, "category", e.target.value)
                              }
                              className="h-8 text-sm"
                              disabled={saving}
                            />
                          ) : (
                            <span className="text-sm text-[var(--text2)]">
                              {product.category || "—"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-[10px]">
                          {edit ? (
                            <Input
                              value={edit.hcpcs_code}
                              onChange={(e) =>
                                updateField(
                                  product.id,
                                  "hcpcs_code",
                                  e.target.value.toUpperCase(),
                                )
                              }
                              className="h-8 text-sm w-24"
                              placeholder="A6021"
                              disabled={saving}
                            />
                          ) : product.hcpcs_code ? (
                            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-mono font-medium bg-[var(--blue-lt)] text-[var(--blue)]">
                              {product.hcpcs_code}
                            </span>
                          ) : (
                            <span className="text-sm text-[var(--text3)]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-[10px]">
                          {edit ? (
                            <Input
                              value={edit.unit_price}
                              type="number"
                              min="0"
                              step="0.01"
                              onChange={(e) =>
                                updateField(product.id, "unit_price", e.target.value)
                              }
                              className="h-8 text-sm w-32"
                              disabled={saving}
                            />
                          ) : (
                            <span className="text-[var(--navy)] font-medium text-sm">
                              ${Number(product.unit_price).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-[10px]">
                          {edit ? (
                            <label className="flex items-center gap-2 text-sm text-[var(--text)]">
                              <input
                                type="checkbox"
                                checked={edit.is_active}
                                onChange={(e) =>
                                  updateField(
                                    product.id,
                                    "is_active",
                                    e.target.checked,
                                  )
                                }
                                disabled={saving}
                                className="cursor-pointer"
                              />
                              Active
                            </label>
                          ) : (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                product.is_active
                                  ? "bg-[var(--green-lt)] text-[var(--green)]"
                                  : "bg-[var(--border)] text-[var(--text2)]"
                              }`}
                            >
                              {product.is_active ? "Active" : "Inactive"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-[10px] text-right">
                          <ProductRowActions
                            product={product}
                            editingRow={editingRows[product.id]}
                            savingId={savingId}
                            deletingId={deletingId}
                            onStartEditing={startEditing}
                            onCancelEditing={cancelEditing}
                            onSave={handleSave}
                            onDeleteClick={setConfirmId}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[var(--bg)] shrink-0">
          <p className="text-[11px] text-[var(--text3)]">
            Showing{" "}
            <span className="font-medium text-[var(--text2)]">
              {sorted.length}
            </span>{" "}
            of{" "}
            <span className="font-medium text-[var(--text2)]">{items.length}</span>{" "}
            products
          </p>
        </div>
      </div>
    </>
  );
}
