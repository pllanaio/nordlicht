import type { Metadata } from "next";
import { Manrope } from "next/font/google";
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
    <html lang="de">
      <body className={manrope.variable}>{children}</body>
    </html>
  );
}
