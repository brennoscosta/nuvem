// WE-16 (22/11/2026): o troika-three-text (o texto 3D do drei) não aponta os tipos no package.json. Só o que a cena usa
// direto: o pré-carregamento da fonte dos letreiros (EscritorioCliente.tsx).
declare module "troika-three-text" {
  export function preloadFont(opcoes: { font?: string; characters?: string | string[]; sdfGlyphSize?: number }, pronto: () => void): void;
}
