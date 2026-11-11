// SEO do WorkEnd: base dos metadados, imagem OG e dados estruturados (JSON-LD). Usado pelo layout e pelas páginas.
import type { Metadata } from "next";

export const SITE = "https://workend.online";
export const NOME = "WorkEnd";
export const TITULO = "WorkEnd — o mapa 3D onde a sua empresa tem endereço";
export const DESCRICAO = "Escolha um lote no mapa 3D, coloque a marca da sua empresa na placa, monte seu escritório com equipe de IA que atende seus clientes e encontre profissionais e empresas para fechar negócio.";
export const OG = { url: "/workend/marca/og-workend.jpg", width: 1200, height: 630, alt: "WorkEnd — o mapa 3D onde a sua empresa tem endereço" };

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
    keywords: ["escritório virtual", "mapa 3D", "vitrine virtual", "endereço virtual para empresas", "rede de contatos", "network empresarial", "WorkEnd"],
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
    icons: { icon: [{ url: "/workend/marca/workend-favicon.svg", type: "image/svg+xml" }, { url: "/workend/marca/workend-icone-32.png", sizes: "32x32", type: "image/png" }], apple: [{ url: "/workend/marca/workend-icone-180.png", sizes: "180x180" }], shortcut: "/workend/marca/workend-icone-32.png" },
    manifest: "/workend/manifest.webmanifest",
    formatDetection: { telephone: false, email: false, address: false },
    other: { "format-detection": "telephone=no" },
  };
}

// Dados estruturados da landing: organização, site e o produto (aplicação web, grátis pra entrar).
export function jsonLdLanding() {
  const org = { "@type": "Organization", "@id": `${SITE}/#org`, name: NOME, url: SITE, logo: `${SITE}/workend/marca/workend-icone-512.png`, email: "contato@workend.online", sameAs: [] as string[] };
  const site = { "@type": "WebSite", "@id": `${SITE}/#site`, url: SITE, name: NOME, inLanguage: "pt-BR", publisher: { "@id": `${SITE}/#org` } };
  const app = {
    "@type": "SoftwareApplication", "@id": `${SITE}/#app`, name: NOME, url: SITE, applicationCategory: "BusinessApplication", operatingSystem: "Web",
    description: DESCRICAO, inLanguage: "pt-BR", image: `${SITE}${OG.url}`,
    offers: { "@type": "Offer", price: "99", priceCurrency: "BRL", description: "Conta grátis. Lote no mapa por R$ 99 ao mês." },
    publisher: { "@id": `${SITE}/#org` },
  };
  const pagina = { "@type": "WebPage", "@id": `${SITE}/#page`, url: SITE, name: TITULO, description: DESCRICAO, inLanguage: "pt-BR", isPartOf: { "@id": `${SITE}/#site` }, about: { "@id": `${SITE}/#app` }, primaryImageOfPage: `${SITE}${OG.url}` };
  const video = { "@type": "VideoObject", name: "Como funciona o WorkEnd, em 1 minuto", description: "Escolher o lote no mapa, pagar no Pix, pôr a marca na fachada, montar as salas e a equipe e fazer negócio com quem está do lado.", thumbnailUrl: `${SITE}/workend/como-funciona.jpg`, contentUrl: `${SITE}/workend/como-funciona.mp4`, uploadDate: "2026-11-11", duration: "PT1M7S", inLanguage: "pt-BR" };
  return { "@context": "https://schema.org", "@graph": [org, site, app, pagina, video] };
}
