// Minha rede: amigos, pedidos, conversas, negociações e chamadas — o painel do consumidor com personagem.
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { ehAdmin } from "@/server/terrenos";
import { Rodape } from "../../_partes";
import { BotaoSair } from "../../_conta";
import { RedeDashboard } from "./_rede";
import { meta } from "../../seo";

export const metadata = meta({ titulo: "Minha rede — WorkEnd", caminho: "/app/rede", indexar: false });
export const dynamic = "force-dynamic";

export default async function Rede() {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect("/entrar?destino=/app/rede");
  return (
    <>
      <header className="faixa flex items-center justify-between py-5">
        <Link href="/" aria-label="WorkEnd"><Image src="/workend/logo.png" alt="WorkEnd" width={1259} height={355} priority className="h-9 w-auto" /></Link>
        <div className="flex items-center gap-3 text-[15px]"><Link href="/app" className="btn btn-claro">Meu escritório</Link>{ehAdmin(u) && <Link href="/app/admin" className="btn btn-claro">Admin</Link>}<span className="hidden text-[var(--tinta-2)] sm:inline">{u.email}</span><BotaoSair /></div>
      </header>
      <RedeDashboard nome={u.nome.split(" ")[0]} />
      <div className="h-16" />
      <Rodape />
    </>
  );
}
