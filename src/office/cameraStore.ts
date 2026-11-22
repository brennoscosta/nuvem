"use client";
// Controles de câmera do mapa (11/11/2026, pedido do dono: "movimentação de câmera"). A barra de botões (ui/ControlesCamera)
// e o teclado pedem comandos; a cena (scene/CameraMundo) executa com animação suave.
import { create } from "zustand";

// drone e andar (12/11/2026): voo automático pela cidade e passeio na rua com a câmera atrás do meu personagem
export type ComandoCamera = "girarEsq" | "girarDir" | "aproximar" | "afastar" | "cima" | "rua" | "inicio" | "seguir" | "passeio" | "drone" | "andar";
interface EstadoCamera {
  pedido: { tipo: ComandoCamera; n: number } | null;
  seguir: boolean; passeio: boolean; cima: boolean; rua: boolean; drone: boolean; andar: boolean;
  pedir: (tipo: ComandoCamera) => void;
  set: (p: Partial<Pick<EstadoCamera, "seguir" | "passeio" | "cima" | "rua" | "drone" | "andar">>) => void;
}
let n = 0;
export const useCamera = create<EstadoCamera>((set) => ({
  pedido: null, seguir: false, passeio: false, cima: false, rua: false, drone: false, andar: false,
  pedir: (tipo) => set({ pedido: { tipo, n: ++n } }),
  set: (p) => set(p),
}));

// Atalhos de teclado (mostrados na ajuda da barra)
export const ATALHOS: [string, string][] = [
  ["W A S D ou setas", "mover"], ["Q / E", "girar"], ["+ / −", "aproximar e afastar"], ["T", "ver de cima"], ["V", "ver da rua"],
  ["F", "seguir meu personagem"], ["P", "girar devagar"], ["O", "voo de drone pela cidade"], ["C", "andar pela rua (W A S D movem o personagem)"],
  ["B", "subir ou descer da bicicleta"], ["H", "voltar ao início"], ["duplo clique", "ir até o ponto"],
];

// joystick da tela no celular (modo andar): direção de -1 a 1, escrita pela interface e lida pela cena a cada quadro
export const joystick = { x: 0, y: 0 };
// Andar pela rua (21/11/2026, pedido do dono: "a movimentação é bugada"): a direção pedida pelo teclado ou pelo joystick,
// já no chão do mundo (x e z de -1 a 1; o tamanho é a força do joystick). Escrita pelo CameraMundo a cada quadro e lida pelo
// meu boneco (scene/Personagens.tsx › Meu), que anda direto por ela, com arranque, freada e colisão quadro a quadro. Antes o
// teclado mandava o boneco até um ponto 2,6 m à frente a cada 160 ms: parava longe das paredes, cortava quinas, a bicicleta
// pulsava de velocidade e soltar a tecla freava de uma vez.
export const comandoAndar = { ativo: false, x: 0, z: 0 };

// para onde a câmera olha (alvo no chão e direção): escrito pelo CameraMundo a cada quadro, lido pelo mini-mapa e pela névoa
export const cameraInfo = { x: 0, z: 0, ang: 0, pronto: false };
// Até onde a câmera do mapa se afasta (20/11/2026, pedido do dono: "quero poder diminuir mais o zoom para poder ver melhor
// a cidade de cima, algo em torno de 30% de zoom menos"): 119 → 155 m no computador e 138 → 180 m no celular em pé.
// Vale para a roda do mouse, a pinça, os botões e o teclado. A câmera de seguir o personagem não muda.
export const RAIO_MAXIMO = typeof window !== "undefined" && window.innerWidth < window.innerHeight ? 180 : 155;

// Hora do mapa (12/11/2026): automática (horário de Brasília), sempre dia ou sempre noite. Lembrada só neste navegador.
// Primeira visita de dia (WE-21, 22/11/2026): das 18h às 6h quem chegava pela primeira vez via a cidade apagada e os
// letreiros ilegíveis. Sem escolha salva, a PRIMEIRA visita do navegador abre sempre de dia (a troca nos ajustes continua
// valendo); a visita fica marcada quando a cidade 3D abre (scene/CicloDia) e, da segunda em diante, vale a hora automática.
// ?hora= continua mandando em tudo (scene/CicloDia).
export type ModoHora = "auto" | "dia" | "noite";
const CHAVE_HORA = "workend-hora";
const CHAVE_VISITA = "workend-ja-entrou";
let diaDaPrimeiraVisita = false;
function lerModoHora(): ModoHora {
  if (typeof window === "undefined") return "auto";
  try {
    const v = window.localStorage.getItem(CHAVE_HORA);
    if (v === "dia" || v === "noite" || v === "auto") return v;
    if (window.localStorage.getItem(CHAVE_VISITA)) return "auto";
  } catch { /* sem armazenamento: não dá para saber se já entrou; fica de dia */ }
  diaDaPrimeiraVisita = true;
  return "dia";
}
// a cidade abriu de dia por ser a primeira visita (a nota do painel de ajustes explica o "Dia" marcado)
export const primeiraVisitaDeDia = () => diaDaPrimeiraVisita;
export function marcarVisita() { try { window.localStorage.setItem(CHAVE_VISITA, "1"); } catch { /* sem armazenamento */ } }
export const useHora = create<{ modo: ModoHora; proximo: () => void; definir: (m: ModoHora) => void }>((set, get) => ({
  modo: lerModoHora(),
  // escolha direta (painel de ajustes do mapa, 16/11/2026)
  definir: (modo) => { diaDaPrimeiraVisita = false; try { window.localStorage.setItem(CHAVE_HORA, modo); } catch { /* sem armazenamento */ } set({ modo }); },
  proximo: () => {
    diaDaPrimeiraVisita = false;
    const modo: ModoHora = get().modo === "auto" ? "dia" : get().modo === "dia" ? "noite" : "auto";
    try { window.localStorage.setItem(CHAVE_HORA, modo); } catch { /* sem armazenamento: vale só nesta visita */ }
    set({ modo });
  },
}));
