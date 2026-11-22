// Vendas (17/11/2026, frente "atendente que fecha a venda"): a chave Pix do dono para receber os pedidos e os pedidos que
// a atendente de IA fez na loja, com filtro por status, detalhe, contato do cliente e os botões "Confirmar pagamento",
// "Marcar como entregue" e "Cancelar". O WorkEnd não recebe nem repassa dinheiro. Regras em src/server/pedidos.ts.
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { terrenoDoUsuario, ehAdmin } from "@/server/terrenos";
import { Rodape } from "../../_partes";
import { CabecalhoApp } from "../../_cabecalho";
import { meta } from "../../seo";
import { PainelVendas, type Dados as DadosVendas } from "./_vendas";
import { vendasDoDono } from "@/server/pedidos";
import { jsonInicial } from "@/server/http";
import { Icone } from "@/office/ui/Icone";
import { numeroDaLoja, rotuloLoja, temNumero } from "@/office/data/numeroLoja";

export const metadata = meta({ titulo: "Vendas — WorkEnd", caminho: "/app/vendas", indexar: false });
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ pedido?: string; status?: string }> };

export default async function Vendas({ searchParams }: Props) {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect("/entrar?destino=/app/vendas");
  const q = await searchParams;
  const chao = await terrenoDoUsuario(u.id).catch(() => null);
  const ativo = chao?.status === "ativo" ? chao : null;
  const numero = ativo ? numeroDaLoja(ativo) : null;
  // WE-16 (22/11/2026): os pedidos já vêm na página, como o GET de /api/workend/vendas (sem filtro) os devolve (antes: 2,1 s
  // em "Carregando as vendas…" no 4G)
  const inicial = await jsonInicial<DadosVendas>(vendasDoDono(u, null));
  return (
    <>
      <CabecalhoApp atual="app" email={u.email} admin={ehAdmin(u)} />
      <section className="faixa pt-4">
        <div className="pg-topo" style={ativo ? ({ "--marca": ativo.cor } as React.CSSProperties) : undefined}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <span className="pg-rotulo"><Icone nome="recibo" tamanho={15} />Vendas{temNumero(numero) ? ` · ${rotuloLoja(numero)}` : ""}{ativo ? ` · ${ativo.empresaNome}` : ""}</span>
              <h1>Pedidos da loja</h1>
              <p className="pg-sub">A atendente de IA mostra a vitrine, monta o pedido com o cliente e entrega o <b>Pix com a sua chave</b>: o dinheiro cai direto na sua conta, o WorkEnd não recebe nem repassa nada. Confira no app do banco e confirme o pagamento aqui.</p>
            </div>
            <div className="pg-acoes">
              {temNumero(numero) && <a href={`/loja/${numero}#conversa`} target="_blank" rel="noreferrer" className="btn btn-linha">Ver a loja</a>}
              <Link href="/app/vitrine" className="btn btn-claro">Vitrine</Link>
            </div>
          </div>
        </div>
      </section>
      <PainelVendas pedidoInicial={q.pedido ?? null} statusInicial={q.status ?? null} temLoja={!!ativo} inicial={inicial} />
      <div className="h-16" />
      <Rodape />
    </>
  );
}
