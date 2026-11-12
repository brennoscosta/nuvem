"use client";
// Central de avisos (sino, 12/11/2026): candidatura recebida, evento daqui a 10 minutos, mensagem nova, conversa na loja,
// pagamento confirmado, indicação, agendamento. Fica na barra do mapa (tema escuro) e no cabeçalho do painel (claro).
// Confere a cada 45 s com a aba visível. No mapa, os avisos do próprio mapa abrem ali mesmo (lote, praça, conversas).
import { useEffect, useRef, useState } from "react";
import { useMundo, modoMundo } from "../mundoStore";
import { usePersonagem } from "../personagemStore";
import { PRACA_CHAVE } from "../data/praca";

interface Aviso { id: string; tipo: string; titulo: string; texto: string; link: string; lidoEm: string | null; criadoEm: string }
const ICONE: Record<string, string> = { candidatura: "📋", evento: "🎤", mensagem: "💬", loja: "🛎️", pagamento: "✅", indicacao: "🤝", agendamento: "📅", amizade: "👋", negociacao: "🤝", sistema: "ℹ️" };
const ha = (iso: string, agora: number) => {
  const s = Math.max(0, (agora - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora"; if (s < 3600) return `há ${Math.floor(s / 60)} min`; if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400); return d === 1 ? "ontem" : `há ${d} dias`;
};

// abre no próprio mapa o que é do mapa; o resto navega
function abrirLink(link: string) {
  if (!link) return;
  if (modoMundo() && link.startsWith("/mundo")) {
    const q = new URLSearchParams(link.split("?")[1] ?? "");
    if (q.get("caixa")) { usePersonagem.getState().abrir("caixa"); return; }
    if (q.get("praca")) { useMundo.getState().selecionarLote(PRACA_CHAVE); return; }
    const lote = q.get("lote"); if (lote) { useMundo.getState().selecionarLote(lote); return; }
  }
  window.location.href = link;
}

export function Sino({ tema = "escuro" }: { tema?: "escuro" | "claro" }) {
  const [dados, setDados] = useState<{ avisos: Aviso[]; naoLidos: number; logado: boolean; agora: number } | null>(null);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const buscar = useRef<() => void>(() => {});
  useEffect(() => {
    let vivo = true;
    const carregar = () => { if (document.visibilityState !== "visible") return; fetch("/api/workend/avisos", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (vivo && j) setDados({ ...j, agora: Date.now() }); }).catch(() => {}); };
    buscar.current = carregar;
    carregar();
    const t = setInterval(carregar, 45_000);
    document.addEventListener("visibilitychange", carregar);
    return () => { vivo = false; clearInterval(t); document.removeEventListener("visibilitychange", carregar); };
  }, []);
  // links que chegam de fora para o mapa (ex.: /mundo?praca=1 vindo do sino do painel)
  useEffect(() => {
    if (!modoMundo()) return;
    const q = new URLSearchParams(window.location.search);
    if (!q.get("praca") && !q.get("caixa")) return;
    const t = setTimeout(() => { if (q.get("praca")) useMundo.getState().selecionarLote(PRACA_CHAVE); if (q.get("caixa")) usePersonagem.getState().abrir("caixa"); }, 1200);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("pointerdown", fora); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);
  if (!dados?.logado) return null;
  const marcar = (ids?: string[]) => {
    setDados((d) => d && { ...d, naoLidos: ids ? Math.max(0, d.naoLidos - d.avisos.filter((a) => ids.includes(a.id) && !a.lidoEm).length) : 0, avisos: d.avisos.map((a) => (!ids || ids.includes(a.id) ? { ...a, lidoEm: a.lidoEm ?? new Date().toISOString() } : a)) });
    void fetch("/api/workend/avisos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ids ? { ids } : {}) });
  };
  const escuro = tema === "escuro";
  const n = dados.naoLidos;
  return (
    <div ref={caixa} className="relative shrink-0" data-tour="avisos">
      <button onClick={() => { setAberto((a) => !a); if (!aberto) buscar.current(); }} aria-label={n ? `Avisos: ${n} não lidos` : "Avisos"} aria-expanded={aberto}
        className={`relative grid h-8 w-8 place-items-center rounded-full text-[15px] ${escuro ? "bg-white/10 text-white hover:bg-white/20" : "bg-[var(--cinza)] hover:bg-[var(--linha)]"}`}>
        <span aria-hidden className={n ? "sino-balanca" : ""}>🔔</span>
        {n > 0 && <span className={`absolute -right-1 -top-1 min-w-[18px] rounded-full bg-[#E2575B] px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ${escuro ? "ring-[#111418]" : "ring-white"}`}>{n > 9 ? "9+" : n}</span>}
      </button>
      {aberto && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-2xl bg-white text-[#1D2128] shadow-2xl ring-1 ring-black/10" role="dialog" aria-label="Avisos">
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-2.5">
            <b className="text-sm">Avisos</b>
            {n > 0 && <button onClick={() => marcar()} className="text-[12px] font-semibold text-[#1D4ED8]">Marcar todos como lidos</button>}
          </div>
          <ul className="max-h-[min(26rem,65vh)] overflow-y-auto">
            {dados.avisos.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-[#5B6472]">Nada novo por aqui. Candidaturas, conversas na sua loja, eventos da praça e pagamentos aparecem neste sino.</li>}
            {dados.avisos.map((a) => (
              <li key={a.id}>
                <button onClick={() => { if (!a.lidoEm) marcar([a.id]); setAberto(false); abrirLink(a.link); }} className={`flex w-full gap-3 px-4 py-2.5 text-left hover:bg-[#F1F3F6] ${a.lidoEm ? "" : "bg-[#EEF3FF]/60"}`}>
                  <span className="mt-0.5 text-[18px] leading-none" aria-hidden>{ICONE[a.tipo] ?? "🔔"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2"><span className={`text-[13px] leading-snug ${a.lidoEm ? "font-semibold" : "font-bold"}`}>{a.titulo}</span>{!a.lidoEm && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#1D4ED8]" aria-label="não lido" />}</span>
                    {a.texto && <span className="mt-0.5 line-clamp-2 block text-[12px] text-[#5B6472]">{a.texto}</span>}
                    <span className="mt-0.5 block text-[11px] text-[#8A93A0]">{ha(a.criadoEm, dados.agora)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
