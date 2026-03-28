"use client";

import { HeroUIProvider } from "@heroui/react";
import { ThemeProvider } from "next-themes";
import { useRouter } from "next/navigation";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <HeroUIProvider navigate={router.push}>
        {children}
      </HeroUIProvider>
    </ThemeProvider>
  );
}
