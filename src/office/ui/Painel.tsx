"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { PainelEscritorio } from "./Escritorio";
import { PainelPersonagem, FichaPersonagem, ChatPersonagem, CaixaPersonagem } from "./Personagem";
import { JanelaChamada } from "./Chamada";
import { AREAS, AREAS_APOIO, FUNCOES, NIVEIS, NIVEL, PERSONALIDADES, type AreaId, type Nivel } from "../data/org";
import { SETORES_ESCRITORIO } from "../data/layout";
import { qualidade, escolherQualidade } from "../scene/qualidade";
import { BONECOS } from "../data/bonecos";
import { useEscritorio } from "../store";
import { useSimulador } from "../sim/simulador";
import { PainelAgente, STATUS } from "./PainelAgente";
import { MenuAgente } from "./MenuAgente";
import { Mural } from "./Mural";
import { ModalLogin, CartaoPublico } from "./Login";
import { CartaoLote, PainelEmpresa, ContaWorkend, AvisoPagamento } from "./Lote";
import { useMundo, modoMundo } from "../mundoStore";

// Estamos no mapa do WorkEnd (workend.online/mundo)? Só dá pra saber no navegador (sem erro de hidratação).
const semAssinatura = () => () => {};
const useModoMundo = () => useSyncExternalStore(semAssinatura, modoMundo, () => false);

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
  const checado = useEscritorio((s) => s.checado);
  const admin = useEscritorio((s) => s.admin);
  const setModalLogin = useEscritorio((s) => s.setModalLogin);
  const logout = useEscritorio((s) => s.logout);
  const statusServidor = useEscritorio((s) => s.statusServidor);
  const vista = useEscritorio((s) => s.vista);
  const setVista = useEscritorio((s) => s.setVista);
  const mundo = useModoMundo();
  const temSimulados = ordem.some((id) => agentes[id] && !agentes[id].real);
  const total = ordem.length;
  const trabalhando = ordem.filter((id) => agentes[id]?.status === "trabalhando").length;
  const gasto = ordem.reduce((a, id) => a + (agentes[id]?.gastoHoje ?? 0), 0);
  // No mundo do WorkEnd a barra é enxuta (sem os agentes nem o estado do servidor da Nuvem) e rola de lado no celular
  if (mundo) return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-2 sm:p-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-[#111418]/85 px-3 py-2 text-white shadow-xl backdrop-blur sm:gap-3 sm:px-4">
        <div className="flex shrink-0 items-center gap-2 border-r border-white/10 pr-2 sm:pr-3">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#4F7DF3] to-[#8B6CF0]" />
          <div className="leading-tight"><div className="whitespace-nowrap text-sm font-bold tracking-wide">WorkEnd</div><div className="hidden whitespace-nowrap text-[10px] text-white/50 md:block">Clique num lote à venda pra reservar o seu</div></div>
        </div>
        <div className="sem-barra min-w-0 flex-1 overflow-x-auto">
          <div className="ml-auto flex w-max items-center gap-1.5 whitespace-nowrap [&>*]:shrink-0">
            <button onClick={() => setVista(vista === "fora" ? "dentro" : "fora")} title={vista === "fora" ? "Entrar no escritório" : "Ver o prédio por fora"} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15">{vista === "fora" ? "🏢 Ver por dentro" : "🌆 Ver por fora"}</button>
            <ContaWorkend />
          </div>
        </div>
      </div>
    </div>
  );
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-[#111418]/85 px-4 py-2 text-white shadow-xl backdrop-blur">
        <div className="flex items-center gap-2 pr-3 border-r border-white/10">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#4F7DF3] to-[#8B6CF0]" />
          <div className="leading-tight"><div className="text-sm font-bold tracking-wide">{mundo ? "WorkEnd · Mundo" : "Escritório Nuvem"}</div><div className="text-[10px] text-white/50">{mundo ? "Clique num lote à venda pra reservar o seu" : `${total} agentes · ${trabalhando} trabalhando · R$ ${gasto.toFixed(2)} hoje`}</div></div>
        </div>
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
          {ordem.map((id) => { const a = agentes[id]; if (!a) return null; const st = STATUS[a.status]; return (
            <button key={id} onClick={() => selecionar(selecionado === id ? null : id)} title={`${a.nome} · ${NIVEL[a.nivel].nome} · ${st.nome}`}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition ${selecionado === id ? "border-white bg-white/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
              <span className="h-2 w-2 rounded-full" style={{ background: st.cor, boxShadow: `0 0 8px ${st.cor}` }} />
              <span className="font-medium">{a.nome}</span>
              <span className="rounded-full px-1.5 text-[9px] font-bold uppercase" style={{ background: NIVEL[a.nivel].cor, color: "#111" }}>{NIVEL[a.nivel].nome}</span>
            </button>); })}
          {total === 0 && <span className="text-xs text-white/50">{admin || !online ? "Escritório vazio. Clique em “Contratar agente” pra trazer o primeiro." : "Escritório vazio."}</span>}
        </div>
        {sirene && <span className="animate-pulse rounded-full bg-[#E53935] px-2 py-1 text-[10px] font-bold">APROVAÇÃO PENDENTE</span>}
        <span title={statusServidor ? `banco: ${statusServidor.banco} · IA: ${statusServidor.ia}${statusServidor.detalhe ? " · " + statusServidor.detalhe : ""}` : "conectando"} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${online && statusServidor?.ia === "ok" ? "bg-[#22A86B]/20 text-[#7EE2B0]" : online ? "bg-[#F2913D]/20 text-[#FFC48A]" : "bg-white/5 text-white/50"}`}><span className={`h-1.5 w-1.5 rounded-full ${online ? (statusServidor?.ia === "ok" ? "bg-[#22A86B]" : "bg-[#F2913D]") : "bg-white/30"}`} />{!checado ? "Conectando…" : online ? (statusServidor?.ia === "ok" ? "Agentes reais" : "Banco ok · sem IA") : "Offline"}</span>
        <button onClick={() => setVista(vista === "fora" ? "dentro" : "fora")} title={vista === "fora" ? "Entrar no escritório" : "Ver o prédio por fora"} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15">{vista === "fora" ? "🏢 Ver por dentro" : "🌆 Ver por fora"}</button>
        {temSimulados && <button onClick={() => setSimulando(!simulando)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${simulando ? "bg-white/10 text-white" : "bg-white/5 text-white/50"}`}>{simulando ? "Simulação: ligada" : "Simulação: pausada"}</button>}
        {!mundo && (admin || !online) && <button onClick={() => setModal(true)} className="rounded-full bg-[#4F7DF3] px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-[#3f6ae0]">+ Contratar agente</button>}
        {mundo ? <ContaWorkend /> : online && (admin
          ? <button onClick={logout} title="Sair do modo admin" className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">Admin · sair</button>
          : <button onClick={() => setModalLogin(true)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">Entrar</button>)}
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
  const [area, setArea] = useState<AreaId>(SETORES_ESCRITORIO[0]);
  const [nivel, setNivel] = useState<Nivel>("junior");
  const [nome, setNome] = useState(NOMES[Math.floor(Math.random() * NOMES.length)]);
  const [funcao, setFuncao] = useState(FUNCOES[SETORES_ESCRITORIO[0]][0]);
  const [personalidade, setPersonalidade] = useState(PERSONALIDADES[0]);
  const [boneco, setBoneco] = useState(BONECOS[0].id);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { setFuncao(nivel === "ceo" || nivel === "diretor" ? "Gestão" : FUNCOES[area][0]); }, [area, nivel]);
  if (!aberto) return null;
  const temCeo = Object.values(agentes).some((a) => a.nivel === "ceo");
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
        <div className="text-xs text-[#5B6472]">Ele entra pela porta da recepção, passa na sala do chefe e senta na mesa dele. Depois, clique nele pra treinar: perfil, conhecimento, skills e conversa.</div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-[#5B6472]">Nome</span><input value={nome} onChange={(e) => setNome(e.target.value)} className="rounded-xl border border-black/10 px-3 py-2" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-[#5B6472]">Área</span>
            <select value={area} onChange={(e) => setArea(e.target.value as AreaId)} className="rounded-xl border border-black/10 px-3 py-2" disabled={nivel === "ceo"}>
              {[...SETORES_ESCRITORIO, ...AREAS_APOIO].map((id) => <option key={id} value={id}>{AREAS[id].nome}</option>)}
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
      ["Helena", "diretoria", "ceo", "Gestão", "Focado"],
      ["Aurora", "recepcao", "pleno", "Recepcionista", "Comunicativo"],
      ["Rafael", "trafego", "gerente", "Gestor(a) de tráfego", "Focado"],
      ["Ana", "trafego", "junior", "Analista de campanhas", "Animado"],
      ["Marina", "criativos", "gerente", "Diretor(a) de arte", "Criativo"],
      ["Léo", "criativos", "pleno", "Editor(a) de vídeo", "Criativo"],
      ["Gabi", "criativos", "junior", "Designer de imagens", "Detalhista"],
      ["Diego", "consultoria", "gerente", "Consultor(a) de marketing", "Comunicativo"],
      ["Iara", "consultoria", "diretor", "Gestão", "Detalhista"],
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
          if (ev.tipo === "promovido") await carregar(); // área/mesa mudaram no servidor: recarrega antes de animar (o boneco vai pra sala nova)
          st.emitir(ev.agenteId, ev.tipo as never, ev.texto ?? undefined);
          if (ev.tipo === "aprovado" && ev.texto) st.atualizarLocal(ev.agenteId, { falaPublica: ev.texto });
        }
      } catch { /* servidor fora: tenta de novo no próximo ciclo */ }
    }, 4000);
    return () => clearInterval(t);
  }, [carregar]);
}

