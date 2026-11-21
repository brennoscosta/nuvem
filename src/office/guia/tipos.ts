// Guia passo a passo (21/11/2026, frente "tutorial"): o formato dos roteiros. Cada passo acende um alvo da tela (ou é um
// recado no meio, sem alvo) e é de um destes tipos:
//  - fato: o servidor confere no banco (perfil completo, lote pago…) e não dá para marcar à mão;
//  - visita: marca quando a pessoa abre a tela indicada;
//  - manual: a pessoa declara que viu, tocando em Seguir.
import type { FatoGuia, FatosGuia, IdRoteiro, TelaGuia } from "../data/guias";

export interface CtxGuia { logado: boolean; nome: string; fatos: FatosGuia; celular: boolean; tela: TelaGuia }
export type Texto = string | ((c: CtxGuia) => string);
// seletor CSS (vale o primeiro visível) ou função que acha o elemento; null = ainda não existe
export type Alvo = string | (() => Element | null);
export interface AcaoFim { rotulo: string; href?: string; roteiro?: IdRoteiro; fazer?: () => void; principal?: boolean }

export interface Passo {
  id: string;
  tipo: "fato" | "visita" | "manual";
  fato?: FatoGuia; // tipo fato
  tela?: TelaGuia; // tipo visita
  alvo?: Alvo; // sem alvo: recado centralizado
  recadoNoCelular?: boolean; // no celular o passo vira recado (o alvo só existe no computador)
  // prepara a tela (abre o cartão, troca a aba…) e chama pronto(); pode devolver a limpeza ao sair do passo
  antes?: (pronto: () => void, c: CtxGuia) => void | (() => void);
  titulo: Texto;
  texto: Texto;
  auto?: boolean; // um toque no alvo avança sozinho (em ~700 ms)
  opcional?: boolean; // não conta como pendente
  ultimo?: boolean; // tela final
  quando?: (c: CtxGuia) => boolean; // só entra no roteiro nesta situação
  pularSe?: () => boolean; // conferido na hora do passo (a tela pode ter mudado depois de o guia abrir)
  acoes?: AcaoFim[] | ((c: CtxGuia) => AcaoFim[]); // botões da tela final
}

export interface Roteiro {
  id: IdRoteiro;
  tela: TelaGuia;
  nome: string; // aparece no alto do balão e no menu do botão Guia
  // entrada: abre sozinho ao entrar na tela; escritorio/personagem: ao abrir o painel (no mapa)
  gatilho: "entrada" | "escritorio" | "personagem";
  quando?: (c: CtxGuia) => boolean; // situação em que este roteiro vale (quem tem empresa, quem só visita…)
  aoFechar?: () => void; // desfaz o que o roteiro abriu na tela
  passos: Passo[];
}
