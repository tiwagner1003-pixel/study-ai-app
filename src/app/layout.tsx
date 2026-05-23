import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Study AI",
  description: "PDFs in Lernmaterial verwandeln",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
