"use client";

import { Switch } from "@heroui/react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = theme === "dark";

  return (
    <Switch
      aria-label="Toggle theme"
      size="sm"
      color="primary"
      isSelected={isDark}
      onValueChange={(checked) => setTheme(checked ? "dark" : "light")}
      thumbIcon={({ isSelected, className }) =>
        isSelected ? (
          <Moon className={className} />
        ) : (
          <Sun className={className} />
        )
      }
    />
  );
}
