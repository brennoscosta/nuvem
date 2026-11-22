// Minha equipe (11/11/2026): a equipe de IA do lote trabalhando de verdade para o dono (src/server/equipeCliente.ts).
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { terrenoDoUsuario, empresasDoUsuario, ehAdmin } from "@/server/terrenos";
import { PRECO_LOTE, precoCurto } from "@/office/data/precosTerreno";
import { Rodape } from "../../_partes";
import { CabecalhoApp } from "../../_cabecalho";
import { EquipePainel, type InicioEquipe } from "./_equipe";
import { painelEquipe, internasDoDono, conversaDoDono } from "@/server/equipeCliente";
import { jsonInicial } from "@/server/http";
import { membroDeInicio, type ConversaEquipe, type PainelEquipe, type TrocaInterna } from "@/office/ui/equipeComum";
import { meta } from "../../seo";
import "./equipe.css";

export const metadata = meta({ titulo: "Minha equipe — WorkEnd", caminho: "/app/equipe", indexar: false });
export const dynamic = "force-dynamic";

// as abas que abrem sem a conversa (qualquer outro valor de ?aba= abre em Conversar e dar tarefas); "whatsapp" da WE-18
const ABAS_SEM_CONVERSA = ["vagas", "visitantes", "sobre", "internas", "conectores", "whatsapp"];

export default async function Equipe({ searchParams }: { searchParams: Promise<{ lote?: string; membro?: string; aba?: string; visitante?: string }> }) {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect("/entrar?destino=/app/equipe");
  const sp = await searchParams;
  const chao = sp.lote ? null : await terrenoDoUsuario(u.id).catch(() => null);
  // empresas da pessoa (17/11/2026): as próprias e as de que é sócia (sedes divididas); com mais de uma, o topo troca entre elas
  const empresas = await empresasDoUsuario(u.id).catch(() => []);
  const inicial = sp.lote ?? (chao?.status === "ativo" ? chao.chave : empresas[0]?.chave) ?? null;
  const semLote = !inicial;
  // WE-16 (22/11/2026): a tela já sai com o painel, as conversas internas e a conversa da pessoa aberta (antes: 2,4 a 2,8 s
  // em "Carregando…" no 4G). O painel vem antes porque garante a empresa do lote, que as outras duas também usam.
  let dados: InicioEquipe | null = null;
  if (inicial) {
    const painel = await jsonInicial<PainelEquipe>(painelEquipe(u, inicial));
    if (painel) {
      const de = membroDeInicio(sp.membro ?? null, painel), lote = painel.lote.chave;
      const [int, c] = await Promise.all([jsonInicial<{ internas: TrocaInterna[] }>(internasDoDono(u, lote)), de && !ABAS_SEM_CONVERSA.includes(sp.aba ?? "") ? jsonInicial<ConversaEquipe>(conversaDoDono(u, lote, de)) : null]);
      dados = { painel, internas: int?.internas ?? null, conversa: de && c ? { de, c } : null };
    }
  }
  return (
    <>
      <CabecalhoApp atual="equipe" email={u.email} admin={ehAdmin(u)} />
      {semLote ? (
        <section className="faixa mt-4">
          <div className="rounded-2xl bg-[var(--cinza)] p-8">
            <h1 className="text-[2rem]">Sua equipe de IA mora no seu lote</h1>
            <p className="mt-3 max-w-[60ch] text-[var(--tinta-2)]">
              {chao ? "Seu lote está reservado. Pague o 1º mês no mapa e a equipe começa a trabalhar na hora: CEO, atendente e os especialistas que você contratar." : `Escolha um lote no mapa (${precoCurto(PRECO_LOTE)} por mês). Ele vem com CEO e atendente de IA, e você contrata os especialistas que quiser, com R$ 10 de IA por mês incluídos.`}
            </p>
            <Link href={chao ? `/mundo?lote=${encodeURIComponent(chao.chave)}` : "/mundo"} className="btn btn-azul mt-6">{chao ? "Pagar o 1º mês no mapa" : "Escolher meu lote"}</Link>
          </div>
        </section>
      ) : (
        <EquipePainel chaveInicial={inicial} empresas={empresas} membroInicial={sp.membro ?? null} inicial={dados} abaInicial={sp.aba === "vagas" || sp.aba === "visitantes" || sp.aba === "sobre" || sp.aba === "internas" || sp.aba === "conectores" || sp.aba === "whatsapp" ? sp.aba : undefined}
          visitanteInicial={sp.visitante && /^[A-Za-z0-9_-]{4,60}$/.test(sp.visitante) ? sp.visitante : null} />
      )}
      <div className="h-16" />
      <Rodape />
    </>
  );
}
