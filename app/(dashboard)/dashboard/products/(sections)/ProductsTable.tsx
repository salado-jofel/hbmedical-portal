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
import type { TableColumn } from "@/utils/interfaces/table-column";
import { Input } from "@/components/ui/input";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { EmptyState } from "@/app/(components)/EmptyState";
import { TableToolbar } from "@/app/(components)/TableToolbar";
import { DataTable } from "@/app/(components)/DataTable";
import { ProductCard } from "../(components)/ProductCard";
import { ProductRowActions } from "../(components)/ProductRowActions";
import type { RowEdit } from "@/utils/interfaces/products";
import { Package } from "lucide-react";
import toast from "react-hot-toast";

export default function ProductsTable() {
  const dispatch = useAppDispatch();
  const items = useAppSelector((state) => state.products.items);
  const search = useAppSelector((state) => state.products.search);

  const [editingRows, setEditingRows] = useState<Record<string, RowEdit>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered: Product[] = useMemo(
    () =>
      items.filter((p: Product) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;

        return (
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          (p.category ?? "").toLowerCase().includes(q)
        );
      }),
    [items, search],
  );

  function startEditing(product: Product) {
    setEditingRows((prev) => ({
      ...prev,
      [product.id]: {
        sku: product.sku,
        name: product.name,
        category: product.category ?? "",
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

  const columns: TableColumn<Product>[] = [
    {
      key: "sku",
      label: "SKU",
      render: (product) => {
        const edit = editingRows[product.id];
        const saving = savingId === product.id;

        return edit ? (
          <Input
            value={edit.sku}
            onChange={(e) => updateField(product.id, "sku", e.target.value)}
            className="h-8 text-sm w-36"
            disabled={saving}
          />
        ) : (
          <span className="text-sm font-medium text-[var(--navy)]">
            {product.sku}
          </span>
        );
      },
    },
    {
      key: "name",
      label: "Name",
      render: (product) => {
        const edit = editingRows[product.id];
        const saving = savingId === product.id;

        return edit ? (
          <Input
            value={edit.name}
            onChange={(e) => updateField(product.id, "name", e.target.value)}
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
        );
      },
    },
    {
      key: "category",
      label: "Category",
      render: (product) => {
        const edit = editingRows[product.id];
        const saving = savingId === product.id;

        return edit ? (
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
        );
      },
    },
    {
      key: "unit_price",
      label: "Unit Price",
      render: (product) => {
        const edit = editingRows[product.id];
        const saving = savingId === product.id;

        return edit ? (
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
        );
      },
    },
    {
      key: "is_active",
      label: "Status",
      render: (product) => {
        const edit = editingRows[product.id];
        const saving = savingId === product.id;

        return edit ? (
          <label className="flex items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={edit.is_active}
              onChange={(e) =>
                updateField(product.id, "is_active", e.target.checked)
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
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (product) => (
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
      ),
    },
  ];

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
                {filtered.length}
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
          searchPlaceholder="Search by SKU, name, or category..."
          className="p-4 border-b border-[var(--border)]"
        />

        <div className="overflow-auto flex-1">
          <div className="md:hidden">
            {filtered.length === 0 ? (
              <EmptyState
                icon={
                  <Package className="w-10 h-10 mb-3 text-[var(--border)]" />
                }
                message="No Products Found"
                description="Try adjusting your search or filter"
              />
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {filtered.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>

          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={filtered}
              keyExtractor={(p) => p.id}
              emptyMessage="No Products Found"
              headerVariant="brand"
            />
          </div>
        </div>

        <div className="px-4 py-2.5 border-t border-[var(--border)] bg-[var(--bg)] shrink-0">
          <p className="text-[11px] text-[var(--text3)]">
            Showing{" "}
            <span className="font-medium text-[var(--text2)]">
              {filtered.length}
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
