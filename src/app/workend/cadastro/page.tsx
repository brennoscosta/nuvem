import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { Topo, Rodape } from "../_partes";
import { FormCadastro } from "../_conta";

import { meta } from "../seo";

export const metadata = meta({ titulo: "Criar conta — WorkEnd", descricao: "Crie sua conta grátis no WorkEnd, escolha um lote no mapa 3D e monte o escritório virtual da sua empresa.", caminho: "/cadastro" });
export const dynamic = "force-dynamic";

export default async function Cadastro() {
  const u = await usuarioAtual().catch(() => null);
  if (u) redirect("/app");
  return (
    <>
      <Topo />
      <section className="faixa grid gap-10 py-10 lg:grid-cols-[1fr_1fr] lg:py-16">
        <div className="pg-claro">
          <h1 className="text-[2.2rem] lg:text-[2.8rem]">Crie sua conta. O escritório vem em seguida.</h1>
          <p className="mt-5 max-w-[48ch] text-[var(--tinta-2)]">Criar a conta é grátis. Com ela você escolhe seu lote no mapa, coloca sua marca na placa e monta o seu escritório com uma equipe de IA que já trabalha. Profissionais aparecem na busca e recebem propostas.</p>
        </div>
        <div className="pg-cartao p-6 shadow-[0_24px_60px_-40px_rgba(16,24,40,.45)] lg:p-8"><FormCadastro /></div>
      </section>
      <Rodape />
    </>
  );
}
