// SEO do WorkEnd: base dos metadados, imagem OG e dados estruturados (JSON-LD). Usado pelo layout e pelas páginas.
import type { Metadata } from "next";
import { PRECO_LOTE, PRECO_QUIOSQUE, PRECO_ESPACO, precoCurto } from "@/office/data/precosTerreno";

export const SITE = "https://workend.online";
export const NOME = "WorkEnd";
export const TITULO = "WorkEnd — o mapa 3D onde a sua empresa tem endereço";
export const DESCRICAO = "Escolha um lote no mapa 3D, coloque a marca da sua empresa na placa, monte seu escritório com equipe de IA que atende seus clientes e encontre profissionais e empresas para fechar negócio.";
export const OG = { url: "/workend/marca/og-workend.jpg", width: 1200, height: 630, alt: "WorkEnd — o mapa 3D onde a sua empresa tem endereço" };

// Metadados-base (herdados por todas as páginas do site). Cada página passa título/descrição/canonical próprios.
// imagem: a de compartilhamento da página (logo da loja ou da sede); sem ela, a imagem do WorkEnd
export function meta(d: { titulo?: string; descricao?: string; caminho: string; indexar?: boolean; imagem?: { url: string; width?: number; height?: number; alt?: string; type?: string } }): Metadata {
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
    openGraph: { type: "website", url, siteName: NOME, locale: "pt_BR", title, description, images: [d.imagem ?? OG] },
    twitter: { card: d.imagem && (d.imagem.width ?? 0) < 600 ? "summary" : "summary_large_image", title, description, images: [(d.imagem ?? OG).url] },
    icons: { icon: [{ url: "/workend/marca/workend-favicon.svg", type: "image/svg+xml" }, { url: "/workend/marca/workend-icone-32.png", sizes: "32x32", type: "image/png" }], apple: [{ url: "/workend/marca/workend-icone-180.png", sizes: "180x180" }], shortcut: "/workend/marca/workend-icone-32.png" },
    manifest: "/workend/manifest.webmanifest",
    formatDetection: { telephone: false, email: false, address: false },
    other: { "format-detection": "telephone=no" },
  };
}

// oferta mensal com priceSpecification (UnitPriceSpecification, cobrança por mês)
const oferta = (name: string, valor: number, description: string) => ({
  "@type": "Offer", name, price: String(valor), priceCurrency: "BRL", url: `${SITE}/planos`, description,
  priceSpecification: { "@type": "UnitPriceSpecification", price: String(valor), priceCurrency: "BRL", unitCode: "MON", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } },
});
// Dados estruturados da landing: organização, site e o produto (aplicação web, grátis pra entrar).
export function jsonLdLanding() {
  const org = { "@type": "Organization", "@id": `${SITE}/#org`, name: NOME, url: SITE, logo: `${SITE}/workend/marca/workend-icone-512.png`, email: "contato@workend.online", sameAs: [] as string[] };
  const site = { "@type": "WebSite", "@id": `${SITE}/#site`, url: SITE, name: NOME, inLanguage: "pt-BR", publisher: { "@id": `${SITE}/#org` } };
  const app = {
    "@type": "SoftwareApplication", "@id": `${SITE}/#app`, name: NOME, url: SITE, applicationCategory: "BusinessApplication", operatingSystem: "Web",
    description: DESCRICAO, inLanguage: "pt-BR", image: `${SITE}${OG.url}`,
    // WE-19 (22/11/2026): a escada de planos; preços das constantes (data/precosTerreno.ts). O Equipe e a Sede não entram
    // (o Equipe só aparece com o WhatsApp ligado e não tem cobrança; a Sede é sob consulta)
    offers: [
      { "@type": "Offer", name: "Vitrine", price: "0", priceCurrency: "BRL", url: `${SITE}/planos`, description: "Página da loja grátis, com 3 produtos e o botão do WhatsApp." },
      oferta("Quiosque", PRECO_QUIOSQUE, `Quiosque na cidade por ${precoCurto(PRECO_QUIOSQUE)} ao mês.`),
      oferta("1/4 de lote (10 × 10 m)", PRECO_ESPACO, `Um quarto de lote (10 × 10 m) na cidade por ${precoCurto(PRECO_ESPACO)} ao mês.`),
      oferta("Loja", PRECO_LOTE, `Lote no mapa por ${precoCurto(PRECO_LOTE)} ao mês, com prédio, fachada e equipe de IA.`),
    ],
    publisher: { "@id": `${SITE}/#org` },
  };
  const pagina = { "@type": "WebPage", "@id": `${SITE}/#page`, url: SITE, name: TITULO, description: DESCRICAO, inLanguage: "pt-BR", isPartOf: { "@id": `${SITE}/#site` }, about: { "@id": `${SITE}/#app` }, primaryImageOfPage: `${SITE}${OG.url}` };
  const video = { "@type": "VideoObject", name: "Como funciona o WorkEnd, em 1 minuto", description: "Escolher o lote no mapa, pagar no Pix, pôr a marca na fachada, montar as salas e a equipe e fazer negócio com quem está do lado.", thumbnailUrl: `${SITE}/workend/como-funciona.jpg`, contentUrl: `${SITE}/workend/como-funciona.mp4`, uploadDate: "2026-11-11", duration: "PT1M7S", inLanguage: "pt-BR" };
  return { "@context": "https://schema.org", "@graph": [org, site, app, pagina, video] };
}

