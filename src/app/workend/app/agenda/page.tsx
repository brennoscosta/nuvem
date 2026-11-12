// Agenda da loja (12/11/2026): o dono liga o agendamento, cadastra serviços e horários e acompanha quem marcou
// (src/server/agenda.ts). Os clientes marcam no cartão da loja no mapa, na página /loja/N ou pela atendente de IA.
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { terrenoDoUsuario, ehAdmin } from "@/server/terrenos";
import { Rodape } from "../../_partes";
import { CabecalhoApp } from "../../_cabecalho";
import { AgendaDono } from "./_agenda";
import { meta } from "../../seo";

export const metadata = meta({ titulo: "Agenda da loja — WorkEnd", caminho: "/app/agenda", indexar: false });
export const dynamic = "force-dynamic";

export default async function Agenda() {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect("/entrar?destino=/app/agenda");
  const chao = await terrenoDoUsuario(u.id).catch(() => null);
  const ativo = chao?.status === "ativo";
  return (
    <>
      <CabecalhoApp atual="app" email={u.email} admin={ehAdmin(u)} />
      {!ativo ? (
        <section className="faixa mt-4">
          <div className="rounded-2xl bg-[var(--cinza)] p-8">
            <h1 className="text-[2rem]">A agenda mora na sua loja</h1>
            <p className="mt-3 max-w-[60ch] text-[var(--tinta-2)]">{chao ? "Seu lote está reservado. Pague o 1º mês no mapa e ligue a agenda: os clientes marcam horário no cartão da loja, na página dela ou conversando com a atendente de IA." : "Com um lote no mapa (R$ 99 por mês), a sua loja recebe agendamentos: barbearia, clínica, aulas, consultoria. O cliente escolhe o serviço e o horário e você recebe o aviso na hora."}</p>
            <Link href={chao ? `/mundo?lote=${encodeURIComponent(chao.chave)}` : "/mundo"} className="btn btn-azul mt-6">{chao ? "Pagar o 1º mês no mapa" : "Escolher meu lote"}</Link>
          </div>
        </section>
      ) : (
        <AgendaDono />
      )}
      <div className="h-16" />
      <Rodape />
    </>
  );
}
