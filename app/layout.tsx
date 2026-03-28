import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/store/StoreProvider";
import { Toaster } from "react-hot-toast";
import { Providers } from "./(components)/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HB Medical",
  description:
    "HB Medical is seeking elite independent reps to own exclusive markets with our breakthrough Non-Hydrolyzed Collagen product — a clinically differentiated solution that sells itself.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning prevents next-themes hydration mismatch on theme class
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Provider order: ThemeProvider → HeroUIProvider → StoreProvider → children */}
        <Providers>
          <StoreProvider>
            <Toaster position="top-center" />
            {children}
          </StoreProvider>
        </Providers>
      </body>
    </html>
  );
}
