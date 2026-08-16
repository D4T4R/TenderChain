import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/lib/web3/WalletProvider";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme/ThemeProvider";

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
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the stored theme before first paint. Without this the page
            renders light and then snaps to dark on hydration. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-bg text-text">
        <ThemeProvider>
          <WalletProvider>
            {/* AuthProvider depends on the wallet signer, so it nests inside. */}
            <AuthProvider>{children}</AuthProvider>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
