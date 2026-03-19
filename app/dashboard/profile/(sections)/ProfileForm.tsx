"use client";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateProfileInStore } from "../(redux)/profile-slice";
import { updateProfile } from "../(services)/actions";
import { Input } from "@/components/ui/input";
import SubmitButton from "@/app/(components)/SubmitButton";
import { User, Mail, Phone, Save } from "lucide-react";
import { useState } from "react";

function FieldLabel({
  icon: Icon,
  label,
  color = "text-[#2db0b0]",
}: {
  icon: React.ElementType;
  label: string;
  color?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-medium ${color} mb-1`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </div>
  );
}

export default function ProfileForm() {
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state) => state.profile.item);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    setSaving(true);
    try {
      await updateProfile(formData);
      dispatch(
        updateProfileInStore({
          first_name: formData.get("first_name") as string,
          last_name: formData.get("last_name") as string,
          email: formData.get("email") as string,
          phone: formData.get("phone") as string,
        }),
      );
    } catch (err) {
      console.error("[ProfileForm] Error:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Row: First Name + Last Name ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel icon={User} label="First Name" />
            <Input
              name="first_name"
              defaultValue={profile?.first_name ?? ""}
              placeholder="First name"
              disabled={saving}
              className="border-slate-200 focus-visible:ring-[#2db0b0]"
            />
          </div>
          <div>
            <FieldLabel icon={User} label="Last Name" />
            <Input
              name="last_name"
              defaultValue={profile?.last_name ?? ""}
              placeholder="Last name"
              disabled={saving}
              className="border-slate-200 focus-visible:ring-[#2db0b0]"
            />
          </div>
        </div>

        {/* ── Row: Email ── */}
        <div>
          <FieldLabel icon={Mail} label="Email" color="text-emerald-500" />
          <Input
            name="email"
            type="email"
            defaultValue={profile?.email ?? ""}
            placeholder="email@example.com"
            disabled={saving}
            className="border-slate-200 focus-visible:ring-[#2db0b0]"
          />
        </div>

        {/* ── Row: Phone ── */}
        <div>
          <FieldLabel icon={Phone} label="Phone" color="text-slate-400" />
          <Input
            name="phone"
            type="tel"
            defaultValue={profile?.phone ?? ""}
            placeholder="+63 9XX XXX XXXX"
            disabled={saving}
            className="border-slate-200 focus-visible:ring-[#2db0b0]"
          />
        </div>

        {/* ── Save Button ── */}
        <SubmitButton
          type="submit"
          isPending={saving}
          isPendingMesssage="Saving..."
          cta={
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          }
          variant={null}
          size="default"
          classname="w-full sm:w-auto bg-[#2db0b0] hover:bg-[#249191] text-white"
        />
      </form>
    </div>
  );
}