// Lotes reservados e a sessão do WorkEnd (atualiza de vez em quando: outra pessoa pode reservar enquanto você olha)
function useMundoServidor() {
  const carregar = useMundo((s) => s.carregar);
  useEffect(() => { carregar(); const t = setInterval(carregar, 30000); return () => clearInterval(t); }, [carregar]);
}

// O mural da fachada é da Nuvem (recados pro CEO); no mundo do WorkEnd ele não aparece pros visitantes
function MuralSeNuvem() { const mundo = useModoMundo(); const admin = useEscritorio((s) => s.admin); if (mundo && !admin) return null; return <Mural />; }
function PainelOuCartao() {
  const admin = useEscritorio((s) => s.admin);
  const online = useEscritorio((s) => s.online);
  const mundo = useModoMundo();
  // No mundo do WorkEnd a Nuvem é só mais uma loja: ninguém vê o painel interno dos agentes, a não ser o admin da Nuvem
  if (mundo && !admin) return <CartaoPublico />;
  return admin || !online ? <PainelAgente /> : <CartaoPublico />;
}

// Gráficos leves (celular/máquina fraca) ou completos. A escolha fica salva no aparelho.
function BotaoGraficos() {
  // no servidor não existe aparelho pra detectar: o botão só aparece no navegador (sem erro de hidratação)
  const q = useSyncExternalStore(semAssinatura, qualidade, () => null);
  if (!q) return null;
  const leve = q === "leve";
  return (
    <button onClick={() => escolherQualidade(leve ? "alta" : "leve")} title={leve ? "Gráficos leves: sem sombras, resolução menor e 30 quadros/s. Clique pra usar os completos." : "Gráficos completos. Clique pra usar os leves (melhor em celular e computador fraco)."}
      className="pointer-events-auto shrink-0 rounded-xl bg-[#111418]/70 px-3 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur hover:bg-[#111418]/85">
      {leve ? "⚡ Gráficos leves" : "✨ Gráficos completos"}
    </button>
  );
}

