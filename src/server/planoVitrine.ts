// Plano Vitrine (WE-13, 21/11/2026; decisão do dono: grátis e SEM quiosque). A conta grátis tem:
//  - a página própria da loja (workend.online/<slug>, WE-11), com a logomarca, o "Sobre", o botão de WhatsApp e a vitrine;
//  - 3 produtos na vitrine (PRODUTOS_VITRINE_GRATIS; com lote ou quiosque, até 12: vitrine.ts › MAX_PRODUTOS);
//  - a atendente de IA respondendo na página, com UNIDADES_MES_VITRINE unidades por mês (≈ 100 respostas: unidadesIA.ts).
//    Acabou: o roteiro sem IA, como em qualquer loja sem unidades.
// Não tem lote nem quiosque na cidade: o lote (R$ 99) e o quiosque (R$ 47) continuam pagos e iguais.
// Modelo: tabela loja_vitrine (migração 0055_plano_vitrine), uma por conta, com a marca e a atendente enquanto não há lote.
// A empresa é a mesma da conta (emp_<usuário>, equipeCliente.ts › empresaIdDe): o endereço, a vitrine (produto.usuario_id),
// o "Sobre" e os contatos já são da conta. Reservar um lote ou quiosque (terrenos.ts › reservarTerreno) leva a mesma loja
// para a cidade: logomarca, nicho e a atendente (o mesmo id, então as conversas continuam). O plano (planoDa) é derivado:
// lote ou quiosque ativo vale mais que a página grátis, e a página volta a valer se o lote vencer.
// A página grátis tem um número próprio a partir de 10001 (nunca bate com lote, quiosque ou sede) para usar as mesmas
// rotas da loja (/api/workend/loja/<n>/…: conversa, vitrine, cliques); o endereço público é só o slug.
import { sql, migrar } from "./db";
import { ehAdmin, type Terreno } from "./terrenos";
import type { Usuario } from "./usuarios";
import { escritorioPadrao, type Escritorio } from "@/office/data/escritorio";
import { equipeDoQuiosque, ehQuiosque } from "@/office/data/quiosques";
import { nichoValido } from "@/office/data/mundo";
import { ehSede } from "@/office/data/sedes";

export const PRODUTOS_VITRINE_GRATIS = 3;
export const NUMERO_PAGINA_MIN = 10001;
export const ehNumeroDePagina = (n: number) => n >= NUMERO_PAGINA_MIN;
export const chaveDaPagina = (numero: number) => `pagina-${numero}`;
export const ehChaveDePagina = (c: string | null | undefined) => !!c && c.startsWith("pagina-");
const MAX_LOGO = 400 * 1024;
const COR_PADRAO = "#1D4ED8";
export type Plano = "vitrine" | "lote" | "quiosque" | "nenhum";

export interface PaginaGratis {
  usuarioId: string; empresaId: string; numero: number; empresaNome: string; cor: string; nicho: string; temLogo: boolean;
  escritorio: Escritorio | null; publicadaEm: Date | null; criadoEm: Date; atualizadoEm: Date;
}
const CAMPOS = () => sql`usuario_id, empresa_id, numero, empresa_nome, cor, nicho, (logo IS NOT NULL) AS tem_logo, escritorio, publicada_em, criado_em, atualizado_em`;
export const empresaDaConta = (usuarioId: string) => `emp_${usuarioId}`; // = equipeCliente.ts › empresaIdDe de quem não é admin

export async function paginaDoUsuario(usuarioId: string): Promise<PaginaGratis | null> {
  await migrar();
  const [p] = await sql<PaginaGratis[]>`SELECT ${CAMPOS()} FROM loja_vitrine WHERE usuario_id = ${usuarioId}`;
  return p ?? null;
}
// só as publicadas (o que o público vê)
export async function paginaPorNumero(numero: number): Promise<PaginaGratis | null> {
  await migrar();
  const [p] = await sql<PaginaGratis[]>`SELECT ${CAMPOS()} FROM loja_vitrine v WHERE numero = ${numero} AND publicada_em IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id = v.usuario_id AND u.banido_em IS NOT NULL)`;
  return p ?? null;
}
export async function paginaDaEmpresa(empId: string): Promise<PaginaGratis | null> {
  await migrar();
  const [p] = await sql<PaginaGratis[]>`SELECT ${CAMPOS()} FROM loja_vitrine v WHERE empresa_id = ${empId} AND publicada_em IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id = v.usuario_id AND u.banido_em IS NOT NULL)`;
  return p ?? null;
}
// a loja ativa da conta na cidade (lote ou quiosque; as sedes ficam de fora): depois do upgrade, ela vale no lugar da página
export async function lojaNaCidade(usuarioId: string): Promise<string | null> {
  await migrar();
  const ts = await sql<{ chave: string }[]>`SELECT chave FROM terreno WHERE usuario_id = ${usuarioId} AND status = 'ativo' AND anexo_de IS NULL ORDER BY reservado_em`;
  return ts.map((t) => t.chave).find((c) => !ehSede(c)) ?? null;
}
export async function planoDa(usuarioId: string): Promise<Plano> {
  const chave = await lojaNaCidade(usuarioId);
  if (chave) return ehQuiosque(chave) ? "quiosque" : "lote";
  return (await paginaDoUsuario(usuarioId))?.publicadaEm ? "vitrine" : "nenhum";
}

