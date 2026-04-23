"use client";

import { useAppDispatch } from "@/store/hooks";
import { useState } from "react";
import { addProduct } from "../(services)/actions";
import { addProductToStore } from "../(redux)/products-slice";
import type { Product } from "@/utils/interfaces/products";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import SubmitButton from "@/app/(components)/SubmitButton";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Package,
  DollarSign,
  Hash,
  Tag,
  ArrowUpDown,
  FileText,
  Stethoscope,
} from "lucide-react";
import toast from "react-hot-toast";

export function AddProductModal() {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [hcpcsCode, setHcpcsCode] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const isFormValid =
    sku.trim() !== "" &&
    name.trim() !== "" &&
    unitPrice.trim() !== "" &&
    Number(unitPrice) >= 0 &&
    Number(sortOrder) >= 0;

  function resetForm() {
    setSku("");
    setName("");
    setCategory("");
    setHcpcsCode("");
    setDescription("");
    setUnitPrice("");
    setSortOrder("0");
    setIsActive(true);
  }

  function handleOpenChange(val: boolean) {
    if (isSubmitting) return;

    if (!val) {
      resetForm();
    }

    setOpen(val);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("sku", sku);
      formData.set("name", name);
      formData.set("category", category);
      formData.set("hcpcs_code", hcpcsCode);
      formData.set("description", description);
      formData.set("unit_price", unitPrice);
      formData.set("sort_order", sortOrder);
      formData.set("is_active", String(isActive));

      const created: Product = await addProduct(formData);
      dispatch(addProductToStore(created));
      toast.success("Product added successfully!");
      setOpen(false);
      resetForm();
    } catch (err) {
      console.error("[AddProductModal] Error:", err);
      toast.error("Failed to add product. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <SubmitButton
          type="button"
          variant="default"
          size="default"
          classname="bg-[var(--navy)] hover:bg-[#0f4f7a] text-white cursor-pointer"
          cta={
            <>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </>
          }
        />
      </DialogTrigger>

      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl sm:rounded-2xl border border-[var(--border)] shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[var(--navy)]">
            Add New Product
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-[#374151]">
                <Hash className="w-4 h-4 text-[var(--navy)]" />
                SKU
              </label>
              <Input
                name="sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. HBM-001"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-[#374151]">
                <Package className="w-4 h-4 text-[var(--navy)]" />
                Product Name
              </label>
              <Input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Paracetamol 500mg"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-[#374151]">
                <Tag className="w-4 h-4 text-[var(--navy)]" />
                Category
              </label>
              <Input
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Collagen"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-[#374151]">
                <Stethoscope className="w-4 h-4 text-[var(--navy)]" />
                HCPCS Code
              </label>
              <Input
                name="hcpcs_code"
                value={hcpcsCode}
                onChange={(e) => setHcpcsCode(e.target.value.toUpperCase())}
                placeholder="e.g. A6021"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-[#374151]">
                <DollarSign className="w-4 h-4 text-[var(--navy)]" />
                Unit Price
              </label>
              <Input
                name="unit_price"
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="e.g. 99.00"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-[#374151]">
                <ArrowUpDown className="w-4 h-4 text-[var(--navy)]" />
                Sort Order
              </label>
              <Input
                name="sort_order"
                type="number"
                min="0"
                step="1"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="0"
                disabled={isSubmitting}
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-[#374151]">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={isSubmitting}
                  className="cursor-pointer"
                />
                Active product
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-[#374151]">
              <FileText className="w-4 h-4 text-[var(--navy)]" />
              Description
            </label>
            <textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={isSubmitting}
              placeholder="Optional product description..."
              className="w-full rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--navy)] outline-none focus:border-[var(--navy)] focus:ring-2 focus:ring-[var(--navy)]/10 disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2">
            <SubmitButton
              type="button"
              variant="outline"
              size="default"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              classname="w-full sm:w-auto border-[var(--border)] text-[#374151] hover:bg-[var(--bg)] cursor-pointer"
              cta={<span>Cancel</span>}
            />
            <SubmitButton
              type="submit"
              isPending={isSubmitting}
              disabled={!isFormValid || isSubmitting}
              cta={
                <>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Product
                </>
              }
              isPendingMesssage="Saving..."
              variant="default"
              size="default"
              classname="w-full sm:w-auto bg-[var(--navy)] hover:bg-[#0f4f7a] text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
