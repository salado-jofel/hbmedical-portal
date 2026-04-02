"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import { ROLE_LABELS } from "@/utils/helpers/role";
import type { Profile } from "@/utils/interfaces/profiles";

interface ProfileTabProps {
  profile: Profile;
}

export function ProfileTab({ profile }: ProfileTabProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      await updateProfile(formData);
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="first_name" className="text-xs">First name</Label>
          <Input
            id="first_name"
            name="first_name"
            defaultValue={profile.first_name}
            required
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="last_name" className="text-xs">Last name</Label>
          <Input
            id="last_name"
            name="last_name"
            defaultValue={profile.last_name}
            required
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-xs">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={profile.email}
          required
          className="h-9 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone" className="text-xs">Phone</Label>
        <Input
          id="phone"
          name="phone"
          defaultValue={profile.phone}
          className="h-9 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Role</Label>
        <div className="h-9 px-3 flex items-center rounded-md border border-input bg-slate-50 text-sm text-slate-500">
          {ROLE_LABELS[profile.role] ?? profile.role}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          size="sm"
          disabled={isPending}
          className="bg-[#15689E] hover:bg-[#15689E]/90 text-white gap-1.5"
        >
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
