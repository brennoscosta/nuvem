// Endereço próprio da loja (WE-11, 21/11/2026): workend.online/<slug>, a página da loja renderizada no servidor, sem 3D.
// Regras (formato e palavras reservadas em data/slugLoja.ts):
//  - o endereço é da empresa (tabela loja_endereco, migração 0055): sai do nome, é único e fica reservado no cadastro
//    (quando a pessoa diz o nome da empresa) ou na reserva do lote;
//  - não muda depois que a loja foi ao ar. Antes disso, reservar com outro nome troca o endereço (o antigo ainda leva ao novo);
//  - endereço antigo responde com redirecionamento permanente para o atual; /loja/N também leva ao endereço da loja;
//  - as sedes usam o id delas (data/sedes.ts), sem linha no banco.
import { sql, migrar } from "./db";
import { baseDoSlug, slugValido, ehReservado } from "@/office/data/slugLoja";
import { SEDE_POR_ID, ehSede } from "@/office/data/sedes";
import { numeroDaLoja } from "@/office/data/numeroLoja";
import { empresaIdDe } from "./equipeCliente";
import { ehAdmin } from "./terrenos";
import type { Usuario } from "./usuarios";
import { paginaDaEmpresa } from "./planoVitrine";

type Db = typeof sql;

// endereço atual da empresa; sem nenhum, cria a partir do nome
export async function enderecoDaEmpresa(empId: string, nome: string): Promise<string> {
  await migrar();
  const [j] = await sql<{ slug: string }[]>`SELECT slug FROM loja_endereco WHERE empresa_id = ${empId} AND atual`;
  return j?.slug ?? criarEndereco(empId, nome);
}

// primeiro livre de "base", "base-2", "base-3"… (a corrida entre duas requisições cai no índice único e lê o que a outra gravou)
async function criarEndereco(empId: string, nome: string, db: Db = sql): Promise<string> {
  const base = baseDoSlug(nome);
  for (let i = 1; i <= 60; i++) {
    const s = i === 1 ? base : `${base.slice(0, 36)}-${i}`;
    if (!slugValido(s) || ehReservado(s)) continue;
    // um endereço antigo da própria empresa volta a valer (trocou de nome antes de ir ao ar e voltou ao nome de antes)
    const v = await db`UPDATE loja_endereco SET atual = true WHERE slug = ${s} AND empresa_id = ${empId}
      AND NOT EXISTS (SELECT 1 FROM loja_endereco WHERE empresa_id = ${empId} AND atual)`;
    if (v.count) return s;
    const r = await db`INSERT INTO loja_endereco (slug, empresa_id) VALUES (${s}, ${empId}) ON CONFLICT DO NOTHING`;
    if (r.count) return s;
    const [j] = await db<{ slug: string }[]>`SELECT slug FROM loja_endereco WHERE empresa_id = ${empId} AND atual`;
    if (j) return j.slug;
  }
  const s = `${base.slice(0, 30)}-${Date.now().toString(36)}`;
  await db`INSERT INTO loja_endereco (slug, empresa_id) VALUES (${s}, ${empId})`;
  return s;
}

// A linha da empresa, quando ainda não existe, só para guardar o endereço. Nasce com atualizado_em antigo: assim a equipe
// do lote ainda sincroniza na primeira visita (equipeCliente.ts › garantirEmpresaDoLote compara as datas)
async function linhaDaEmpresa(empId: string, usuarioId: string, nome: string) {
  await sql`INSERT INTO empresa (id, slug, nome, usuario_id, atualizado_em) VALUES (${empId}, ${empId}, ${nome.trim().slice(0, 60)}, ${usuarioId}, to_timestamp(0)) ON CONFLICT (id) DO NOTHING`;
}

// a loja já foi ao ar: lote ou quiosque ativo agora ou antes (arquivo dos lotes vencidos)
async function jaFoiAoAr(usuarioId: string): Promise<boolean> {
  const [r] = await sql`SELECT 1 FROM terreno WHERE usuario_id = ${usuarioId} AND status = 'ativo'
    UNION ALL SELECT 1 FROM terreno_arquivo WHERE usuario_id = ${usuarioId}
    UNION ALL SELECT 1 FROM loja_vitrine WHERE usuario_id = ${usuarioId} AND publicada_em IS NOT NULL LIMIT 1`; // a página grátis (WE-13) também
  return !!r;
}

// Reserva o endereço da empresa da conta (cadastro com nome de empresa e reserva de lote). A empresa nasce aqui se ainda
// não existe (a mesma linha que a equipe do lote usa depois: equipeCliente.ts › garantirEmpresaDoLote). Nunca lança.
export async function reservarEndereco(u: Pick<Usuario, "id" | "email" | "papel">, nome: string, chave?: string | null): Promise<string | null> {
  try {
    if (!nome?.trim() || (chave && ehSede(chave)) || (!chave && ehAdmin(u as Usuario))) return null; // admin: uma empresa por lote
    await migrar();
    const empId = empresaIdDe(u.id, chave ?? "", ehAdmin(u as Usuario));
    await linhaDaEmpresa(empId, u.id, nome);
    const [j] = await sql<{ slug: string }[]>`SELECT slug FROM loja_endereco WHERE empresa_id = ${empId} AND atual`;
    if (!j) return await criarEndereco(empId, nome);
    // antes de ir ao ar, o endereço acompanha o nome escolhido na reserva
    const base = baseDoSlug(nome);
    if (j.slug === base || j.slug.replace(/-\d+$/, "") === base || (await jaFoiAoAr(u.id))) return j.slug;
    return await sql.begin(async (tx) => {
      await tx`UPDATE loja_endereco SET atual = false WHERE empresa_id = ${empId} AND atual`;
      return criarEndereco(empId, nome, tx as unknown as Db);
    });
  } catch (e) { console.error("[endereço]", (e as Error).message); return null; }
}

