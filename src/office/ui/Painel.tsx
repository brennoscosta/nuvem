"use client";
import { useEffect, useState } from "react";
import { AREAS, AREAS_OPERACIONAIS, FUNCOES, NIVEIS, NIVEL, PERSONALIDADES, type AreaId, type Nivel } from "../data/org";
import { BONECOS } from "../data/bonecos";
import { useEscritorio } from "../store";
import { useSimulador } from "../sim/simulador";
import { PainelAgente, STATUS } from "./PainelAgente";
import { MenuAgente } from "./MenuAgente";

export function BarraTopo() {
  const agentes = useEscritorio((s) => s.agentes);
  const ordem = useEscritorio((s) => s.ordem);
  const selecionado = useEscritorio((s) => s.selecionado);
  const selecionar = useEscritorio((s) => s.selecionar);
  const setModal = useEscritorio((s) => s.setModal);
  const simulando = useEscritorio((s) => s.simulando);
  const setSimulando = useEscritorio((s) => s.setSimulando);
  const sirene = useEscritorio((s) => s.sirene);
  const online = useEscritorio((s) => s.online);
  const statusServidor = useEscritorio((s) => s.statusServidor);
  const temSimulados = ordem.some((id) => agentes[id] && !agentes[id].real);
  const total = ordem.length;
  const trabalhando = ordem.filter((id) => agentes[id]?.status === "trabalhando").length;
  const gasto = ordem.reduce((a, id) => a + (agentes[id]?.gastoHoje ?? 0), 0);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-[#111418]/85 px-4 py-2 text-white shadow-xl backdrop-blur">
        <div className="flex items-center gap-2 pr-3 border-r border-white/10">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#4F7DF3] to-[#8B6CF0]" />
          <div className="leading-tight"><div className="text-sm font-bold tracking-wide">Escritório Nuvem</div><div className="text-[10px] text-white/50">{total} agentes · {trabalhando} trabalhando · R$ {gasto.toFixed(2)} hoje</div></div>
        </div>
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
          {ordem.map((id) => { const a = agentes[id]; if (!a) return null; const st = STATUS[a.status]; return (
            <button key={id} onClick={() => selecionar(selecionado === id ? null : id)} title={`${a.nome} · ${NIVEL[a.nivel].nome} · ${st.nome}`}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition ${selecionado === id ? "border-white bg-white/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
              <span className="h-2 w-2 rounded-full" style={{ background: st.cor, boxShadow: `0 0 8px ${st.cor}` }} />
              <span className="font-medium">{a.nome}</span>
              <span className="rounded-full px-1.5 text-[9px] font-bold uppercase" style={{ background: NIVEL[a.nivel].cor, color: "#111" }}>{NIVEL[a.nivel].nome}</span>
            </button>); })}
          {total === 0 && <span className="text-xs text-white/50">Escritório vazio. Clique em “Contratar agente” pra trazer o primeiro.</span>}
        </div>
        {sirene && <span className="animate-pulse rounded-full bg-[#E53935] px-2 py-1 text-[10px] font-bold">APROVAÇÃO PENDENTE</span>}
        <span title={statusServidor ? `banco: ${statusServidor.banco} · IA: ${statusServidor.ia}${statusServidor.detalhe ? " · " + statusServidor.detalhe : ""}` : "conectando"} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${online && statusServidor?.ia === "ok" ? "bg-[#22A86B]/20 text-[#7EE2B0]" : online ? "bg-[#F2913D]/20 text-[#FFC48A]" : "bg-white/5 text-white/50"}`}><span className={`h-1.5 w-1.5 rounded-full ${online ? (statusServidor?.ia === "ok" ? "bg-[#22A86B]" : "bg-[#F2913D]") : "bg-white/30"}`} />{online ? (statusServidor?.ia === "ok" ? "Agentes reais" : "Banco ok · sem IA") : "Offline"}</span>
        {temSimulados && <button onClick={() => setSimulando(!simulando)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${simulando ? "bg-white/10 text-white" : "bg-white/5 text-white/50"}`}>{simulando ? "Simulação: ligada" : "Simulação: pausada"}</button>}
        <button onClick={() => setModal(true)} className="rounded-full bg-[#4F7DF3] px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-[#3f6ae0]">+ Contratar agente</button>
      </div>
    </div>
  );
}

