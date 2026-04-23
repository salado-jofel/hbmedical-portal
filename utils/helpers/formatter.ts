export const formatDate = (dateStr?: string | null): string =>
  dateStr
    ? new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

export const formatAmount = (amount?: number | null): string =>
  `$${(amount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

// Statuses that need plain, non-technical wording in the UI. Keep in sync
// with KANBAN_STATUS_CONFIG / OrderStatusBadge / orders filter options —
// this is the fallback for anywhere that accidentally renders the raw
// underscored enum value (charts, toasts, activity feeds).
const STATUS_DISPLAY_OVERRIDES: Record<string, string> = {
  manufacturer_review: "Under Review",
  additional_info_needed: "Needs More Info",
};

export const formatStatus = (status: string | null | undefined): string => {
  if (!status) return "";

  const override = STATUS_DISPLAY_OVERRIDES[status];
  if (override) return override;

  // 1. Replace all underscores with spaces
  const spaced = status.replace(/_/g, " ");

  // 2. Capitalize only the first letter
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
};
