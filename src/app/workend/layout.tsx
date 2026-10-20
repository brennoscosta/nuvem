import type { Metadata, Viewport } from "next";
import "./workend.css";
import { meta, jsonLdLanding } from "./seo";

export const metadata: Metadata = meta({ caminho: "/" });
export const viewport: Viewport = { themeColor: "#FFFFFF", width: "device-width", initialScale: 1, colorScheme: "light" };

export default function WorkendLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="we">
      {/* Inter em todos os pesos (títulos pesados, estilo notion.com) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      {/* dados estruturados (organização, site, produto, página e vídeo) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdLanding()) }} />
      {children}
    </div>
  );
}
