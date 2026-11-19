// Há um cartão ou painel aberto por cima do mapa? (17/11/2026, revisão geral: no celular a barra da câmera e o aviso
// "mapa pesado" cobriam o fim dos cartões e o topo do editor). Quem fica por baixo some enquanto isto for verdade.
import { useMundo } from "../mundoStore";
import { useSede } from "../sedeStore";
import { usePersonagem } from "../personagemStore";
import { useChatEquipe } from "./ChatEquipe";
import { useMoradores } from "../moradorStore";

export function useCartaoAberto() {
  const mundo = useMundo((s) => !!s.loteSelecionado || s.painelEmpresa || s.painelEscritorio || !!s.outdoorSelecionado);
  const sede = useSede((s) => s.aberto);
  const personagem = usePersonagem((s) => s.painel !== null || (s.predio?.fase === "recepcao" || s.predio?.fase === "dentro"));
  const chat = useChatEquipe((s) => s.aberto);
  const morador = useMoradores((s) => s.aberto !== null); // conversa com um morador da cidade (19/11/2026)
  return mundo || sede || personagem || chat || morador;
}
