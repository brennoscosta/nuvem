// Lotes do mundo WorkEnd reservados por usuários (tabela terreno). A planta (quais lotes existem) vem do código.
import { sql, migrar } from "./db";
import { QUARTEIROES } from "@/office/data/mundo";

export interface Terreno { chave: string; usuarioId: string; status: "reservado" | "ativo"; empresaNome: string; cor: string; temLogo: boolean; reservadoEm: Date }

export const COR_PADRAO = "#1D4ED8";
const MAX_LOGO = 400 * 1024;

// Lotes que podem ser comprados: os que estão em quarteirões de lotes (não a Nuvem nem o restaurante)
export function loteAVenda(chave: string) {
  const m = /^(-?\d+),(-?\d+),([0-3])$/.exec(chave); if (!m) return false;
  const q = QUARTEIROES.find((x) => x.i === +m[1] && x.j === +m[2]);
  return !!q?.lotes;
}

const SELECT = sql`SELECT chave, usuario_id, status, empresa_nome, cor, (logo IS NOT NULL) AS tem_logo, reservado_em FROM terreno`;

export async function listarTerrenos(): Promise<Terreno[]> {
  await migrar();
  return sql<Terreno[]>`${SELECT} ORDER BY reservado_em`;
}
export async function terrenoDoUsuario(usuarioId: string): Promise<Terreno | null> {
  await migrar();
  const [t] = await sql<Terreno[]>`${SELECT} WHERE usuario_id = ${usuarioId}`;
  return t ?? null;
}

function corValida(c: string) { return /^#[0-9a-fA-F]{6}$/.test(c); }

// Reserva (ou atualiza a reserva) de um lote. Um lote por usuário; se ele já tinha outro, o antigo é liberado.
export async function reservarTerreno(usuarioId: string, chave: string, d: { empresaNome: string; cor?: string; logoBase64?: string | null; logoTipo?: string | null; manterLogo?: boolean }) {
  await migrar();
  if (!loteAVenda(chave)) throw new Error("Esse lote não está à venda.");
  const nome = (d.empresaNome ?? "").trim().slice(0, 60);
  if (nome.length < 2) throw new Error("Diga o nome da empresa.");
  const cor = d.cor && corValida(d.cor) ? d.cor.toUpperCase() : COR_PADRAO;
  let logo: Buffer | null = null, logoTipo: string | null = null;
  if (d.logoBase64) {
    logoTipo = d.logoTipo ?? "image/png";
    if (!/^image\/(png|jpeg|webp)$/.test(logoTipo)) throw new Error("Logo precisa ser PNG, JPG ou WebP.");
    logo = Buffer.from(d.logoBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
    if (logo.length > MAX_LOGO) throw new Error("Logo muito grande (máximo 400 KB).");
  }
  return sql.begin(async (tx) => {
    const [dono] = await tx<{ usuarioId: string }[]>`SELECT usuario_id FROM terreno WHERE chave = ${chave} FOR UPDATE`;
    if (dono && dono.usuarioId !== usuarioId) throw new Error("Esse lote acabou de ser reservado por outra empresa.");
    // libera um lote anterior do mesmo usuário (um chão por usuário nesta fase)
    await tx`DELETE FROM terreno WHERE usuario_id = ${usuarioId} AND chave <> ${chave}`;
    if (dono) {
      if (d.manterLogo && !logo) await tx`UPDATE terreno SET empresa_nome = ${nome}, cor = ${cor}, atualizado_em = now() WHERE chave = ${chave}`;
      else await tx`UPDATE terreno SET empresa_nome = ${nome}, cor = ${cor}, logo = ${logo}, logo_tipo = ${logoTipo}, atualizado_em = now() WHERE chave = ${chave}`;
    } else {
      await tx`INSERT INTO terreno (chave, usuario_id, empresa_nome, cor, logo, logo_tipo) VALUES (${chave}, ${usuarioId}, ${nome}, ${cor}, ${logo}, ${logoTipo})`;
    }
    const [t] = await tx<Terreno[]>`${SELECT} WHERE chave = ${chave}`;
    return t;
  });
}

export async function liberarTerreno(usuarioId: string, chave: string) {
  await migrar();
  const r = await sql`DELETE FROM terreno WHERE chave = ${chave} AND usuario_id = ${usuarioId}`;
  return r.count > 0;
}

export async function logoDoTerreno(chave: string) {
  await migrar();
  const [r] = await sql<{ logo: Uint8Array | null; logoTipo: string | null }[]>`SELECT logo, logo_tipo FROM terreno WHERE chave = ${chave}`;
  return r?.logo ? { dados: Buffer.from(r.logo), tipo: r.logoTipo ?? "image/png" } : null;
}
