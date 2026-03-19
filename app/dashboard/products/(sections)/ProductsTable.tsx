"use client";

import { useState, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  updateProductInStore,
  removeProductFromStore,
  setSearch,
} from "../(redux)/products-slice";
import { editProduct, deleteProduct } from "../(services)/actions";
import type { Product } from "@/app/(interfaces)/product";
import type { TableColumn } from "@/app/(interfaces)/table-column";
import { Input } from "@/components/ui/input";
import SubmitButton from "@/app/(components)/SubmitButton";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { EmptyState } from "@/app/(components)/EmptyState";
import { QBSyncBadge } from "@/app/(components)/QBSyncBadge";
import { NotSyncedBadge } from "@/app/(components)/NotSyncBadge";
import { TableToolbar } from "@/app/(components)/TableToolbar";
import { DataTable } from "@/app/(components)/DataTable";
import { AddProductModal } from "./AddProductModal";
import { ProductCard } from "./ProductCard";
import { Package, Trash2, Pencil, X, Check } from "lucide-react";

type RowEdit = { name: string; price: string };

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
      items.filter(
        (p: Product) =>
          search === "" || p.name?.toLowerCase().includes(search.toLowerCase()),
      ),
    [items, search],
  );

  function startEditing(product: Product) {
    setEditingRows((prev) => ({
      ...prev,
      [product.id!]: { name: product.name, price: String(product.price) },
    }));
  }

  function cancelEditing(id: string) {
    setEditingRows((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function updateField(id: string, field: keyof RowEdit, value: string) {
    setEditingRows((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  async function handleSave(product: Product) {
    const edit = editingRows[product.id!];
    if (!edit || !product.id) return;
    setSavingId(product.id);
    try {
      const formData = new FormData();
      formData.set("name", edit.name);
      formData.set("price", edit.price);
      await editProduct(product.id, formData);
      dispatch(
        updateProductInStore({
          ...product,
          name: edit.name,
          price: parseFloat(edit.price) || 0,
        }),
      );
      cancelEditing(product.id);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete() {
    if (!confirmId) return;
    setDeletingId(confirmId);
    try {
      await deleteProduct(confirmId);
      dispatch(removeProductFromStore(confirmId));
      setConfirmId(null);
    } finally {
      setDeletingId(null);
    }
  }

  const columns: TableColumn<Product>[] = [
    {
      key: "name",
      label: "Name",
      render: (product) => {
        const edit = editingRows[product.id!];
        const saving = savingId === product.id;
        return edit ? (
          <Input
            value={edit.name}
            onChange={(e) => updateField(product.id!, "name", e.target.value)}
            className="h-8 text-sm"
            disabled={saving}
          />
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2db0b0]/10 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-[#2db0b0]" />
            </div>
            <span className="text-slate-700 font-medium text-sm">
              {product.name}
            </span>
          </div>
        );
      },
    },
    {
      key: "price",
      label: "Price",
      render: (product) => {
        const edit = editingRows[product.id!];
        const saving = savingId === product.id;
        return edit ? (
          <Input
            value={edit.price}
            type="number"
            min="0"
            step="0.01"
            onChange={(e) => updateField(product.id!, "price", e.target.value)}
            className="h-8 text-sm w-32"
            disabled={saving}
          />
        ) : (
          <span className="text-slate-700 font-medium text-sm">
            ${Number(product.price).toFixed(2)}
          </span>
        );
      },
    },
    {
      key: "created_at",
      label: "Date Added",
      cellClassName: "text-slate-400",
      render: (product) =>
        product.created_at
          ? new Date(product.created_at).toLocaleDateString("en-PH", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "—",
    },
    {
      key: "qb_item_id",
      label: "QuickBooks",
      render: (product) =>
        product.qb_item_id ? (
          <QBSyncBadge syncedAt={product.qb_synced_at} />
        ) : (
          <NotSyncedBadge />
        ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (product) => {
        const isEditing = !!editingRows[product.id!];
        const saving = savingId === product.id;
        const deleting = deletingId === product.id;
        return (
          // stopPropagation keeps DataTable's onRowClick (if ever added) from firing
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => cancelEditing(product.id!)}
                  disabled={saving}
                  className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded disabled:opacity-40 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
                <SubmitButton
                  type="button"
                  onClick={() => handleSave(product)}
                  isPending={saving}
                  cta={<Check className="w-4 h-4" />}
                  isPendingMesssage=""
                  variant="ghost"
                  size="icon-xs"
                  classname="text-[#2db0b0] hover:text-[#249191] hover:bg-transparent cursor-pointer"
                />
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => startEditing(product)}
                  disabled={deleting}
                  className="p-1.5 text-slate-300 hover:text-[#2db0b0] transition-colors rounded disabled:opacity-40 cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmId(product.id!)}
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
          searchPlaceholder="Search products..."
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
              keyExtractor={(p) => p.id!}
              emptyMessage="No Products Found"
              headerVariant="teal"
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
