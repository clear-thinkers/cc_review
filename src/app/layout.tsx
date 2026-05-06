import type { Metadata } from "next";
import { Baloo_2, Geist_Mono, Nunito } from "next/font/google";
import LanguageToggle from "./LanguageToggle";
import { appStrings } from "./app.strings";
import "./globals.css";
import { LocaleProvider } from "./shared/locale";
import { AuthProvider } from "@/lib/authContext";
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
  applicationName: "HanziQuest",
  title: appStrings.en.metadata.title,
  description: appStrings.en.metadata.description,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HanziQuest",
  },
  icons: {
    icon: [
      { url: "/icons/logo-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/logo-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/logo-180.png", sizes: "180x180", type: "image/png" }],
  },
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
          <AuthProvider>
            <SessionGuard>
              <LanguageToggle />
              {children}
            </SessionGuard>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
