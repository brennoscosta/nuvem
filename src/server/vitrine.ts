// Vitrine de produtos (12/11/2026): o dono mostra até 12 produtos (foto, nome, preço, descrição) dentro da loja — no
// cartão do lote no mapa e na página /loja/N — com o botão "Pedir no WhatsApp" que abre a conversa com o próprio dono.
// O WorkEnd não passa dinheiro adiante (isso exigiria repasse e nota fiscal). A vitrine é da conta, como a equipe:
// aparece no lote principal ativo do dono. Fotos no banco (até 200 KB), já reduzidas no navegador.
import { avisarSeguidores } from "./seguir";
import { sql, id, migrar } from "./db";
import type { Usuario } from "./usuarios";
import { terrenoDoUsuario, obterTerreno, ehAdmin } from "./terrenos";
import { empresaIdDe, ErroHttp, type Contatos } from "./equipeCliente";
import { lojaDoNumero } from "./resultados";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";

export const MAX_PRODUTOS = 12;
export const MAX_FOTO = 200 * 1024;
const MAX_PRECO = 99_999_999; // R$ 999.999,99

export interface ProdutoPublico { id: string; nome: string; preco: number | null; descricao: string; foto: string | null }
export interface ProdutoDono extends ProdutoPublico { ativo: boolean; ordem: number }
export interface VitrinePublica { numero: number; empresa: string; cor: string; whatsapp: string | null; atendente: string | null; produtos: ProdutoPublico[] }

