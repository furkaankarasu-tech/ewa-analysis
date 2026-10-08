import type { Metadata } from "next";
import "./globals.css";
import "./bilingual.css";
import "./detail-panels.css";
import "./modern-theme.css";

export const metadata: Metadata = {
  title: "EWA Radar | SAP Basis rapor analizi",
  description: "SAP ABAP/HANA EarlyWatch Alert raporlarından sayısal bulgular ve aksiyon listesi çıkaran Basis çalışma alanı.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
