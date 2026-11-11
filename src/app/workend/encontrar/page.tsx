// Encontrar (11/11/2026): busca pública de profissionais e empresas do WorkEnd, por área e texto.
import { usuarioAtual } from "@/server/usuarios";
import { ehAdmin } from "@/server/terrenos";
import { Topo, Rodape } from "../_partes";
import { CabecalhoApp } from "../_cabecalho";
import { meta } from "../seo";
import { Busca } from "./_busca";

export const metadata = meta({ titulo: "Encontrar profissionais e empresas — WorkEnd", descricao: "Ache profissionais disponíveis e empresas com endereço no mapa 3D do WorkEnd. Converse, peça orçamento e feche negócio com avaliação dos dois lados.", caminho: "/encontrar" });
export const dynamic = "force-dynamic";

export default async function Encontrar({ searchParams }: { searchParams: Promise<{ tipo?: string; nicho?: string; q?: string }> }) {
  const u = await usuarioAtual().catch(() => null);
  const sp = await searchParams;
  return (
    <>
      {u ? <CabecalhoApp atual="encontrar" email={u.email} admin={ehAdmin(u)} /> : <Topo />}
      <Busca logado={!!u} euId={u?.id ?? null} inicial={{ tipo: sp.tipo === "empresas" ? "empresas" : "profissionais", nicho: sp.nicho ?? "", q: sp.q ?? "" }} />
      <div className="h-16" />
      <Rodape />
    </>
  );
}
