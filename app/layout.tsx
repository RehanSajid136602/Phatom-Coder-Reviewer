import type { Metadata } from "next";
import { DM_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  weight: ["300", "400", "500"],
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PHANTOM — AI Code Reviewer",
  description: "Surgical-precision AI code reviews",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg",
        color: "#0a0a0a",
      },
    ],
  },
  manifest: "/site.webmanifest",
  themeColor: "#0a0a0a",
  openGraph: {
    title: "PHANTOM — AI Code Reviewer",
    description: "Surgical-precision AI code reviews",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PHANTOM — AI Code Reviewer",
    description: "Surgical-precision AI code reviews",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmMono.variable} ${instrumentSerif.variable}`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
