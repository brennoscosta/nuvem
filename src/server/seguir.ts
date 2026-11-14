// Seguir uma loja (13/11/2026): quem segue recebe no sino (e no celular, se ligou) quando a loja liga uma promoção, marca um
// evento na praça ou põe um produto novo na vitrine. A loja é da conta do dono (o lote pode mudar; os seguidores ficam).
// Promoção e produto: no máximo 1 aviso por loja a cada 6 h (por tipo). Evento: um aviso por evento.
import { sql, migrar } from "./db";
import { avisar } from "./avisos";
import { lojaDoNumero } from "./resultados";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";

export type TipoNovidade = "promocao" | "evento" | "produto";
const INTERVALO_HORAS: Record<TipoNovidade, number> = { promocao: 6, produto: 6, evento: 0 };
const MAX_AVISADOS = 2000;

export async function estadoSeguir(usuarioId: string | null, numero: number) {
  const loja = await lojaDoNumero(numero);
  if (!loja) return null;
  const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM seguidor WHERE dono_id = ${loja.donoId}`;
  const [s] = usuarioId ? await sql`SELECT 1 FROM seguidor WHERE usuario_id = ${usuarioId} AND dono_id = ${loja.donoId}` : [];
  return { seguindo: !!s, seguidores: n, meu: usuarioId === loja.donoId };
}
export async function alternarSeguir(usuarioId: string, numero: number) {
  const loja = await lojaDoNumero(numero);
  if (!loja) throw new Error("Esta loja não está aberta agora.");
  if (loja.donoId === usuarioId) throw new Error("Esta loja é sua.");
  const r = await sql`DELETE FROM seguidor WHERE usuario_id = ${usuarioId} AND dono_id = ${loja.donoId}`;
  if (!r.count) await sql`INSERT INTO seguidor (usuario_id, dono_id) VALUES (${usuarioId}, ${loja.donoId}) ON CONFLICT DO NOTHING`;
  return estadoSeguir(usuarioId, numero);
}
export async function seguidoresDe(donoId: string, dias = 30) {
  await migrar();
  const [r] = await sql<{ total: number; novos: number }[]>`SELECT count(*)::int AS total, count(*) FILTER (WHERE criado_em > now() - make_interval(days => ${dias}))::int AS novos FROM seguidor WHERE dono_id = ${donoId}`;
  return { total: r?.total ?? 0, novos: r?.novos ?? 0 };
}

// Avisa os seguidores. Nunca lança (é chamado logo depois de gravar a promoção, o evento ou o produto).
export async function avisarSeguidores(donoId: string, tipo: TipoNovidade, a: { texto: string; ref?: string }) {
  try {
    await migrar();
    const horas = INTERVALO_HORAS[tipo];
    if (horas > 0) {
      // trava por loja e tipo: só passa se o último envio foi há mais de N horas (quem ganha a corrida grava primeiro)
      const r = await sql`INSERT INTO seguidor_envio (dono_id, tipo) VALUES (${donoId}, ${tipo})
        ON CONFLICT (dono_id, tipo) DO UPDATE SET em = now() WHERE seguidor_envio.em < now() - make_interval(hours => ${horas}) RETURNING dono_id`;
      if (!r.count) return 0;
    }
    const [loja] = await sql<{ chave: string; empresa: string }[]>`SELECT chave, empresa_nome AS empresa FROM terreno WHERE usuario_id = ${donoId} AND status = 'ativo' AND anexo_de IS NULL ORDER BY reservado_em LIMIT 1`;
    if (!loja) return 0;
    const numero = LOTE_POR_CHAVE[loja.chave]?.numero;
    const titulo = tipo === "promocao" ? `🏷️ ${loja.empresa} ligou uma promoção` : tipo === "evento" ? `🎤 ${loja.empresa} marcou um evento na praça` : `🛍️ ${loja.empresa} pôs um produto novo`;
    const link = tipo === "evento" ? "/mundo?praca=1" : tipo === "produto" && numero ? `/loja/${numero}#vitrine` : `/mundo?lote=${encodeURIComponent(loja.chave)}`;
    const quem = await sql<{ usuarioId: string }[]>`SELECT usuario_id FROM seguidor WHERE dono_id = ${donoId} ORDER BY criado_em LIMIT ${MAX_AVISADOS}`;
    const ref = `seg:${tipo}:${donoId}:${a.ref ?? new Date().toISOString().slice(0, 13)}`;
    for (const s of quem) await avisar(s.usuarioId, { tipo: "seguindo", ref, renovar: tipo !== "evento", titulo, texto: a.texto, link });
    return quem.length;
  } catch (e) { console.error("[seguir]", (e as Error).message); return 0; }
}
