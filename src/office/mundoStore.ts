"use client";
// Estado do mundo WorkEnd: lotes reservados, lote selecionado, usuário do WorkEnd (sessão própria, separada do admin
// da Nuvem) e o rascunho da empresa enquanto o usuário monta a placa dele.
import { useSede } from "./sedeStore";
import { sedeDe, sedeDoParametro, frenteDaSede } from "./data/sedes";
import { create } from "zustand";
import { useSyncExternalStore } from "react";


import type { Escritorio } from "./data/escritorio";
export interface Terreno { chave: string; usuarioId: string; status: "reservado" | "ativo"; empresaNome: string; cor: string; temLogo: boolean; reservadoEm: string; reservadoAte: string | null; pagoAte: string | null; escritorio: Escritorio | null; nicho?: string; anexoDe?: string | null; promocao?: Promocao | null }
// promoção na fachada (12/11/2026): faixa no prédio, selo no balão e no mini-mapa até a hora marcada
export interface Promocao { texto: string; ate: string; desde?: string }
export const promocaoAtiva = (t: Terreno | null | undefined, agora: number) => (t?.promocao && new Date(t.promocao.ate).getTime() > agora ? t.promocao : null);
// relógio de 30 em 30 s para o que vence sozinho (promoção): a tela some com a faixa sem recarregar
let agoraRel = 0; const ouvintesRel = new Set<() => void>(); let timerRel: ReturnType<typeof setInterval> | null = null;
function assinarRelogio(cb: () => void) {
  ouvintesRel.add(cb);
  if (!timerRel) { agoraRel = Date.now(); timerRel = setInterval(() => { agoraRel = Date.now(); ouvintesRel.forEach((f) => f()); }, 30_000); queueMicrotask(cb); }
  return () => { ouvintesRel.delete(cb); if (!ouvintesRel.size && timerRel) { clearInterval(timerRel); timerRel = null; } };
}
export const useAgora = () => useSyncExternalStore(assinarRelogio, () => agoraRel, () => 0);
export interface UsuarioWorkend { id: string; email: string; nome: string; empresaNome: string; papel?: "dono" | "admin"; banidoEm?: string | null; corLoja?: string } // corLoja: a cor da página grátis (WE-13)
export interface Rascunho { empresaNome: string; cor: string; logoDataUrl: string | null; ceoNome: string; atendenteNome: string; nicho: string }
export type AbaEscritorio = "predio" | "visual" | "interior" | "setores" | "equipe" | "contratar" | "treinar";
// creditos: o que a carteira de créditos cobriu (20/11/2026); valor é só a parte do Pix (0 = pago todo com créditos)
// modelo (20/11/2026, frente predios): compra de um modelo de prédio do catálogo (data/modelos.ts); `modelo` diz qual
// inicio (WE-07, 21/11/2026): 1º pagamento de um lote ou quiosque reservado; aprovado, vem o passo de configuração
export interface Pix { id: string; lote: string; valor: number; codigo: string; qrBase64: string; expiraEm: string; status: "pendente" | "aprovado" | "rejeitado" | "expirado"; tipo: "lote" | "layout" | "personagem" | "outdoor" | "barraca" | "item" | "creditos" | "agente" | "ia" | "personalidade" | "modelo"; creditos?: number; modelo?: string; inicio?: boolean }
// resposta de qualquer rota de pagamento (mercadopago.ts › cobrar): Pix pendente ou já aprovado com créditos
export interface RespostaCobranca { id: string; valor: number; codigo: string; qrBase64: string; expiraEm: string; status?: "pendente" | "aprovado"; creditos?: number }
// praça de eventos e feira de sábado (12/11/2026)
export interface EventoPraca { id: string; titulo: string; descricao: string; link: string; inicio: string; fim: string; meu: boolean; empresa: { nome: string; cor: string; numero: number | null; chave: string | null; logo: string | null } }
export interface BarracaFeira { vaga: number; status: "livre" | "reservada" | "paga"; meu: boolean; nome: string; descricao: string; cor: string; tipo: string; contato: { whatsapp?: string; instagram?: string } }
export interface Praca { agenda: EventoPraca[]; feira: { dia: string; barracas: BarracaFeira[]; preco: number }; agora: string }

