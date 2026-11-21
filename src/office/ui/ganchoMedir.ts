// Ganchos de teste, só com ?medir=1 (21/11/2026, frente responsivo): a ferramenta de medir a largura das telas
// (testes/responsivo/mede-largura.mjs) abre cada cartão da cidade sem recarregar o 3D, que no servidor desenha devagar.
// Sem ?medir=1 nada disto existe na janela.
import { useMundo } from "../mundoStore";
import { useSede } from "../sedeStore";
import { usePersonagem } from "../personagemStore";
import { useEscritorio } from "../store";
import { abrirChatEquipe, useChatEquipe } from "./ChatEquipe";
import { PRACA_CHAVE } from "../data/praca";
import { QUIOSQUES } from "../data/quiosques";
import { OUTDOORS } from "../data/outdoors";
import { SEDES } from "../data/sedes";
import { LOTES } from "../data/mundo";
import { entradasDaCidade } from "../data/entradas";

if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("medir")) {
  Object.assign(window, {
    __ui: {
      mundo: useMundo, sede: useSede, personagem: usePersonagem, escritorio: useEscritorio, chatEquipe: useChatEquipe, abrirChatEquipe,
      praca: PRACA_CHAVE, quiosques: QUIOSQUES.map((q) => q.chave), outdoors: OUTDOORS.map((o) => o.id), sedes: SEDES.map((s) => ({ id: s.id, chave: s.chave })),
      lotes: LOTES.map((l) => ({ chave: l.chave, numero: l.numero })), entradas: () => entradasDaCidade(useMundo.getState().terrenos),
    },
  });
}
