import type { Metadata } from "next";
import { Roboto, DM_Sans, DM_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import { StoreProvider } from "@/store/StoreProvider";
import { Toaster } from "react-hot-toast";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
});

const dmSans = DM_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meridian",
  description:
    "Meridian is seeking elite independent reps to own exclusive markets with our breakthrough Non-Hydrolyzed Collagen product — a clinically differentiated solution that sells itself.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <body className={`antialiased ${dmSans.className}`}>
        <StoreProvider>
          <NextTopLoader
            color="#0f2d4a"
            shadow="0 0 10px #0f2d4a, 0 0 5px #0f2d4a"
            height={7}
            showSpinner={false}
          />
          <Toaster
            position="top-right"
            gutter={10}
            toastOptions={{
              duration: 4000,
              style: {
                background: "#ffffff",
                color: "#0f2d4a",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "12px 14px",
                fontSize: "13px",
                fontWeight: 500,
                lineHeight: "1.4",
                maxWidth: "380px",
                boxShadow:
                  "0 10px 30px -10px rgba(15, 45, 74, 0.18), 0 4px 12px -4px rgba(15, 45, 74, 0.08)",
              },
              success: {
                iconTheme: { primary: "#15803d", secondary: "#f0fdf4" },
                style: { borderLeft: "4px solid #15803d" },
              },
              error: {
                iconTheme: { primary: "#dc2626", secondary: "#fef2f2" },
                style: { borderLeft: "4px solid #dc2626" },
              },
              loading: {
                iconTheme: { primary: "#0d7a6b", secondary: "#e0f5f2" },
                style: { borderLeft: "4px solid #0d7a6b" },
              },
            }}
          />
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
