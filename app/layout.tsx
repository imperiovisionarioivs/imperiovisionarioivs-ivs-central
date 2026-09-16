import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

// URL pública deste app — usada para gerar links absolutos (ex: og:url) e
// para checagens client-side (manifest, start_url). Configurável via
// NEXT_PUBLIC_APP_URL para não engessar o domínio no código; o valor padrão
// é o domínio definitivo combinado (subdomínio próprio, separado do site
// institucional que já vive em imperiovisionario.com.br / www).
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.imperiovisionario.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "IVS Central da Agência",
  description: "CRM e operação privada da Império Visionário.",
  manifest: "/manifest.webmanifest",
  applicationName: "IVS Central",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "IVS Central",
  },
  icons: {
    icon: [
      { url: "/icons/ivs-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/ivs-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/ivs-192.png", sizes: "192x192", type: "image/png" }],
  },
  // Ferramenta interna e privada, autenticada — nunca deve ser indexada por
  // buscadores (não é o site institucional). Reforçado também por
  // public/robots.txt.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0b0d",
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
