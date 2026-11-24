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
import { anexosDe, poseCrua, conferirComEnfeites, ajustarPose, encaixar, giroValido, quartosDoTerreno, estruturasDoLote, conferirQuartos, lugarMaisPerto, girosParaTentar, giroPreferido, centroDoRet, retDoQuarto, retDaMetade, type Giro, type Ponto, type PosePredio, type Conferencia, type TamanhoEstrutura } from "./data/posicaoPredio";
import type { Quarto, Metade } from "./data/quartosLote";
import { ehSede, sedeDe } from "./data/sedes";
import { ehQuiosque, QUIOSQUE_POR_CHAVE, rotuloQuiosque } from "./data/quiosques";
import { LOTE_POR_CHAVE } from "./data/mundo";
import { useSede } from "./sedeStore";

// Lote em quartos (21/11/2026, data/quartosLote.ts): edita uma estrutura por vez (estrutura = "predio" para o prédio médio
// ou o id do quiosque). Ela encaixa no quarto (quiosque) ou na metade (prédio médio): arrastar e as setas levam ao lugar
// livre mais perto naquela direção; o giro é de 90 em 90 graus (o prédio médio, meia volta). A rota que grava confere o
// lote inteiro de novo (src/server/posicao.ts › salvarEstrutura).
export interface Edicao {
  chave: string | null; nome: string;
  estrutura: string | null; tamanho: TamanhoEstrutura | null; lugar: Quarto | Metade | null; // só no lote em quartos
  giro: Giro; desloc: Ponto; inicial: { giro: Giro; desloc: Ponto; lugar?: Quarto | Metade | null } | null;
  pose: PosePredio | null; conf: Conferencia | null;
  aviso: string | null; // "Ajustei a posição para caber", "Salvo"...
  salvando: boolean; erro: string | null; arrastando: boolean;
  abrir: (chave: string, estrutura?: string | null) => string | null; // devolve o motivo quando não pode
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
  return sd ? `Sede da ${sd.nome}` : qk ? rotuloQuiosque(qk) : l ? `Lote ${l.numero}` : "Prédio";
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

// lote em quartos: a pose e a conferência de uma estrutura num giro e lugar (com as outras do lote no caminho). Se ela vale
// mas fecha a passagem de outra, o motivo é o da outra.
function calcularEstrutura(chave: string, id: string, giro: Giro, lugar: Quarto | Metade) {
  const e = useMundo.getState().terrenos[chave]?.escritorio ?? null;
  if (!e) return { pose: null, conf: null };
  const lc = conferirQuartos(chave, e, { id, giro, lugar });
  const i = lc.poses.findIndex((p) => p.estrutura?.id === id);
  const pose = lc.poses[i] ?? null;
  let conf: Conferencia | null = lc.confs[i] ?? null;
  if (conf?.ok && !lc.ok) conf = { ...conf, ok: false, motivo: lc.motivo };
  return { pose, conf };
}
function quartosDoLoteEm(chave: string) {
  const m = useMundo.getState(), t = m.terrenos[chave];
  return t?.escritorio ? quartosDoTerreno(t, anexosDe(m.terrenos)[chave] ?? null) : null;
}

export const useEdicao = create<Edicao>((set, get) => {
  const aplicar = (giro: Giro, desloc: Ponto, aviso: string | null = null) => {
    const ch = get().chave; if (!ch) return;
    const s = get();
    if (s.estrutura && s.lugar != null) {
      const { pose, conf } = calcularEstrutura(ch, s.estrutura, giro, s.lugar);
      set({ giro: pose?.giro ?? giro, desloc: [0, 0], pose, conf, aviso, erro: null }); return;
    }
    const { pose, conf } = calcular(ch, giro, desloc);
    set({ giro: pose?.giro ?? giro, desloc: pose?.desloc ?? desloc, pose, conf, aviso, erro: null });
  };
  // lote em quartos: leva a estrutura para outro lugar; mantém o giro se ele vale lá, senão o que vale (o preferido primeiro)
  const levar = (lugar: Quarto | Metade) => {
    const s = get(); if (!s.chave || !s.estrutura || !s.tamanho || lugar === s.lugar) return;
    const tentar = [...new Set([...girosParaTentar(s.giro, s.tamanho, lugar).slice(0, 1), giroPreferido(s.chave, s.tamanho, lugar), ...girosParaTentar(s.giro, s.tamanho, lugar)])];
    const giro = tentar.find((g) => calcularEstrutura(s.chave!, s.estrutura!, g, lugar).conf?.ok) ?? tentar[0];
    set({ lugar }); aplicar(giro, [0, 0]);
  };
  return {
    chave: null, nome: "", estrutura: null, tamanho: null, lugar: null, giro: 0, desloc: [0, 0], inicial: null, pose: null, conf: null, aviso: null, salvando: false, erro: null, arrastando: false,
    abrir: (chave, estrutura = null) => {
      const p = podeEditarPosicao(chave); if (!p.pode) return p.motivo ?? "Só o dono pode mudar a posição deste prédio.";
      const t = useMundo.getState().terrenos[chave];
      const q = quartosDoLoteEm(chave);
      if (q && t?.escritorio) {
        const ests = estruturasDoLote(q, t.escritorio), s = ests.find((x) => x.id === estrutura) ?? ests[0];
        if (!s) return "Este lote ainda não tem nada para posicionar.";
        const l = LOTE_POR_CHAVE[chave], n = q.quiosques.findIndex((x) => x.id === s.id);
        const nome = `${s.tamanho === "medio" ? "Prédio médio" : q.quiosques.length > 1 ? `Quiosque ${n + 1}` : "Quiosque"}${l ? ` · Lote ${l.numero}` : ""}`;
        set({ chave, nome, estrutura: s.id, tamanho: s.tamanho, lugar: s.lugar, inicial: { giro: s.giro, desloc: [0, 0], lugar: s.lugar }, salvando: false, erro: null, aviso: null, arrastando: false });
        aplicar(s.giro, [0, 0]);
        useMundo.setState({ loteSelecionado: null, loteHover: null, painelEscritorio: false });
        travarSelecao(true);
        useSede.setState({ aberto: false });
        return null;
      }
      set({ estrutura: null, tamanho: null, lugar: null });
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
      // lote em quartos: o quiosque gira de 90 em 90 graus; o prédio médio dá meia volta na metade dele
      if (s.estrutura) { aplicar(((((s.giro + sentido * (s.tamanho === "medio" ? 2 : 1)) % 4) + 4) % 4) as Giro, [0, 0]); return; }
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
    mover: (dx, dz) => {
      const s = get(); if (!s.chave) return;
      // lote em quartos: as setas levam ao quarto (ou à metade) livre do lado, naquela direção
      if (s.estrutura && s.tamanho && s.pose && s.lugar != null) {
        const l = LOTE_POR_CHAVE[s.chave], q = quartosDoLoteEm(s.chave); if (!l || !q) return;
        const c = centroDoRet(s.tamanho === "medio" ? retDaMetade(l, s.lugar as Metade) : retDoQuarto(l, s.lugar as Quarto));
        const alvo = lugarMaisPerto(s.chave, q, s.estrutura, s.tamanho, c[0] + Math.sign(dx) * 10, c[1] + Math.sign(dz) * 10);
        if (alvo != null) levar(alvo); return;
      }
      aplicar(s.giro, [encaixar(s.desloc[0] + dx), encaixar(s.desloc[1] + dz)]);
    },
    colocar: (desloc) => {
      const s = get(); if (!s.chave) return;
      // lote em quartos: o arrasto leva a estrutura para o lugar livre mais perto do dedo (encaixa no quarto ou na metade)
      if (s.estrutura && s.tamanho && s.pose) {
        const q = quartosDoLoteEm(s.chave); if (!q) return;
        const c = s.pose.terreno.centro, cx = (s.pose.caixa.x0 + s.pose.caixa.x1) / 2 - s.pose.centro[0], cz = (s.pose.caixa.z0 + s.pose.caixa.z1) / 2 - s.pose.centro[1];
        const alvo = lugarMaisPerto(s.chave, q, s.estrutura, s.tamanho, c[0] + desloc[0] + cx, c[1] + desloc[1] + cz);
        if (alvo != null) levar(alvo); return;
      }
      const d: Ponto = [encaixar(desloc[0]), encaixar(desloc[1])]; if (d[0] === s.desloc[0] && d[1] === s.desloc[1]) return; aplicar(s.giro, d);
    },
    centralizar: () => {
      const s = get(); if (!s.chave) return;
      if (s.estrutura) { if (s.inicial?.lugar != null) { set({ lugar: s.inicial.lugar }); aplicar(s.inicial.giro, [0, 0]); } return; } // volta para onde estava
      aplicar(s.giro, [0, 0]);
    },
    cancelar: () => { const ch = get().chave; travarSelecao(false); set({ chave: null, estrutura: null, tamanho: null, lugar: null, pose: null, conf: null, inicial: null, arrastando: false, erro: null, aviso: null }); if (ch) useMundo.getState().selecionarLote(ch); },
    confirmar: async () => {
      const s = get(); if (!s.chave || !s.conf?.ok || s.salvando) return false;
      set({ salvando: true, erro: null });
      try {
        const corpo = s.estrutura ? { estrutura: s.estrutura, giro: s.giro, lugar: s.lugar } : { giro: s.giro, desloc: s.desloc };
        const r = await fetch(`/api/terrenos/${encodeURIComponent(s.chave)}/posicao`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { set({ salvando: false, erro: j.erro ?? "Não deu para salvar a posição. Tente de novo." }); return false; }
        await useMundo.getState().carregar();
        const ch = s.chave;
        travarSelecao(false);
        set({ chave: null, estrutura: null, tamanho: null, lugar: null, pose: null, conf: null, inicial: null, salvando: false, arrastando: false });
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
