import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/lib/web3/WalletProvider";
import { AuthProvider } from "@/lib/auth/AuthProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TenderChain",
  description:
    "Blockchain-based tender management with stake-backed verification and public transparency",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-gradient-to-br from-brand-from to-brand-to">
        <WalletProvider>
          {/* AuthProvider depends on the wallet signer, so it nests inside. */}
          <AuthProvider>{children}</AuthProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
