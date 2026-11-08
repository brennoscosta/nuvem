"use client";
// Personagem do visitante: o meu (montar, pagar, andar) e os outros que estão online (ver, clicar, conversar).
// Presença por batida: a cada 3 s mando minha posição e recebo quem está por perto. Chat por consulta a cada 2,5 s.
import { create } from "zustand";
import { useMundo } from "./mundoStore";
import type { TipoAvatar } from "./data/bonecos";
import { pontoNaCalcada } from "./data/mundo";

export interface Redes { instagram?: string; linkedin?: string; whatsapp?: string; site?: string }
export interface MeuPersonagem { usuarioId: string; nome: string; tipo: string; boneco: string; roupa: string; bio: string; redes: Redes; mostrarRedes: boolean; pagoAte: string | null; x: number; z: number; rot: number }
export interface Outro { usuarioId: string; nome: string; boneco: string; roupa: string; bio: string; x: number; z: number; rot: number; redes?: Redes; online: boolean }
export interface Mensagem { id: string; deId: string; paraId: string; tipo: string; texto: string; criadoEm: string }
export interface Conversa { outroId: string; nome: string; boneco: string; roupa: string; ultimo: string; tipo: string; quando: string; naoLidas: number; online: boolean }

interface Estado {
  carregado: boolean;
  meu: MeuPersonagem | null;
  ativo: boolean;
  preco: number; precoCheio: number; pagamentoLigado: boolean;
  outros: Outro[];
  naoLidas: number;
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
}

export const usePersonagem = create<Estado>((set, get) => ({
  carregado: false, meu: null, ativo: false, preco: 5.9, precoCheio: 19.9, pagamentoLigado: false, outros: [], naoLidas: 0, destino: null, passeio: false, posicao: [0, 21.3, 0], painel: null, outroSelecionado: null, mensagens: [], conversas: [], erro: null,

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
      set({ outros, naoLidas: j.naoLidas ?? 0, outroSelecionado: sel ? { ...sel, ...(outros.find((o) => o.usuarioId === sel.usuarioId) ?? { online: false }) } : null });
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
}));

export type { TipoAvatar };
if (typeof window !== "undefined") (window as unknown as { __personagem: typeof usePersonagem }).__personagem = usePersonagem;
