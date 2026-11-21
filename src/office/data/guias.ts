// Guia passo a passo (21/11/2026, frente "tutorial"): a lista dos roteiros, das telas e dos fatos que o guia conhece.
// Fica separada dos roteiros (src/office/guia/roteiros*.ts, que mexem na tela) para o servidor validar o que chega
// (src/server/guia.ts) sem importar nada do navegador.

// telas com guia: caminho da página → nome curto
export const TELAS_GUIA = {
  "/mundo": "mundo", "/app": "painel", "/app/creditos": "creditos", "/app/vendas": "vendas", "/app/resultados": "resultados",
  "/app/divulgar": "divulgar", "/app/equipe": "equipe", "/app/rede": "rede", "/app/perfil": "perfil", "/encontrar": "encontrar",
} as const;
export type TelaGuia = (typeof TELAS_GUIA)[keyof typeof TELAS_GUIA];
const NOMES_TELA = new Set<string>(Object.values(TELAS_GUIA));
export const ehTelaGuia = (v: unknown): v is TelaGuia => typeof v === "string" && NOMES_TELA.has(v);
// /workend/app/x (caminho interno, fora do domínio do WorkEnd) e /app/x/ valem como /app/x
export function telaDoCaminho(caminho: string): TelaGuia | null {
  const p = (caminho.replace(/^\/workend(?=\/|$)/, "").replace(/\/+$/, "") || "/") as keyof typeof TELAS_GUIA;
  return TELAS_GUIA[p] ?? null;
}

export const ROTEIROS_GUIA = [
  "boas-vindas", "dono", "cidade", "empresa", "escritorio", "personagem",
  "creditos", "vendas", "resultados", "divulgar", "equipe", "rede", "encontrar", "perfil",
] as const;
export type IdRoteiro = (typeof ROTEIROS_GUIA)[number];
const IDS = new Set<string>(ROTEIROS_GUIA);
export const ehRoteiro = (v: unknown): v is IdRoteiro => typeof v === "string" && IDS.has(v);
export const ehPassoId = (v: unknown): v is string => typeof v === "string" && /^[a-z][a-z0-9-]{0,29}$/.test(v);

// fatos que o servidor confere no banco (passos de fato: não dá para marcar à mão)
export const FATOS_GUIA = ["perfil", "personagem", "lote", "loteAtivo", "reservado", "quiosque", "expandiu", "contratou", "anunciou", "vendeu"] as const;
export type FatoGuia = (typeof FATOS_GUIA)[number];
export type FatosGuia = Record<FatoGuia, boolean>;
export const FATOS_VAZIOS: FatosGuia = Object.fromEntries(FATOS_GUIA.map((f) => [f, false])) as FatosGuia;

export interface ProgressoGuia { feitos: string[]; dispensado: boolean; concluido: boolean }
export interface EstadoGuiaServidor {
  logado: boolean;
  nome: string; // primeiro nome, para o "boas-vindas"
  fatos: FatosGuia;
  progresso: Partial<Record<IdRoteiro, ProgressoGuia>>;
  telas: TelaGuia[]; // telas já abertas (passos de visita)
}
