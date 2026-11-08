// Minha rede: amigos, pedidos, conversas, negociações e chamadas — o painel do consumidor com personagem.
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/server/usuarios";
import { ehAdmin } from "@/server/terrenos";
import { Rodape } from "../../_partes";
import { CabecalhoApp } from "../../_cabecalho";
import { RedeDashboard } from "./_rede";
import { meta } from "../../seo";

export const metadata = meta({ titulo: "Minha rede — WorkEnd", caminho: "/app/rede", indexar: false });
export const dynamic = "force-dynamic";

export default async function Rede() {
  const u = await usuarioAtual().catch(() => null);
  if (!u) redirect("/entrar?destino=/app/rede");
  return (
    <>
      <CabecalhoApp atual="rede" email={u.email} admin={ehAdmin(u)} />
      <RedeDashboard nome={u.nome.split(" ")[0]} />
      <div className="h-16" />
      <Rodape />
    </>
  );
}
