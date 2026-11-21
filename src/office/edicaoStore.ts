// Modo "Editar posição" (21/11/2026, pedido do dono: "quero que tenha a opção de poder girar o prédio, estilo a parte de
// editar do game RollerCoaster Tycoon, SimCity e etc. para que possamos posicionar no local correto do nosso terreno").
// O dono do lote ou do quiosque (e a conta admin, nas sedes) abre o modo perto do prédio; a câmera vai para cima do
// terreno, aparece a grade de 0,5 m e o prédio vira "fantasma" verde (vale) ou vermelho (não vale, com o motivo). Gira de
// 90 em 90 graus (botões, R e Shift+R), arrasta com o mouse ou o dedo (encaixa na grade), ajusta com as setas, centraliza,
// confirma ou cancela (Esc). A conta é a mesma do servidor (data/posicaoPredio.ts); quem grava é a rota
// /api/terrenos/[chave]/posicao (src/server/posicao.ts), que confere tudo de novo.
// A cena lê daqui: scene/EditorPosicao.tsx (grade, contorno, caminho da porta, arrasto e câmera) e o prédio em edição
// (scene/EscritorioCliente.tsx, scene/Quiosques.tsx e a sede) vai para a pose do rascunho sem refazer o desenho.
import { create } from "zustand";
import { useMundo, travarSelecao } from "./mundoStore";
import { anexosDe, poseCrua, conferirComEnfeites, ajustarPose, encaixar, giroValido, type Giro, type Ponto, type PosePredio, type Conferencia } from "./data/posicaoPredio";
import { ehSede, sedeDe } from "./data/sedes";
import { ehQuiosque, QUIOSQUE_POR_CHAVE } from "./data/quiosques";
import { LOTE_POR_CHAVE } from "./data/mundo";
import { useSede } from "./sedeStore";

export interface Edicao {
  chave: string | null; nome: string;
  giro: Giro; desloc: Ponto; inicial: { giro: Giro; desloc: Ponto } | null;
  pose: PosePredio | null; conf: Conferencia | null;
  aviso: string | null; // "Ajustei a posição para caber", "Salvo"...
  salvando: boolean; erro: string | null; arrastando: boolean;
  abrir: (chave: string) => string | null; // devolve o motivo quando não pode
  girar: (sentido: 1 | -1) => void; // 1 = para a esquerda (anti-horário visto de cima), -1 = para a direita
  mover: (dx: number, dz: number) => void; // ajuste fino (setas): em metros, eixos do mundo
  colocar: (desloc: Ponto) => void; // arrasto: o deslocamento já encaixado
  centralizar: () => void;
  cancelar: () => void;
  confirmar: () => Promise<boolean>;
  setArrastando: (a: boolean) => void;
}

// quem pode editar a posição deste terreno: o dono (ou sócio) do lote ou do quiosque ativo; a sede, só a conta admin
export function podeEditarPosicao(chave: string | null | undefined): { pode: boolean; motivo: string | null } {
  const m = useMundo.getState();
  if (!chave) return { pode: false, motivo: null };
  const t = m.terrenos[chave];
  if (ehSede(chave)) return m.admin ? { pode: true, motivo: null } : { pode: false, motivo: "A posição da sede só muda pela conta admin." };
  if (!t) return { pode: false, motivo: null };
  if (t.anexoDe) return { pode: false, motivo: "A posição do prédio é ajustada pelo lote principal." };
  const dono = !!m.usuario && (t.usuarioId === m.usuario.id || m.meus.includes(chave));
  if (!dono && !m.admin) return { pode: false, motivo: null };
  if (t.status !== "ativo" || !t.escritorio) return { pode: false, motivo: "Pague o 1º mês para posicionar o prédio." };
  return { pode: true, motivo: null };
}
function nomeDe(chave: string) {
  const sd = sedeDe(chave), qk = QUIOSQUE_POR_CHAVE[chave], l = LOTE_POR_CHAVE[chave];
  return sd ? `Sede da ${sd.nome}` : qk ? `Quiosque ${qk.numero}` : l ? `Lote ${l.numero}` : "Prédio";
}
// a pose e a conferência de um rascunho (o escritório em edição no painel, se for deste lote)
function calcular(chave: string, giro: Giro, desloc: Ponto) {
  const m = useMundo.getState(), t = m.terrenos[chave];
  const e = (m.loteSelecionado === chave && m.rascunhoEscritorio) || t?.escritorio || null;
  const base = { chave, status: t?.status ?? "ativo", escritorio: e };
  const anexo = anexosDe(m.terrenos)[chave] ?? null;
  const pose = poseCrua(base, anexo, { giro, desloc });
  return { base, anexo, pose, conf: pose ? conferirComEnfeites(pose, e?.decor) : null };
}