// o que um endereço pede: a empresa e o endereço atual dela (que é diferente quando este é antigo)
export async function lerEndereco(slug: string): Promise<{ empresaId: string; atual: string } | null> {
  if (!slugValido(slug)) return null;
  await migrar();
  const [r] = await sql<{ empresaId: string; atual: string | null }[]>`SELECT e.empresa_id, a.slug AS atual FROM loja_endereco e
    LEFT JOIN loja_endereco a ON a.empresa_id = e.empresa_id AND a.atual WHERE e.slug = ${slug}`;
  return r ? { empresaId: r.empresaId, atual: r.atual ?? slug } : null;
}

// número da loja aberta da empresa (o lote ou quiosque ativo dela); null quando ela não está no ar
export async function numeroDaEmpresa(empId: string): Promise<number | null> {
  await migrar();
  const ts = await sql<{ chave: string; usuarioId: string; email: string; papel: Usuario["papel"] }[]>`SELECT t.chave, t.usuario_id, u.email, u.papel
    FROM empresa e JOIN terreno t ON t.usuario_id = e.usuario_id AND t.status = 'ativo' AND t.anexo_de IS NULL
    JOIN usuario u ON u.id = t.usuario_id AND u.banido_em IS NULL WHERE e.id = ${empId} ORDER BY t.reservado_em`;
  const t = ts.filter((x) => !ehSede(x.chave)).find((x) => empresaIdDe(x.usuarioId, x.chave, ehAdmin({ email: x.email, papel: x.papel } as Usuario)) === empId);
  if (t) return numeroDaLoja({ chave: t.chave });
  return (await paginaDaEmpresa(empId))?.numero ?? null; // página grátis (Plano Vitrine, WE-13)
}
// endereço atual da empresa, sem criar
export async function enderecoAtual(empId: string): Promise<string | null> {
  await migrar();
  const [j] = await sql<{ slug: string }[]>`SELECT slug FROM loja_endereco WHERE empresa_id = ${empId} AND atual`;
  return j?.slug ?? null;
}

// endereço de uma loja aberta (lojaPublica): sede pelo id; as outras pela empresa
export async function enderecoDaLoja(l: { numero: number; empresaId: string; nome: string; chave: string }): Promise<string> {
  const sede = Object.values(SEDE_POR_ID).find((s) => s.chave === l.chave);
  return sede ? sede.id : enderecoDaEmpresa(l.empresaId, l.nome);
}

// versão da imagem de compartilhamento (api/workend/loja/[numero]/fachada): muda quando muda o que aparece nela, e o endereço
// da imagem muda junto (?v=), para o WhatsApp não mostrar a antiga
export function versaoFachada(l: { nome: string; cor: string; predio?: string | null; temLogo: boolean; sobre?: string; slug?: string | null; numero: number }) {
  const s = [l.nome, l.cor, l.predio ?? "", l.temLogo ? 1 : 0, (l.sobre ?? "").slice(0, 120), l.slug ?? "", l.numero].join("|");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

// Lojas no ar com o endereço próprio (sitemap.xml, WE-12): os lotes e quiosques ativos (a ampliação do lote duplo não conta)
// de contas não suspensas e as sedes. Quem ainda não tem endereço ganha um agora, pelo nome da placa.
export async function lojasNoAr(): Promise<{ slug: string; atualizadoEm: string }[]> {
  await migrar();
  const ts = await sql<{ chave: string; usuarioId: string; empresaNome: string; email: string; papel: Usuario["papel"]; atualizadoEm: Date }[]>`
    SELECT t.chave, t.usuario_id, t.empresa_nome, u.email, u.papel, t.atualizado_em FROM terreno t JOIN usuario u ON u.id = t.usuario_id AND u.banido_em IS NULL
    WHERE t.status = 'ativo' AND t.anexo_de IS NULL ORDER BY t.reservado_em`;
  const sedePorChave = new Map(Object.values(SEDE_POR_ID).map((s) => [s.chave, s.id]));
  const out: { slug: string; atualizadoEm: string }[] = [], vistos = new Set<string>();
  for (const t of ts) {
    let slug = sedePorChave.get(t.chave) ?? null;
    if (!slug) {
      const empId = empresaIdDe(t.usuarioId, t.chave, ehAdmin({ email: t.email, papel: t.papel } as Usuario));
      await linhaDaEmpresa(empId, t.usuarioId, t.empresaNome);
      slug = await enderecoDaEmpresa(empId, t.empresaNome).catch(() => null);
    }
    if (slug && !vistos.has(slug)) { vistos.add(slug); out.push({ slug, atualizadoEm: new Date(t.atualizadoEm).toISOString().slice(0, 10) }); }
  }
  // as páginas grátis publicadas (Plano Vitrine, WE-13) das contas que não têm loja na cidade
  const pgs = await sql<{ empresaId: string; empresaNome: string; atualizadoEm: Date }[]>`SELECT v.empresa_id, v.empresa_nome, v.atualizado_em FROM loja_vitrine v
    JOIN usuario u ON u.id = v.usuario_id AND u.banido_em IS NULL WHERE v.publicada_em IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM terreno t WHERE t.usuario_id = v.usuario_id AND t.status = 'ativo' AND t.anexo_de IS NULL) ORDER BY v.publicada_em`;
  for (const p of pgs) {
    const slug = await enderecoDaEmpresa(p.empresaId, p.empresaNome).catch(() => null);
    if (slug && !vistos.has(slug)) { vistos.add(slug); out.push({ slug, atualizadoEm: new Date(p.atualizadoEm).toISOString().slice(0, 10) }); }
  }
  return out;
}
