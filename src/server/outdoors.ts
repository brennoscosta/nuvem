// Outdoors do mapa (12/11/2026): aluguel por 30 dias no Pix, só para quem tem lote ativo. A reserva vale 70 minutos (o
// QR do Pix vale 60). Pagou: o anúncio fica no ar até pago_ate. Estorno tira os dias. A frase é curta e só texto.
import { sql, migrar } from "./db";
import type { Usuario } from "./usuarios";
import { ehAdmin, terrenoDoUsuario } from "./terrenos";
import { criarCobrancaOutdoor, type CobrancaPix } from "./mercadopago";
import { OUTDOORS, OUTDOOR_POR_ID, PRECO_OUTDOOR, DIAS_OUTDOOR, MAX_FRASE_OUTDOOR, type OutdoorPublico } from "@/office/data/outdoors";
import { LOTE_POR_CHAVE, nomeNicho } from "@/office/data/mundo";

const limparFrase = (f: unknown) => (typeof f === "string" ? f : "").replace(/https?:\/\/\S+|www\.\S+/gi, "").replace(/[<>{}\[\]\\]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_FRASE_OUTDOOR);

export async function listarOutdoors(euId: string | null): Promise<OutdoorPublico[]> {
  await migrar();
  const linhas = await sql<{ slot: string; usuarioId: string | null; terrenoChave: string | null; frase: string; reservadoAte: Date | null; pagoAte: Date | null; ativo: boolean; reservado: boolean;
    empresaNome: string | null; cor: string | null; nicho: string | null; chave: string | null; temLogo: boolean | null }[]>`
    SELECT o.slot, o.usuario_id, o.terreno_chave, o.frase, o.reservado_ate, o.pago_ate,
      (o.pago_ate > now()) AS ativo, (o.reservado_ate > now()) AS reservado,
      t.empresa_nome, t.cor, t.nicho, t.chave, (t.logo IS NOT NULL) AS tem_logo
    FROM outdoor o
    LEFT JOIN LATERAL (SELECT * FROM terreno x WHERE x.usuario_id = o.usuario_id AND x.status = 'ativo' AND x.anexo_de IS NULL ORDER BY (x.chave = o.terreno_chave) DESC LIMIT 1) t ON true`;
  return OUTDOORS.map((v) => {
    const o = linhas.find((l) => l.slot === v.id);
    const ativo = !!o?.ativo && !!o.chave;
    return {
      slot: v.id, status: ativo ? "ativo" : o?.reservado ? "reservado" : "livre", pagoAte: o?.pagoAte ? new Date(o.pagoAte).toISOString() : null, meu: !!euId && o?.usuarioId === euId,
      frase: ativo ? o!.frase : "",
      empresa: ativo ? { nome: o!.empresaNome ?? "", cor: o!.cor ?? "#1D4ED8", nicho: nomeNicho(o!.nicho), numero: o!.chave ? LOTE_POR_CHAVE[o!.chave]?.numero ?? null : null, chave: o!.chave, logo: o!.temLogo && o!.chave ? `/api/terrenos/${encodeURIComponent(o!.chave)}/logo` : null } : null,
    };
  });
}

export async function alugarOutdoor(u: Usuario, slot: string, fraseIn: unknown, base: string): Promise<CobrancaPix> {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  const vaga = OUTDOOR_POR_ID[slot]; if (!vaga) throw new Error("Outdoor não encontrado.");
  const lote = await terrenoDoUsuario(u.id);
  if (!lote || lote.status !== "ativo") throw new Error("Para anunciar num outdoor, tenha um lote ativo no mapa: o anúncio mostra a sua loja.");
  const frase = limparFrase(fraseIn);
  const [atual] = await sql<{ usuarioId: string | null; ativo: boolean; reservado: boolean; pagoAte: Date | null }[]>`SELECT usuario_id, (pago_ate > now()) AS ativo, (reservado_ate > now()) AS reservado, pago_ate FROM outdoor WHERE slot = ${slot}`;
  if (atual?.ativo && atual.usuarioId !== u.id) throw new Error(`Este outdoor está alugado até ${new Date(atual.pagoAte!).toLocaleDateString("pt-BR")}. Escolha outro.`);
  if (atual?.reservado && atual.usuarioId !== u.id) throw new Error("Outra empresa está pagando este outdoor agora. Tente de novo em 1 hora ou escolha outro.");
  await sql`INSERT INTO outdoor (slot, usuario_id, terreno_chave, frase, reservado_ate) VALUES (${slot}, ${u.id}, ${lote.chave}, ${frase}, now() + interval '70 minutes')
    ON CONFLICT (slot) DO UPDATE SET usuario_id = EXCLUDED.usuario_id, terreno_chave = EXCLUDED.terreno_chave, frase = EXCLUDED.frase, reservado_ate = EXCLUDED.reservado_ate,
      pago_ate = CASE WHEN outdoor.usuario_id = EXCLUDED.usuario_id THEN outdoor.pago_ate ELSE NULL END, atualizado_em = now()`;
  const valor = ehAdmin(u) ? Math.round(PRECO_OUTDOOR * 100) / 10000 : PRECO_OUTDOOR; // admin paga 1/100 para testar de verdade
  return criarCobrancaOutdoor(u, base, slot, valor, `WorkEnd · outdoor ${vaga.nome} · ${DIAS_OUTDOOR} dias (${lote.empresaNome})`);
}

// a frase pode ser trocada a qualquer momento por quem alugou (sem pagar de novo)
export async function mudarFraseOutdoor(u: Usuario, slot: string, fraseIn: unknown) {
  await migrar();
  const r = await sql`UPDATE outdoor SET frase = ${limparFrase(fraseIn)}, atualizado_em = now() WHERE slot = ${slot} AND usuario_id = ${u.id} AND pago_ate > now()`;
  if (!r.count) throw new Error("Você não tem anúncio neste outdoor.");
}
// admin tira a frase de um anúncio (o aluguel continua)
export async function limparFraseOutdoorAdmin(slot: string) { await migrar(); await sql`UPDATE outdoor SET frase = '', atualizado_em = now() WHERE slot = ${slot}`; }

type Db = typeof sql;
export async function ativarOutdoor(slot: string, usuarioId: string, meses: number, db: Db = sql) {
  const r = await db`UPDATE outdoor SET reservado_ate = NULL, atualizado_em = now(), pago_ate = GREATEST(COALESCE(pago_ate, now()), now()) + make_interval(days => ${DIAS_OUTDOOR * meses}) WHERE slot = ${slot} AND usuario_id = ${usuarioId}`;
  return r.count > 0;
}
export async function reverterOutdoor(slot: string, usuarioId: string, meses: number, db: Db = sql) {
  await db`UPDATE outdoor SET atualizado_em = now(), pago_ate = pago_ate - make_interval(days => ${DIAS_OUTDOOR * meses}) WHERE slot = ${slot} AND usuario_id = ${usuarioId} AND pago_ate IS NOT NULL`;
}
