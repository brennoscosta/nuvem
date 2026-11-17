import type { Metadata } from "next";
import { headers } from "next/headers";
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

export default function Home() {
  return <Escritorio />;
}