// ---------- página da loja (WE-11, 21/11/2026) ----------
// JSON-LD LocalBusiness: o tipo pelo nicho (todos são tipos de LocalBusiness no schema.org), os contatos públicos, o horário
// da agenda da loja (quando ligada), as redes em sameAs e a nota de quem já negociou pelo WorkEnd. Endereço físico não entra:
// a loja tem endereço na cidade 3D, e o WorkEnd não pede o endereço de rua (TODO do dono: campo de endereço, se quiser).
const TIPO_POR_NICHO: Record<string, string> = {
  varejo: "Store", alimentacao: "FoodEstablishment", saude: "HealthAndBeautyBusiness", beleza: "BeautySalon", financas: "FinancialService",
  juridico: "LegalService", imoveis: "RealEstateAgent", casa: "HomeAndConstructionBusiness", eventos: "EntertainmentBusiness", turismo: "TravelAgency",
  automotivo: "AutomotiveBusiness", tecnologia: "ProfessionalService", marketing: "ProfessionalService", consultoria: "ProfessionalService",
  servicos: "ProfessionalService", negocios: "ProfessionalService",
};
const DIAS_LD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export interface LojaLD {
  nome: string; caminho: string; titulo: string; descricao: string; nichoId: string; logo: string | null; imagem: string;
  contatos: { whatsapp?: string; instagram?: string; site?: string; email?: string };
  horarios: { dia: number; abre: string; fecha: string }[]; avaliacao: { media: number | null; n: number };
}
const absoluta = (u: string) => (/^https?:\/\//.test(u) ? u : `${SITE}${u}`);
export function jsonLdLoja(d: LojaLD) {
  const url = `${SITE}${d.caminho}`;
  const c = d.contatos;
  const sameAs = [c.instagram ? `https://instagram.com/${c.instagram}` : null, c.site ?? null].filter((x): x is string => !!x);
  const loja: Record<string, unknown> = {
    "@type": TIPO_POR_NICHO[d.nichoId] ?? "LocalBusiness", "@id": `${url}#loja`, name: d.nome, url, description: d.descricao,
    image: [absoluta(d.imagem), ...(d.logo ? [absoluta(d.logo)] : [])],
  };
  if (d.logo) loja.logo = absoluta(d.logo);
  if (c.whatsapp) loja.telephone = c.whatsapp.length <= 11 ? `+55${c.whatsapp}` : `+${c.whatsapp}`;
  if (c.email) loja.email = c.email;
  if (sameAs.length) loja.sameAs = sameAs;
  if (d.horarios.length) loja.openingHoursSpecification = d.horarios.map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: `https://schema.org/${DIAS_LD[h.dia]}`, opens: h.abre, closes: h.fecha }));
  if (d.avaliacao.n > 0 && d.avaliacao.media != null) loja.aggregateRating = { "@type": "AggregateRating", ratingValue: Number(d.avaliacao.media.toFixed(1)), reviewCount: d.avaliacao.n, bestRating: 5, worstRating: 1 };
  const pagina = { "@type": "WebPage", "@id": `${url}#pagina`, url, name: d.titulo, description: d.descricao, inLanguage: "pt-BR", about: { "@id": `${url}#loja` }, isPartOf: { "@id": `${SITE}/#site` }, primaryImageOfPage: { "@type": "ImageObject", url: absoluta(d.imagem) } };
  return { "@context": "https://schema.org", "@graph": [loja, pagina] };
}
