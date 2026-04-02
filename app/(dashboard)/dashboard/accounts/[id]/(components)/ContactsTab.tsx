"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, User, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { removeContactFromStore } from "@/app/(dashboard)/dashboard/(redux)/contacts-slice";
import { deactivateContact } from "@/app/(dashboard)/dashboard/(services)/contacts/actions";
import { ContactModal } from "./ContactModal";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { EmptyState } from "@/app/(components)/EmptyState";
import { staggerContainer, fadeUp } from "@/components/ui/animations";
import { cn } from "@/utils/utils";
import type { ContactPreferredContact } from "@/utils/interfaces/contacts";

const PREFERRED_LABELS: Record<ContactPreferredContact, string> = {
  email: "Prefers email",
  phone: "Prefers phone",
  either: "Email or phone",
};

interface ContactsTabProps {
  facilityId: string;
  isAdmin: boolean;
  isAssignedRep: boolean;
}

export function ContactsTab({ facilityId, isAdmin, isAssignedRep }: ContactsTabProps) {
  const dispatch = useAppDispatch();
  const contacts = useAppSelector((s) => s.contacts.items);
  const canManage = isAdmin || isAssignedRep;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDeactivate() {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deactivateContact(deleteId, facilityId);
      dispatch(removeContactFromStore(deleteId));
      toast.success("Contact removed.");
      setConfirmOpen(false);
    } catch {
      toast.error("Failed to remove contact.");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Header + Add button ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#64748B]">
          {contacts.length} active contact{contacts.length !== 1 ? "s" : ""}
        </p>
        {canManage && <ContactModal facilityId={facilityId} />}
      </div>

      {/* ── Contact cards ── */}
      {contacts.length === 0 ? (
        <EmptyState
          icon={<User className="w-10 h-10 stroke-1" />}
          message="No contacts yet"
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {contacts.map((contact) => (
            <motion.div
              key={contact.id}
              variants={fadeUp}
              className="bg-white border border-[#E2E8F0] rounded-xl p-4 space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
            >
              {/* Name + edit/delete */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A] truncate">
                    {contact.first_name} {contact.last_name}
                  </p>
                  {contact.title && (
                    <p className="text-xs text-[#94A3B8] truncate mt-0.5">
                      {contact.title}
                    </p>
                  )}
                </div>
                {canManage && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <ContactModal facilityId={facilityId} contact={contact} />
                    <button
                      type="button"
                      onClick={() => { setDeleteId(contact.id); setConfirmOpen(true); }}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-[#94A3B8] hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remove contact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Email */}
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-2 text-xs text-[#64748B] hover:text-[#15689E] transition-colors group"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{contact.email}</span>
                </a>
              )}

              {/* Phone */}
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-2 text-xs text-[#64748B] hover:text-[#15689E] transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{contact.phone}</span>
                </a>
              )}

              {/* Preferred method */}
              <div
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs",
                  contact.preferred_contact === "email"
                    ? "bg-[#EFF6FF] text-[#15689E]"
                    : contact.preferred_contact === "phone"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-[#F1F5F9] text-[#64748B]",
                )}
              >
                {PREFERRED_LABELS[contact.preferred_contact]}
              </div>

              {/* Notes */}
              {contact.notes && (
                <p className="text-xs text-[#94A3B8] line-clamp-2 border-t border-[#F1F5F9] pt-2">
                  {contact.notes}
                </p>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
      <ConfirmModal
        open={confirmOpen}
        onOpenChange={(v) => { if (!isDeleting) setConfirmOpen(v); }}
        onConfirm={handleDeactivate}
        isLoading={isDeleting}
        title="Remove Contact"
        description="This contact will be removed from the account. This action cannot be undone."
      />
    </div>
  );
}
