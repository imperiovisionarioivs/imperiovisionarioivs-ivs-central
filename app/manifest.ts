import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "IVS Central da Agência",
    short_name: "IVS Central",
    description: "CRM e operação privada da Império Visionário.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0a0b0d",
    theme_color: "#0a0b0d",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/ivs-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/ivs-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/ivs-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