export const useEdicao = create<Edicao>((set, get) => {
  const aplicar = (giro: Giro, desloc: Ponto, aviso: string | null = null) => {
    const ch = get().chave; if (!ch) return;
    const { pose, conf } = calcular(ch, giro, desloc);
    set({ giro: pose?.giro ?? giro, desloc: pose?.desloc ?? desloc, pose, conf, aviso, erro: null });
  };
  return {
    chave: null, nome: "", giro: 0, desloc: [0, 0], inicial: null, pose: null, conf: null, aviso: null, salvando: false, erro: null, arrastando: false,
    abrir: (chave) => {
      const p = podeEditarPosicao(chave); if (!p.pode) return p.motivo ?? "Só o dono pode mudar a posição deste prédio.";
      const t = useMundo.getState().terrenos[chave];
      const d = t?.escritorio?.decor, giro = giroValido(d?.giro), desloc: Ponto = Array.isArray(d?.desloc) ? [encaixar(d.desloc[0]), encaixar(d.desloc[1])] : [0, 0];
      set({ chave, nome: nomeDe(chave), inicial: { giro, desloc }, salvando: false, erro: null, aviso: null, arrastando: false });
      // a posição gravada pode não valer mais (troca de modelo): começa pela que a cena desenha
      const { base, anexo } = calcular(chave, giro, desloc);
      const a = ajustarPose(base, anexo, { giro, desloc });
      aplicar(a?.pose.giro ?? giro, a?.pose.desloc ?? desloc);
      // o cartão do lote sai da frente (volta ao fechar)
      useMundo.setState({ loteSelecionado: null, loteHover: null, painelEscritorio: false });
      travarSelecao(true);
      useSede.setState({ aberto: false }); // o cartão da sede também sai da frente
      return null;
    },
    girar: (sentido) => {
      const s = get(); if (!s.chave || !s.pose) return;
      const passo = s.pose.terreno.so180 ? 2 : 1;
      const giro = ((((s.giro + sentido * passo) % 4) + 4) % 4) as Giro;
      const { base, anexo, pose, conf } = calcular(s.chave, giro, s.desloc);
      // girou e não cabe: encaixa no lugar válido mais perto (até 3 m), como nos jogos de construir
      if (pose && conf && !conf.ok) {
        const a = ajustarPose(base, anexo, { giro, desloc: s.desloc });
        if (a && a.conf.ok && a.pose.giro === giro && Math.hypot(a.pose.desloc[0] - s.desloc[0], a.pose.desloc[1] - s.desloc[1]) <= 3) { aplicar(giro, a.pose.desloc, "Ajustei a posição para o prédio caber girado."); return; }
      }
      aplicar(giro, s.desloc);
    },
    mover: (dx, dz) => { const s = get(); if (!s.chave) return; aplicar(s.giro, [encaixar(s.desloc[0] + dx), encaixar(s.desloc[1] + dz)]); },
    colocar: (desloc) => { const s = get(); if (!s.chave) return; const d: Ponto = [encaixar(desloc[0]), encaixar(desloc[1])]; if (d[0] === s.desloc[0] && d[1] === s.desloc[1]) return; aplicar(s.giro, d); },
    centralizar: () => { const s = get(); if (!s.chave) return; aplicar(s.giro, [0, 0]); },
    cancelar: () => { const ch = get().chave; travarSelecao(false); set({ chave: null, pose: null, conf: null, inicial: null, arrastando: false, erro: null, aviso: null }); if (ch) useMundo.getState().selecionarLote(ch); },
    confirmar: async () => {
      const s = get(); if (!s.chave || !s.conf?.ok || s.salvando) return false;
      set({ salvando: true, erro: null });
      try {
        const r = await fetch(`/api/terrenos/${encodeURIComponent(s.chave)}/posicao`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ giro: s.giro, desloc: s.desloc }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { set({ salvando: false, erro: j.erro ?? "Não deu para salvar a posição. Tente de novo." }); return false; }
        await useMundo.getState().carregar();
        const ch = s.chave;
        travarSelecao(false);
        set({ chave: null, pose: null, conf: null, inicial: null, salvando: false, arrastando: false });
        useMundo.getState().selecionarLote(ch);
        return true;
      } catch { set({ salvando: false, erro: "Sem conexão. Tente de novo." }); return false; }
    },
    setArrastando: (a) => set({ arrastando: a }),
  };
});
export const edicaoAtiva = () => !!useEdicao.getState().chave;
export const editandoQuiosque = (s: Edicao) => (s.chave && ehQuiosque(s.chave) ? s.chave : null);

// ?medir=1 (roteiros de teste, testes/editor/teste-editor.mjs): o estado da edição e a fonte das poses ficam no window
if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("medir")) {
  void Promise.all([import("./data/posicaoPredio"), import("./data/entradas"), import("./data/obstaculos"), import("./data/quiosques"), import("./data/sedes")]).then(([pp, en, ob, q, s]) => {
    Object.assign(window, { __edicao: useEdicao, __posicao: { ...pp, entradasDaCidade: en.entradasDaCidade, caixasDaCidade: ob.caixasDaCidade, QUIOSQUE_POR_CHAVE: q.QUIOSQUE_POR_CHAVE, SEDES: s.SEDES } });
  });
}
