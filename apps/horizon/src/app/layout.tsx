import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Providers } from "./providers";
import { SSEProvider } from "@/components/SSEProvider";

const font = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Horizon - Owner Interface",
  description: "Visitor management system for property owners",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={font.className}>
        <Providers>
          <SSEProvider>{children}</SSEProvider>
          <Toaster />
          <Sonner position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
