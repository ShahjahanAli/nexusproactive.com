import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Nexus Widget — Action-Native Chatbot for Your Backend',
  description:
    'Discover, classify, and safely execute backend APIs from your website chatbot. OpenAPI ingestion, risk-tiered actions, undo ledger, and inline approvals.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full min-h-screen antialiased`}
    >
      <body className="flex min-h-screen flex-1 flex-col bg-[#070908]">{children}</body>
    </html>
  );
}
