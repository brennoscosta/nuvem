"use client";
// Personagem do visitante: o meu (montar, pagar, andar) e os outros que estão online (ver, clicar, conversar).
// Presença por batida: a cada 3 s mando minha posição e recebo quem está por perto. Chat por consulta a cada 2,5 s.
import { create } from "zustand";
import { useMundo } from "./mundoStore";
import type { TipoAvatar } from "./data/bonecos";
import { pontoNaCalcada } from "./data/mundo";
import { useChamada, type ChamadaInfo } from "./chamadaStore";

export interface Redes { instagram?: string; linkedin?: string; whatsapp?: string; site?: string }
export interface MeuPersonagem { usuarioId: string; nome: string; tipo: string; boneco: string; roupa: string; bio: string; redes: Redes; mostrarRedes: boolean; pagoAte: string | null; x: number; z: number; rot: number }
export type StatusRelacao = "nenhuma" | "pedi" | "pediram" | "amigos" | "recusada";
export interface Outro { usuarioId: string; nome: string; boneco: string; roupa: string; bio: string; x: number; z: number; rot: number; redes?: Redes; online: boolean; relacao?: { status: StatusRelacao; id: string | null } }
export interface Amigo { usuarioId: string; nome: string; boneco: string; roupa: string; bio: string; redes: Redes; online: boolean; desde: string }
export interface Pedido { id: string; usuarioId: string; nome: string; boneco: string; roupa: string; bio: string; criadoEm: string; direcao: "recebido" | "enviado" }
export interface Negociacao { id: string; deId: string; paraId: string; titulo: string; texto: string; valor: number | null; status: string; criadoEm: string; respondidoEm: string | null; outroId: string; outroNome: string; outroBoneco: string; outroRoupa: string }
export interface Mensagem { id: string; deId: string; paraId: string; tipo: string; texto: string; criadoEm: string }
export interface Conversa { outroId: string; nome: string; boneco: string; roupa: string; ultimo: string; tipo: string; quando: string; naoLidas: number; online: boolean }

interface Estado {
  carregado: boolean;
  meu: MeuPersonagem | null;
  ativo: boolean;
  preco: number; precoCheio: number; pagamentoLigado: boolean;
  outros: Outro[];
  naoLidas: number;
  pedidos: number; // pedidos de amizade recebidos
  amigos: Amigo[]; listaPedidos: Pedido[]; negociacoes: Negociacao[];
  destino: [number, number] | null; // pra onde meu boneco está andando
  passeio: boolean; // o destino atual é um passeio automático pela calçada (não um clique)
  posicao: [number, number, number]; // x, z, rot atuais (atualizados pela cena)
  painel: "montar" | "ficha" | "chat" | "caixa" | null;
  outroSelecionado: Outro | null;
  mensagens: Mensagem[];
  conversas: Conversa[];
  erro: string | null;
  carregar: () => Promise<void>;
  salvar: (d: { nome: string; tipo: string; bio: string; redes: Redes; mostrarRedes: boolean }) => Promise<string | null>;
  pagar: (meses?: number) => Promise<string | null>;
  abrir: (painel: Estado["painel"]) => void;
  fechar: () => void;
  irPara: (x: number, z: number) => void;
  setPosicao: (x: number, z: number, rot: number) => void;
  batida: () => Promise<void>;
  selecionarOutro: (o: Outro | null) => void;
  abrirChat: (o: Outro) => Promise<void>;
  atualizarChat: () => Promise<void>;
  enviar: (tipo: string, texto: string) => Promise<string | null>;
  carregarCaixa: () => Promise<void>;
  carregarRede: () => Promise<void>;
  pedirAmizade: (paraId: string) => Promise<string | null>;
  responderAmizade: (pedidoId: string, aceitar: boolean) => Promise<string | null>;
  desfazerAmizade: (outroId: string) => Promise<void>;
  negociar: (paraId: string, d: { titulo: string; texto: string; valor: string }) => Promise<string | null>;
  responderNegociacao: (id: string, status: "aceita" | "recusada" | "cancelada" | "concluida") => Promise<string | null>;
  ligar: (o: Outro | { usuarioId: string; nome: string; boneco: string; roupa: string }, video: boolean) => Promise<string | null>;
}

