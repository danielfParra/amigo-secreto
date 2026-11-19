import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import ChatNotifier from "@/components/ChatNotifier";
import FirstVisit from "@/components/FirstVisit";
import RegisterSW from "@/components/RegisterSW";
import Snow from "@/components/Snow";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
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
  themeColor: "#0A4D31",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const CONTRACT = `<!--
THESIS: a standard, friendly app dressed for Christmas: cards, rows and pill buttons in Public Sans, never a themed novelty UI.
OWN-WORLD: pine green #0E6B3F / deep pine #0A4D31, holly red #C8102E, snow white; snowflake texture, falling snowflakes, snowy pines along the bottom, holly corner.
STORY: join with your name, write three wishes, watch the group fill up, then open your secret friend and chat anonymously.
FIRST VIEWPORT: deep-pine cover, headline, pines and a gift tree scene, white Empezar button.
FORM: standard modern app (user-chosen after the sticker-album trial); seed key 1f5c7560 for the earlier roll.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={publicSans.variable}>
      <body>
        <div hidden dangerouslySetInnerHTML={{ __html: CONTRACT }} />
        {children}
        <ChatNotifier />
        <FirstVisit />
        <Snow />
        <RegisterSW />
      </body>
    </html>
  );
}
