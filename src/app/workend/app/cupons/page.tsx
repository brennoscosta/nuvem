// Cupons (13/11/2026): o dono cria, encerra e valida os cupons da loja; qualquer pessoa vê os cupons que pegou.
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { ehAdmin } from "@/server/terrenos";
import { Rodape } from "../../_partes";
import { CabecalhoApp } from "../../_cabecalho";
import { meta } from "../../seo";
import { PainelCupons } from "./_cupons";
import { Icone } from "@/office/ui/Icone";

export const metadata = meta({ titulo: "Cupons — WorkEnd", caminho: "/app/cupons", indexar: false });
export const dynamic = "force-dynamic";

export default async function Cupons() {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect("/entrar?destino=/app/cupons");
  return (
    <>
      <CabecalhoApp atual="app" email={u.email} admin={ehAdmin(u)} />
      <section className="faixa pt-4">
        <div className="pg-topo" style={{ "--marca": "#E11D48" } as React.CSSProperties}>
        <span className="pg-rotulo"><Icone nome="cupom" tamanho={15} />Cupons</span>
        <h1>Desconto que vira venda</h1>
        <p className="pg-sub">Crie até 3 cupons para a sua loja. Quem pega recebe um código só dele; na hora da compra, você confere o código aqui e ele fica marcado como usado.</p>
        </div>
      </section>
      <PainelCupons />
      <div className="h-16" />
      <Rodape />
    </>
  );
}
