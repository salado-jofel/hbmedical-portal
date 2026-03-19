"use client";

import { ReactNode } from "react";

interface RoleButtonProps {
  value: string;
  currentRole: string;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}

export function RoleButton({
  value,
  currentRole,
  onClick,
  icon,
  label,
}: RoleButtonProps) {
  const isActive = currentRole === value;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer"
      style={{
        borderColor: isActive ? "#00d4c8" : "rgba(255,255,255,0.1)",
        background: isActive ? "rgba(0,212,200,0.1)" : "rgba(255,255,255,0.03)",
        color: isActive ? "#00d4c8" : "rgba(255,255,255,0.35)",
      }}
    >
      {icon}
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}