export const CORES_EMPRESA = ["#1D4ED8", "#0EA5A4", "#16A34A", "#D97706", "#DC2626", "#DB2777", "#7C3AED", "#1F2937"];

export { LOTES, LOTE_POR_CHAVE, NOME_CONSTRUCAO, descricaoLote, type LoteInfo } from "./data/mundo";
import { LOTE_POR_CHAVE } from "./data/mundo";
import { OUTDOOR_POR_ID, type OutdoorPublico } from "./data/outdoors";
import { PRACA_CHAVE } from "./data/praca";
import { useCreditos, novoIdem } from "./creditosStore";
import { QUIOSQUE_POR_CHAVE, balcaoDoQuiosque, ehQuiosque } from "./data/quiosques";
import { medir, medirUmaVez } from "@/lib/medir";
import { aplicarPosesCidade } from "./data/posesCidade";
// trava de seleção do modo "Editar posição" (edicaoStore liga e desliga)
let selecaoTravada = false;
export const travarSelecao = (sim: boolean) => { selecaoTravada = sim; };

// Estamos no mapa do WorkEnd (workend.online/mundo)? Aí o login é o do WorkEnd, não o do admin da Nuvem.
export const modoMundo = () => typeof window !== "undefined" && (window.location.pathname.startsWith("/mundo") || new URLSearchParams(window.location.search).has("mundo"));
// Pra onde mandar quem quer comprar e não está logado: cadastro do WorkEnd, voltando pro lote escolhido
export function linkCadastro(chave: string) {
  const q = `?lote=${encodeURIComponent(chave)}`;
  return modoMundo() ? `/cadastro${q}` : `https://workend.online/cadastro${q}`;
}

interface Estado {
  terrenos: Record<string, Terreno>;
  meu: string | null; // chave do lote do usuário logado
  meus: string[]; // todos os lotes dele: próprios e os de que é sócio (17/11/2026, terreno.socios)
  usuario: UsuarioWorkend | null;
  admin: boolean; // admin do WorkEnd (vê tudo, libera e bane)
  pagamentoLigado: boolean; // MP_ACCESS_TOKEN configurado no servidor
  preco: number; // R$ por lote por mês
  fundador: { valor: number; restam: number; vagas: number } | null; // oferta de entrada (src/server/ofertas.ts)
  minutosReserva: number;
  desvioRelogio: number; // servidor - navegador (ms), pra contagem regressiva certa
  pagando: boolean;
  pix: Pix | null; // cobrança Pix aberta (QR no cartão do lote)
  painelEscritorio: boolean; // painel "Montar escritório" aberto
  abaEscritorio: AbaEscritorio; // aba inicial do painel (cada botão de edição do cartão abre numa aba)
  rascunhoEscritorio: Escritorio | null; // o que está sendo editado (a cena desenha ao vivo)
  salvandoEscritorio: boolean;
  carregado: boolean;
  loteSelecionado: string | null;
  loteHover: string | null;
  painelEmpresa: boolean; // painel "Montar minha empresa" aberto
  // o painel abriu como o passo logo depois do 1º pagamento (WE-07, 21/11/2026): nicho, nomes da equipe e logomarca
  configurarEmpresa: boolean;
  rascunho: Rascunho | null; // o que está sendo editado (a cena mostra ao vivo)
  alvoCamera: [number, number, number] | null; // a câmera desliza até aqui
  // de que lado a câmera olha o alvo (ângulo em volta do eixo vertical, 0 = do sul): só as sedes pedem (19/11/2026, as
  // viradas para o norte são vistas de frente, pela rua delas); null = mantém o ângulo de agora (scene/Cena3D.tsx)
  giroCamera: number | null;
  // sobe quando a conta admin gira uma sede (data/sedes.ts › aplicarPosesSedes): quem desenha a sede é montado de novo
  versaoSedes: number;
  vagas: Record<string, number>; // vagas abertas por lote (placa "Estamos contratando")
  praca: Praca | null; carregarPraca: () => Promise<void>;
  abrirPix: (p: Pix) => void; // Pix de barraca e de roupa do personagem (criados fora do cartão do lote)
  // cobrança única (20/11/2026): abre o Pix ou, se já foi pago com créditos, mostra o "confirmado" e recarrega
  abrirCobranca: (j: RespostaCobranca, lote: string, tipo: Pix["tipo"], extra?: { modelo?: string; inicio?: boolean }) => Promise<void>;
  aposAprovado: (p: Pix) => Promise<void>;
  // outdoors nas avenidas (12/11/2026)
  outdoors: OutdoorPublico[]; precoOutdoor: number; outdoorSelecionado: string | null;
  carregarOutdoors: () => Promise<void>;
  abrirOutdoor: (slot: string | null) => void;
  pagarOutdoor: (slot: string, frase: string, creditos?: boolean) => Promise<string | null>;
  carregar: () => Promise<void>;
  selecionarLote: (chave: string | null) => void;
  setLoteHover: (chave: string | null) => void;
  abrirPainel: () => void;
  abrirConfiguracao: () => void; // o passo depois do 1º pagamento (ui/Lote.tsx › PixAberto)
  fecharPainel: () => void;
  setRascunho: (r: Partial<Rascunho>) => void;
  reservar: () => Promise<string | null>;
  desistir: () => Promise<string | null>;
  pagar: (meses?: number, tipo?: "lote" | "layout" | "personagem" | "modelo", creditos?: boolean, modelo?: string) => Promise<string | null>;
  conferirPagamento: (ref: string) => Promise<string>;
  fecharPix: () => void;
  abrirEscritorio: (aba?: AbaEscritorio) => void;
  setAbaEscritorio: (aba: AbaEscritorio) => void;
  fecharEscritorio: () => void;
  setEscritorio: (e: Escritorio) => void;
  salvarEscritorio: () => Promise<string | null>;
  sairWorkend: () => Promise<void>;
  limparAlvo: () => void;
}

