import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Reads",
  description: "Your curated reading list, powered by AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.cdnfonts.com/css/switzer"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
