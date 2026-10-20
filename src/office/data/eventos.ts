// Contrato de eventos entre o "cérebro" dos agentes e a cena.
// Hoje quem gera é o simulador; na Fase 2 o orquestrador real emite o mesmo formato via WebSocket.

export type TipoEvento =
  | "contratado" // entra pelo elevador e vai até a mesa
  | "tarefa_recebida" // chefe vem até a mesa entregar; depois trabalha
  | "trabalhando" // digitando, tela acesa
  | "planejando" // balão de "..."
  | "revisao_pedida" // vai até a sala do chefe
  | "aprovado" // comemora
  | "devolvido" // volta pra mesa com ajustes
  | "bloqueado" // "!" sobre a cabeça
  | "aprovacao_do_dono" // sirene
  | "reuniao" // vai pra sala de reunião
  | "pausa" // vai pra copa / lounge
  | "voltou" // volta pra mesa
  | "expediente_encerrado" // vai embora
  | "promovido" // troca de mesa/crachá
  | "demitido"; // sai com a caixa

export interface Evento {
  id: string;
  ts: number;
  agenteId: string;
  tipo: TipoEvento;
  texto?: string; // resumo público (o que aparece no balão / barra)
  payload?: Record<string, unknown>;
}