// eventos de medição (WE-01, 21/11/2026, src/lib/medir.ts): o tipo do que foi pago, separando quiosque e lote extra
const tipoMedido = (p: Pix, t?: Terreno) => (p.tipo !== "lote" ? p.tipo : ehQuiosque(p.lote) ? "quiosque" : t?.anexoDe ? "lote_extra" : "lote");
const pixGerado = (p: Pix, t?: Terreno) => { if (p.status === "pendente" && p.valor > 0) medirUmaVez(`pix_gerado:${p.id}`, "pix_gerado", { tipo: tipoMedido(p, t), value: p.valor, currency: "BRL" }); };

export const useMundo = create<Estado>((set, get) => ({
  vagas: {}, praca: null,
  carregarPraca: async () => { const j = await fetch("/api/workend/praca", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null); if (j?.agenda) set({ praca: j as Praca }); },
  abrirPix: (p) => { set({ pix: p }); pixGerado(p, get().terrenos[p.lote]); },
  abrirCobranca: async (j, lote, tipo, extra) => {
    const p: Pix = { id: j.id, lote, valor: j.valor, codigo: j.codigo, qrBase64: j.qrBase64, expiraEm: j.expiraEm, status: j.status === "aprovado" ? "aprovado" : "pendente", tipo, creditos: j.creditos ?? 0, ...(extra?.modelo ? { modelo: extra.modelo } : {}), ...(extra?.inicio ? { inicio: true } : {}) };
    set({ pix: p });
    pixGerado(p, get().terrenos[lote]); // o QR Code aparece no cartão
    void useCreditos.getState().carregar();
    if (p.status === "aprovado") await get().aposAprovado(p);
  },
  // Pagamento confirmado (Pix ou créditos): recarrega o que mudou e atualiza o rascunho do escritório aberto
  aposAprovado: async (pix) => {
    const antes = new Set((get().terrenos[pix.lote]?.escritorio?.equipe ?? []).map((m) => m.id));
    await get().carregar();
    // 1º pagamento do lote ou do quiosque: a loja aparece no mapa (o lote extra só aumenta o prédio que já existe)
    const tl = get().terrenos[pix.lote];
    if (pix.tipo === "lote" && pix.inicio && tl?.status === "ativo" && !tl.anexoDe) medirUmaVez(`loja:${pix.lote}:${pix.id}`, "loja_publicada", { tipo: tipoMedido(pix, tl) });
    void useCreditos.getState().carregar();
    if (pix.tipo === "outdoor") await get().carregarOutdoors();
    if (pix.tipo === "barraca") await get().carregarPraca();
    if (pix.tipo === "personagem" || pix.tipo === "item") { const { usePersonagem } = await import("./personagemStore"); await usePersonagem.getState().carregar(); }
    const t = get().terrenos[pix.lote]; const r = get().rascunhoEscritorio;
    // modelo comprado com o painel aberto (frente predios): o servidor já trocou o prédio; o rascunho fica com o modelo e a compra
    if (pix.tipo === "modelo" && t?.escritorio && r) set({ rascunhoEscritorio: { ...r, layout: t.escritorio.layout, modelo: t.escritorio.modelo, modelosComprados: t.escritorio.modelosComprados } });
    // crédito de troca de prédio comprado com o painel aberto: atualiza os contadores do rascunho
    if (pix.tipo === "layout" && t?.escritorio && r) set({ rascunhoEscritorio: { ...r, trocasLayout: t.escritorio.trocasLayout, creditosLayout: t.escritorio.creditosLayout } });
    // agente comprado (ou personalidade trocada) com o painel aberto: o membro novo e o setor dele entram no rascunho
    if ((pix.tipo === "agente" || pix.tipo === "personalidade") && t?.escritorio && r) {
      const novos = pix.tipo === "agente" ? t.escritorio.equipe.filter((m) => !antes.has(m.id) && !r.equipe.some((x) => x.id === m.id)) : [];
      const setores = [...r.setores];
      for (const m of novos) {
        const s = t.escritorio.setores.find((x) => x.id === m.setorId); if (!s) continue;
        const i = setores.findIndex((x) => x.id === s.id);
        if (i < 0) setores.push(s); else if (setores[i].mesas < s.mesas) setores[i] = { ...setores[i], mesas: s.mesas };
      }
      const doServidor = new Map(t.escritorio.equipe.map((m) => [m.id, m]));
      const equipe = r.equipe.map((m) => { const s = doServidor.get(m.id); return s ? { ...m, personalidadeId: s.personalidadeId, escopo: s.escopo, nome: pix.tipo === "agente" ? m.nome : m.nome } : m; });
      set({ rascunhoEscritorio: { ...r, setores, equipe: [...equipe, ...novos] } });
    }
  },
  outdoors: [], precoOutdoor: 29.9, outdoorSelecionado: null,
  carregarOutdoors: async () => { const j = await fetch("/api/outdoors", { cache: "no-store" }).then((r) => r.json()).catch(() => null); if (j?.vagas) set({ outdoors: j.vagas, precoOutdoor: j.preco ?? 29.9 }); },
  abrirOutdoor: (slot) => { const v = slot ? OUTDOOR_POR_ID[slot] : null; set({ outdoorSelecionado: v ? slot : null, loteSelecionado: v ? null : get().loteSelecionado, painelEmpresa: false, painelEscritorio: false, alvoCamera: v ? [v.pos[0] * 0.82, 0.5, v.pos[1] * 0.82] : get().alvoCamera }); },
  pagarOutdoor: async (slot, frase, creditos = false) => {
    set({ pagando: true });
    try {
      const r = await fetch(`/api/outdoors/${encodeURIComponent(slot)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ frase, creditos, idem: novoIdem() }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return j.erro ?? `Erro ${r.status}`;
      await get().abrirCobranca(j, `outdoor:${slot}`, "outdoor");
      void get().carregarOutdoors(); return null;
    } catch (e) { return (e as Error).message; } finally { set({ pagando: false }); }
  },
  terrenos: {}, meu: null, meus: [], usuario: null, admin: false, pagamentoLigado: false, preco: 99, fundador: null, minutosReserva: 10, desvioRelogio: 0, pagando: false, pix: null, painelEscritorio: false, abaEscritorio: "predio", rascunhoEscritorio: null, salvandoEscritorio: false, carregado: false, loteSelecionado: null, loteHover: null, painelEmpresa: false, configurarEmpresa: false, rascunho: null, alvoCamera: null, giroCamera: null, versaoSedes: 0,

  carregar: async () => {
    void get().carregarOutdoors();
    // ?sede= e ?lote= só valem na primeira carga: o carregar() repete a cada 30 s (Painel.tsx) e reabria o cartão da sede,
    // puxava a câmera de volta e fechava a conversa com a equipe (16/11/2026)
    const primeira = !get().carregado;
    try {
      const [t, u] = await Promise.all([
        fetch("/api/terrenos").then((r) => r.json()).catch(() => ({ terrenos: [], meu: null })),
        fetch("/api/workend/eu").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      const terrenos: Record<string, Terreno> = {};
      for (const x of (t.terrenos ?? []) as Terreno[]) terrenos[x.chave] = x;
      // quiosques e sedes vão para a posição gravada (data/posesCidade.ts, 21/11/2026)
      const poses = aplicarPosesCidade(terrenos);
      if (poses.sedes) set({ versaoSedes: get().versaoSedes + 1 });
      set({ terrenos, vagas: t.vagas ?? {}, meu: t.meu ?? null, meus: Array.isArray(t.meus) ? t.meus : t.meu ? [t.meu] : [], usuario: u && u.id ? u : null, admin: !!t.admin, pagamentoLigado: !!t.pagamento, preco: t.preco ?? 99, fundador: t.fundador ?? null, minutosReserva: t.minutosReserva ?? 10, desvioRelogio: t.agora ? new Date(t.agora).getTime() - Date.now() : 0, carregado: true });
      // veio do cadastro com ?lote=: já abre o lote escolhido
      const busca = primeira && typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const sedePedida = sedeDoParametro(busca?.get("sede")); // ?sede=1 (Social RP) ou ?sede=<id da sede>
      if (sedePedida) get().selecionarLote(sedePedida.chave);
      const pedido = busca?.get("lote") ?? null;
      if (pedido && (LOTE_POR_CHAVE[pedido] || QUIOSQUE_POR_CHAVE[pedido]) && !get().loteSelecionado) { get().selecionarLote(pedido); if (u && u.id && !terrenos[pedido] && pedido !== PRACA_CHAVE && !busca?.get("pagamento")) get().abrirPainel(); }
      // ?montar=contratar (21/11/2026): o botão "Contratar designer" da Minha equipe abre direto a vitrine de agentes do lote
      if (pedido && busca?.get("montar") === "contratar" && terrenos[pedido]?.escritorio && u && u.id) get().abrirEscritorio("contratar");
    } catch (e) { console.warn("[mundo] sem servidor:", e); set({ carregado: true }); }
  },

  selecionarLote: (chave) => {
    // no modo "Editar posição" o clique no prédio não abre cartão (office/edicaoStore.ts)
    if (chave && selecaoTravada) return;
    // a sede do OneState não é um lote da lista: abre o cartão dela (src/office/ui/CartaoOneState.tsx)
    const sd = sedeDe(chave);
    if (sd) { const [x, z] = frenteDaSede(sd, 0); set({ loteSelecionado: null, alvoCamera: [x, 0.5, z], giroCamera: sd.rot }); useSede.setState({ aberto: true, id: sd.id }); return; }
    // quiosque (20/11/2026, data/quiosques.ts): fora da lista de lotes; a câmera olha o balcão
    const qk = chave ? QUIOSQUE_POR_CHAVE[chave] : null;
    // giroCamera: a câmera olha pelo lado do balcão (no calçadão e na orla o balcão não está virado para o sul)
    if (qk && chave) { const [bx, bz] = balcaoDoQuiosque(qk); set({ outdoorSelecionado: null, loteSelecionado: chave, painelEmpresa: false, rascunho: null, painelEscritorio: false, rascunhoEscritorio: null, alvoCamera: [(qk.pos[0] + bx) / 2, 0.5, (qk.pos[1] + bz) / 2], giroCamera: qk.rot }); return; }
    const l = chave ? LOTE_POR_CHAVE[chave] : null;
    // lote duplo ativo: a câmera vai para o meio dos dois terrenos, onde fica o prédio
    let alvo: [number, number, number] | null = l ? [l.centro[0], 0.5, l.centro[1]] : null;
    if (l && chave) {
      const ts = get().terrenos; const t = ts[chave];
      const par = t?.anexoDe ? (t.status === "ativo" ? t.anexoDe : null) : Object.values(ts).find((x) => x.anexoDe === chave && x.status === "ativo")?.chave ?? null;
      const lp = par ? LOTE_POR_CHAVE[par] : null; if (lp) alvo = [(l.centro[0] + lp.centro[0]) / 2, 0.5, l.centro[1]];
    }
    set({ outdoorSelecionado: null, loteSelecionado: l ? chave : null, painelEmpresa: false, rascunho: null, painelEscritorio: false, rascunhoEscritorio: null, alvoCamera: alvo });
  },
  setLoteHover: (chave) => set({ loteHover: chave }),

  abrirPainel: () => {
    const { loteSelecionado, terrenos, usuario } = get(); if (!loteSelecionado || loteSelecionado === PRACA_CHAVE) return; // a praça não está à venda
    const t = terrenos[loteSelecionado];
    if (!t) medir("abrir_reserva", { tipo: ehQuiosque(loteSelecionado) ? "quiosque" : "lote" }); // lote livre: o formulário de reserva
    const ceo = t?.escritorio?.equipe.find((m) => m.papel === "ceo")?.nome ?? "";
    const atendente = t?.escritorio?.equipe.find((m) => m.papel === "atendente")?.nome ?? "";
    set({ painelEmpresa: true, configurarEmpresa: false, rascunho: { empresaNome: t?.empresaNome ?? usuario?.empresaNome ?? "", cor: t?.cor ?? usuario?.corLoja ?? CORES_EMPRESA[0], logoDataUrl: t?.temLogo ? `/api/terrenos/${encodeURIComponent(loteSelecionado)}/logo?v=${Date.now()}` : null, ceoNome: ceo, atendenteNome: atendente, nicho: t?.nicho ?? "negocios" } });
  },
  abrirConfiguracao: () => { get().abrirPainel(); if (get().painelEmpresa) set({ configurarEmpresa: true }); },
  fecharPainel: () => set({ painelEmpresa: false, rascunho: null }),
  setRascunho: (r) => set((s) => ({ rascunho: s.rascunho ? { ...s.rascunho, ...r } : null })),

  reservar: async () => {
    const { loteSelecionado, rascunho, terrenos, usuario } = get();
    if (!loteSelecionado || !rascunho) return "Escolha um lote.";
    if (!usuario) return "Entre na sua conta do WorkEnd.";
    const atual = terrenos[loteSelecionado];
    const logoNovo = rascunho.logoDataUrl?.startsWith("data:") ? rascunho.logoDataUrl : null;
    // WE-07 (21/11/2026): a reserva nova leva só o nome e a cor; o servidor grava as sugestões do resto. Editar a placa de um
    // lote que já é meu manda tudo, como antes.
    const meuJa = !!atual && atual.usuarioId === usuario.id;
    const body = !meuJa ? { empresaNome: rascunho.empresaNome, cor: rascunho.cor } : { empresaNome: rascunho.empresaNome, cor: rascunho.cor, ceoNome: rascunho.ceoNome, atendenteNome: rascunho.atendenteNome, nicho: rascunho.nicho, logoBase64: logoNovo, logoTipo: logoNovo ? (/^data:(image\/[a-z]+)/.exec(logoNovo)?.[1] ?? "image/png") : null, manterLogo: !logoNovo && !!rascunho.logoDataUrl && !!atual?.temLogo };
    const r = await fetch(`/api/terrenos/${encodeURIComponent(loteSelecionado)}/reservar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    if (!meuJa) medir("reserva_confirmada", { tipo: ehQuiosque(loteSelecionado) ? "quiosque" : "lote" });
    set({ painelEmpresa: false, rascunho: null });
    await get().carregar();
    return null;
  },

  desistir: async () => {
    const { loteSelecionado } = get(); if (!loteSelecionado) return null;
    const r = await fetch(`/api/terrenos/${encodeURIComponent(loteSelecionado)}/reservar`, { method: "DELETE" });
    const j = r.ok ? null : await r.json().catch(() => null);
    await get().carregar();
    return r.ok ? null : j?.erro ?? "Não foi possível desistir agora.";
  },

  // Gera o Pix (QR Code + copia e cola) e mostra no cartão do lote; o mapa confere o pagamento a cada poucos segundos
  pagar: async (meses = 1, tipo = "lote", creditos = false, modelo) => {
    const { loteSelecionado } = get(); if (!loteSelecionado) return "Escolha um lote.";
    const inicio = tipo === "lote" && get().terrenos[loteSelecionado]?.status === "reservado"; // 1º mês (WE-07)
    set({ pagando: true });
    try {
      const r = await fetch(`/api/terrenos/${encodeURIComponent(loteSelecionado)}/pagar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ meses, tipo, creditos, idem: novoIdem(), ...(modelo ? { modelo } : {}) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return j.erro ?? `Erro ${r.status}`;
      await get().abrirCobranca(j, loteSelecionado, tipo, modelo || inicio ? { ...(modelo ? { modelo } : {}), ...(inicio ? { inicio } : {}) } : undefined);
      return null;
    } catch (e) { return (e as Error).message; } finally { set({ pagando: false }); }
  },
  // Confere na API do Mercado Pago (pelo botão "já paguei", pelo relógio do cartão ou ao voltar com ?ref=) e recarrega
  conferirPagamento: async (ref) => {
    const r = await fetch(`/api/pagamentos/${encodeURIComponent(ref)}`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    const status = r.ok ? (j.status as string) : "erro";
    const { pix } = get();
    if (pix && pix.id === ref) {
      // pix_pago quando a pessoa vê a confirmação no cartão (relógio de 4 s ou "Já paguei"); uma vez por cobrança
      if (status === "aprovado") { set({ pix: { ...pix, status: "aprovado" } }); if (pix.valor > 0) medirUmaVez(`pix_pago:${pix.id}`, "pix_pago", { tipo: tipoMedido(pix, get().terrenos[pix.lote]), value: pix.valor, currency: "BRL" }); await get().aposAprovado(pix); }
      else if (status === "rejeitado" || status === "cancelado" || status === "estornado") set({ pix: { ...pix, status: "rejeitado" } });
      else if (new Date(pix.expiraEm).getTime() < Date.now()) set({ pix: { ...pix, status: "expirado" } });
    } else await get().carregar();
    return status;
  },
  fecharPix: () => set({ pix: null }),

  // Painel "Montar escritório": edita uma cópia; a cena mostra a cópia enquanto o painel está aberto
  abrirEscritorio: (aba = "predio") => {
    const { loteSelecionado, terrenos } = get(); if (!loteSelecionado) return;
    const t = terrenos[loteSelecionado]; if (!t?.escritorio) return;
    set({ painelEscritorio: true, painelEmpresa: false, abaEscritorio: aba, rascunhoEscritorio: JSON.parse(JSON.stringify(t.escritorio)) as Escritorio });
  },
  setAbaEscritorio: (aba) => set({ abaEscritorio: aba }),
  fecharEscritorio: () => set({ painelEscritorio: false, rascunhoEscritorio: null }),
  setEscritorio: (e) => set({ rascunhoEscritorio: e }),
  salvarEscritorio: async () => {
    const { loteSelecionado, rascunhoEscritorio } = get(); if (!loteSelecionado || !rascunhoEscritorio) return "Nada pra salvar.";
    set({ salvandoEscritorio: true });
    try {
      const r = await fetch(`/api/terrenos/${encodeURIComponent(loteSelecionado)}/escritorio`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(rascunhoEscritorio) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return j.erro ?? `Erro ${r.status}`;
      set({ painelEscritorio: false, rascunhoEscritorio: null });
      await get().carregar();
      return null;
    } catch (e) { return (e as Error).message; } finally { set({ salvandoEscritorio: false }); }
  },

  sairWorkend: async () => { await fetch("/api/workend/sair", { method: "POST" }); set({ usuario: null, meu: null, meus: [], painelEmpresa: false, rascunho: null }); await get().carregar(); },
  limparAlvo: () => set({ alvoCamera: null, giroCamera: null }),
}));

if (typeof window !== "undefined") (window as unknown as { __mundo: typeof useMundo }).__mundo = useMundo;
