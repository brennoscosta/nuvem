// Créditos WorkEnd (20/11/2026, frente "creditos"): saldo de créditos (1 crédito = R$ 1,00), pacotes no Pix, extrato e
// regras; e as Unidades de IA da empresa (medidor, compra com créditos e extrato por agente e por tipo).
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { ehAdmin } from "@/server/terrenos";
import { Rodape } from "../../_partes";
import { CabecalhoApp } from "../../_cabecalho";
import { meta } from "../../seo";
import { PainelCreditos } from "./_creditos";
import { Icone } from "@/office/ui/Icone";

export const metadata = meta({ titulo: "Créditos — WorkEnd", caminho: "/app/creditos", indexar: false });
export const dynamic = "force-dynamic";

export default async function Creditos() {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect("/entrar?destino=/app/creditos");
  return (
    <>
      <CabecalhoApp atual="app" email={u.email} admin={ehAdmin(u)} />
      <section className="faixa pt-4">
        <div className="pg-topo" style={{ "--marca": "#1D4ED8" } as React.CSSProperties}>
          <span className="pg-rotulo"><Icone nome="carteira" tamanho={15} />Créditos</span>
          <h1>Seus créditos no WorkEnd</h1>
          <p className="pg-sub">1 crédito vale R$ 1,00 e paga o lote, a renovação, os agentes, as unidades de IA e tudo o que o WorkEnd vende. Compre um pacote no Pix e pague com um clique.</p>
        </div>
      </section>
      <PainelCreditos />
      <div className="h-16" />
      <Rodape />
    </>
  );
}
