import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chronos | Solana Token Dashboard",
  description: "Real-time Solana token tracker powered by DexScreener and Jupiter",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#0a0a0a] text-white font-sans">
        {children}
      </body>
    </html>
  );
}