const texto = (t: unknown, max: number) => (typeof t === "string" ? t : "").replace(/[<>{}\[\]\\]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

// "12,90", "R$ 1.234,56", "12.90", "1234" → centavos; vazio = sob consulta (null)
export function lerPreco(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") { if (!Number.isFinite(v) || v < 0) throw new ErroHttp("Preço inválido."); return Math.min(MAX_PRECO, Math.round(v)); }
  let s = String(v).replace(/[^\d,.]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ""); // "1.234" = mil duzentos e trinta e quatro
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw new ErroHttp("Preço inválido. Escreva assim: 12,90.");
  const c = Math.round(n * 100);
  if (c > MAX_PRECO) throw new ErroHttp("Preço alto demais para a vitrine.");
  return c;
}

// tipo da foto conferido pelos primeiros bytes (não pelo que o navegador diz)
export function tipoDaFoto(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
function lerFoto(base64: unknown): { dados: Buffer; tipo: string } {
  if (typeof base64 !== "string" || !base64) throw new ErroHttp("Foto vazia.");
  const dados = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");
  if (dados.length > MAX_FOTO) throw new ErroHttp("Foto grande demais (máximo 200 KB). Escolha outra ou recorte.", 413);
  const tipo = tipoDaFoto(dados);
  if (!tipo) throw new ErroHttp("A foto precisa ser JPG, PNG ou WebP.");
  return { dados, tipo };
}

const urlFoto = (pid: string, temFoto: boolean, em: Date) => (temFoto ? `/api/workend/vitrine/foto/${pid}?v=${Math.floor(new Date(em).getTime() / 1000)}` : null);
type Linha = { id: string; nome: string; precoCentavos: number | null; descricao: string; temFoto: boolean; ordem: number; ativo: boolean; atualizadoEm: Date };
const paraPublico = (p: Linha): ProdutoPublico => ({ id: p.id, nome: p.nome, preco: p.precoCentavos, descricao: p.descricao, foto: urlFoto(p.id, p.temFoto, p.atualizadoEm) });
const CAMPOS = () => sql`id, nome, preco_centavos, descricao, (foto IS NOT NULL) AS tem_foto, ordem, ativo, atualizado_em`;

async function loteAtivo(u: Usuario) {
  if (u.banidoEm) throw new ErroHttp("Conta suspensa.", 403);
  const t = await terrenoDoUsuario(u.id);
  if (!t) throw new ErroHttp("A vitrine fica dentro da sua loja. Escolha um lote no mapa primeiro.", 404);
  if (t.status !== "ativo") throw new ErroHttp("Pague o 1º mês do lote para abrir a vitrine.", 402);
  return t;
}
// o WhatsApp público da loja (Minha equipe › Sobre a empresa)
async function whatsappDe(donoId: string, chave: string) {
  const [d] = await sql<{ email: string; papel: Usuario["papel"] }[]>`SELECT email, papel FROM usuario WHERE id = ${donoId}`;
  if (!d) return null;
  const [e] = await sql<{ contatos: Contatos | null }[]>`SELECT contatos FROM empresa WHERE id = ${empresaIdDe(donoId, chave, ehAdmin(d as Usuario))}`;
  return e?.contatos?.whatsapp ?? null;
}

// ---------- dono ----------
export async function vitrineDoDono(u: Usuario) {
  await migrar();
  const t = await terrenoDoUsuario(u.id);
  const produtos = await sql<Linha[]>`SELECT ${CAMPOS()} FROM produto WHERE usuario_id = ${u.id} ORDER BY ordem, criado_em`;
  return {
    lote: t ? { chave: t.chave, numero: LOTE_POR_CHAVE[t.chave]?.numero ?? null, ativo: t.status === "ativo", empresa: t.empresaNome, cor: t.cor } : null,
    whatsapp: t ? await whatsappDe(u.id, t.chave) : null,
    max: MAX_PRODUTOS,
    produtos: produtos.map((p): ProdutoDono => ({ ...paraPublico(p), ativo: p.ativo, ordem: p.ordem })),
  };
}

export async function salvarProduto(u: Usuario, d: { id?: unknown; nome?: unknown; preco?: unknown; descricao?: unknown; ativo?: unknown; foto?: unknown; removerFoto?: unknown }) {
  await migrar(); await loteAtivo(u);
  const nome = texto(d.nome, 60).replace(/\n/g, " ");
  if (nome.length < 2) throw new ErroHttp("Dê um nome ao produto.");
  const preco = lerPreco(d.preco);
  const descricao = texto(d.descricao, 300);
  const foto = d.foto ? lerFoto(d.foto) : null;
  const ativo = d.ativo !== false;
  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${"vitrine:" + u.id}))`;
    if (typeof d.id === "string" && d.id) {
      const [ja] = await tx<{ id: string }[]>`SELECT id FROM produto WHERE id = ${d.id} AND usuario_id = ${u.id}`;
      if (!ja) throw new ErroHttp("Produto não encontrado.", 404);
      if (foto) await tx`UPDATE produto SET nome = ${nome}, preco_centavos = ${preco}, descricao = ${descricao}, ativo = ${ativo}, foto = ${foto.dados}, foto_tipo = ${foto.tipo}, atualizado_em = now() WHERE id = ${d.id}`;
      else if (d.removerFoto === true) await tx`UPDATE produto SET nome = ${nome}, preco_centavos = ${preco}, descricao = ${descricao}, ativo = ${ativo}, foto = NULL, foto_tipo = NULL, atualizado_em = now() WHERE id = ${d.id}`;
      else await tx`UPDATE produto SET nome = ${nome}, preco_centavos = ${preco}, descricao = ${descricao}, ativo = ${ativo}, atualizado_em = now() WHERE id = ${d.id}`;
      const [p] = await tx<Linha[]>`SELECT ${CAMPOS()} FROM produto WHERE id = ${d.id}`;
      return { ...paraPublico(p), ativo: p.ativo, ordem: p.ordem };
    }
    const [{ n, maior }] = await tx<{ n: number; maior: number }[]>`SELECT count(*)::int AS n, COALESCE(max(ordem), -1)::int AS maior FROM produto WHERE usuario_id = ${u.id}`;
    if (n >= MAX_PRODUTOS) throw new ErroHttp(`A vitrine cabe ${MAX_PRODUTOS} produtos. Apague um para pôr outro.`);
    const pid = id("prd");
    await tx`INSERT INTO produto (id, usuario_id, nome, preco_centavos, descricao, foto, foto_tipo, ordem, ativo) VALUES (${pid}, ${u.id}, ${nome}, ${preco}, ${descricao}, ${foto?.dados ?? null}, ${foto?.tipo ?? null}, ${maior + 1}, ${ativo})`;
    const [p] = await tx<Linha[]>`SELECT ${CAMPOS()} FROM produto WHERE id = ${pid}`;
    if (ativo) void avisarSeguidores(u.id, "produto", { texto: nome, ref: pid }); // quem segue a loja (no máximo 1 aviso a cada 6 h)
    return { ...paraPublico(p), ativo: p.ativo, ordem: p.ordem };
  });
}

export async function mostrarProduto(u: Usuario, pid: string, ativo: boolean) {
  await migrar();
  const r = await sql`UPDATE produto SET ativo = ${ativo}, atualizado_em = now() WHERE id = ${pid} AND usuario_id = ${u.id}`;
  if (!r.count) throw new ErroHttp("Produto não encontrado.", 404);
  return { ok: true };
}
export async function apagarProduto(u: Usuario, pid: string) {
  await migrar();
  const r = await sql`DELETE FROM produto WHERE id = ${pid} AND usuario_id = ${u.id}`;
  if (!r.count) throw new ErroHttp("Produto não encontrado.", 404);
  return { ok: true };
}
// nova ordem: a lista de ids na ordem em que devem aparecer (ids de outra conta são ignorados)
export async function ordenarProdutos(u: Usuario, ids: unknown) {
  await migrar();
  if (!Array.isArray(ids) || !ids.length) throw new ErroHttp("Ordem vazia.");
  const lista = [...new Set(ids.filter((x): x is string => typeof x === "string").slice(0, MAX_PRODUTOS * 2))];
  await sql`UPDATE produto p SET ordem = o.pos - 1 FROM unnest(${sql.array(lista)}::text[]) WITH ORDINALITY AS o(id, pos) WHERE p.id = o.id AND p.usuario_id = ${u.id}`;
  return { ok: true };
}

// ---------- público ----------
export async function vitrinePublica(numero: number): Promise<VitrinePublica> {
  await migrar();
  const loja = await lojaDoNumero(numero);
  if (!loja) throw new ErroHttp("Esta loja não está aberta agora.", 404);
  const t = await obterTerreno(loja.chave);
  const produtos = await sql<Linha[]>`SELECT ${CAMPOS()} FROM produto WHERE usuario_id = ${loja.donoId} AND ativo ORDER BY ordem, criado_em LIMIT ${MAX_PRODUTOS}`;
  const atendente = t?.escritorio?.equipe.find((m) => m.papel === "atendente")?.nome ?? null;
  return { numero, empresa: t?.empresaNome ?? "", cor: t?.cor ?? "#1D4ED8", whatsapp: produtos.length ? await whatsappDe(loja.donoId, loja.chave) : null, atendente, produtos: produtos.map(paraPublico) };
}

// foto: pública quando o produto está à mostra; escondido, só o dono vê (na prévia)
export async function fotoDoProduto(pid: string, quemPede: Usuario | null) {
  await migrar();
  const [p] = await sql<{ foto: Uint8Array | null; fotoTipo: string | null; ativo: boolean; usuarioId: string; atualizadoEm: Date }[]>`SELECT foto, foto_tipo, ativo, usuario_id, atualizado_em FROM produto WHERE id = ${pid}`;
  if (!p?.foto) return null;
  if (!p.ativo && quemPede?.id !== p.usuarioId && !ehAdmin(quemPede)) return null;
  return { dados: Buffer.from(p.foto), tipo: p.fotoTipo ?? "image/jpeg", publico: p.ativo, versao: Math.floor(new Date(p.atualizadoEm).getTime() / 1000) };
}
