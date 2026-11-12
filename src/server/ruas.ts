// Ruas com nome (12/11/2026). As 8 ruas da grade têm um nome padrão (src/office/data/mundo.ts); uma empresa fundadora
// (pagou o 1º mês com o preço de fundador, src/server/ofertas.ts) pode dar nome a UMA rua livre. O primeiro que pegar
// fica com ela. O nome passa por um filtro (tamanho, caracteres, palavrões, links) e recebe "Rua" ou "Avenida" conforme
// a rua. O admin vê todas e pode devolver uma rua ao nome padrão.
import { sql, migrar } from "./db";
import type { Usuario } from "./usuarios";
import { ehAdmin } from "./terrenos";
import { RUAS, RUA_POR_ID } from "@/office/data/mundo";

export interface RuaPublica { id: string; nome: string; padrao: string; tipo: "Rua" | "Avenida"; dono: string | null; dada: boolean }

// palavras que não entram em nome de rua (a lista é curta de propósito: o resto o admin limpa)
const PROIBIDAS = ["porra", "caralho", "merda", "puta", "puto", "buceta", "piroca", "cacete", "foda", "fdp", "viado", "bosta", "cu", "otario", "otaria", "corno", "vagabund", "arrombad", "nazis", "hitler"];
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Limpa e valida o nome; devolve o nome completo ("Avenida Padaria do Bairro") ou lança o motivo
export function nomeDeRua(tipo: "Rua" | "Avenida", bruto: unknown): string {
  let t = (typeof bruto === "string" ? bruto : "").replace(/\s+/g, " ").trim();
  t = t.replace(/^(rua|r\.|avenida|av\.?)\s+/i, ""); // o prefixo vem da própria rua
  if (t.length < 3 || t.length > 28) throw new Error("O nome precisa ter de 3 a 28 letras (sem contar Rua ou Avenida).");
  if (!/^[\p{L}\p{N} .,'&-]+$/u.test(t)) throw new Error("Use só letras, números, espaço e . , ' & -");
  if (/https?:|www\.|\.com|\.br|@/i.test(t)) throw new Error("Nome de rua não pode ter link nem e-mail.");
  if (!/\p{L}{2}/u.test(t)) throw new Error("O nome precisa ter letras.");
  const palavras = semAcento(t).split(/[^a-z0-9]+/);
  if (palavras.some((p) => PROIBIDAS.some((x) => p === x || (x.length > 4 && p.startsWith(x))))) throw new Error("Esse nome não pode ser usado numa rua da cidade.");
  // primeira letra de cada palavra em maiúscula, conectivos em minúscula
  const conect = new Set(["de", "da", "do", "das", "dos", "e"]);
  t = t.split(" ").map((p) => (conect.has(p.toLowerCase()) ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1))).join(" "); // "dos Criadores" fica minúsculo depois de Rua/Avenida
  return `${tipo} ${t}`;
}

export async function listarRuas(): Promise<RuaPublica[]> {
  await migrar();
  const linhas = await sql<{ rua: string; nome: string; empresa: string }[]>`SELECT rua, nome, empresa FROM rua_nome`.catch(() => []);
  const por = new Map(linhas.map((l) => [l.rua, l]));
  return RUAS.map((r) => { const l = por.get(r.id); return { id: r.id, nome: l?.nome ?? r.padrao, padrao: r.padrao, tipo: r.tipo, dono: l ? l.empresa || null : null, dada: !!l }; });
}

// Fundador = tem pagamento de lote aprovado com a oferta de fundador. O admin também pode (para testar).
async function ehFundador(u: Usuario) {
  if (ehAdmin(u)) return true;
  const [r] = await sql`SELECT 1 FROM pagamento WHERE usuario_id = ${u.id} AND tipo = 'lote' AND oferta = 'fundador' AND status = 'aprovado' LIMIT 1`;
  return !!r;
}
export async function minhaSituacao(u: Usuario | null) {
  if (!u) return { fundador: false, podeNomear: false, minha: null as string | null };
  await migrar();
  const [minha] = await sql<{ rua: string }[]>`SELECT rua FROM rua_nome WHERE usuario_id = ${u.id}`;
  const fundador = await ehFundador(u);
  return { fundador, podeNomear: fundador && !minha, minha: minha?.rua ?? null };
}

export async function nomearRua(u: Usuario, ruaId: unknown, nome: unknown) {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  const r = RUA_POR_ID[String(ruaId ?? "")]; if (!r) throw new Error("Escolha uma rua do mapa.");
  if (!(await ehFundador(u))) throw new Error("Dar nome a uma rua é um presente para as empresas fundadoras (1º mês pago com o preço de fundador).");
  const completo = nomeDeRua(r.tipo, nome);
  const base = completo.replace(/^(Rua|Avenida) /, "");
  if (RUAS.some((x) => x.id !== r.id && x.padrao.replace(/^(Rua|Avenida) /, "").toLowerCase() === base.toLowerCase())) throw new Error("Já existe uma rua com esse nome.");
  const [emp] = await sql<{ empresaNome: string }[]>`SELECT empresa_nome FROM terreno WHERE usuario_id = ${u.id} AND status = 'ativo' AND anexo_de IS NULL ORDER BY reservado_em LIMIT 1`;
  // não vale usar o nome de outra empresa da cidade (marca de terceiros)
  const [outra] = await sql`SELECT 1 FROM terreno WHERE usuario_id <> ${u.id} AND status = 'ativo' AND lower(empresa_nome) = lower(${base}) LIMIT 1`;
  if (outra) throw new Error("Esse é o nome de outra empresa da cidade. Use o nome da sua ou um nome que não seja de ninguém.");
  return sql.begin(async (tx) => {
    // uma por conta (o admin também fica com uma só) e o primeiro que pegar fica com a rua
    const [jaTenho] = await tx`SELECT rua FROM rua_nome WHERE usuario_id = ${u.id} FOR UPDATE`;
    if (jaTenho) throw new Error("A sua empresa já deu nome a uma rua.");
    // nem repetir o nome de outra rua (mesmo trocando Rua por Avenida)
    const [repetido] = await tx`SELECT 1 FROM rua_nome WHERE lower(regexp_replace(nome, '^(Rua|Avenida) ', '')) = lower(${base})`;
    if (repetido) throw new Error("Já existe uma rua com esse nome.");
    const ins = await tx`INSERT INTO rua_nome (rua, nome, usuario_id, empresa) VALUES (${r.id}, ${completo}, ${u.id}, ${emp?.empresaNome ?? ""}) ON CONFLICT (rua) DO NOTHING`;
    if (!ins.count) throw new Error("Outra empresa acabou de dar nome a essa rua. Escolha outra.");
    return { id: r.id, nome: completo };
  });
}

// admin: todas as ruas com nome dado, e devolver ao padrão
export async function ruasAdmin() {
  await migrar();
  return sql<{ rua: string; nome: string; empresa: string; email: string | null; criadoEm: Date }[]>`SELECT n.rua, n.nome, n.empresa, u.email, n.criado_em FROM rua_nome n LEFT JOIN usuario u ON u.id = n.usuario_id ORDER BY n.criado_em DESC`;
}
export async function limparRua(rua: string) { await migrar(); await sql`DELETE FROM rua_nome WHERE rua = ${rua}`; }
