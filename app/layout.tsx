import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "WPShield",
  description: "Cybernara WPShield — Security Monitoring Dashboard",
  icons: {
    icon: "/logos/cn-icon.png",
  },
};

// Reads the saved theme and applies the `dark` class to <html> before React
// hydrates. Without this, the page would always render in light mode first
// (server has no access to localStorage) and then flash to dark a moment
// after JS loads — this inline script runs synchronously during initial
// parse, before paint, so there's no flash either way.
const themeInitScript = `
(function() {
  try {
    var theme = localStorage.getItem('wpshield_theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}