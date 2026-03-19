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
      className="transition-colors"
      style={{ color: "rgba(255,255,255,0.35)" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#00d4c8")}
      onMouseLeave={(e) =>
        (e.currentTarget.style.color = "rgba(255,255,255,0.35)")
      }
    >
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );
}