const NOMES = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabi", "Heitor", "Iara", "João", "Karen", "Léo", "Marina", "Nico", "Olívia", "Pedro", "Rafa", "Sofia", "Tiago", "Vitória"];

export function ModalContratar() {
  const aberto = useEscritorio((s) => s.modalContratar);
  const setModal = useEscritorio((s) => s.setModal);
  const contratar = useEscritorio((s) => s.contratar);
  const agentes = useEscritorio((s) => s.agentes);
  const [area, setArea] = useState<AreaId>("suporte");
  const [nivel, setNivel] = useState<Nivel>("junior");
  const [nome, setNome] = useState(NOMES[Math.floor(Math.random() * NOMES.length)]);
  const [funcao, setFuncao] = useState(FUNCOES.suporte[0]);
  const [personalidade, setPersonalidade] = useState(PERSONALIDADES[0]);
  const [boneco, setBoneco] = useState(BONECOS[0].id);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { setFuncao(nivel === "ceo" || nivel === "diretor" ? "Gestão" : FUNCOES[area][0]); }, [area, nivel]);
  if (!aberto) return null;
  const temCeo = Object.values(agentes).some((a) => a.nivel === "ceo");
  const [enviando, setEnviando] = useState(false);
  const enviar = async () => {
    setEnviando(true);
    try {
      const a = await contratar({ nome: nome.trim() || "Agente", area: nivel === "ceo" ? "diretoria" : area, nivel, funcao, personalidade, boneco });
      if (!a) { setErro(nivel === "ceo" && temCeo ? "Já existe um CEO." : "Não há mesa livre pra esse cargo nessa área."); return; }
      setErro(null); setModal(false); setNome(NOMES[Math.floor(Math.random() * NOMES.length)]);
      useEscritorio.getState().selecionar(a.id);
    } catch (e) { setErro((e as Error).message); } finally { setEnviando(false); }
  };
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(false)}>
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 text-[#1D2128] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-xl font-bold">Contratar agente</div>
        <div className="text-xs text-[#5B6472]">Ele entra pelo elevador, passa na sala do chefe e senta na mesa dele. Depois, clique nele pra treinar: perfil, conhecimento, skills e conversa.</div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-[#5B6472]">Nome</span><input value={nome} onChange={(e) => setNome(e.target.value)} className="rounded-xl border border-black/10 px-3 py-2" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-[#5B6472]">Área</span>
            <select value={area} onChange={(e) => setArea(e.target.value as AreaId)} className="rounded-xl border border-black/10 px-3 py-2" disabled={nivel === "ceo"}>
              {AREAS_OPERACIONAIS.map((id) => <option key={id} value={id}>{AREAS[id].nome}</option>)}
            </select></label>
          <label className="flex flex-col gap-1 col-span-2"><span className="text-xs font-semibold text-[#5B6472]">Cargo</span>
            <div className="flex flex-wrap gap-1.5">
              {NIVEIS.map((n) => <button key={n.id} onClick={() => setNivel(n.id)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${nivel === n.id ? "border-transparent text-[#111]" : "border-black/10 text-[#5B6472]"}`} style={nivel === n.id ? { background: n.cor } : {}}>{n.nome}</button>)}
            </div>
            <div className="text-[11px] text-[#5B6472]">{NIVEL[nivel].autonomia} · modelo {NIVEL[nivel].modelo}</div></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-[#5B6472]">Função</span>
            <select value={funcao} onChange={(e) => setFuncao(e.target.value)} className="rounded-xl border border-black/10 px-3 py-2">
              {(nivel === "ceo" || nivel === "diretor" ? ["Gestão"] : FUNCOES[area]).map((f) => <option key={f}>{f}</option>)}
            </select></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-[#5B6472]">Personalidade</span>
            <select value={personalidade} onChange={(e) => setPersonalidade(e.target.value)} className="rounded-xl border border-black/10 px-3 py-2">{PERSONALIDADES.map((p) => <option key={p}>{p}</option>)}</select></label>
          <div className="col-span-2 flex flex-col gap-1"><span className="text-xs font-semibold text-[#5B6472]">Boneco</span>
            <div className="flex flex-wrap gap-2">
              {BONECOS.map((b) => (
                <button key={b.id} onClick={() => setBoneco(b.id)} className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 text-xs ${boneco === b.id ? "border-[#4F7DF3] bg-[#4F7DF3]/10" : "border-black/10"}`}>
                  <span className="relative inline-block h-6 w-6 rounded-full" style={{ background: b.pele }}>
                    {b.estiloCabelo !== "careca" && <span className="absolute left-0 right-0 top-0 h-2.5 rounded-t-full" style={{ background: b.cabelo }} />}
                  </span>
                  {b.nome}{b.arquivo ? " · 3D" : ""}
                </button>
              ))}
            </div>
          </div>
        </div>
        {erro && <div className="mt-3 text-xs font-semibold text-[#E2575B]">{erro}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setModal(false)} className="rounded-xl px-4 py-2 text-sm text-[#5B6472]">Cancelar</button>
          <button onClick={enviar} disabled={enviando} className="rounded-xl bg-[#4F7DF3] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{enviando ? "Contratando…" : "Contratar"}</button>
        </div>
      </div>
    </div>
  );
}

