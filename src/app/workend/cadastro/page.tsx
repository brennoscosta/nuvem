import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { Topo, Rodape } from "../_partes";
import { FormCadastro } from "../_conta";

export const dynamic = "force-dynamic";

export default async function Cadastro() {
  const u = await usuarioAtual().catch(() => null);
  if (u) redirect("/app");
  return (
    <>
      <Topo />
      <section className="faixa grid gap-10 py-10 lg:grid-cols-[1fr_1fr] lg:py-16">
        <div>
          <h1 className="text-[2.2rem] lg:text-[2.8rem]">Crie sua conta. O escritório vem em seguida.</h1>
          <p className="mt-5 max-w-[48ch] text-[var(--tinta-2)]">Entrar é grátis. Com a conta você vê o catálogo de especialistas, acompanha um escritório funcionando e é avisado primeiro quando abrir pra montar o seu.</p>
        </div>
        <div className="rounded-2xl bg-[var(--cinza)] p-6 lg:p-8"><FormCadastro /></div>
      </section>
      <Rodape />
    </>
  );
}
