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
import SubmitButton from "@/app/(components)/SubmitButton";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { EmptyState } from "@/app/(components)/EmptyState";
import { TableToolbar } from "@/app/(components)/TableToolbar";
import { DataTable } from "@/app/(components)/DataTable";
import { AddProductModal } from "../(components)/AddProductModal";
import { ProductCard } from "../(components)/ProductCard";
import { Package, Trash2, Pencil, X, Check } from "lucide-react";
import toast from "react-hot-toast";

type RowEdit = {
  sku: string;
  name: string;
  category: string;
  unit_price: string;
  is_active: boolean;
};

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
          <span className="text-sm font-medium text-slate-700">
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
            <div className="w-8 h-8 rounded-lg bg-[#15689E]/10 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-[#15689E]" />
            </div>
            <div className="min-w-0">
              <span className="text-slate-700 font-medium text-sm block">
                {product.name}
              </span>
              {product.description ? (
                <span className="text-xs text-slate-400 block truncate max-w-[260px]">
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
          <span className="text-sm text-slate-600">
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
          <span className="text-slate-700 font-medium text-sm">
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
          <label className="flex items-center gap-2 text-sm text-slate-700">
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
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600"
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
      render: (product) => {
        const edit = editingRows[product.id];
        const isEditing = !!edit;
        const saving = savingId === product.id;
        const deleting = deletingId === product.id;

        const isRowValid =
          isEditing &&
          edit.sku.trim() !== "" &&
          edit.name.trim() !== "" &&
          edit.unit_price.trim() !== "" &&
          Number(edit.unit_price) >= 0;

        return (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => cancelEditing(product.id)}
                  disabled={saving}
                  className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded disabled:opacity-40 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                <SubmitButton
                  type="button"
                  onClick={() => handleSave(product)}
                  isPending={saving}
                  disabled={!isRowValid || saving}
                  cta={<Check className="w-4 h-4" />}
                  isPendingMesssage=""
                  variant="ghost"
                  size="icon-xs"
                  classname="text-[#15689E] hover:text-[#0f4f7a] hover:bg-transparent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => startEditing(product)}
                  disabled={deleting}
                  className="p-1.5 text-slate-300 hover:text-[#15689E] transition-colors rounded disabled:opacity-40 cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmId(product.id)}
                  disabled={deleting}
                  className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        );
      },
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

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[calc(100vh-172px)] md:h-[calc(100vh-219px)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-slate-700">
              All Products
            </h2>
            <p className="text-xs text-slate-400">
              Showing{" "}
              <span className="font-medium text-slate-600">
                {filtered.length}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-600">{items.length}</span>{" "}
              products
            </p>
          </div>
          <AddProductModal />
        </div>

        <TableToolbar
          searchValue={search}
          onSearchChange={(value) => dispatch(setSearch(value))}
          searchPlaceholder="Search by SKU, name, or category..."
        />

        <div className="overflow-auto flex-1">
          <div className="md:hidden">
            {filtered.length === 0 ? (
              <EmptyState
                icon={
                  <Package className="w-10 h-10 mb-3 text-slate-300 opacity-30" />
                }
                message="No Products Found"
                description="Try adjusting your search or filter"
              />
            ) : (
              <div className="divide-y divide-slate-100">
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

        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 shrink-0">
          <p className="text-xs text-slate-400">
            Showing{" "}
            <span className="font-medium text-slate-600">
              {filtered.length}
            </span>{" "}
            of{" "}
            <span className="font-medium text-slate-600">{items.length}</span>{" "}
            products
          </p>
        </div>
      </div>
    </>
  );
}
