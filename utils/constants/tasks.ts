export const GROUP_CONFIG = {
  overdue: {
    label: "Overdue",
    dotClass: "bg-red-500",
    emptyLabel: "No overdue tasks",
  },
  today: {
    label: "Due Today",
    dotClass: "bg-[#e8821a]",
    emptyLabel: "Nothing due today",
  },
  upcoming: {
    label: "Upcoming",
    dotClass: "bg-[#15689E]",
    emptyLabel: "No upcoming tasks",
  },
  done: {
    label: "Completed",
    dotClass: "bg-[#94A3B8]",
    emptyLabel: "No completed tasks",
  },
} as const;
