import type { Metadata } from "next";
import { Baloo_2, Geist_Mono, Nunito } from "next/font/google";
import LanguageToggle from "./LanguageToggle";
import { appStrings } from "./app.strings";
import "./globals.css";
import { LocaleProvider } from "./shared/locale";
import { SessionGuard } from "./SessionGuard";

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
  title: appStrings.en.metadata.title,
  description: appStrings.en.metadata.description,
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
        <LocaleProvider>
          <SessionGuard>
            <LanguageToggle />
            {children}
          </SessionGuard>
        </LocaleProvider>
      </body>
    </html>
  );
}
