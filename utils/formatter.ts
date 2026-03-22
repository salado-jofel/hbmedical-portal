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

export const formatStatus = (status: string | null | undefined): string => {
  if (!status) return "";

  // 1. Replace all underscores with spaces
  const spaced = status.replace(/_/g, " ");

  // 2. Capitalize only the first letter
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
};
