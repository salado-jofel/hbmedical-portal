/**
 * Centralized HeroUI v3 brand theme — single source of truth for colors.
 *
 * HeroUI v3 is CSS-variable-based (no Tailwind plugin needed).
 * These values are applied as overrides in app/globals.css.
 *
 * Token mapping (HeroUI v3 → brand):
 *   --accent / --accent-foreground  → primary action color (buttons, checkbox, switch)
 *   --background / --foreground     → page background / default text
 *   --surface / --surface-foreground → card / panel background (≈ content1 in v2)
 *   --surface-secondary             → secondary panel background (≈ content2 in v2)
 *
 * To add a new color:
 *   1. Add it here.
 *   2. Apply the CSS variable override in app/globals.css under :root (light) and .dark.
 *   3. Reference it in components via Tailwind utilities like text-accent, bg-surface, etc.
 *      (Tailwind utilities for HeroUI tokens are registered by @heroui/styles/themes/default)
 *
 * DO NOT hardcode these hex values directly in components.
 */

export const brandColors = {
  /** Primary action / orange accent — used by buttons, checkbox, switch, focus ring */
  accent: "#e8891a",
  accentForeground: "#ffffff",

  dark: {
    background: "#1a3a4a",
    foreground: "#ffffff",
    /** Card / panel surface */
    surface: "#1e4a5f",
    surfaceSecondary: "#1a3a4a",
  },

  light: {
    background: "#f0f4f8",
    foreground: "#1a3a4a",
    /** Card / panel surface */
    surface: "#ffffff",
    surfaceSecondary: "#f0f4f8",
  },
} as const;
