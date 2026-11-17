// Número público da loja de um terreno (17/11/2026, revisão geral): o endereço workend.online/loja/N.
//  - lote duplo: a ampliação usa o número da loja principal (um número só por loja);
//  - as sedes (fora da lista de lotes, data/sedes.ts) têm o próprio número: Social RP 0, AppZone 901, bday.fm 902,
//    NUVCAM 903 — já com página e atendimento na recepção.
import { LOTES, LOTE_POR_CHAVE } from "./mundo";
import { SEDE_POR_CHAVE, SEDE_POR_NUMERO } from "./sedes";

export function numeroDaLoja(t: { chave: string; anexoDe?: string | null } | null | undefined): number | null {
  if (!t) return null;
  const sede = SEDE_POR_CHAVE[t.chave];
  if (sede) return sede.numeroLoja;
  return LOTE_POR_CHAVE[t.anexoDe ?? t.chave]?.numero ?? null;
}
// número que existe (0 é a sede da Social RP): para usar no lugar de `if (numero)`
export const temNumero = (n: number | null | undefined): n is number => typeof n === "number" && n >= 0;
// como o número aparece na tela: "Lote 12" ou "Sede"
export const rotuloLoja = (n: number | null | undefined) => (n != null && SEDE_POR_NUMERO[n] ? "Sede" : n != null ? `Lote ${n}` : "");
// o contrário: de que terreno é a loja N (sedes pelo número delas)
export const chaveDaLoja = (numero: number): string | null => SEDE_POR_NUMERO[numero]?.chave ?? LOTES.find((x) => x.numero === numero)?.chave ?? null;
