// SEO do WorkEnd: base dos metadados, imagem OG e dados estruturados (JSON-LD). Usado pelo layout e pelas páginas.
import type { Metadata } from "next";

export const SITE = "https://workend.online";
export const NOME = "WorkEnd";
export const TITULO = "WorkEnd — o escritório virtual da sua empresa com agentes de IA";
export const DESCRICAO = "Monte os setores da sua empresa, contrate agentes de IA especialistas já treinados e receba relatórios de campanhas, faturamento e custos. Você é o CEO.";
export const OG = { url: "/workend/og.jpg", width: 1200, height: 630, alt: "WorkEnd — o escritório onde agentes de IA trabalham por você" };

// Metadados-base (herdados por todas as páginas do site). Cada página passa título/descrição/canonical próprios.
export function meta(d: { titulo?: string; descricao?: string; caminho: string; indexar?: boolean }): Metadata {
  const title = d.titulo ?? TITULO;
  const description = d.descricao ?? DESCRICAO;
  const url = `${SITE}${d.caminho}`;
  const indexar = d.indexar ?? true;
  return {
    metadataBase: new URL(SITE),
    title,
    description,
    applicationName: NOME,
    keywords: ["escritório virtual", "agentes de IA", "automação de marketing", "gestão de tráfego com IA", "social media com IA", "relatórios automáticos", "equipe de IA", "SaaS para empresas", "WorkEnd"],
    authors: [{ name: NOME, url: SITE }],
    creator: NOME,
    publisher: NOME,
    category: "technology",
    alternates: { canonical: url, languages: { "pt-BR": url } },
    robots: indexar
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } }
      : { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    openGraph: { type: "website", url, siteName: NOME, locale: "pt_BR", title, description, images: [OG] },
    twitter: { card: "summary_large_image", title, description, images: [OG.url] },
    icons: { icon: [{ url: "/workend/icone-64.png", sizes: "64x64", type: "image/png" }, { url: "/workend/icone-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/workend/icone-192.png", sizes: "192x192" }], shortcut: "/workend/icone-64.png" },
    manifest: "/workend/manifest.webmanifest",
    formatDetection: { telephone: false, email: false, address: false },
    other: { "format-detection": "telephone=no" },
  };
}

// Dados estruturados da landing: organização, site e o produto (aplicação web, grátis pra entrar).
export function jsonLdLanding() {
  const org = { "@type": "Organization", "@id": `${SITE}/#org`, name: NOME, url: SITE, logo: `${SITE}/workend/icone-192.png`, email: "contato@workend.online", sameAs: [] as string[] };
  const site = { "@type": "WebSite", "@id": `${SITE}/#site`, url: SITE, name: NOME, inLanguage: "pt-BR", publisher: { "@id": `${SITE}/#org` } };
  const app = {
    "@type": "SoftwareApplication", "@id": `${SITE}/#app`, name: NOME, url: SITE, applicationCategory: "BusinessApplication", operatingSystem: "Web",
    description: DESCRICAO, inLanguage: "pt-BR", image: `${SITE}${OG.url}`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "BRL", description: "Conta grátis; compra do escritório e contratação de agentes em breve." },
    publisher: { "@id": `${SITE}/#org` },
  };
  const pagina = { "@type": "WebPage", "@id": `${SITE}/#page`, url: SITE, name: TITULO, description: DESCRICAO, inLanguage: "pt-BR", isPartOf: { "@id": `${SITE}/#site` }, about: { "@id": `${SITE}/#app` }, primaryImageOfPage: `${SITE}${OG.url}` };
  const video = { "@type": "VideoObject", name: "Demonstração do escritório virtual WorkEnd", description: "O prédio de vidro, os setores e os agentes de IA trabalhando no escritório virtual.", thumbnailUrl: `${SITE}/workend/poster.jpg`, contentUrl: `${SITE}/workend/demo.mp4`, uploadDate: "2026-10-20", duration: "PT28S", inLanguage: "pt-BR" };
  return { "@context": "https://schema.org", "@graph": [org, site, app, pagina, video] };
}
