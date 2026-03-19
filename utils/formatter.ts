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
