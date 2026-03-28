import { heroui } from "@heroui/react";

export default {
  content: ["./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}"],
  plugins: [
    heroui({
      themes: {
        dark: {
          colors: {
            background: "#1a3a4a",
            foreground: "#ffffff",
            primary: { DEFAULT: "#e8891a", foreground: "#ffffff" },
            content1: "#1e4a5f",
            content2: "#163344",
            default: { DEFAULT: "#2a5570", foreground: "#ffffff" },
          },
        },
        light: {
          colors: {
            background: "#f0f4f8",
            foreground: "#1a3a4a",
            primary: { DEFAULT: "#e8891a", foreground: "#ffffff" },
            content1: "#ffffff",
            content2: "#f0f4f8",
          },
        },
      },
    }),
  ],
};
