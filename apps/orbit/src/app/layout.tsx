/**
 * Root Layout with Toaster and SSE
 */
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { SSEProvider } from "@/components/SSEProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Orbit - Guard Interface",
  description: "Visitor management system for security guards",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SSEProvider>{children}</SSEProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#fff",
              color: "#363636",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            },
            success: {
              iconTheme: {
                primary: "#10b981",
                secondary: "#fff",
              },
            },
            error: {
              iconTheme: {
                primary: "#ef4444",
                secondary: "#fff",
              },
            },
          }}
        />
      </body>
    </html>
  );
}
