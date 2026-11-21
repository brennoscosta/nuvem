// Guia passo a passo (21/11/2026, frente "tutorial"): o progresso de cada conta nos roteiros e os fatos que o servidor
// confere no banco. Os passos de fato (perfil completo, lote pago, personagem ativo, agente contratado…) nunca são
// guardados como feitos: valem pelo que está no banco agora. Lote e loja ativa contam só o lote de que a pessoa é titular,
// como o painel (terrenos.ts › terrenoDoUsuario) e o mapa (meu): sócio de uma sede não vira "dono" no guia. Os de visita e os manuais ficam em guia_progresso (0049).
import { sql, migrar } from "./db";
import { resumoPerfil } from "./perfis";
import type { Usuario } from "./usuarios";
import { ehPassoId, ehRoteiro, ehTelaGuia, type EstadoGuiaServidor, type FatosGuia, type ProgressoGuia, type IdRoteiro, type TelaGuia } from "@/office/data/guias";

export async function fatosDoGuia(u: Pick<Usuario, "id" | "papel">): Promise<FatosGuia> {
  const id = u.id;
  const [[r], perfil] = await Promise.all([
    sql<Omit<FatosGuia, "perfil">[]>`SELECT
      EXISTS (SELECT 1 FROM personagem WHERE usuario_id = ${id}) AS personagem, -- 21/11: o personagem básico é grátis; vale ter criado
      EXISTS (SELECT 1 FROM terreno WHERE usuario_id = ${id} AND anexo_de IS NULL AND chave NOT LIKE 'quiosque-%') AS lote,
      EXISTS (SELECT 1 FROM terreno WHERE usuario_id = ${id} AND anexo_de IS NULL AND status = 'ativo') AS lote_ativo,
      EXISTS (SELECT 1 FROM terreno WHERE usuario_id = ${id} AND anexo_de IS NULL AND status = 'reservado') AS reservado,
      EXISTS (SELECT 1 FROM terreno WHERE usuario_id = ${id} AND chave LIKE 'quiosque-%') AS quiosque,
      EXISTS (SELECT 1 FROM terreno WHERE usuario_id = ${id} AND anexo_de IS NOT NULL) AS expandiu,
      EXISTS (SELECT 1 FROM agente_contratado WHERE usuario_id = ${id}) AS contratou,
      (EXISTS (SELECT 1 FROM anuncio_praca WHERE usuario_id = ${id}) OR EXISTS (SELECT 1 FROM outdoor WHERE usuario_id = ${id} AND pago_ate > now())) AS anunciou,
      EXISTS (SELECT 1 FROM pedido WHERE usuario_id = ${id}) AS vendeu`,
    resumoPerfil(id).then((p) => p.completo).catch(() => false),
  ]);
  return { perfil, ...r };
}

export async function estadoGuia(u: Usuario): Promise<EstadoGuiaServidor> {
  await migrar();
  const [fatos, linhas] = await Promise.all([
    fatosDoGuia(u),
    sql<{ roteiro: string; feitos: string[]; dispensadoEm: Date | null; concluidoEm: Date | null }[]>`SELECT roteiro, feitos, dispensado_em, concluido_em FROM guia_progresso WHERE usuario_id = ${u.id}`,
  ]);
  const progresso: Partial<Record<IdRoteiro, ProgressoGuia>> = {};
  let telas: TelaGuia[] = [];
  for (const l of linhas) {
    if (l.roteiro === "_telas") { telas = l.feitos.filter(ehTelaGuia); continue; }
    if (ehRoteiro(l.roteiro)) progresso[l.roteiro] = { feitos: l.feitos, dispensado: !!l.dispensadoEm, concluido: !!l.concluidoEm };
  }
  return { logado: true, nome: u.nome.trim().split(/\s+/)[0] ?? "", fatos, progresso, telas };
}

export interface AcaoGuia { roteiro?: unknown; feitos?: unknown; dispensar?: unknown; reabrir?: unknown; concluir?: unknown; tela?: unknown }

// Marca passos vistos, dispensa, reabre ou conclui um roteiro; ou registra a abertura de uma tela (passos de visita).
export async function salvarGuia(usuarioId: string, a: AcaoGuia) {
  await migrar();
  if (a.tela !== undefined) {
    if (!ehTelaGuia(a.tela)) throw new Error("Tela desconhecida.");
    await gravar(usuarioId, "_telas", [a.tela], false, false, false);
    return;
  }
  if (!ehRoteiro(a.roteiro)) throw new Error("Roteiro desconhecido.");
  const feitos = Array.isArray(a.feitos) ? [...new Set(a.feitos.filter(ehPassoId))].slice(0, 20) : [];
  await gravar(usuarioId, a.roteiro, feitos, a.dispensar === true, a.reabrir === true, a.concluir === true);
}

async function gravar(usuarioId: string, roteiro: string, feitos: string[], dispensar: boolean, reabrir: boolean, concluir: boolean) {
  // junta os passos sem repetir (no máximo 80 por roteiro); reabrir tira a marca de dispensado
  await sql`INSERT INTO guia_progresso (usuario_id, roteiro, feitos, dispensado_em, concluido_em)
    VALUES (${usuarioId}, ${roteiro}, ${sql.array(feitos)}::text[], CASE WHEN ${dispensar} THEN now() END, CASE WHEN ${concluir} THEN now() END)
    ON CONFLICT (usuario_id, roteiro) DO UPDATE SET
      feitos = (SELECT COALESCE(array_agg(DISTINCT f), '{}') FROM (SELECT unnest(guia_progresso.feitos || EXCLUDED.feitos) AS f LIMIT 80) x),
      dispensado_em = CASE WHEN ${reabrir} THEN NULL ELSE COALESCE(EXCLUDED.dispensado_em, guia_progresso.dispensado_em) END,
      concluido_em = COALESCE(guia_progresso.concluido_em, EXCLUDED.concluido_em),
      atualizado_em = now()`;
}
