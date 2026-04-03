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
} from "lucide-react";
import toast from "react-hot-toast";

export function AddProductModal() {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
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
          classname="bg-[#15689E] hover:bg-[#0f4f7a] text-white cursor-pointer"
          cta={
            <>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </>
          }
        />
      </DialogTrigger>

      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl sm:rounded-2xl border border-[#E2E8F0] shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-[#0F172A]">
            Add New Product
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-[#374151]">
                <Hash className="w-4 h-4 text-[#15689E]" />
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
                <Package className="w-4 h-4 text-[#15689E]" />
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
                <Tag className="w-4 h-4 text-[#15689E]" />
                Category
              </label>
              <Input
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Medication"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-[#374151]">
                <DollarSign className="w-4 h-4 text-[#15689E]" />
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
                <ArrowUpDown className="w-4 h-4 text-[#15689E]" />
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
              <FileText className="w-4 h-4 text-[#15689E]" />
              Description
            </label>
            <textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              disabled={isSubmitting}
              placeholder="Optional product description..."
              className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#15689E] focus:ring-2 focus:ring-[#15689E]/10 disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2">
            <SubmitButton
              type="button"
              variant="outline"
              size="default"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              classname="w-full sm:w-auto border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC] cursor-pointer"
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
              classname="w-full sm:w-auto bg-[#15689E] hover:bg-[#0f4f7a] text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
