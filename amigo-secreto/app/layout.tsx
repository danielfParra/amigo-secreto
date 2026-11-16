import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Public_Sans } from "next/font/google";
import RegisterSW from "@/components/RegisterSW";
import Snow from "@/components/Snow";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: "Amigo secreto",
  description: "El amigo secreto de la familia, con sorteo cifrado.",
  appleWebApp: { capable: true, title: "Amigo secreto", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#2338F5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const CONTRACT = `<!--
THESIS: Amigo secreto is a sticker album. Each person is a numbered slot that fills with a die-cut sticker; the draw is a sealed pack. Refuses the tidy rounded-card app.
OWN-WORLD: cover blue #2338F5, paper #F6F7FF, sticker yellow/red/green/purple, ink navy; white die-cut edges, perforated packs, foil sweep, dotted album grid, Bricolage Grotesque display.
STORY: you see the album fill up, write your wishes, then tear the pack open and a sticker slaps on with the name of who you give to.
FIRST VIEWPORT: blue cover, headline top, collage of three stickers and a pack, yellow Empezar button at the bottom.
FORM: album de laminas (Panini), candidate 7 of 7, seed key 1f5c7560.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${publicSans.variable} ${display.variable}`}>
      <body>
        <div hidden dangerouslySetInnerHTML={{ __html: CONTRACT }} />
        {children}
        <Snow />
        <RegisterSW />
      </body>
    </html>
  );
}
