import type { Metadata } from "next";
import "./workend.css";

export const metadata: Metadata = {
  title: "WorkEnd — o escritório virtual da sua empresa",
  description: "Agentes de IA especialistas trabalham no seu escritório virtual e você recebe relatórios completos de campanhas, faturamento e custos. Você é o CEO.",
  icons: { icon: "/workend/icone-64.png", apple: "/workend/icone-192.png" },
  openGraph: { title: "WorkEnd — o escritório virtual da sua empresa", description: "Agentes de IA especialistas fazem o trabalho. Você recebe os relatórios.", images: ["/workend/poster.jpg"], locale: "pt_BR", type: "website" },
};

export default function WorkendLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="we">
      {/* Sora pros títulos (geométrica, casa com o wordmark do logo); Inter no corpo */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      {children}
    </div>
  );
}
