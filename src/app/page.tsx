import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";

// 21/11/2026 (responsividade): no mapa as conversas ficam em cartões presos embaixo; com o teclado aberto (Android) a
// altura útil (dvh) encolhe acima dele e o cartão sobe junto, em vez de o teclado cobrir o campo. O iPhone ignora isto e
// rola sozinho até o campo.
export const viewport: Viewport = { width: "device-width", initialScale: 1, interactiveWidget: "resizes-content" };
import { Escritorio } from "@/office/Escritorio";
import { ehHostWorkend } from "@/server/hosts";
import { meta } from "./workend/seo";

// No domínio do WorkEnd esta página é o mapa da cidade (/mundo, reescrito pelo proxy): título, descrição e imagem de
// compartilhamento do WorkEnd (17/11/2026, revisão geral: o link do mapa aparecia como "Escritório Nuvem" no WhatsApp).
// No escritório da Nuvem continua o título de sempre (layout da raiz).
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  if (h.get("x-site") !== "workend" && !ehHostWorkend(h.get("x-forwarded-host") ?? h.get("host") ?? "")) return {};
  return meta({ titulo: "Mapa da cidade — WorkEnd", descricao: "Passeie pela cidade 3D do WorkEnd: entre nas lojas, converse com as atendentes de IA, conheça as empresas e reserve o endereço da sua.", caminho: "/mundo" });
}

// WE-15 (21/11/2026): o primeiro quadro (HTML do servidor) já sabe se é o mapa e qual sede ou lote o link pede, para
// não desenhar a barra do escritório da Nuvem antes do JavaScript (src/office/inicioMundo.ts). O proxy marca o mapa do
// WorkEnd com x-site; ?mundo vale em qualquer domínio, igual a modoMundo() no navegador.
// WE-10 (21/11/2026): o mapa do WorkEnd não tinha nenhum h1; um título só para leitores de tela e buscadores (sr-only),
// só no domínio do WorkEnd; o escritório da Nuvem continua como estava.
export default async function Home({ searchParams }: PageProps<"/">) {
  const [h, q] = await Promise.all([headers(), searchParams]);
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const mundo = h.get("x-site") === "workend" || q.mundo !== undefined;
  return <>{h.get("x-site") === "workend" && <h1 className="sr-only">Mapa da cidade do WorkEnd</h1>}<Escritorio inicio={{ mundo, sede: mundo ? um(q.sede) : null, lote: mundo ? um(q.lote) : null }} /></>;
}
