// Estado do passaporte no navegador (20/11/2026, frente "visitante"): o passaporte aberto, o aviso depois de um
// atendimento (carimbo, marco, cupom, pedido cumprido) e os presentes de Natal do dia (a cena e o contador leem daqui).
// Os dados vêm de /api/workend/passaporte (src/server/passaporte.ts).
import { create } from "zustand";
import { usePersonagem } from "./personagemStore";
import { ACESSORIO_POR_ID } from "./data/acessorios";

// vestir já uma peça ganha (troca a do mesmo lugar); recarrega os itens para a peça nova estar na conta
export async function usarItem(item: string) {
  await usePersonagem.getState().carregarItens();
  const st = usePersonagem.getState();
  const usando = st.itens?.usando ?? st.meu?.acessorios ?? [];
  const lugar = ACESSORIO_POR_ID[item]?.lugar;
  return st.vestir([item, ...usando.filter((i) => ACESSORIO_POR_ID[i]?.lugar !== lugar)]);
}

export interface CarimboTela { chave: string; nome: string; cor: string; numero: number | null; em: string; logo: string | null; novo?: boolean }
export interface MarcoTela { n: number; id: string; insignia: string; frase: string; item: string; itemNome: string; bonus: number; cor: string; ganho: boolean; em: string | null; bonusRecebido: number }
export interface MarcoGanho { id: string; insignia: string; item: string | null; itemNome: string | null; bonus: number; semBonusPorTeto: boolean }
export interface CupomPassaporte { id: string; titulo: string; regra: string; validade: string; desconto: string | null; meu: string | null; usado: boolean }
export interface PedidoHoje { moradorId: string; morador: string; estado: "disponivel" | "aceito" | "feito" | "agradecido" | "recusado"; loja: { nome: string; numero: number | null; chave: string } | null; texto: string | null }
export interface PresenteTela { idx: number; x: number; z: number; caixa: string; fita: string; achado: boolean }
export interface NatalTela { ativo: boolean; temporada: number; meta: number; porDia: number; achados: number; hoje: PresenteTela[]; ganhou: boolean; dia: string }
export interface Passaporte {
  logado: true; ativo: boolean; nome: string; boneco: string | null; roupa: string | null; acessorios: string[]; numero: string; emitido: string;
  carimbos: CarimboTela[]; total: number; proximo: { n: number; falta: number; insignia: string } | null; marcos: MarcoTela[];
  insignias: { id: string; nome: string; frase: string; cor: string }[]; pedidos: PedidoHoje[];
  assinaturas: { moradorId: string; morador: string; loja: string; em: string }[]; natal: NatalTela; limiteDia: number;
}
export interface Atendimento {
  carimbo: CarimboTela | null; total: number; proximo: { n: number; falta: number; insignia: string } | null; marcos: MarcoGanho[];
  cupom: CupomPassaporte | null; pedidos: { moradorId: string; morador: string }[]; limiteDoDia: boolean;
}

interface Estado {
  aberto: boolean;
  dados: Passaporte | null;
  carregando: boolean;
  novos: number; // carimbos e marcos novos desde a última vez que abriu (selo no botão)
  aviso: (Atendimento & { n: number; numero: number; atendente: string | null }) | null;
  natal: NatalTela | null;
  abrir: () => void;
  fechar: () => void;
  carregar: () => Promise<void>;
  carregarNatal: () => Promise<void>;
  aoAtendimento: (r: Atendimento | null | undefined, numero: number, atendente?: string | null) => void;
  fecharAviso: () => void;
  presenteAchado: (idx: number, achados: number) => void;
}

let seqAviso = 0;
export const usePassaporte = create<Estado>()((set, get) => ({
  aberto: false, dados: null, carregando: false, novos: 0, aviso: null, natal: null,
  abrir: () => { set({ aberto: true, novos: 0 }); void get().carregar(); },
  fechar: () => set({ aberto: false }),
  carregar: async () => {
    if (get().carregando) return;
    set({ carregando: true });
    try {
      const r = await fetch("/api/workend/passaporte", { cache: "no-store" });
      const j = r.ok ? await r.json() : null;
      if (j?.logado) set({ dados: j as Passaporte, natal: (j as Passaporte).natal });
    } catch { /* sem rede: fica o que tinha */ }
    set({ carregando: false });
  },
  carregarNatal: async () => {
    try { const r = await fetch("/api/workend/passaporte/natal", { cache: "no-store" }); if (r.ok) set({ natal: (await r.json()) as NatalTela }); } catch { /* sem rede */ }
  },
  aoAtendimento: (r, numero, atendente = null) => {
    if (!r) return;
    const novidades = (r.carimbo?.novo ? 1 : 0) + r.marcos.length;
    set((s) => ({ aviso: { ...r, n: ++seqAviso, numero, atendente }, novos: s.novos + novidades }));
    if (novidades || r.pedidos.length) void get().carregar();
  },
  fecharAviso: () => set({ aviso: null }),
  presenteAchado: (idx, achados) => set((s) => (s.natal ? { natal: { ...s.natal, achados, hoje: s.natal.hoje.map((p) => (p.idx === idx ? { ...p, achado: true } : p)) } } : {})),
}));
