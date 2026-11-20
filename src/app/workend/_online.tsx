"use client";
// Página inicial (20/11/2026, pedido do dono: "quero que mostre quantas pessoas estão online na cidade"): o mesmo número
// do topo do mapa, "N pessoas na cidade agora", com o link para entrar no mapa. O primeiro número vem do servidor (sem
// piscar); depois atualiza a cada 15 s enquanto a aba está à vista (office/ui/onlineComum.ts).
import Link from "next/link";
import { useResumoOnline, pessoas } from "@/office/ui/onlineComum";

export function PessoasNaCidade({ inicial }: { inicial: number | null }) {
  const r = useResumoOnline();
  const n = r?.total ?? inicial;
  if (n == null) return null;
  return (
    <p className="wh-vivo wh-online" data-teste="online-inicio">
      <i className="wi-vivo" aria-hidden /><b>{n}</b> {pessoas(n)} na cidade agora <span>·</span>
      <Link prefetch={false} href="/mundo" className="wh-online-link">Entrar no mapa<span aria-hidden> →</span></Link>
    </p>
  );
}
