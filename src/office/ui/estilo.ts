// Classes compartilhadas dos painéis flutuantes do mapa: no celular viram uma "gaveta" colada embaixo (largura toda,
// no máximo 72% da altura); no computador ficam à direita, abaixo da barra de cima.
// 21/11/2026 (cartão da sede cortado no celular): a altura segue a tela visível (dvh: a barra do navegador do celular
// entra e sai) e a largura nunca passa da tela, nem com o cartão largo numa tela estreita.
export const FLUTUANTE = "absolute z-20 inset-x-2 bottom-2 max-h-[72dvh] max-w-[calc(100vw-1rem)] sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-20 sm:max-h-[calc(100dvh-7rem)] rounded-2xl bg-white/97 text-[#1D2128] shadow-2xl backdrop-blur";
export const LARGO = "sm:w-[22rem]";
export const ESTREITO = "sm:w-80";
