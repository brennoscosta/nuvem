"use client";
// Abertura da página: quem visita escreve o nome da empresa, escolhe o prédio e a cor, e vê tudo ao vivo no mundo 3D.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LayoutId } from "@/office/data/escritorio";
import { Contador } from "./efeitos";

const Vitrine3D = dynamic(() => import("./Vitrine3D"), { ssr: false });

const PREDIOS: { id: LayoutId; nome: string }[] = [
  { id: "vidro", nome: "Cubo de vidro" }, { id: "moderno", nome: "Térreo moderno" }, { id: "sobrado", nome: "Sobrado" },
  { id: "loja", nome: "Loja de rua" }, { id: "galpao", nome: "Galpão" }, { id: "container", nome: "Contêineres" },
];
const CORES = [
  { cor: "#0A6CFF", nome: "Azul" }, { cor: "#16A34A", nome: "Verde" }, { cor: "#E9504F", nome: "Vermelho" },
  { cor: "#F59E0B", nome: "Amarelo" }, { cor: "#7C3AED", nome: "Roxo" }, { cor: "#111827", nome: "Preto" },
];

export function Hero({ livres, total, lote, logado }: { livres: number; total: number; lote: { chave: string; numero: number } | null; logado: boolean }) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES[0].cor);
  const [layout, setLayout] = useState<LayoutId>("vidro");
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [pronto, setPronto] = useState(false);
  const [ativa, setAtiva] = useState(true);
  const quadro = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => { try { const c = document.createElement("canvas"); setWebgl(!!(c.getContext("webgl2") || c.getContext("webgl"))); } catch { setWebgl(false); } }, 0);
    const el = quadro.current; let io: IntersectionObserver | null = null;
    if (el && "IntersectionObserver" in window) { io = new IntersectionObserver(([e]) => setAtiva(e.isIntersecting), { threshold: 0.02 }); io.observe(el); }
    return () => { clearTimeout(t); io?.disconnect(); };
  }, []);
  const q = new URLSearchParams();
  if (lote) q.set("lote", lote.chave);
  if (nome.trim()) q.set("empresa", nome.trim());
  const destino = logado ? (lote ? `/mundo?lote=${encodeURIComponent(lote.chave)}` : "/mundo") : `/cadastro${q.size ? `?${q}` : ""}`;
  const subtitulo = lote ? `Lote ${lote.numero} · livre agora` : "seu endereço no WorkEnd";
  return (
    <section className="wi-hero">
      <div className="wi-ceu" aria-hidden><i /><i /><i /></div>
      <div className="faixa wi-hero-grade">
        <div className="wi-hero-texto">
          <h1>Sua empresa de portas abertas num <span className="wi-marca">mundo 3D</span>.</h1>
          <p className="wi-lead">Escolha um lote no mapa, ponha sua marca na fachada e monte o escritório da sua equipe. Quem anda pelo WorkEnd passa na sua porta.</p>
          <div className="wi-acoes">
            <Link href={destino} className="wi-btn wi-btn-azul">{logado ? "Ir para o meu lote" : "Criar conta e reservar"}<span aria-hidden>→</span></Link>
            <Link href="/mundo" className="wi-btn wi-btn-vidro">Passear pelo mapa</Link>
          </div>
          <p className="wi-prova"><i className="wi-vivo" aria-hidden /><b><Contador valor={livres} /></b> de {total} lotes livres agora <span>·</span> R$ 99 por mês <span>·</span> Pix direto no mapa</p>
        </div>

        <div className="wi-vitrine" ref={quadro}>
          <div className={`wi-vitrine-3d ${pronto ? "pronto" : ""}`}>
            {webgl && <Vitrine3D nome={nome} cor={cor} layout={layout} subtitulo={subtitulo} ativa={ativa} onPronto={() => setPronto(true)} />}
            {!pronto && <div className="wi-carregando" aria-hidden><span /><span /><span /></div>}
            {webgl === false && <img src="/workend/poster.jpg" alt="" className="wi-poster" />}
          </div>
          <div className="wi-painel" role="group" aria-label="Monte a sua fachada">
            <label className="wi-campo">
              <span>Experimente: o nome da sua empresa</span>
              <input value={nome} maxLength={22} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Padaria do Bairro" autoComplete="organization" />
            </label>
            <div className="wi-linha">
              <div className="wi-predios" role="radiogroup" aria-label="Tipo de prédio">
                {PREDIOS.map((p) => <button key={p.id} type="button" role="radio" aria-checked={layout === p.id} className={layout === p.id ? "on" : ""} onClick={() => setLayout(p.id)}>{p.nome}</button>)}
              </div>
              <div className="wi-cores" role="radiogroup" aria-label="Cor da marca">
                {CORES.map((c) => <button key={c.cor} type="button" role="radio" aria-checked={cor === c.cor} aria-label={c.nome} className={cor === c.cor ? "on" : ""} style={{ ["--c" as string]: c.cor }} onClick={() => setCor(c.cor)} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
