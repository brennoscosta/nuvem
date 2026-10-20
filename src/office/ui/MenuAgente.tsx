"use client";
// Menu rápido ao passar o mouse num agente: convocar reunião por setor (só o gerente de cada setor vai), abrir ficha, falar.
import { useEffect, useState } from "react";
import { AREAS, AREAS_OPERACIONAIS, NIVEL, type AreaId } from "../data/org";
import { useEscritorio } from "../store";

export function MenuAgente() {
  const hover = useEscritorio((s) => s.hover);
  const menuReuniao = useEscritorio((s) => s.menuReuniao);
  const agentes = useEscritorio((s) => s.agentes);
  const reuniaoAtiva = useEscritorio((s) => s.reuniaoAtiva);
  const selecionar = useEscritorio((s) => s.selecionar);
  const setMenuReuniao = useEscritorio((s) => s.setMenuReuniao);
  const convocar = useEscritorio((s) => s.convocarReuniao);
  const encerrar = useEscritorio((s) => s.encerrarReuniao);
  const setHover = useEscritorio((s) => s.setHover);
  const admin = useEscritorio((s) => s.admin);
  const online = useEscritorio((s) => s.online);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [fixo, setFixo] = useState<string | null>(null); // menu "preso" quando o mouse entra nele
  const [setores, setSetores] = useState<AreaId[]>([]);

  useEffect(() => {
    const mv = (e: MouseEvent) => { if (!fixo && !menuReuniao) setPos({ x: e.clientX, y: e.clientY }); };
    window.addEventListener("mousemove", mv); return () => window.removeEventListener("mousemove", mv);
  }, [fixo, menuReuniao]);
  // some quando o mouse sai do boneco e não entrou no menu
  useEffect(() => { if (!hover) { const t = setTimeout(() => { if (!fixo && !menuReuniao) setFixo(null); }, 300); return () => clearTimeout(t); } }, [hover, fixo, menuReuniao]);

  const id = menuReuniao ?? fixo ?? hover;
  const a = id ? agentes[id] : null;
  if (!a || (online && !admin)) return null;
  const podeConvocar = ["ceo", "diretor", "gerente"].includes(a.nivel);
  const gerentes = Object.values(agentes).filter((x) => x.nivel === "gerente" || x.nivel === "diretor");
  const left = Math.min(pos.x + 14, window.innerWidth - 300), top = Math.min(pos.y + 10, window.innerHeight - 320);

  return (
    <div className="absolute z-20 w-72 rounded-2xl bg-[#111418]/95 p-2 text-white shadow-2xl backdrop-blur" style={{ left, top }}
      onMouseEnter={() => setFixo(a.id)} onMouseLeave={() => { if (!menuReuniao) { setFixo(null); setHover(null); } }}>
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: NIVEL[a.nivel].cor }} />
        <span className="text-sm font-bold">{a.nome}</span>
        <span className="text-[10px] uppercase text-white/50">{NIVEL[a.nivel].nome} · {AREAS[a.area].nome}</span>
      </div>
      {!menuReuniao ? (
        <div className="mt-1 flex flex-col">
          <button onClick={() => { selecionar(a.id); setFixo(null); setHover(null); }} className="rounded-xl px-3 py-2 text-left text-xs hover:bg-white/10">💬 Conversar / treinar</button>
          {podeConvocar && !reuniaoAtiva && <button onClick={() => { setMenuReuniao(a.id); setSetores([]); }} className="rounded-xl px-3 py-2 text-left text-xs hover:bg-white/10">📣 Chamar reunião por setor…</button>}
          {reuniaoAtiva && <button onClick={() => { encerrar(); setFixo(null); setHover(null); }} className="rounded-xl px-3 py-2 text-left text-xs text-[#FFC48A] hover:bg-white/10">⏹ Encerrar reunião em andamento</button>}
          <button onClick={() => { selecionar(a.id); setFixo(null); setHover(null); }} className="rounded-xl px-3 py-2 text-left text-xs hover:bg-white/10">🪪 Ver ficha</button>
        </div>
      ) : (
        <div className="mt-1 px-1">
          <div className="px-2 text-[11px] text-white/60">Setores na reunião (vai só o gerente de cada um):</div>
          <div className="mt-1 flex flex-col gap-1">
            {AREAS_OPERACIONAIS.map((area) => {
              const ger = gerentes.find((g) => g.area === area && g.nivel === "gerente") ?? gerentes.find((g) => g.area === area);
              const on = setores.includes(area);
              return (
                <button key={area} onClick={() => setSetores(on ? setores.filter((x) => x !== area) : [...setores, area])}
                  className={`flex items-center justify-between rounded-xl px-3 py-1.5 text-left text-xs ${on ? "bg-white/15" : "hover:bg-white/10"}`}>
                  <span className="flex items-center gap-2"><span className={`h-3.5 w-3.5 rounded border ${on ? "border-transparent" : "border-white/40"}`} style={on ? { background: AREAS[area].cor } : {}} />{AREAS[area].nome}</span>
                  <span className="text-[10px] text-white/50">{ger ? `${ger.nome} (${NIVEL[ger.nivel].nome})` : "sem gerente"}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2 px-1">
            <button disabled={!setores.length} onClick={() => { convocar(a.id, setores); setFixo(null); setHover(null); }} className="flex-1 rounded-xl bg-[#D9A23A] px-3 py-1.5 text-xs font-bold text-[#111] disabled:opacity-40">Chamar pra sala de reunião</button>
            <button onClick={() => { setMenuReuniao(null); setFixo(null); setHover(null); }} className="rounded-xl px-3 py-1.5 text-xs text-white/60">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
