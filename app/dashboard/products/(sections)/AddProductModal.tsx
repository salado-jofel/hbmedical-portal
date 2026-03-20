import { useAppDispatch } from "@/store/hooks";
import { useState } from "react";
import { addProduct } from "../(services)/actions";
import { addProductToStore } from "../(redux)/products-slice";
import { Product } from "@/app/(interfaces)/product";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SubmitButton from "@/app/(components)/SubmitButton";
import { Input } from "@/components/ui/input";
import { Plus, Package, DollarSign } from "lucide-react";
import toast from "react-hot-toast";

// ─── Add Product Modal ────────────────────────────────────────────────────────
export function AddProductModal() {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // ✅ controlled field state
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  // ✅ true only when both fields have valid values
  const isFormValid = name.trim() !== "" && price.trim() !== "" && parseFloat(price) >= 0;

  // ✅ reset fields when modal closes
  function handleOpenChange(val: boolean) {
    if (isSubmitting) return;
    if (!val) {
      setName("");
      setPrice("");
    }
    setOpen(val);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      const created: Product = await addProduct(formData);
      dispatch(addProductToStore(created));
      toast.success("Product added successfully!");
      setOpen(false);
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

      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-800">
            Add New Product
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Package className="w-4 h-4 text-[#15689E]" />
              Product Name
            </label>
            <Input
              name="name"
              value={name}                                  // ✅ controlled
              onChange={(e) => setName(e.target.value)}    // ✅
              placeholder="e.g. Paracetamol 500mg"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <DollarSign className="w-4 h-4 text-[#15689E]" />
              Price
            </label>
            <Input
              name="price"
              type="number"
              min="0"
              step="0.01"
              value={price}                                 // ✅ controlled
              onChange={(e) => setPrice(e.target.value)}   // ✅
              placeholder="e.g. 99.00"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2">
            <SubmitButton
              type="button"
              variant="outline"
              size="default"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              classname="w-full sm:w-auto text-slate-600 cursor-pointer"
              cta={<span>Cancel</span>}
            />
            <SubmitButton
              type="submit"
              isPending={isSubmitting}
              disabled={!isFormValid || isSubmitting}       // ✅ guarded
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
