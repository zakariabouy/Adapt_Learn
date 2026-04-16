import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, IBM_Plex_Sans } from "next/font/google";
import DemoSwitcher from "@/components/DemoSwitcher";
import PedagogicalHero from "@/components/ui/PedagogicalHero";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial pair used by the /teacher/pending review queue.
// Fraunces = characterful display serif. IBM Plex Sans = refined body.
// Kept as CSS variables so only the editorial-scope opts in.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AdaptLearn — Agentic AI for Inclusive Education",
  description: "AI-powered inclusive education platform that adapts to each student's unique learning style using multi-agent AI.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${ibmPlexSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <DemoSwitcher />
        <PedagogicalHero />
      </body>
    </html>
  );
}
