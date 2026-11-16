import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import RegisterSW from "@/components/RegisterSW";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Amigo secreto",
  description: "El amigo secreto de la familia, con sorteo cifrado.",
  appleWebApp: { capable: true, title: "Amigo secreto", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#CFCABF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={figtree.variable}>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
