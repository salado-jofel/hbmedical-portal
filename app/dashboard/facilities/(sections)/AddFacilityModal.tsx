"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Phone, Plus, User } from "lucide-react";
import { addFacility } from "../(services)/actions";
import { useAppDispatch } from "@/store/hooks";
import { addFacilityToStore } from "../(redux)/facilities-slice";
import SubmitButton from "@/app/(components)/SubmitButton";
import type { Facility } from "@/app/(interfaces)/facility";

const FACILITY_TYPES: string[] = [
  "Hospital",
  "Clinic",
  "Pharmacy",
  "Laboratory",
  "Rehabilitation Center",
  "Dental Clinic",
  "Birthing Center",
];


function FieldWrapper({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

export function AddFacilityModal() {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    formData.set("type", type);
    setIsSubmitting(true);
    try {
      const created: Facility = await addFacility(formData);
      dispatch(addFacilityToStore(created));
      setOpen(false);
      setType("");
    } catch (err) {
      console.error("[AddFacilityModal]", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!isSubmitting) setOpen(val);
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-[#2db0b0] hover:bg-[#249191] text-white shadow-sm w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Facility
        </Button>
      </DialogTrigger>

      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md p-0 gap-0 overflow-hidden rounded-2xl max-h-[90dvh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-[#2db0b0] px-6 py-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-white text-base font-semibold">
                Add New Facility
              </DialogTitle>
              <p className="text-teal-100 text-xs mt-0.5">
                Fill in the details to register a new facility
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await handleSubmit(new FormData(e.currentTarget));
          }}
          className="px-6 py-5 space-y-4 overflow-y-auto"
        >
          <FieldWrapper label="Facility Name">
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                name="name"
                placeholder="e.g. St. Luke's Medical Center"
                required
                disabled={isSubmitting}
                className="pl-9 border-slate-200 focus-visible:ring-[#2db0b0] text-sm"
              />
            </div>
          </FieldWrapper>

          <FieldWrapper label="Facility Type">
            <Select
              value={type}
              onValueChange={setType}
              required
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full border-slate-200 focus:ring-[#2db0b0] text-sm">
                <SelectValue placeholder="Select facility type" />
              </SelectTrigger>
              <SelectContent>
                {FACILITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldWrapper>

          <FieldWrapper label="Contact Person">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                name="contact"
                placeholder="e.g. Dr. Juan dela Cruz"
                required
                disabled={isSubmitting}
                className="pl-9 border-slate-200 focus-visible:ring-[#2db0b0] text-sm"
              />
            </div>
          </FieldWrapper>

          <FieldWrapper label="Phone">
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                name="phone"
                type="tel"
                placeholder="e.g. +63 912 345 6789"
                required
                disabled={isSubmitting}
                className="pl-9 border-slate-200 focus-visible:ring-[#2db0b0] text-sm"
              />
            </div>
          </FieldWrapper>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1 pb-1">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              className="flex-1 border-slate-200 text-slate-600 hover:bg-slate-50 text-sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <SubmitButton
              type="submit"
              isPending={isSubmitting}
              isPendingMesssage="Saving..."
              cta="Save Facility"
              variant={null}
              size="default"
              classname="flex-1 bg-[#2db0b0] hover:bg-[#249191] text-white text-sm shadow-sm"
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
