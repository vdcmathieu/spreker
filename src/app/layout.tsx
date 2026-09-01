import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Splash } from "@/components/Splash";

/**
 * One superfamily, separated by the width axis rather than by family. The
 * `wdth` axis is loaded because the headline animates along it — see DESIGN.md.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/**
 * The canonical origin, and the sub-path the lab host serves this project from.
 * They are separate because `metadataBase` resolves absolute paths against the
 * origin only — the base path has to be written into the asset URL itself.
 */
const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lab.vandecatsije.com";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const ogImage = `${basePath}/og.png`;

export const metadata: Metadata = {
  metadataBase: new URL(origin),
  title: "Spreker — party speakers, rented by the room",
  description:
    "Tell us the space and how many people are coming. We work out how loud it has to be, bring the rig that gets there, set it up and take it away.",
  openGraph: {
    title: "Spreker — party speakers, rented by the room",
    description:
      "Tell us the space and how many people are coming. We bring the rig that fills it.",
    type: "website",
    url: `${origin}${basePath}`,
    images: [{ url: ogImage, width: 1200, height: 630, alt: "A powered speaker cabinet lit violet and amber, beside the words: as loud as the room can take" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Spreker — party speakers, rented by the room",
    description:
      "Tell us the space and how many people are coming. We bring the rig that fills it.",
    images: [ogImage],
  },
};

export const viewport: Viewport = {
  themeColor: "#07060b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${archivo.variable} ${plexMono.variable} h-full`}>
      <body className="min-h-full">
        <Splash />
        {children}
      </body>
    </html>
  );
}
