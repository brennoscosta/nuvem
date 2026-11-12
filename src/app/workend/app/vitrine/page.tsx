// Vitrine (12/11/2026): o dono monta os produtos que aparecem na loja dele (cartão do mapa e /loja/N), com o botão
// "Pedir no WhatsApp". Regras e dados em src/server/vitrine.ts.
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { terrenoDoUsuario, ehAdmin } from "@/server/terrenos";
import { Rodape } from "../../_partes";
import { CabecalhoApp } from "../../_cabecalho";
import { VitrinePainel } from "./_vitrine";
import { meta } from "../../seo";

export const metadata = meta({ titulo: "Vitrine — WorkEnd", caminho: "/app/vitrine", indexar: false });
export const dynamic = "force-dynamic";

export default async function Vitrine() {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect("/entrar?destino=/app/vitrine");
  const chao = await terrenoDoUsuario(u.id).catch(() => null);
  return (
    <>
      <CabecalhoApp atual="app" email={u.email} admin={ehAdmin(u)} />
      {chao?.status === "ativo" ? <VitrinePainel /> : (
        <section className="faixa mt-4">
          <div className="rounded-2xl bg-[var(--cinza)] p-8">
            <h1 className="text-[2rem]">A vitrine fica dentro da sua loja</h1>
            <p className="mt-3 max-w-[60ch] text-[var(--tinta-2)]">
              {chao ? "Seu lote está reservado. Pague o 1º mês no mapa e monte a vitrine: até 12 produtos com foto e preço, e o botão Pedir no WhatsApp." : "Com um lote no mapa (R$ 99 por mês), você mostra até 12 produtos com foto e preço na sua loja, e o cliente pede direto no seu WhatsApp."}
            </p>
            <Link href={chao ? `/mundo?lote=${encodeURIComponent(chao.chave)}` : "/mundo"} className="btn btn-azul mt-6">{chao ? "Pagar o 1º mês no mapa" : "Escolher meu lote"}</Link>
          </div>
        </section>
      )}
      <div className="h-16" />
      <Rodape />
    </>
  );
}
