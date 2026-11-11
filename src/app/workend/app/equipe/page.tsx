// Minha equipe (11/11/2026): a equipe de IA do lote trabalhando de verdade para o dono (src/server/equipeCliente.ts).
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { terrenoDoUsuario, ehAdmin } from "@/server/terrenos";
import { Rodape } from "../../_partes";
import { CabecalhoApp } from "../../_cabecalho";
import { EquipePainel } from "./_equipe";
import { meta } from "../../seo";

export const metadata = meta({ titulo: "Minha equipe — WorkEnd", caminho: "/app/equipe", indexar: false });
export const dynamic = "force-dynamic";

export default async function Equipe({ searchParams }: { searchParams: Promise<{ lote?: string; membro?: string }> }) {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect("/entrar?destino=/app/equipe");
  const sp = await searchParams;
  const chao = sp.lote ? null : await terrenoDoUsuario(u.id).catch(() => null);
  const semLote = !sp.lote && (!chao || chao.status !== "ativo");
  return (
    <>
      <CabecalhoApp atual="equipe" email={u.email} admin={ehAdmin(u)} />
      {semLote ? (
        <section className="faixa mt-4">
          <div className="rounded-2xl bg-[var(--cinza)] p-8">
            <h1 className="text-[2rem]">Sua equipe de IA mora no seu lote</h1>
            <p className="mt-3 max-w-[60ch] text-[var(--tinta-2)]">
              {chao ? "Seu lote está reservado. Pague o 1º mês no mapa e a equipe começa a trabalhar na hora: CEO, atendente e os especialistas que você contratar." : "Escolha um lote no mapa (R$ 99 por mês). Ele vem com CEO e atendente de IA, e você contrata os especialistas que quiser, com R$ 10 de IA por mês incluídos."}
            </p>
            <Link href={chao ? `/mundo?lote=${encodeURIComponent(chao.chave)}` : "/mundo"} className="btn btn-azul mt-6">{chao ? "Pagar o 1º mês no mapa" : "Escolher meu lote"}</Link>
          </div>
        </section>
      ) : (
        <EquipePainel chaveInicial={sp.lote ?? chao?.chave ?? null} membroInicial={sp.membro ?? null} />
      )}
      <div className="h-16" />
      <Rodape />
    </>
  );
}
