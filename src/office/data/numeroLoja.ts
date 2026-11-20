// Número público da loja de um terreno (17/11/2026, revisão geral): o endereço workend.online/loja/N.
//  - lote duplo: a ampliação usa o número da loja principal (um número só por loja);
//  - as sedes (fora da lista de lotes, data/sedes.ts) têm o próprio número: Social RP 0, AppZone 901, bday.fm 902,
//    NUVCAM 903 — já com página e atendimento na recepção.
import { LOTES, LOTE_POR_CHAVE } from "./mundo";
import { SEDE_POR_CHAVE, SEDE_POR_NUMERO } from "./sedes";
// quiosques (20/11/2026, data/quiosques.ts): número próprio a partir de 101, fora da lista de lotes
import { QUIOSQUE_POR_CHAVE, QUIOSQUE_POR_NUMERO } from "./quiosques";

export function numeroDaLoja(t: { chave: string; anexoDe?: string | null } | null | undefined): number | null {
  if (!t) return null;
  const sede = SEDE_POR_CHAVE[t.chave];
  if (sede) return sede.numeroLoja;
  const quiosque = QUIOSQUE_POR_CHAVE[t.chave];
  if (quiosque) return quiosque.numero;
  return LOTE_POR_CHAVE[t.anexoDe ?? t.chave]?.numero ?? null;
}
// número que existe (0 é a sede da Social RP): para usar no lugar de `if (numero)`
export const temNumero = (n: number | null | undefined): n is number => typeof n === "number" && n >= 0;
// como o número aparece na tela: "Lote 12" ou "Sede"
export const rotuloLoja = (n: number | null | undefined) => (n != null && SEDE_POR_NUMERO[n] ? "Sede" : n != null && QUIOSQUE_POR_NUMERO[n] ? `Quiosque ${n}` : n != null ? `Lote ${n}` : "");
// o contrário: de que terreno é a loja N (sedes e quiosques pelo número deles)
export const chaveDaLoja = (numero: number): string | null => SEDE_POR_NUMERO[numero]?.chave ?? QUIOSQUE_POR_NUMERO[numero]?.chave ?? LOTES.find((x) => x.numero === numero)?.chave ?? null;