// a página como "terreno" para as rotas da loja (equipeCliente.ts › lojaPorNumero): ativa, sem lote, só com a atendente
export function terrenoDaPagina(p: PaginaGratis): Terreno {
  return {
    chave: chaveDaPagina(p.numero), usuarioId: p.usuarioId, status: "ativo", empresaNome: p.empresaNome, cor: p.cor, temLogo: p.temLogo,
    reservadoEm: p.criadoEm, reservadoAte: null, pagoAte: null, escritorio: p.escritorio, nicho: p.nicho, anexoDe: null, promocao: null,
    inauguradoEm: p.publicadaEm, socios: [],
  };
}

export async function logoDaPagina(chave: string) {
  const numero = Number(chave.replace(/^pagina-/, "")) | 0;
  await migrar();
  const [r] = await sql<{ logo: Uint8Array | null; logoTipo: string | null }[]>`SELECT logo, logo_tipo FROM loja_vitrine WHERE numero = ${numero} AND publicada_em IS NOT NULL`;
  return r?.logo ? { dados: Buffer.from(r.logo), tipo: r.logoTipo ?? "image/png" } : null;
}

// tipo da imagem pelos primeiros bytes
function tipoDaImagem(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
export class ErroPagina extends Error { constructor(msg: string, public status = 400) { super(msg); } }

// Cria ou edita a página grátis da conta e publica (na primeira vez). Quem já tem loja na cidade edita a loja em Minha equipe.
export async function salvarPagina(u: Usuario, d: { empresaNome?: unknown; cor?: unknown; nicho?: unknown; logoBase64?: unknown; removerLogo?: unknown }) {
  await migrar();
  if (u.banidoEm) throw new ErroPagina("Conta suspensa.", 403);
  if (ehAdmin(u)) throw new ErroPagina("A conta de administrador usa lotes no mapa, não a página grátis.", 403);
  if (await lojaNaCidade(u.id)) throw new ErroPagina("A sua loja já está na cidade: edite a marca no mapa e o resto em Minha equipe.", 409);
  const atual = await paginaDoUsuario(u.id);
  const nome = (typeof d.empresaNome === "string" ? d.empresaNome : atual?.empresaNome ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (nome.length < 2) throw new ErroPagina("Diga o nome da empresa.");
  const cor = typeof d.cor === "string" && /^#[0-9a-fA-F]{6}$/.test(d.cor) ? d.cor.toUpperCase() : atual?.cor ?? COR_PADRAO;
  const nicho = d.nicho != null ? nichoValido(d.nicho) : atual?.nicho ?? "negocios";
  let logo: Buffer | null = null, logoTipo: string | null = null;
  if (typeof d.logoBase64 === "string" && d.logoBase64) {
    logo = Buffer.from(d.logoBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
    if (logo.length > MAX_LOGO) throw new ErroPagina("Logo muito grande (máximo 400 KB).");
    logoTipo = tipoDaImagem(logo);
    if (!logoTipo) throw new ErroPagina("A logo precisa ser PNG, JPG ou WebP.");
  }
  const tirarLogo = d.removerLogo === true;
  // a atendente nasce como a do quiosque (só ela, data/quiosques.ts) e vai junto quando a loja for para a cidade
  const esc = atual?.escritorio ?? equipeDoQuiosque(escritorioPadrao(nome, cor));
  const empId = empresaDaConta(u.id);
  // a empresa da conta (a mesma do lote, depois): atualizado_em antigo para a equipe sincronizar na primeira visita
  await sql`INSERT INTO empresa (id, slug, nome, usuario_id, atualizado_em) VALUES (${empId}, ${empId}, ${nome}, ${u.id}, to_timestamp(0)) ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome`;
  await sql`INSERT INTO loja_vitrine (usuario_id, empresa_id, empresa_nome, cor, nicho, logo, logo_tipo, escritorio, publicada_em)
    VALUES (${u.id}, ${empId}, ${nome}, ${cor}, ${nicho}, ${logo}, ${logoTipo}, ${sql.json(esc as unknown as Parameters<typeof sql.json>[0])}, now())
    ON CONFLICT (usuario_id) DO UPDATE SET empresa_nome = EXCLUDED.empresa_nome, cor = EXCLUDED.cor, nicho = EXCLUDED.nicho,
      logo = CASE WHEN ${tirarLogo} THEN NULL WHEN EXCLUDED.logo IS NOT NULL THEN EXCLUDED.logo ELSE loja_vitrine.logo END,
      logo_tipo = CASE WHEN ${tirarLogo} THEN NULL WHEN EXCLUDED.logo IS NOT NULL THEN EXCLUDED.logo_tipo ELSE loja_vitrine.logo_tipo END,
      publicada_em = COALESCE(loja_vitrine.publicada_em, now()), atualizado_em = now()`;
  // o nome da empresa da conta acompanha (o formulário do lote no mapa começa com ele)
  await sql`UPDATE usuario SET empresa_nome = ${nome} WHERE id = ${u.id}`;
  return (await paginaDoUsuario(u.id))!;
}

// o "Sobre" e os contatos da empresa da conta (os mesmos que a loja do lote usa depois)
export async function perfilDaConta(usuarioId: string): Promise<{ sobre: string; contatos: { whatsapp?: string; instagram?: string; site?: string; email?: string } }> {
  await migrar();
  const [e] = await sql<{ sobre: string; contatos: Record<string, string> | null }[]>`SELECT sobre, contatos FROM empresa WHERE id = ${empresaDaConta(usuarioId)}`;
  return { sobre: e?.sobre ?? "", contatos: e?.contatos ?? {} };
}
