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
            showSpinner={true}
          />
          <Toaster position="top-center" />
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
