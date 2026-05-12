"use client";

import { Eye, EyeOff } from "lucide-react";

interface PasswordToggleProps {
  show: boolean;
  onToggle: () => void;
}

export function PasswordToggle({ show, onToggle }: PasswordToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? "Hide password" : "Show password"}
      className="text-[var(--text3)] hover:text-[var(--navy)] transition-colors"
    >
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}
