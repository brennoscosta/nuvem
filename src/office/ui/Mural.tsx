"use client";
// Mural da fachada (vista "por fora"): chat automático com o que está acontecendo no escritório.
// Todo mundo lê; só quem está autenticado (hoje o CEO/admin) escreve — a mensagem vai pro CEO IA e a resposta volta aqui.
import { useEffect, useRef, useState } from "react";
import { useEscritorio } from "../store";
import { NIVEL, AREAS } from "../data/org";

interface Item { id: string; autorTipo: "humano" | "agente" | "sistema"; autorNome: string; agenteId: string | null; texto: string; criadoEm: string }

function hora(iso: string | number) { const d = new Date(iso); return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }

export function Mural() {
  const vista = useEscritorio((s) => s.vista);
  const admin = useEscritorio((s) => s.admin);
  const online = useEscritorio((s) => s.online);
  const agentes = useEscritorio((s) => s.agentes);
  const historico = useEscritorio((s) => s.historico);
  const setModalLogin = useEscritorio((s) => s.setModalLogin);
  const [itens, setItens] = useState<Item[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false); // visitante começa com o mural recolhido; admin, aberto
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => { setAberto(admin); }, [admin]);

  // carrega e atualiza o mural a cada 6 s
  useEffect(() => {
    if (vista !== "fora" || !online) return;
    let vivo = true;
    const buscar = async () => { try { const r = await fetch("/api/mural"); if (r.ok && vivo) setItens(await r.json()); } catch { /* offline */ } };
    buscar(); const t = setInterval(buscar, 6000);
    return () => { vivo = false; clearInterval(t); };
  }, [vista, online, admin]);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [itens.length, historico.length]);

  if (vista !== "fora") return null;
  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="pointer-events-auto absolute left-3 top-16 z-10 flex items-center gap-2 rounded-full bg-[#111418]/88 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22A86B]" />Mural da Nuvem · ao vivo <span className="text-white/50">▸</span>
      </button>
    );
  }

  // mistura mensagens do mural com os últimos eventos da cena (o que está acontecendo agora)
  const eventos = historico.slice(0, 15).map((e) => ({ id: e.id, ts: e.ts, autor: agentes[e.agenteId]?.nome ?? "Escritório", tipo: "sistema" as const, texto: e.texto ?? e.tipo.replace(/_/g, " "), agenteId: e.agenteId }));
  const linhas = [
    ...itens.map((i) => ({ id: i.id, ts: new Date(i.criadoEm).getTime(), autor: i.autorNome, tipo: i.autorTipo, texto: i.texto, agenteId: i.agenteId })),
    ...eventos,
  ].sort((a, b) => a.ts - b.ts).slice(-80);

  const enviar = async () => {
    const t = texto.trim(); if (!t || enviando) return;
    setEnviando(true); setErro(null);
    try {
      const r = await fetch("/api/mural", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texto: t }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro ?? "falhou");
      setTexto("");
      const r2 = await fetch("/api/mural"); if (r2.ok) setItens(await r2.json());
    } catch (e) { setErro((e as Error).message); } finally { setEnviando(false); }
  };

  return (
    <div className="pointer-events-auto absolute bottom-14 left-3 top-16 z-10 flex w-[22rem] max-w-[calc(100vw-1.5rem)] flex-col rounded-2xl bg-[#111418]/88 text-white shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div>
          <div className="text-sm font-bold">Mural da Nuvem</div>
          <div className="text-[10px] text-white/50">{online ? "o que está acontecendo lá dentro, em tempo real" : "offline — sem conexão com o escritório"}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full bg-[#22A86B]/20 px-2 py-0.5 text-[10px] font-semibold text-[#7EE2B0]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22A86B]" />ao vivo</span>
          <button onClick={() => setAberto(false)} title="Minimizar o mural" className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/20">Minimizar ▾</button>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 text-xs">
        {linhas.length === 0 && <div className="text-white/40">Ainda não há movimento por aqui. Quando os agentes trabalharem, aparece aqui.</div>}
        {linhas.map((l) => {
          const ag = l.agenteId ? agentes[l.agenteId] : null;
          const cor = ag ? NIVEL[ag.nivel].cor : l.tipo === "humano" ? "#D9A23A" : "#8EA3C7";
          return (
            <div key={l.id} className={`rounded-xl px-3 py-2 ${l.tipo === "humano" ? "bg-[#D9A23A]/15" : l.tipo === "agente" ? "bg-white/[0.08]" : "bg-white/[0.04]"}`}>
              <div className="mb-0.5 flex items-center gap-1.5 text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: cor }} />
                <span className="font-bold" style={{ color: cor }}>{l.autor}</span>
                {ag && <span className="text-white/40">{NIVEL[ag.nivel].nome} · {AREAS[ag.area].nome}</span>}
                <span className="ml-auto text-white/30">{hora(l.ts)}</span>
              </div>
              <div className={l.tipo === "sistema" ? "text-white/60" : "text-white/90"}>{l.texto}</div>
            </div>
          );
        })}
        <div ref={fim} />
      </div>
      <div className="border-t border-white/10 p-2">
        {admin ? (
          <div className="flex flex-col gap-1">
            <div className="flex gap-1.5">
              <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") enviar(); }} placeholder="Fale com o CEO da Nuvem…" disabled={enviando}
                className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-xs outline-none placeholder:text-white/30 focus:bg-white/15" />
              <button onClick={enviar} disabled={enviando || !texto.trim()} className="rounded-xl bg-[#4F7DF3] px-3 py-2 text-xs font-bold disabled:opacity-40">{enviando ? "…" : "Enviar"}</button>
            </div>
            {erro && <div className="px-1 text-[10px] text-[#FF8A80]">{erro}</div>}
            <div className="px-1 text-[10px] text-white/35">Você fala como CEO. Visitantes veem só um resumo do que foi dito.</div>
          </div>
        ) : (
          <div className="flex items-center justify-between px-1 text-[11px] text-white/50">
            <span>Só a diretoria fala por aqui.</span>
            <button onClick={() => setModalLogin(true)} className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white">Sou da diretoria · entrar</button>
          </div>
        )}
      </div>
    </div>
  );
}
