"use client";
// Caça aos presentes de Natal (20/11/2026, frente "visitante"; só na época, data/natal.ts › natalNoNavegador). Todo dia
// aparecem 3 presentes, os mesmos para todo mundo (scene/PresentesNatal.tsx desenha). Andar até perto de um (2,4 m) pega:
// o navegador manda a batida de posição e pede o presente; o servidor confere a batida (src/server/passaporte.ts ›
// acharPresente). 12 presentes dão o Gorro de Natal, que não está à venda. O contador mostra dicas de onde eles estão.
import { useCallback, useEffect, useRef, useState } from "react";
import { usePassaporte, usarItem, type PresenteTela } from "../passaporteStore";
import { usePersonagem, minhaPos } from "../personagemStore";
import { useMundo, type Terreno } from "../mundoStore";
import { natalNoNavegador } from "../data/natal";
import { RAIO_PRESENTE } from "../data/passaporte";
import { LOTES } from "../data/mundo";
import { Icone } from "./Icone";
import { ondeNaCidade } from "./PessoasOnline";


// "no calçadão do rio", "na calçada da Padaria do Bairro"…
export function dicaDoPresente(x: number, z: number, terrenos: Record<string, Terreno>) {
  const onde = ondeNaCidade(x, z, terrenos);
  if (onde !== "andando pela rua") return onde;
  let melhor = LOTES[0], dm = Infinity;
  for (const l of LOTES) { const d = Math.hypot(x - l.centro[0], z - l.centro[1]); if (d < dm) { dm = d; melhor = l; } }
  const t = terrenos[melhor.chave], dono = t?.anexoDe ? terrenos[t.anexoDe] : t;
  return dono?.status === "ativo" && dono.empresaNome ? `na calçada da ${dono.empresaNome}` : `na calçada do lote ${melhor.numero}`;
}

type Achado = { n: number; achados: number; meta: number; premio: { item: string | null; itemNome: string | null } | null };

// carrega os presentes do dia e pega os que estão perto (um de cada vez; falhou, espera 10 s para tentar aquele de novo)
function useCacaNatal(avisar: (a: Achado) => void) {
  const ligado = useRef(false), pegando = useRef(false), falhou = useRef(new Map<number, number>()), seq = useRef(0);
  useEffect(() => {
    ligado.current = natalNoNavegador();
    if (!ligado.current) return;
    void usePassaporte.getState().carregarNatal();
    const recarregar = setInterval(() => void usePassaporte.getState().carregarNatal(), 5 * 60_000);
    const t = setInterval(async () => {
      const st = usePersonagem.getState(), n = usePassaporte.getState().natal;
      if (!n?.ativo || !st.ativo || st.predio || pegando.current) return;
      const agora = Date.now();
      const p = n.hoje.find((x) => !x.achado && (falhou.current.get(x.idx) ?? 0) < agora && Math.hypot(minhaPos.x - x.x, minhaPos.z - x.z) <= RAIO_PRESENTE);
      if (!p) return;
      pegando.current = true;
      try {
        await st.batida(); // a posição de agora fica gravada antes de pedir (é a prova que o servidor confere)
        const r = await fetch("/api/workend/passaporte/natal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idx: p.idx, x: minhaPos.x, z: minhaPos.z, rot: minhaPos.rot }) });
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          usePassaporte.getState().presenteAchado(p.idx, j.achados);
          avisar({ n: ++seq.current, achados: j.achados, meta: j.meta, premio: j.premio ?? null });
          if (j.premio) { void usePersonagem.getState().carregarItens(); void usePassaporte.getState().carregar(); }
        } else falhou.current.set(p.idx, agora + 10_000);
      } catch { falhou.current.set(p.idx, agora + 10_000); }
      pegando.current = false;
    }, 600);
    return () => { clearInterval(t); clearInterval(recarregar); };
  }, [avisar]);
}