// Preenche o escritório com um time inicial (demo), um de cada vez
// Só com ?demo=1 na URL; por padrão o escritório começa vazio e o admin contrata cada agente.
export function useTimeInicial() {
  useEffect(() => {
    const s = useEscritorio.getState();
    if (s.ordem.length) return;
    if (!new URLSearchParams(window.location.search).has("demo")) return;
    const time: Array<[string, AreaId, Nivel, string, string]> = [
      ["Helena", "suporte", "ceo", "Gestão", "Focado"],
      ["Rafael", "suporte", "gerente", "Atendente N2", "Comunicativo"],
      ["Ana", "suporte", "junior", "Atendente N1", "Animado"],
      ["Bruno", "suporte", "estagiario", "Atendente N1", "Calmo"],
      ["Marina", "vendas", "gerente", "Closer", "Comunicativo"],
      ["Diego", "vendas", "pleno", "SDR", "Animado"],
      ["Gabi", "marketing", "senior", "Social media", "Criativo"],
      ["Léo", "marketing", "junior", "Editor(a) de vídeo", "Criativo"],
      ["Sofia", "engenharia", "gerente", "Dev back-end", "Detalhista"],
      ["Tiago", "engenharia", "pleno", "Dev front-end", "Focado"],
      ["Iara", "engenharia", "diretor", "Gestão", "Detalhista"],
    ];
    useEscritorio.setState({ simulando: true, online: false });
    const timers = time.map(([nome, area, nivel, funcao, personalidade], i) => setTimeout(() => {
      useEscritorio.getState().contratar({ nome, area, nivel, funcao, personalidade, boneco: BONECOS[i % BONECOS.length].id });
    }, 800 + i * 1400));
    return () => timers.forEach(clearTimeout);
  }, []);
}

// Carrega os agentes reais do banco e acompanha os eventos deles (o que o motor faz vira animação).
function useServidor() {
  const carregar = useEscritorio((s) => s.carregarDoServidor);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("demo")) return;
    carregar();
    let desde = new Date().toISOString();
    const t = setInterval(async () => {
      const st = useEscritorio.getState(); if (!st.online) return;
      try {
        const r = await fetch(`/api/eventos?desde=${encodeURIComponent(desde)}`).then((x) => x.json());
        desde = r.agora;
        for (const ev of r.eventos as { agenteId: string | null; tipo: string; texto: string | null }[]) {
          if (!ev.agenteId || !st.agentes[ev.agenteId]) { if (ev.tipo === "contratado") carregar(); continue; }
          if (["contratado", "demitido", "reuniao"].includes(ev.tipo)) continue; // já tratados localmente por quem disparou
          st.emitir(ev.agenteId, ev.tipo as never, ev.texto ?? undefined);
        }
      } catch { /* servidor fora: tenta de novo no próximo ciclo */ }
    }, 4000);
    return () => clearInterval(t);
  }, [carregar]);
}

export function Painel() {
  useSimulador();
  useTimeInicial();
  useServidor();
  return (
    <>
      <BarraTopo />
      <MenuAgente />
      <PainelAgente />
      <ModalContratar />
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-xl bg-[#111418]/70 px-3 py-1.5 text-[11px] text-white/70 backdrop-blur">Arraste pra mover · roda do mouse pra zoom · botão direito pra girar · clique no boneco pra ver a ficha · passe o mouse pra chamar reunião</div>
    </>
  );
}