export const usePersonagem = create<Estado>((set, get) => ({
  carregado: false, meu: null, ativo: false, preco: 5.9, precoCheio: 19.9, pagamentoLigado: false, outros: [], naoLidas: 0, pedidos: 0, amigos: [], listaPedidos: [], negociacoes: [], destino: null, passeio: false, posicao: [0, 21.3, 0], painel: null, outroSelecionado: null, mensagens: [], conversas: [], erro: null,

  carregar: async () => {
    try {
      const j = await fetch("/api/personagem").then((r) => r.json());
      const meu: MeuPersonagem | null = j.personagem ?? null;
      set({ meu, ativo: !!j.ativo, preco: j.preco ?? 5.9, precoCheio: j.precoCheio ?? 19.9, pagamentoLigado: !!j.pagamento, carregado: true, posicao: meu ? [...pontoNaCalcada(meu.x, meu.z), meu.rot] : get().posicao });
    } catch { set({ carregado: true }); }
  },
  salvar: async (d) => {
    const r = await fetch("/api/personagem", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    set({ meu: j.personagem, ativo: !!j.ativo });
    return null;
  },
  // Pix do personagem: reaproveita o painel de Pix do mapa (chave "personagem")
  pagar: async (meses = 1) => {
    const r = await fetch("/api/personagem/pagar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ meses }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    useMundo.setState({ pix: { id: j.id, lote: "personagem", valor: j.valor, codigo: j.codigo, qrBase64: j.qrBase64, expiraEm: j.expiraEm, status: "pendente", tipo: "personagem" } });
    return null;
  },
  abrir: (painel) => set({ painel }),
  fechar: () => set({ painel: null, outroSelecionado: null }),
  irPara: (x, z) => { if (get().ativo) set({ destino: [x, z], passeio: false }); },
  setPosicao: (x, z, rot) => { set({ posicao: [x, z, rot] }); },
  batida: async () => {
    try {
      const [x, z, rot] = get().posicao;
      const j = await fetch("/api/personagem/presenca", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ x, z, rot }) }).then((r) => r.json());
      const outros: Outro[] = j.outros ?? [];
      const sel = get().outroSelecionado;
      set({ outros, naoLidas: j.naoLidas ?? 0, pedidos: j.pedidos ?? 0, outroSelecionado: sel ? { ...sel, ...(outros.find((o) => o.usuarioId === sel.usuarioId) ?? { online: false }), relacao: sel.relacao } : null });
      // chamada tocando pra mim: avisa a janela de chamada
      const c = j.chamada as (ChamadaInfo & { outroNome: string }) | null; const meu = get().meu;
      if (c && meu && c.paraId === meu.usuarioId && c.status === "tocando") useChamada.getState().receber(c, meu.usuarioId);
    } catch { /* offline: tenta na próxima */ }
  },
  selecionarOutro: (o) => set({ outroSelecionado: o, painel: o ? "ficha" : get().painel === "ficha" ? null : get().painel }),
  abrirChat: async (o) => { set({ outroSelecionado: o, painel: "chat", mensagens: [] }); await get().atualizarChat(); },
  atualizarChat: async () => {
    const o = get().outroSelecionado; if (!o) return;
    const atuais = get().mensagens;
    const desde = atuais.length ? atuais[atuais.length - 1].criadoEm : null;
    const r = await fetch(`/api/mensagens/${encodeURIComponent(o.usuarioId)}${desde ? `?desde=${encodeURIComponent(desde)}` : ""}`);
    if (!r.ok) return;
    const novas: Mensagem[] = await r.json();
    if (!novas.length) return;
    const ids = new Set(atuais.map((m) => m.id));
    set({ mensagens: [...atuais, ...novas.filter((m) => !ids.has(m.id))] });
  },
  enviar: async (tipo, texto) => {
    const o = get().outroSelecionado; if (!o) return "Escolha com quem falar.";
    const r = await fetch(`/api/mensagens/${encodeURIComponent(o.usuarioId)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tipo, texto }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    set({ mensagens: [...get().mensagens, j] });
    return null;
  },
  carregarCaixa: async () => { const r = await fetch("/api/mensagens"); if (r.ok) set({ conversas: await r.json() }); },
  carregarRede: async () => {
    const r = await fetch("/api/rede"); if (!r.ok) return; const j = await r.json();
    set({ amigos: j.amigos ?? [], listaPedidos: j.pedidos ?? [], negociacoes: j.negociacoes ?? [], conversas: j.conversas ?? get().conversas, pedidos: (j.pedidos ?? []).filter((p: Pedido) => p.direcao === "recebido").length });
    if (j.personagem !== undefined) set({ meu: j.personagem, ativo: !!j.ativo, preco: j.preco ?? get().preco, precoCheio: j.precoCheio ?? get().precoCheio, carregado: true });
  },
  pedirAmizade: async (paraId) => {
    const r = await fetch("/api/amigos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paraId }) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    const sel = get().outroSelecionado; if (sel && sel.usuarioId === paraId) set({ outroSelecionado: { ...sel, relacao: j } });
    return null;
  },
  responderAmizade: async (pedidoId, aceitar) => {
    const r = await fetch(`/api/amigos/${encodeURIComponent(pedidoId)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ aceitar }) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    const sel = get().outroSelecionado; if (sel && sel.relacao?.id === pedidoId) set({ outroSelecionado: { ...sel, relacao: j } });
    void get().carregarRede(); return null;
  },
  desfazerAmizade: async (outroId) => { await fetch(`/api/amigos/${encodeURIComponent(outroId)}`, { method: "DELETE" }); void get().carregarRede(); },
  negociar: async (paraId, d) => {
    const r = await fetch("/api/negociacoes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paraId, ...d }) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    if (get().painel === "chat") void get().atualizarChat(); void get().carregarRede(); return null;
  },
  responderNegociacao: async (id, status) => {
    const r = await fetch(`/api/negociacoes/${encodeURIComponent(id)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) return j.erro ?? `Erro ${r.status}`;
    set({ negociacoes: get().negociacoes.map((n) => (n.id === id ? { ...n, status } : n)) });
    if (get().painel === "chat") void get().atualizarChat(); return null;
  },
  ligar: async (o, video) => { const meu = get().meu; if (!meu) return "Monte seu personagem primeiro."; return useChamada.getState().ligar(o.usuarioId, video, meu.usuarioId, { nome: o.nome, boneco: o.boneco, roupa: o.roupa }); },
}));

export type { TipoAvatar };
if (typeof window !== "undefined") (window as unknown as { __personagem: typeof usePersonagem }).__personagem = usePersonagem;
