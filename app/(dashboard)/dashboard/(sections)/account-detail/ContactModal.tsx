"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createContact,
  updateContact,
  getContactsByFacility,
} from "@/app/(dashboard)/dashboard/(services)/contacts/actions";
import { useAppDispatch } from "@/store/hooks";
import { setContacts } from "@/app/(dashboard)/dashboard/(redux)/contacts-slice";
import type { IContact, IContactFormState } from "@/utils/interfaces/contacts";
import { PhoneInputField } from "@/app/(components)/PhoneInputField";

const PREFERRED_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "either", label: "Either" },
];

interface ContactModalProps {
  facilityId: string;
  contact?: IContact;
}

export function ContactModal({ facilityId, contact }: ContactModalProps) {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const isEdit = !!contact;
  const [phone, setPhone] = useState(contact?.phone ?? "");

  const action = isEdit
    ? updateContact.bind(null, contact.id, facilityId)
    : createContact.bind(null, facilityId);

  const [state, formAction, isPending] = useActionState<
    IContactFormState | null,
    FormData
  >(action, null);

  // On success: close dialog, sync fresh contacts into Redux
  useEffect(() => {
    if (!state?.success) return;
    setOpen(false);
    formRef.current?.reset();
    setPhone(contact?.phone ?? "");
    getContactsByFacility(facilityId).then((fresh) => {
      dispatch(setContacts(fresh));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.success, facilityId, dispatch]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="w-7 h-7">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            className="gap-1.5 bg-[#15689E] hover:bg-[#125d8e] text-white"
          >
            <Plus className="w-4 h-4" />
            Add Contact
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Contact" : "New Contact"}</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="space-y-4 mt-2">
          {/* ── First Name + Last Name ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name" className="text-xs">
                First name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="first_name"
                name="first_name"
                required
                defaultValue={contact?.first_name ?? ""}
                placeholder="Jane"
                className="h-9 text-sm"
              />
              {state?.fieldErrors?.first_name && (
                <p className="text-xs text-red-500">{state.fieldErrors.first_name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name" className="text-xs">
                Last name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="last_name"
                name="last_name"
                required
                defaultValue={contact?.last_name ?? ""}
                placeholder="Smith"
                className="h-9 text-sm"
              />
              {state?.fieldErrors?.last_name && (
                <p className="text-xs text-red-500">{state.fieldErrors.last_name}</p>
              )}
            </div>
          </div>

          {/* ── Title ── */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs">
              Title <span className="text-red-400">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={contact?.title ?? ""}
              placeholder="Director of Operations"
              className="h-9 text-sm"
            />
            {state?.fieldErrors?.title && (
              <p className="text-xs text-red-500">{state.fieldErrors.title}</p>
            )}
          </div>

          {/* ── Email ── */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">
              Email <span className="text-red-400">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={contact?.email ?? ""}
              placeholder="jane@hospital.com"
              className="h-9 text-sm"
            />
            {state?.fieldErrors?.email && (
              <p className="text-xs text-red-500">{state.fieldErrors.email}</p>
            )}
          </div>

          {/* ── Phone ── */}
          <PhoneInputField
            value={phone}
            onChange={(val) => setPhone(val)}
            label="Phone Number"
            required={true}
            theme="light"
            error={state?.fieldErrors?.phone}
          />
          <input type="hidden" name="phone" value={phone} />

          {/* ── Preferred contact ── */}
          <div className="space-y-1.5">
            <Label htmlFor="preferred_contact" className="text-xs">
              Preferred contact method <span className="text-red-400">*</span>
            </Label>
            <Select
              name="preferred_contact"
              defaultValue={contact?.preferred_contact ?? "email"}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PREFERRED_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-sm">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state?.fieldErrors?.preferred_contact && (
              <p className="text-xs text-red-500">{state.fieldErrors.preferred_contact}</p>
            )}
          </div>

          {/* ── Notes ── */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs">
              Notes
            </Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={contact?.notes ?? ""}
              placeholder="Any additional context..."
              className="text-sm resize-none h-20"
            />
          </div>

          {/* ── Top-level error ── */}
          {state?.error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          {/* ── Actions ── */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="w-full sm:w-auto bg-[#15689E] hover:bg-[#15689E]/90 text-white gap-1.5"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? "Save changes" : "Add contact"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
