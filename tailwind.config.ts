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
            primary: {
              50: "#fff3e0",
              100: "#ffe0b2",
              200: "#ffcc80",
              300: "#ffb74d",
              400: "#ffa726",
              500: "#e8891a",
              600: "#d4750f",
              700: "#bf620a",
              800: "#a54e05",
              900: "#8c3d00",
              DEFAULT: "#e8891a",
              foreground: "#ffffff",
            },
            content1: "#1e4a5f",
            content2: "#163344",
            default: { DEFAULT: "#2a5570", foreground: "#ffffff" },
          },
        },
        light: {
          colors: {
            background: "#f0f4f8",
            foreground: "#1a3a4a",
            primary: {
              50: "#fff3e0",
              100: "#ffe0b2",
              200: "#ffcc80",
              300: "#ffb74d",
              400: "#ffa726",
              500: "#e8891a",
              600: "#d4750f",
              700: "#bf620a",
              800: "#a54e05",
              900: "#8c3d00",
              DEFAULT: "#e8891a",
              foreground: "#ffffff",
            },
            content1: "#ffffff",
            content2: "#f0f4f8",
          },
        },
      },
    }),
  ],
};
