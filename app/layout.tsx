import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/store/StoreProvider";
import { Toaster } from "react-hot-toast";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
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
    <html lang="en" className={roboto.variable}>
      <body className="antialiased">
        <StoreProvider>
          <Toaster position="top-center" />
          {children}</StoreProvider>
      </body>
    </html>
  );
}
