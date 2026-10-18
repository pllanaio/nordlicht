import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ContentDock — Ideen werden Videos",
    template: "%s | ContentDock",
  },
  description:
    "Erstelle Kurzvideos mit KI und veröffentliche auf Instagram, TikTok und YouTube.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">Zum Inhalt springen</a>
        {children}
        <Script id="contentdock-theme" strategy="beforeInteractive">{`
          try {
            var savedTheme = localStorage.getItem('contentdock-theme-v1');
            var preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.dataset.theme = (savedTheme === 'dark' || savedTheme === 'light') ? savedTheme : preferredTheme;
          } catch (error) {
            document.documentElement.dataset.theme = 'light';
          }
        `}</Script>
      </body>
    </html>
  );
}
