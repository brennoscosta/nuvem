"use client";
// Hero do redesign: o nome digitado aparece na placa .sign, que é HTML por cima do visor (não faz parte do render).
// A barra da placa acende quando o campo recebe texto: é o único movimento da página.
import { useState } from "react";

export function Hero({ lote, logado }: { lote: { chave: string; numero: number } | null; logado: boolean }) {
  const [nome, setNome] = useState("");
  const v = nome.trim();
  const q = new URLSearchParams();
  if (lote) q.set("lote", lote.chave);
  if (v) q.set("empresa", v);
  const destino = logado ? (lote ? `/mundo?lote=${encodeURIComponent(lote.chave)}` : "/mundo") : `/cadastro${q.size ? `?${q}` : ""}`;
  const rotulo = lote ? `Lote ${lote.numero}` : "O seu lote";
  return (
    <section className="wrap" style={{ paddingTop: 72 }}>
      <h1>Um endereço onde dá para entrar.</h1>
      <p className="lede" style={{ marginTop: 20 }}>Escreva o nome da sua empresa e veja a fachada acender. R$ 99 por mês, no Pix, com uma sala para cada setor da sua equipe.</p>
      <div className="form">
        <div className="field">
          <label htmlFor="nome">O nome da sua empresa</label>
          <input id="nome" type="text" placeholder="Padaria do Bairro" maxLength={26} autoComplete="organization" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <a href={destino} className="lp-btn lp-btn-g">Reservar este nome</a>
      </div>
      <ul className="seals">
        <li>Pix direto no mapa</li><li>Reembolso em até 7 dias</li><li>Três trocas de prédio grátis</li>
      </ul>
      <div className="viewport" data-asset="hero-3d">
        <img src="/workend/render/hero-1600.webp" srcSet="/workend/render/hero-1000.webp 1000w, /workend/render/hero-1600.webp 1600w, /workend/render/hero-2400.webp 2400w" sizes="(min-width: 1180px) 1132px, calc(100vw - 48px)" width={2400} height={1000} alt="O prédio de vidro ao entardecer, com as janelas acesas, numa rua da cidade do WorkEnd" fetchPriority="high" decoding="async" />
        <div className={`sign${v ? " is-lit" : ""}`} aria-hidden>
          <div className="sign-plate">
            <div className="sign-nome">{v || "Sua empresa"}</div>
            <div className="sign-bar" />
          </div>
          <div className="sign-tail" />
        </div>
        <p className="legenda" aria-live="polite">{v ? `${rotulo}, ${v}. Letreiro aceso.` : `${rotulo}, livre agora. Escreva o nome para acender.`}</p>
      </div>
    </section>
  );
}