export function CacaNatal() {
  const natal = usePassaporte((s) => s.natal);
  const ativo = usePersonagem((s) => s.ativo);
  const terrenos = useMundo((s) => s.terrenos);
  const logado = useMundo((s) => !!s.usuario);
  const [aberto, setAberto] = useState(false);
  const [achado, setAchado] = useState<Achado | null>(null);
  const [usado, setUsado] = useState("");
  const avisar = useCallback((a: Achado) => setAchado(a), []);
  useCacaNatal(avisar);
  useEffect(() => { if (!achado || achado.premio) return; const t = setTimeout(() => setAchado(null), 5000); return () => clearTimeout(t); }, [achado]);
  if (!natal?.ativo) return null;
  const restam = natal.hoje.filter((p) => !p.achado).length;
  return (
    <>
      <div className="pointer-events-auto relative" data-guia="caca-natal">
        <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="hud-ilha inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-white" aria-label={`Presentes de Natal: ${natal.achados} de ${natal.meta}`}>
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#C8102E]"><Icone nome="presente" tamanho={13} traco={2.2} /></span>
          <b data-teste="contador-presentes">{natal.achados}/{natal.meta}</b><span className="hidden sm:inline">presentes</span>
        </button>
        {aberto && (
          <div className="absolute left-0 top-full z-30 mt-1.5 w-[min(300px,calc(100vw-1.5rem))] rounded-2xl bg-[#0E1013]/95 p-3 text-white shadow-2xl ring-1 ring-white/10">
            <div className="text-[13px] font-bold">Caça aos presentes de Natal</div>
            <p className="mt-0.5 text-[12px] text-white/70">{natal.ganhou ? "Você já ganhou o Gorro de Natal. Continue achando para ajudar a cidade a brilhar." : `Ache ${natal.meta} e ganhe o Gorro de Natal (não está à venda). Todo dia aparecem ${natal.porDia} novos.`}</p>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">{restam ? `Hoje: ${restam} escondido${restam > 1 ? "s" : ""}` : "Hoje você achou todos"}</div>
            <ul className="mt-1 space-y-1">
              {natal.hoje.map((p: PresenteTela) => (
                <li key={p.idx} className={`flex items-center gap-2 text-[12.5px] ${p.achado ? "text-white/40 line-through" : ""}`}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.caixa }} />
                  <span className="min-w-0 flex-1">Um presente {dicaDoPresente(p.x, p.z, terrenos)}</span>
                  {!p.achado && ativo && <button type="button" onClick={() => { setAberto(false); usePersonagem.getState().irPara(p.x, p.z); }} className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold hover:bg-white/20">Ir</button>}
                </li>
              ))}
            </ul>
            {!ativo && (logado
              ? <button type="button" onClick={() => usePersonagem.getState().abrir("montar")} className="mt-2 w-full rounded-xl bg-[#E9C46A] px-3 py-2 text-[13px] font-bold text-[#1A1306]">Crie seu personagem grátis para pegar</button>
              : <a href={`/entrar?destino=${encodeURIComponent("/mundo")}`} className="mt-2 block w-full rounded-xl bg-[#E9C46A] px-3 py-2 text-center text-[13px] font-bold text-[#1A1306]">Entre para pegar presentes</a>)}
          </div>
        )}
      </div>
      {achado && (
        <div role="status" data-teste="presente-achado" className="pointer-events-auto absolute inset-x-2 top-[7.2rem] z-30 mx-auto max-w-[340px] sm:top-[7rem]">
          <div className="painel-entra rounded-2xl bg-[#7F1D1D] px-4 py-3 text-white shadow-2xl ring-1 ring-[#F2C14E]/40">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F2C14E] text-[#7F1D1D]"><Icone nome="presente" tamanho={20} traco={2.2} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold">{achado.premio ? "Você ganhou o Gorro de Natal!" : "Presente achado!"}</div>
                <div className="text-[12px] text-white/80">{achado.achados} de {achado.meta} presentes{achado.premio ? ". Ele não está à venda: só quem caça tem." : ""}</div>
              </div>
              <button type="button" onClick={() => setAchado(null)} aria-label="Fechar" className="shrink-0 rounded-full p-1 text-white/70 hover:bg-white/10"><Icone nome="fechar" tamanho={15} /></button>
            </div>
            {achado.premio?.item && <button type="button" disabled={!!usado} onClick={async () => { setUsado("…"); const e = await usarItem(achado.premio!.item!); setUsado(e ?? "Usando"); }} className="mt-2 rounded-full bg-[#F2C14E] px-3 py-1 text-[12px] font-bold text-[#3A1206] disabled:opacity-70">{usado || "Usar agora"}</button>}
          </div>
        </div>
      )}
    </>
  );
}
