"use client";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { PhoneInputField } from "@/app/(components)/PhoneInputField";
import { updateProfileInStore } from "../(redux)/profile-slice";
import { updateProfile } from "../(services)/actions";
import { Input } from "@/components/ui/input";
import SubmitButton from "@/app/(components)/SubmitButton";
import { User, Mail, Save } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

function FieldLabel({
  icon: Icon,
  label,
  color = "text-[#15689E]",
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
  const [phone, setPhone] = useState(profile?.phone ?? "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    setSaving(true);
    try {
      await updateProfile(null, formData);
      dispatch(
        updateProfileInStore({
          first_name: formData.get("first_name") as string,
          last_name: formData.get("last_name") as string,
          email: formData.get("email") as string,
          phone: formData.get("phone") as string,
        }),
      );
      toast.success("Profile saved successfully!");
    } catch (err) {
      console.error("[ProfileForm] Error:", err);
      toast.error("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-6">
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
              className="border-[#E2E8F0] focus-visible:ring-[#15689E]/10 focus-visible:border-[#15689E]"
            />
          </div>
          <div>
            <FieldLabel icon={User} label="Last Name" />
            <Input
              name="last_name"
              defaultValue={profile?.last_name ?? ""}
              placeholder="Last name"
              disabled={saving}
              className="border-[#E2E8F0] focus-visible:ring-[#15689E]/10 focus-visible:border-[#15689E]"
            />
          </div>
        </div>

        {/* ── Row: Phone ── */}
        <PhoneInputField
          value={phone}
          onChange={(val) => setPhone(val)}
          label="Phone"
          theme="light"
        />
        {phone && <input type="hidden" name="phone" value={phone} />}

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
          classname="w-full sm:w-auto bg-[#15689E] hover:bg-[#125d8e] text-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
        />
      </form>
    </div>
  );
}
