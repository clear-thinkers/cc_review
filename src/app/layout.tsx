import type { Metadata } from "next";
import { Baloo_2, Geist_Mono, Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const balooDisplay = Baloo_2({
  variable: "--font-baloo-display",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "汉字复习游戏 Chinese Character Review Game",
  description: "汉字复习游戏 Chinese Character Review Game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${nunito.variable} ${balooDisplay.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