export function Painel() {
  useSimulador();
  // ?vista=fora abre já na vista externa (prévias e links). No mundo do WorkEnd a entrada é sempre por fora (o mapa),
  // nunca dentro do escritório da Nuvem — a Nuvem é só uma das lojas.
  useEffect(() => { const q = new URLSearchParams(window.location.search); if (q.get("vista") === "fora" || (modoMundo() && q.get("vista") !== "dentro")) useEscritorio.getState().setVista("fora"); }, []);
  // voltou do Google (?conexao=youtube): abre o painel do CEO na aba Tarefas assim que os agentes carregarem
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("conexao")) return;
    const tentar = () => { const s = useEscritorio.getState(); const ceo = Object.values(s.agentes).find((a) => a.nivel === "ceo"); if (ceo) { s.selecionar(ceo.id); return true; } return false; };
    if (tentar()) return;
    const un = useEscritorio.subscribe(() => { if (tentar()) un(); });
    return un;
  }, []);
  useTimeInicial();
  useServidor();
  useMundoServidor();
  return (
    <>
      <BarraTopo />
      <MenuAgente />
      <MuralSeNuvem />
      <PainelOuCartao />
      <CartaoLote />
      <PainelEmpresa />
      <PainelEscritorio />
      <PainelPersonagem />
      <FichaPersonagem />
      <ChatPersonagem />
      <CaixaPersonagem />
      <JanelaChamada />
      <AvisoPagamento />
      <ModalLogin />
      <ModalContratar />
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-2">
        <div className="hidden rounded-xl bg-[#111418]/70 px-3 py-1.5 text-[11px] text-white/70 backdrop-blur sm:block">Arraste pra mover · roda do mouse pra zoom · botão direito pra girar · clique no boneco pra ver a ficha · clique num lote “À venda” pra reservar</div>
        <BotaoGraficos />
      </div>
    </>
  );
}
