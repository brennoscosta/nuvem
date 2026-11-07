// Painel do admin do WorkEnd: lotes (reservas e chãos pagos), pagamentos e usuários, com liberar/banir/ativar.
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { ehAdmin } from "@/server/terrenos";
import { pagamentoLigado } from "@/server/mercadopago";
import { Rodape } from "../../_partes";
import { BotaoSair } from "../../_conta";
import { PainelAdmin } from "./_painel";
import { meta } from "../../seo";

export const metadata = meta({ titulo: "Admin — WorkEnd", caminho: "/app/admin", indexar: false });
export const dynamic = "force-dynamic";

export default async function Admin() {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect("/entrar");
  if (!ehAdmin(u)) redirect("/app");
  return (
    <>
      <header className="faixa flex items-center justify-between py-5">
        <Link href="/" aria-label="WorkEnd"><Image src="/workend/logo.png" alt="WorkEnd" width={1259} height={355} priority className="h-9 w-auto" /></Link>
        <div className="flex items-center gap-3 text-[15px]"><Link href="/app" className="btn btn-linha">Meu painel</Link><Link href="/mundo" className="btn btn-claro">Ver o mapa</Link><BotaoSair /></div>
      </header>
      <section className="faixa pt-4">
        <h1 className="text-[2rem] lg:text-[2.4rem]">Admin do WorkEnd</h1>
        <p className="mt-2 max-w-[70ch] text-[var(--tinta-2)]">Tudo que acontece no mundo: lotes reservados e pagos, pagamentos do Mercado Pago e usuários. Banir um imóvel tira a empresa do lote e suspende a conta do dono. Pagamento: <b>{pagamentoLigado() ? "ligado" : "desligado (falta MP_ACCESS_TOKEN)"}</b>.</p>
      </section>
      <PainelAdmin />
      <div className="h-16" />
      <Rodape />
    </>
  );
}
