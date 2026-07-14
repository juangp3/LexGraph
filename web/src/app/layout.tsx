import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { CommandSearch } from "@/features/search/CommandSearch";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LexGraph",
  description: "The etymological graph explorer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          {children}
          <CommandSearch />
        </Providers>
      </body>
    </html>
  );
}
