import type { Metadata, Viewport } from "next";
import "./workend.css";
import { meta, jsonLdLanding } from "./seo";
import { SCRIPT_NATAL } from "@/office/data/natal";
import { ClasseNatal } from "./_natal";
import { AvisoContaExcluida } from "./_aviso-conta";
import { Medicao } from "./_medicao";

export const metadata: Metadata = meta({ caminho: "/" });
export const viewport: Viewport = { themeColor: "#DFE5EC", width: "device-width", initialScale: 1, colorScheme: "light" };

export default function WorkendLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="we">
      {/* Natal (20/11 a 6/1): põe a classe we-natal no <html> antes de pintar (sininho do logotipo); ?natal=0 desliga */}
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_NATAL }} />
      <ClasseNatal />
      {/* Inter é a fonte de interface; o logotipo é vetor (não carrega Archivo) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet" />
      {/* dados estruturados (organização, site, produto, página e vídeo) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdLanding()) }} />
      {children}
      {/* depois de excluir a conta (/?conta=excluida): o aviso de que ela foi excluída */}
      <AvisoContaExcluida />
      {/* aviso de cookies e medição (WE-01): nada de fora carrega antes do aceite */}
      <Medicao />
    </div>
  );
}
