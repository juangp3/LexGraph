import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { CommandSearch } from "@/features/search/CommandSearch";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

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
      <body className={spaceGrotesk.className}>
        <Providers>
          {children}
          <CommandSearch />
        </Providers>
      </body>
    </html>
  );
}
