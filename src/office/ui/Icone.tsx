// Ícones próprios do WorkEnd (16/11/2026, pedido do dono: "não quero esses ícones de WhatsApp, quero ícones próprios").
// Todos no mesmo desenho: grade de 24, traço de 1,8 com pontas redondas e um preenchimento leve na mesma cor (duotom).
// Funcionam sem CSS (tudo em atributo), então servem no site, no mapa e nos avisos. A classe "ic" permite animar o traço.
import type { ReactNode } from "react";

const T = { fill: "currentColor", fillOpacity: 0.16 } as const; // o tom: preenchimento leve

const ICONES = {
  mapa: <><path {...T} d="M8.5 4.2l7 2.5V20l-7-2.5z" /><path d="M3 6.6l5.5-2.4 7 2.5L21 4.3v13.2l-5.5 2.5-7-2.5L3 19.9z" /><path d="M8.5 4.2v13.3M15.5 6.7V20" /></>,
  escritorio: <><path {...T} d="M4.5 9L12 4.5 19.5 9z" /><path d="M4.5 21V9L12 4.5 19.5 9v12M2.5 21h19" /><path d="M10 21v-4.2h4V21M8.2 11.8h1.6M14.2 11.8h1.6M8.2 14.6h1.6M14.2 14.6h1.6" /></>,
  resultados: <><rect {...T} x="15" y="5.5" width="4" height="14.5" rx="1.2" /><path d="M3.5 20.5h17" /><rect x="5" y="13" width="4" height="7" rx="1.2" /><rect x="10" y="9" width="4" height="11" rx="1.2" /><rect x="15" y="5.5" width="4" height="14.5" rx="1.2" /></>,
  equipe: <><circle {...T} cx="9" cy="8.2" r="3.2" /><circle cx="9" cy="8.2" r="3.2" /><path d="M3.2 20c0-3.4 2.6-6 5.8-6s5.8 2.6 5.8 6" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.1c2.9.2 4.8 2.6 4.8 5.6" /></>,
  encontrar: <><circle {...T} cx="10.8" cy="10.8" r="6.3" /><circle cx="10.8" cy="10.8" r="6.3" /><path d="M15.6 15.6l4.9 4.9" /><path d="M8 9.2a3.2 3.2 0 0 1 2.6-1.7" /></>,
  rede: <><circle {...T} cx="12" cy="16.8" r="2.6" /><path d="M7.8 8.6l2.9 5.9M16.3 8.1l-2.9 6.3M8.6 6.6h6.7" /><circle cx="6.4" cy="6.8" r="2.4" /><circle cx="17.6" cy="6.3" r="2.4" /><circle cx="12" cy="16.8" r="2.6" /></>,
  admin: <><path {...T} d="M12 3l7 3v5.4c0 4.4-3 8-7 9.6-4-1.6-7-5.2-7-9.6V6z" /><path d="M12 3l7 3v5.4c0 4.4-3 8-7 9.6-4-1.6-7-5.2-7-9.6V6z" /><path d="M9 12l2.1 2.1L15.2 10" /></>,
  sair: <><path d="M13.5 4H6.6A1.6 1.6 0 0 0 5 5.6v12.8A1.6 1.6 0 0 0 6.6 20h6.9" /><path d="M10.5 12H21M17.4 8.4L21 12l-3.6 3.6" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h10" /></>,
  fechar: <><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></>,
  baixo: <><path d="M6.5 9.5L12 15l5.5-5.5" /></>,
  seta: <><path d="M5 12h14M13.5 6.5L19 12l-5.5 5.5" /></>,
  mais: <><path d="M12 5v14M5 12h14" /></>,
  check: <><path d="M5 12.5l4.4 4.4L19 7.4" /></>,
  conversar: <><path {...T} d="M4 5.6A1.6 1.6 0 0 1 5.6 4h8.8A1.6 1.6 0 0 1 16 5.6v5.8a1.6 1.6 0 0 1-1.6 1.6H9.2L5.6 16v-3H5.6A1.6 1.6 0 0 1 4 11.4z" /><path d="M4 5.6A1.6 1.6 0 0 1 5.6 4h8.8A1.6 1.6 0 0 1 16 5.6v5.8a1.6 1.6 0 0 1-1.6 1.6H9.2L5.6 16v-3H5.6A1.6 1.6 0 0 1 4 11.4z" /><path d="M19 9h.4A1.6 1.6 0 0 1 21 10.6v5.6a1.6 1.6 0 0 1-1.6 1.6H19V20l-3.2-2.2h-4.2a1.6 1.6 0 0 1-1.6-1.6v-.8" /><path d="M7.6 8.6h.01M10 8.6h.01M12.4 8.6h.01" strokeWidth="2.4" /></>,
  negociar: <><path {...T} d="M6.2 3h7.6L18 7.2v12.6a1.2 1.2 0 0 1-1.2 1.2H6.2A1.2 1.2 0 0 1 5 19.8V4.2A1.2 1.2 0 0 1 6.2 3z" /><path d="M6.2 3h7.6L18 7.2v12.6a1.2 1.2 0 0 1-1.2 1.2H6.2A1.2 1.2 0 0 1 5 19.8V4.2A1.2 1.2 0 0 1 6.2 3z" /><path d="M13.6 3v4.4H18M8.4 14l2.2 2.2 4.2-4.4" /></>,
  chamada: <><rect {...T} x="3" y="6.5" width="12.5" height="11" rx="2.6" /><rect x="3" y="6.5" width="12.5" height="11" rx="2.6" /><path d="M15.5 10.4l5.5-3.1v9.4l-5.5-3.1" /></>,
  amizade: <><circle {...T} cx="9" cy="8" r="3.3" /><circle cx="9" cy="8" r="3.3" /><path d="M3 20c0-3.6 2.7-6.2 6-6.2s6 2.6 6 6.2M18.5 8v6M15.5 11h6" /></>,
  explorador: <><circle cx="12" cy="12" r="8.6" /><path {...T} d="M15.2 8.8l-2 4.4-4.4 2 2-4.4z" /><path d="M15.2 8.8l-2 4.4-4.4 2 2-4.4z" /><path d="M12 3.4v1.8M12 18.8v1.8M3.4 12h1.8M18.8 12h1.8" /></>,
  maleta: <><rect {...T} x="3" y="7.5" width="18" height="12.5" rx="2.2" /><rect x="3" y="7.5" width="18" height="12.5" rx="2.2" /><path d="M9 7.5V6a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 6v1.5M3 12.6h18M11 12.6v1.6h2v-1.6" /></>,
  estrela: <><path {...T} d="M12 3.6l2.6 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.2 2.7 1-5.7-4.1-4 5.7-.8z" /><path d="M12 3.6l2.6 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.2 2.7 1-5.7-4.1-4 5.7-.8z" /></>,
  candidato: <><rect {...T} x="5" y="3" width="14" height="18" rx="2" /><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="9" r="2.3" /><path d="M8.4 15.4c.6-1.7 2-2.6 3.6-2.6s3 .9 3.6 2.6M9.2 18h5.6" /></>,
  feirante: <><path {...T} d="M3 9l2-5h14l2 5z" /><path d="M3 9l2-5h14l2 5M3 9a2.25 2.25 0 0 0 4.5 0 2.25 2.25 0 0 0 4.5 0 2.25 2.25 0 0 0 4.5 0 2.25 2.25 0 0 0 4.5 0M4.5 11.2V20M19.5 11.2V20M2.5 20h19M7.5 15.2h9" /></>,
  editar: <><path {...T} d="M4 20l1-4.6L15.4 5a2.1 2.1 0 0 1 3 3L8 18.4z" /><path d="M4 20l1-4.6L15.4 5a2.1 2.1 0 0 1 3 3L8 18.4zM13.4 7l3 3" /></>,
  pino: <><path {...T} d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  ajuda: <><circle {...T} cx="12" cy="12" r="8.8" /><circle cx="12" cy="12" r="8.8" /><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6M12 16.9h.01" /></>,
  cabide: <><path d="M10 5.6a2 2 0 1 1 2.7 1.9c-.4.2-.7.5-.7 1V9.4l8.3 5.4c.9.6.5 2-.6 2H4.3c-1.1 0-1.5-1.4-.6-2L12 9.4" /><path {...T} d="M12 9.4l8.3 5.4c.9.6.5 2-.6 2H4.3c-1.1 0-1.5-1.4-.6-2z" /></>,
  etiqueta: <><path {...T} d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-6l-2 3-2-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /><path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-6l-2 3-2-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM7 9.4h10M7 12.2h6" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  selo: <><circle {...T} cx="12" cy="9.2" r="5.6" /><circle cx="12" cy="9.2" r="5.6" /><path d="M8.6 13.6L7.2 21l4.8-2.4 4.8 2.4-1.4-7.4M10 9.2l1.4 1.4L14.2 8" /></>,
  raio: <><path {...T} d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" /><path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" /></>,
  instagram: <><rect {...T} x="4" y="4" width="16" height="16" rx="4.6" /><rect x="4" y="4" width="16" height="16" rx="4.6" /><circle cx="12" cy="12" r="3.7" /><path d="M16.7 7.3h.01" strokeWidth="2.4" /></>,
  telefone: <><path {...T} d="M6.4 4.5h3l1.5 4-2 1.3a10 10 0 0 0 5.3 5.3l1.3-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.4 6.5a2 2 0 0 1 2-2z" /><path d="M6.4 4.5h3l1.5 4-2 1.3a10 10 0 0 0 5.3 5.3l1.3-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.4 6.5a2 2 0 0 1 2-2z" /></>,
  perfil: <><rect {...T} x="3" y="5" width="18" height="14" rx="2.2" /><rect x="3" y="5" width="18" height="14" rx="2.2" /><circle cx="8.6" cy="10.6" r="2" /><path d="M5.9 15.8c.5-1.3 1.5-2 2.7-2s2.2.7 2.7 2M14 10h4M14 13.2h3" /></>,
  globo: <><circle {...T} cx="12" cy="12" r="8.8" /><circle cx="12" cy="12" r="8.8" /><path d="M3.2 12h17.6M12 3.2c2.4 2.5 3.7 5.5 3.7 8.8s-1.3 6.3-3.7 8.8c-2.4-2.5-3.7-5.5-3.7-8.8S9.6 5.7 12 3.2z" /></>,
  agenda: <><rect {...T} x="3.5" y="5" width="17" height="15.5" rx="2.2" /><rect x="3.5" y="5" width="17" height="15.5" rx="2.2" /><path d="M3.5 9.6h17M8 3.2v3.4M16 3.2v3.4M8 13.4h2.4M13.6 13.4H16M8 16.6h2.4" /></>,
  microfone: <><rect {...T} x="9" y="3" width="6" height="11" rx="3" /><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.6 11a6.4 6.4 0 0 0 12.8 0M12 17.4V21M9 21h6" /></>,
  sino: <><path {...T} d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20.5h4" /></>,
  // mapa 3D (16/11/2026): câmera, som, ajustes e conta
  girarEsq: <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.2v4.3h4.3" /></>,
  girarDir: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.2v4.3h-4.3" /></>,
  zoomMais: <><circle {...T} cx="10.5" cy="10.5" r="6.5" /><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.3 15.3l4.9 4.9M10.5 7.8v5.4M7.8 10.5h5.4" /></>,
  zoomMenos: <><circle {...T} cx="10.5" cy="10.5" r="6.5" /><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.3 15.3l4.9 4.9M7.8 10.5h5.4" /></>,
  cubo: <><path {...T} d="M12 3l8 4.5L12 12 4 7.5z" /><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12v9M4 7.5l8 4.5 8-4.5" /></>,
  rua: <><path {...T} d="M6.5 20.5L10 5h4l3.5 15.5z" /><path d="M3 20.5h18M6.5 20.5L10 5h4l3.5 15.5M12 8v1.6M12 12v1.8M12 16.4v2" /></>,
  seguir: <><circle {...T} cx="12" cy="8.6" r="2.8" /><circle cx="12" cy="8.6" r="2.8" /><path d="M7 18.6c.5-2.7 2.6-4.5 5-4.5s4.5 1.8 5 4.5M3 7V4.6A1.6 1.6 0 0 1 4.6 3H7M17 3h2.4A1.6 1.6 0 0 1 21 4.6V7M21 17v2.4a1.6 1.6 0 0 1-1.6 1.6H17M7 21H4.6A1.6 1.6 0 0 1 3 19.4V17" /></>,
  orbita: <><circle {...T} cx="12" cy="12" r="2.6" /><circle cx="12" cy="12" r="2.6" /><ellipse cx="12" cy="12" rx="9" ry="4.2" /><circle cx="19.6" cy="9.8" r="1.4" fill="currentColor" stroke="none" /></>,
  drone: <><rect {...T} x="9" y="10" width="6" height="4" rx="1.3" /><rect x="9" y="10" width="6" height="4" rx="1.3" /><path d="M9 10L7 8M15 10l2-2M9 14l-2 2M15 14l2 2" /><ellipse cx="5.6" cy="6.6" rx="2.7" ry="1.1" /><ellipse cx="18.4" cy="6.6" rx="2.7" ry="1.1" /><ellipse cx="5.6" cy="17.4" rx="2.7" ry="1.1" /><ellipse cx="18.4" cy="17.4" rx="2.7" ry="1.1" /></>,
  andar: <><circle cx="13.6" cy="4.6" r="1.8" /><path d="M12.6 8.6l-2 5 3 2.4V21M10.6 13.6L8.2 21M12.6 8.6l3 3 2.6.6M12.6 8.6L9.2 10l-1.6 3" /></>,
  casa: <><path {...T} d="M5.5 9.6V20h13V9.6L12 4.4z" /><path d="M3.5 11L12 4l8.5 7M5.5 9.6V20h5v-5.4h3V20h5V9.6" /></>,
  sol: <><circle {...T} cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></>,
  lua: <><path {...T} d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></>,
  relogio: <><circle {...T} cx="12" cy="12" r="8.8" /><circle cx="12" cy="12" r="8.8" /><path d="M12 7.4V12l3.1 2" /></>,
  ajustes: <><path d="M4 6.5h8.6M17.4 6.5H20M4 12h2.6M11.4 12H20M4 17.5h10.6M19.4 17.5H20" /><circle {...T} cx="15" cy="6.5" r="2.4" /><circle cx="15" cy="6.5" r="2.4" /><circle {...T} cx="9" cy="12" r="2.4" /><circle cx="9" cy="12" r="2.4" /><circle {...T} cx="17" cy="17.5" r="2.4" /><circle cx="17" cy="17.5" r="2.4" /></>,
  som: <><path {...T} d="M4 9.4h3.6L12 5.6v12.8l-4.4-3.8H4z" /><path d="M4 9.4h3.6L12 5.6v12.8l-4.4-3.8H4zM15.6 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.6 7.6 0 0 1 0 10.8" /></>,
  mudo: <><path {...T} d="M4 9.4h3.6L12 5.6v12.8l-4.4-3.8H4z" /><path d="M4 9.4h3.6L12 5.6v12.8l-4.4-3.8H4zM16 9.5l5 5M21 9.5l-5 5" /></>,
  pessoa: <><circle {...T} cx="12" cy="7.6" r="3.6" /><circle cx="12" cy="7.6" r="3.6" /><path d="M4.8 20.5c.7-4 3.6-6.6 7.2-6.6s6.5 2.6 7.2 6.6" /></>,
  predios: <><path {...T} d="M10 21V4.6l9 4V21z" /><path d="M2.5 21h19M5 21V10l5-2.6M10 21V4.6l9 4V21M13.2 11h2.6M13.2 14.4h2.6M13.2 17.8h2.6M6.8 13.6h1.2M6.8 17h1.2" /></>,
  camadas: <><path {...T} d="M12 3.5l9 5-9 5-9-5z" /><path d="M12 3.5l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.4l9 5 9-5" /></>,
  brilho: <><path {...T} d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z" /><path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>,
  mouse: <><rect {...T} x="6.5" y="3" width="11" height="18" rx="5.5" /><rect x="6.5" y="3" width="11" height="18" rx="5.5" /><path d="M12 7v3.4" /></>,
  teclado: <><rect {...T} x="2.5" y="6" width="19" height="12" rx="2.4" /><rect x="2.5" y="6" width="19" height="12" rx="2.4" /><path d="M6 9.6h.01M9.4 9.6h.01M12.8 9.6h.01M16.2 9.6h.01M6 13h.01M18 9.6h.01M18 13h.01M8.6 14.6h6.8" strokeWidth="2.2" /></>,
  menos: <><path d="M5.5 12h13" /></>,
  filtro: <><path {...T} d="M4 5h16l-6 7.4V19l-4 1.6v-8.2z" /><path d="M4 5h16l-6 7.4V19l-4 1.6v-8.2z" /></>,
  sacola: <><path {...T} d="M5 8h14l-1.2 12a1.5 1.5 0 0 1-1.5 1.4H7.7a1.5 1.5 0 0 1-1.5-1.4z" /><path d="M5 8h14l-1.2 12a1.5 1.5 0 0 1-1.5 1.4H7.7a1.5 1.5 0 0 1-1.5-1.4zM9 10.5V7a3 3 0 0 1 6 0v3.5" /></>,
  cupom: <><path {...T} d="M3 8.6V6.6A1.6 1.6 0 0 1 4.6 5h14.8A1.6 1.6 0 0 1 21 6.6v2a2.4 2.4 0 0 0 0 4.8v2a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 15.4v-2a2.4 2.4 0 0 0 0-4.8z" /><path d="M3 8.6V6.6A1.6 1.6 0 0 1 4.6 5h14.8A1.6 1.6 0 0 1 21 6.6v2a2.4 2.4 0 0 0 0 4.8v2a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 15.4v-2a2.4 2.4 0 0 0 0-4.8zM14.5 5.8v1.4M14.5 10.3v1.4M14.5 14.8v1.4" /></>,
  cameraOff: <><rect {...T} x="3" y="6.5" width="12.5" height="11" rx="2.6" /><rect x="3" y="6.5" width="12.5" height="11" rx="2.6" /><path d="M15.5 10.4l5.5-3.1v9.4l-5.5-3.1M3 3.5l18 17" /></>,
  quadro: <><rect {...T} x="3" y="4.5" width="18" height="15" rx="2" /><rect x="3" y="4.5" width="18" height="15" rx="2" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="M3.5 17l5-4.6 3.6 3.2 3.2-2.6 5.2 4.4" /></>,
  planta: <><path {...T} d="M7 14h10l-1.4 6.4a1 1 0 0 1-1 .8H9.4a1 1 0 0 1-1-.8z" /><path d="M7 14h10l-1.4 6.4a1 1 0 0 1-1 .8H9.4a1 1 0 0 1-1-.8zM12 14V8.5M12 10c0-3.2 2.4-5.5 6-5.5 0 3.3-2.5 5.5-6 5.5zM12 11.5c0-2.6-2-4.6-5-4.6 0 2.7 2 4.6 5 4.6z" /></>,
  foto: <><path {...T} d="M3 8.6A1.6 1.6 0 0 1 4.6 7h2.6l1.6-2.4h6.4L16.8 7h2.6A1.6 1.6 0 0 1 21 8.6v9.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 18.4z" /><path d="M3 8.6A1.6 1.6 0 0 1 4.6 7h2.6l1.6-2.4h6.4L16.8 7h2.6A1.6 1.6 0 0 1 21 8.6v9.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 18.4z" /><circle cx="12" cy="13.2" r="3.6" /></>,
  placa: <><rect {...T} x="4" y="3.5" width="16" height="8.5" rx="1.4" /><rect x="4" y="3.5" width="16" height="8.5" rx="1.4" /><path d="M12 12v8.5M8.5 20.5h7M7.5 7.8h9" /></>,
  arrastar: <><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" strokeWidth="2.8" /></>,
  expandir: <><path d="M14 4h6v6M20 4l-6.5 6.5M10 20H4v-6M4 20l6.5-6.5" /></>,
  recolher: <><path d="M20 10h-6V4M14 10l6.5-6.5M4 14h6v6M10 14l-6.5 6.5" /></>,
  // roupas e acessórios do personagem (src/office/data/acessorios.ts)
  bone: <><path {...T} d="M4.6 15a7.4 7.4 0 0 1 14.8 0z" /><path d="M4.6 15a7.4 7.4 0 0 1 14.8 0M3 15h18.4c.5 0 .7.6.3.9-1.7 1.2-3.9 1.6-6 1.6H4a1 1 0 0 1-1-1zM12 7.6V6.6" /></>,
  chapeu: <><path {...T} d="M8 13.4V10a4 4 0 0 1 8 0v3.4z" /><path d="M8 13.4V10a4 4 0 0 1 8 0v3.4M2.5 14.6c0 1.7 4.3 3 9.5 3s9.5-1.3 9.5-3-4.3-3-9.5-3-9.5 1.3-9.5 3zM8 11.8h8" /></>,
  cartola: <><rect {...T} x="7.5" y="4.5" width="9" height="10.5" rx=".8" /><path d="M7.5 15V5.3c0-.4.4-.8.8-.8h7.4c.4 0 .8.4.8.8V15M3.5 15.4c2.6 1.6 14.4 1.6 17 0M7.5 11.6h9" /></>,
  coroa: <><path {...T} d="M4.2 17.5L3 7.6l5 4 4-6.1 4 6.1 5-4-1.2 9.9z" /><path d="M4.2 17.5L3 7.6l5 4 4-6.1 4 6.1 5-4-1.2 9.9zM4.2 20.5h15.6" /></>,
  fone: <><path d="M4.5 15v-3a7.5 7.5 0 0 1 15 0v3" /><rect {...T} x="3" y="13.5" width="4.2" height="7" rx="1.6" /><rect x="3" y="13.5" width="4.2" height="7" rx="1.6" /><rect {...T} x="16.8" y="13.5" width="4.2" height="7" rx="1.6" /><rect x="16.8" y="13.5" width="4.2" height="7" rx="1.6" /></>,
  oculosSol: <><path fill="currentColor" fillOpacity={0.55} d="M4 10h6.5v2.6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM13.5 10H20v2.6a3 3 0 0 1-3 3h-.5a3 3 0 0 1-3-3z" /><path d="M2.5 10h19M4 10h6.5v2.6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM13.5 10H20v2.6a3 3 0 0 1-3 3h-.5a3 3 0 0 1-3-3z" /></>,
  oculosRedondo: <><circle {...T} cx="7" cy="13" r="3.6" /><circle {...T} cx="17" cy="13" r="3.6" /><circle cx="7" cy="13" r="3.6" /><circle cx="17" cy="13" r="3.6" /><path d="M10.6 12.6c.9-.9 1.9-.9 2.8 0M3.4 12.3L2 10.3M20.6 12.3l1.4-2" /></>,
  mochila: <><rect {...T} x="5" y="7" width="14" height="14" rx="4" /><rect x="5" y="7" width="14" height="14" rx="4" /><path d="M9 7V5.6a3 3 0 0 1 6 0V7M8.6 13.8h6.8v4H8.6z" /></>,
  asas: <><path {...T} d="M11 13c-2-5-6-7-9-6 1 3 2 5 4 6-1 1-2 2-2 3 3 1 5 0 7-3zM13 13c2-5 6-7 9-6-1 3-2 5-4 6 1 1 2 2 2 3-3 1-5 0-7-3z" /><path d="M11 13c-2-5-6-7-9-6 1 3 2 5 4 6-1 1-2 2-2 3 3 1 5 0 7-3zM13 13c2-5 6-7 9-6-1 3-2 5-4 6 1 1 2 2 2 3-3 1-5 0-7-3z" /></>,
  cachecol: <><path {...T} d="M5 7c4 2 10 2 14 0v3c-4 2-10 2-14 0z" /><path d="M5 7c4 2 10 2 14 0v3c-4 2-10 2-14 0zM14 10.6V20l2.4-1 2.2 1V9.4" /></>,
  colar: <><path d="M5 4.5c0 5 3.1 8.6 7 8.6s7-3.6 7-8.6" /><circle {...T} cx="12" cy="16.6" r="2.4" /><circle cx="12" cy="16.6" r="2.4" /><path d="M12 13.1v1.1" /></>,
  // painel "Meu personagem" (16/11/2026): abas do visual e o seletor de cor livre
  cabelo: <><path {...T} d="M5.6 12.4C5.6 7.4 8.5 4 12 4s6.4 3.4 6.4 8.4c-1.7-.6-3.7-2.2-4.5-4.3-1.6 2.3-4.7 3.6-8.3 4.3z" /><path d="M5.6 12.4C5.6 7.4 8.5 4 12 4s6.4 3.4 6.4 8.4M5.6 12.4c.4 4.5 3 7.6 6.4 7.6s6-3.1 6.4-7.6M5.6 12.4c3.6-.7 6.7-2 8.3-4.3.8 2.1 2.8 3.7 4.5 4.3" /></>,
  camiseta: <><path {...T} d="M8.4 4L3 7l2 4.2 2.6-1.1V20h8.8V10.1l2.6 1.1L21 7l-5.4-3c-.6 1.5-2 2.4-3.6 2.4S9 5.5 8.4 4z" /><path d="M8.4 4L3 7l2 4.2 2.6-1.1V20h8.8V10.1l2.6 1.1L21 7l-5.4-3c-.6 1.5-2 2.4-3.6 2.4S9 5.5 8.4 4z" /></>,
  calca: <><path {...T} d="M6.6 3.5h10.8l1.4 17h-4.4L12 10.2l-2.4 10.3H5.2z" /><path d="M6.6 3.5h10.8l1.4 17h-4.4L12 10.2l-2.4 10.3H5.2zM6.4 7h11.2" /></>,
  tenis: <><path {...T} d="M3 16.4V9.8c0-.6.6-1 1.1-.8l3.3 1.2 2-2.8 3 3.1c2.2 2.1 4.8 2.7 7.1 3.3.8.2 1.5.9 1.5 1.7v.9z" /><path d="M3 16.4V9.8c0-.6.6-1 1.1-.8l3.3 1.2 2-2.8 3 3.1c2.2 2.1 4.8 2.7 7.1 3.3.8.2 1.5.9 1.5 1.7v.9zM3 16.4v2.1h18v-2.1M10.4 9.8l-1.3 1.4M12.6 11.8l-1.3 1.4" /></>,
  contaGotas: <><path {...T} d="M13.6 7.4l3 3-8.2 8.2-3.6.6.6-3.6z" /><path d="M13.6 7.4l3 3-8.2 8.2-3.6.6.6-3.6zM12.4 6.2l5.4 5.4M15 5.4l1.6-1.6a2.1 2.1 0 0 1 3 0l.6.6a2.1 2.1 0 0 1 0 3L18.6 9" /></>,
  dado: <><rect {...T} x="4" y="4" width="16" height="16" rx="3.4" /><rect x="4" y="4" width="16" height="16" rx="3.4" /><path d="M8.6 8.6h.01M15.4 8.6h.01M12 12h.01M8.6 15.4h.01M15.4 15.4h.01" strokeWidth="2.6" /></>,
  // conectores (17/11/2026)
  chave: <><circle {...T} cx="8" cy="15.5" r="4.3" /><circle cx="8" cy="15.5" r="4.3" /><path d="M11.1 12.4l8.7-8.7M16.3 7.2l2.6 2.6M14 9.5l2 2" /></>,
  plugue: <><path {...T} d="M6.8 9h10.4v3.4a5.2 5.2 0 0 1-10.4 0z" /><path d="M6.8 9h10.4v3.4a5.2 5.2 0 0 1-10.4 0z" /><path d="M9.6 9V4.2M14.4 9V4.2M12 17.6V21" /></>,
  enviar: <><path {...T} d="M3.5 11.3L20.5 4l-6.7 16.5-3-6.7z" /><path d="M3.5 11.3L20.5 4l-6.7 16.5-3-6.7z" /><path d="M10.8 13.8L20.5 4" /></>,
  banco: <><ellipse {...T} cx="12" cy="6" rx="7" ry="2.8" /><ellipse cx="12" cy="6" rx="7" ry="2.8" /><path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" /></>,
  codigo: <><path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.4 5.5l-2.8 13" /></>,
  // decoração por dentro (17/11/2026)
  tapete: <><rect {...T} x="3" y="7" width="18" height="10" rx="2.5" /><rect x="3" y="7" width="18" height="10" rx="2.5" /><rect x="6.5" y="10" width="11" height="4" rx="1" /><path d="M3 9.5H1.5M3 14.5H1.5M21 9.5h1.5M21 14.5h1.5" /></>,
  estante: <><rect {...T} x="4" y="3" width="16" height="18" rx="1.2" /><rect x="4" y="3" width="16" height="18" rx="1.2" /><path d="M4 9h16M4 15h16M7 5v3M9 5.5V8M14 11v3M16.5 10.5V14M8 17v3" /></>,
  luminaria: <><path {...T} d="M8 3h8l2.5 6h-13z" /><path d="M8 3h8l2.5 6h-13zM12 9v11M8.5 21h7" /></>,
  poltrona: <><path {...T} d="M6 10V7.5A2.5 2.5 0 0 1 8.5 5h7A2.5 2.5 0 0 1 18 7.5V10" /><path d="M6 10V7.5A2.5 2.5 0 0 1 8.5 5h7A2.5 2.5 0 0 1 18 7.5V10M4 11.5a2 2 0 0 1 4 0V14h8v-2.5a2 2 0 0 1 4 0V17H4zM6 17v2M18 17v2" /></>,
  lousa: <><rect {...T} x="3" y="4" width="18" height="12" rx="1.5" /><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M7 8.5c2-1.5 3 1.5 5 0s3-1 5 .5M7 12h6M8 16l-2 5M16 16l2 5" /></>,
  cafe: <><path {...T} d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" /><path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3" /></>,
} satisfies Record<string, ReactNode>;

export type NomeIcone = keyof typeof ICONES;
export const ICONE_ACESSORIO: Record<string, NomeIcone> = {
  "bone-workend": "bone", "chapeu-palha": "chapeu", cartola: "cartola", coroa: "coroa", fone: "fone",
  "oculos-sol": "oculosSol", "oculos-redondo": "oculosRedondo", mochila: "mochila", asas: "asas", cachecol: "cachecol", colar: "colar",
};
// selo de cada missão de visitante (src/office/data/missoes.ts)
export const ICONE_MISSAO: Record<string, NomeIcone> = { explorador: "explorador", papo: "conversar", amigos: "equipe", negociante: "maleta", avaliador: "estrela", candidato: "candidato", feirante: "feirante" };

export function Icone({ nome, tamanho = 20, className, titulo, traco = 1.8 }: { nome: NomeIcone; tamanho?: number; className?: string; titulo?: string; traco?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} className={`ic ${className ?? ""}`} fill="none" stroke="currentColor" strokeWidth={traco} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={titulo ? undefined : true} role={titulo ? "img" : undefined} focusable="false">
      {titulo && <title>{titulo}</title>}
      {ICONES[nome]}
    </svg>
  );
}
