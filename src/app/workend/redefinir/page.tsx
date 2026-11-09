import { Topo, Rodape } from "../_partes";
import { FormNovaSenha } from "../_conta";
import { meta } from "../seo";

export const metadata = meta({ titulo: "Criar nova senha — WorkEnd", caminho: "/redefinir", indexar: false });
export const dynamic = "force-dynamic";

export default async function Redefinir({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return (
    <>
      <Topo />
      <section className="faixa grid gap-10 py-10 lg:grid-cols-[1fr_1fr] lg:py-16">
        <div>
          <h1 className="text-[2.2rem] lg:text-[2.8rem]">Crie uma nova senha.</h1>
          <p className="mt-5 max-w-[48ch] text-[var(--tinta-2)]">Depois de salvar, as sessões abertas em outros aparelhos são encerradas.</p>
        </div>
        <div className="rounded-2xl bg-[var(--cinza)] p-6 lg:p-8">
          {t ? <FormNovaSenha token={t} /> : <p className="text-[var(--tinta-2)]">Link incompleto. Abra de novo o link que você recebeu.</p>}
        </div>
      </section>
      <Rodape />
    </>
  );
}
