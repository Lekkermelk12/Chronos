import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chronos | Solana Time Machine",
  description: "Track old Raydium coins, TikTok coins, and reversal plays on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased" style={{ background: "#1a0f07", color: "#f5e6c8", fontFamily: "'Georgia', 'Times New Roman', serif" }}>
        {children}
      </body>
    </html>
  );
}
