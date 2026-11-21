"use client";
// Página inicial (20/11/2026, pedido do dono: "quero que mostre quantas pessoas estão online na cidade"): o mesmo número
// do topo do mapa, "N pessoas na cidade agora", com o link para entrar no mapa.
// 21/11/2026 (brief, decisão do dono: "fica, mas discreto, num lugar em que se clica para ver, e não em destaque na página
// de venda"): saiu do herói e fica pequeno no fim da página, perto do último "Passear pelo mapa". Fechado, mostra só o
// ponto verde e a pergunta; o número aparece ao tocar. O primeiro número vem do servidor (sem piscar) e a consulta a cada
// 15 s, enquanto a aba está à vista (office/ui/onlineComum.ts), só começa depois do toque.
import Link from "next/link";
import { useState } from "react";
import { useResumoOnline, pessoas } from "@/office/ui/onlineComum";

export function PessoasNaCidade({ inicial }: { inicial: number | null }) {
  const [aberto, setAberto] = useState(false);
  if (inicial == null) return null;
  return (
    <div className="wh-online" data-teste="online-inicio">
      <button type="button" className="wh-online-botao" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        <i className="wi-vivo" aria-hidden />Quem está na cidade agora?
      </button>
      {aberto && <NumeroNaCidade inicial={inicial} />}
    </div>
  );
}

function NumeroNaCidade({ inicial }: { inicial: number }) {
  const r = useResumoOnline();
  const n = r?.total ?? inicial;
  return (
    <p className="wh-online-numero" aria-live="polite">
      <b>{n}</b> {pessoas(n)} na cidade agora <span aria-hidden>·</span>
      <Link prefetch={false} href="/mundo" className="wh-online-link">Entrar no mapa<span aria-hidden> →</span></Link>
    </p>
  );
}
