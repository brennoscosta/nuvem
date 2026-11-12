// Movimento da cidade (12/11/2026): pedidos pelo WhatsApp dos últimos 2 minutos (produto da vitrine ou contato da loja),
// para a cena fazer sair um motoboy de cada loja. Só o número do lote e a hora: nada de quem pediu.
import { sql, migrar, temBanco } from "@/server/db";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";
export const dynamic = "force-dynamic";

declare global {
  var __workendMovimento: { em: number; pedidos: { numero: number; em: number }[] } | undefined;
}
export async function GET() {
  const c = globalThis.__workendMovimento;
  if (c && Date.now() - c.em < 8000) return resposta(c.pedidos);
  let pedidos: { numero: number; em: number }[] = [];
  if (temBanco()) {
    try {
      await migrar();
      const rows = await sql<{ chave: string | null; em: string }[]>`SELECT terreno_chave AS chave, (extract(epoch FROM criado_em) * 1000)::bigint::text AS em
        FROM clique_loja WHERE tipo IN ('produto', 'whatsapp') AND criado_em > now() - interval '2 minutes' ORDER BY criado_em DESC LIMIT 12`;
      pedidos = rows.flatMap((r) => { const n = r.chave ? LOTE_POR_CHAVE[r.chave]?.numero : undefined; return n ? [{ numero: n, em: Number(r.em) }] : []; });
    } catch (e) { console.error("[movimento]", (e as Error).message); }
  }
  globalThis.__workendMovimento = { em: Date.now(), pedidos };
  return resposta(pedidos);
}
const resposta = (pedidos: { numero: number; em: number }[]) => Response.json({ pedidos, agora: Date.now() }, { headers: { "cache-control": "public, max-age=8" } });
