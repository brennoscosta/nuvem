// Guarda no aparelho (v67, 13/11/2026): o que a cena gera em código e é caro (terreno e mata da serra) fica no IndexedDB do
// navegador, e a segunda visita reaproveita em vez de calcular de novo. A chave leva a versão: mudou o gerador, muda a chave.
// Tudo com try/catch: sem IndexedDB (aba anônima, navegador antigo, cota cheia) a cena só gera de novo.
const BANCO = "workend-cena", LOJA = "gerado";
let aberto: Promise<IDBDatabase | null> | null = null;
function abrir(): Promise<IDBDatabase | null> {
  if (aberto) return aberto;
  aberto = new Promise((ok) => {
    try {
      if (typeof indexedDB === "undefined") return ok(null);
      const r = indexedDB.open(BANCO, 1);
      r.onupgradeneeded = () => { try { r.result.createObjectStore(LOJA); } catch { /* já existe */ } };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
      r.onblocked = () => ok(null);
    } catch { ok(null); }
  });
  return aberto;
}
export async function lerGuardado<T>(chave: string): Promise<T | null> {
  const db = await abrir(); if (!db) return null;
  return new Promise((ok) => {
    try {
      const r = db.transaction(LOJA, "readonly").objectStore(LOJA).get(chave);
      r.onsuccess = () => ok((r.result as T | undefined) ?? null);
      r.onerror = () => ok(null);
    } catch { ok(null); }
  });
}
// grava sem segurar nada (falhou, paciência: na próxima visita gera de novo)
export function guardar(chave: string, valor: unknown) {
  void abrir().then((db) => {
    if (!db) return;
    try {
      const tx = db.transaction(LOJA, "readwrite"), loja = tx.objectStore(LOJA);
      // apaga as versões antigas do mesmo item (chave "nome@versão")
      const nome = chave.split("@")[0];
      const lista = loja.getAllKeys();
      lista.onsuccess = () => { for (const k of lista.result) if (typeof k === "string" && k.split("@")[0] === nome && k !== chave) loja.delete(k); loja.put(valor, chave); };
    } catch { /* cota cheia ou bloqueado */ }
  });
}
// devolve a vez para o navegador desenhar um quadro (geração em fatias: a cidade continua lisa enquanto isso)
export const fatia = () => new Promise<void>((ok) => setTimeout(ok, 0));
// lê de uma vez tudo o que começa com o prefixo (ex.: os prédios do kit já montados neste aparelho)
export async function lerVarios<T>(prefixo: string): Promise<Map<string, T>> {
  const saida = new Map<string, T>();
  const db = await abrir(); if (!db) return saida;
  return new Promise((ok) => {
    try {
      const r = db.transaction(LOJA, "readonly").objectStore(LOJA).openCursor(IDBKeyRange.bound(prefixo, prefixo + "￿"));
      r.onsuccess = () => { const c = r.result; if (!c) return ok(saida); saida.set(String(c.key), c.value as T); c.continue(); };
      r.onerror = () => ok(saida);
    } catch { ok(saida); }
  });
}
