import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { Topo, Rodape } from "../_partes";
import { FormEntrar } from "../_conta";

import { meta } from "../seo";

export const metadata = meta({ titulo: "Entrar — WorkEnd", descricao: "Entre na sua conta do WorkEnd pra ver seu escritório e o catálogo de especialistas.", caminho: "/entrar" });
export const dynamic = "force-dynamic";

export default async function Entrar() {
  const u = await usuarioAtual().catch(() => null);
  if (u) redirect("/app");
  return (
    <>
      <Topo />
      <section className="faixa grid gap-10 py-10 lg:grid-cols-[1fr_1fr] lg:py-16">
        <div className="pg-claro">
          <h1 className="text-[2.2rem] lg:text-[2.8rem]">Bem-vindo de volta.</h1>
          <p className="mt-5 max-w-[48ch] text-[var(--tinta-2)]">Entre pra ver seu escritório e o catálogo de especialistas.</p>
        </div>
        <div className="pg-cartao p-6 shadow-[0_24px_60px_-40px_rgba(16,24,40,.45)] lg:p-8"><FormEntrar esqueci /></div>
      </section>
      <Rodape />
    </>
  );
}
