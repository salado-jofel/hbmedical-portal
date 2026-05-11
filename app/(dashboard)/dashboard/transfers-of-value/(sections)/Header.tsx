"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CreateReportModal } from "../(components)/CreateReportModal";
import type { IRepProfile } from "@/utils/interfaces/accounts";

export function Header({
  canCreate,
  admin,
  reps,
  selectedRepId,
}: {
  canCreate: boolean;
  admin: boolean;
  reps: IRepProfile[];
  selectedRepId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleRepChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "__all__") {
      params.delete("rep");
    } else {
      params.set("rep", value);
    }
    const next = params.toString();
    router.push(next ? `${pathname}?${next}` : pathname);
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        {admin && reps.length > 0 ? (
          <div className="flex flex-col gap-1 sm:max-w-xs sm:w-full">
            <Label className="text-xs">Filter by representative</Label>
            <Select
              value={selectedRepId ?? "__all__"}
              onValueChange={handleRepChange}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All reps</SelectItem>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.first_name} {r.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div />
        )}

        {canCreate && (
          <Button
            type="button"
            onClick={() => setOpen(true)}
            className="h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white rounded-lg shadow-sm self-end sm:self-auto"
          >
            <Plus className="w-4 h-4 mr-1.5" strokeWidth={2} />
            New monthly report
          </Button>
        )}
      </div>
      <CreateReportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
