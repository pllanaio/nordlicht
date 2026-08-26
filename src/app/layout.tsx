import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import Script from "next/script";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ContentDock — Content, der läuft",
    template: "%s | ContentDock",
  },
  description:
    "Plane, verfeinere und veröffentliche deinen Content für alle Kanäle in einem fokussierten Workflow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={manrope.variable}>
        {children}
        <ThemeToggle />
        <Script id="contentdock-theme" strategy="beforeInteractive">{`
          try {
            var savedTheme = localStorage.getItem('contentdock-theme-v1');
            var preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.dataset.theme = savedTheme || preferredTheme;
          } catch (error) {
            document.documentElement.dataset.theme = 'light';
          }
        `}</Script>
      </body>
    </html>
  );
}
