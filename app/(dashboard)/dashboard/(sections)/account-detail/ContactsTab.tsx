"use client";

import { useTransition } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, User, Trash2 } from "lucide-react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { removeContactFromStore } from "@/app/(dashboard)/dashboard/(redux)/contacts-slice";
import { deactivateContact } from "@/app/(dashboard)/dashboard/(services)/contacts/actions";
import { ContactModal } from "./ContactModal";
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

  const [, startTransition] = useTransition();

  function handleDeactivate(contactId: string) {
    startTransition(async () => {
      try {
        await deactivateContact(contactId, facilityId);
        dispatch(removeContactFromStore(contactId));
      } catch {
        // Silent — user stays on page
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* ── Header + Add button ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
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
              className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
            >
              {/* Name + edit/delete */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {contact.first_name} {contact.last_name}
                  </p>
                  {contact.title && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {contact.title}
                    </p>
                  )}
                </div>
                {canManage && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <ContactModal facilityId={facilityId} contact={contact} />
                    <button
                      type="button"
                      onClick={() => handleDeactivate(contact.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-[#15689E] transition-colors group"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{contact.email}</span>
                </a>
              )}

              {/* Phone */}
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-[#15689E] transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{contact.phone}</span>
                </a>
              )}

              {/* Preferred method */}
              <div
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs border",
                  contact.preferred_contact === "email"
                    ? "bg-blue-50 text-[#15689E] border-blue-200"
                    : contact.preferred_contact === "phone"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-50 text-slate-500 border-slate-200",
                )}
              >
                {PREFERRED_LABELS[contact.preferred_contact]}
              </div>

              {/* Notes */}
              {contact.notes && (
                <p className="text-xs text-slate-400 line-clamp-2 border-t border-slate-100 pt-2">
                  {contact.notes}
                </p>
              )}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
