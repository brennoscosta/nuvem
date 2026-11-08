// Lotes do mundo WorkEnd (tabela terreno). A planta (quais lotes existem) vem do código; aqui ficam as reservas,
// os chãos pagos e as ações do admin. Regras: a reserva vale 1 hora sem pagamento; pagar (R$ 99 por lote
// por mês) deixa o chão ativo por 30 dias, com 5 dias de tolerância depois do vencimento; um chão por conta
// (o admin não tem essa trava); usuário banido não reserva.
import { sql, migrar } from "./db";
import { QUARTEIROES } from "@/office/data/mundo";
import type { Usuario } from "./usuarios";
import { escritorioPadrao, normalizarEscritorio, type Escritorio } from "@/office/data/escritorio";

export interface Terreno {
  chave: string; usuarioId: string; status: "reservado" | "ativo"; empresaNome: string; cor: string; temLogo: boolean;
  reservadoEm: Date; reservadoAte: Date | null; pagoAte: Date | null;
  escritorio: Escritorio | null; // layout, setores e equipe (só quando ativo)
}
export interface TerrenoAdmin extends Terreno { email: string; usuarioNome: string; banidoEm: Date | null }

export const PRECO_LOTE = 99; // R$ por lote por mês
export const ADMIN_EMAIL = "souzacostabrenno@gmail.com"; // dono do WorkEnd: entra no /app/admin com a conta ou com a senha (ADMIN_SENHA)
// A conta admin paga 1/100 do preço (R$ 0,99) pra testar o pagamento de verdade sem gastar
export const precoPara = (u: Usuario | null | undefined) => (ehAdmin(u) ? Math.round(PRECO_LOTE) / 100 : PRECO_LOTE);
export const MINUTOS_RESERVA = 60; // 1 hora pra pagar (pedido do Brenno, 07/11)
export const DIAS_MES = 30;
export const DIAS_TOLERANCIA = 5;
export const COR_PADRAO = "#1D4ED8";
const MAX_LOGO = 400 * 1024;

export const ehAdmin = (u: Usuario | null | undefined) => !!u && (u.papel === "admin" || u.email === ADMIN_EMAIL || (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map((s) => s.trim()).includes(u.email));

// Lotes que podem ser comprados: os que estão em quarteirões de lotes (não a Nuvem nem o restaurante)
export function loteAVenda(chave: string) {
  const m = /^(-?\d+),(-?\d+),([0-3])$/.exec(chave); if (!m) return false;
  const q = QUARTEIROES.find((x) => x.i === +m[1] && x.j === +m[2]);
  return !!q?.lotes;
}

// trecho comum do SELECT (função, não constante: no build do Next não existe banco e o `sql` não pode ser tocado na importação)
const CAMPOS = () => sql`t.chave, t.usuario_id, t.status, t.empresa_nome, t.cor, (t.logo IS NOT NULL) AS tem_logo, t.reservado_em, t.reservado_ate, t.pago_ate, t.escritorio`;

// Apaga o que venceu: reserva sem pagamento depois de 1 h; chão pago depois do vencimento + tolerância
async function limparVencidos() {
  await sql`DELETE FROM terreno WHERE status = 'reservado' AND reservado_ate IS NOT NULL AND reservado_ate < now()`;
  await sql`DELETE FROM terreno WHERE status = 'ativo' AND pago_ate IS NOT NULL AND pago_ate + make_interval(days => ${DIAS_TOLERANCIA}) < now()`;
}

export async function listarTerrenos(): Promise<Terreno[]> {
  await migrar(); await limparVencidos();
  const lista = await sql<Terreno[]>`SELECT ${CAMPOS()} FROM terreno t ORDER BY t.reservado_em`;
  // lotes ativados antes do escritório existir (build 34) ganham o padrão na primeira leitura
  for (const t of lista) if (t.status === "ativo" && !t.escritorio) t.escritorio = await garantirEscritorio(t.chave);
  return lista;
}
export async function terrenoDoUsuario(usuarioId: string): Promise<Terreno | null> {
  await migrar(); await limparVencidos();
  const [t] = await sql<Terreno[]>`SELECT ${CAMPOS()} FROM terreno t WHERE t.usuario_id = ${usuarioId} ORDER BY t.status = 'ativo' DESC, t.reservado_em DESC LIMIT 1`;
  return t ?? null;
}
export async function obterTerreno(chave: string): Promise<Terreno | null> {
  await migrar();
  const [t] = await sql<Terreno[]>`SELECT ${CAMPOS()} FROM terreno t WHERE t.chave = ${chave}`;
  return t ?? null;
}

function corValida(c: string) { return /^#[0-9a-fA-F]{6}$/.test(c); }

// Reserva (ou atualiza a placa de) um lote. Um lote por usuário; se ele já tinha outro reservado, o antigo é liberado.
export async function reservarTerreno(u: Usuario, chave: string, d: { empresaNome: string; cor?: string; logoBase64?: string | null; logoTipo?: string | null; manterLogo?: boolean; ceoNome?: string | null; atendenteNome?: string | null }) {
  await migrar(); await limparVencidos();
  if (u.banidoEm) throw new Error("Sua conta foi suspensa por descumprir as políticas de uso. Fale com contato@workend.online.");
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
  const admin = ehAdmin(u);
  // o escritório já nasce na reserva, com os nomes que o dono deu ao CEO e à atendente (editáveis depois)
  const esc = escritorioPadrao(nome, cor, { ceo: d.ceoNome, atendente: d.atendenteNome });
  const escJson = sql.json(esc as unknown as Parameters<typeof sql.json>[0]);
  return sql.begin(async (tx) => {
    const [dono] = await tx<{ usuarioId: string; status: string; escritorio: Escritorio | null }[]>`SELECT usuario_id, status, escritorio FROM terreno WHERE chave = ${chave} FOR UPDATE`;
    if (dono && dono.usuarioId !== u.id) throw new Error("Esse lote acabou de ser reservado por outra empresa.");
    if (!admin) {
      const [ativo] = await tx<{ chave: string }[]>`SELECT chave FROM terreno WHERE usuario_id = ${u.id} AND status = 'ativo' AND chave <> ${chave}`;
      if (ativo) throw new Error("Você já tem um chão ativo. Nesta fase cada conta tem um lote.");
      // libera uma reserva anterior (não paga) do mesmo usuário
      await tx`DELETE FROM terreno WHERE usuario_id = ${u.id} AND chave <> ${chave} AND status = 'reservado'`;
    }
    if (dono) {
      if (d.manterLogo && !logo) await tx`UPDATE terreno SET empresa_nome = ${nome}, cor = ${cor}, atualizado_em = now() WHERE chave = ${chave}`;
      else await tx`UPDATE terreno SET empresa_nome = ${nome}, cor = ${cor}, logo = ${logo}, logo_tipo = ${logoTipo}, atualizado_em = now() WHERE chave = ${chave}`;
      // editar a placa: só renomeia CEO/atendente se o dono preencheu os campos (não apaga o que ele já montou)
      if (dono.escritorio && (d.ceoNome || d.atendenteNome)) {
        const e = dono.escritorio;
        e.equipe = e.equipe.map((m) => (m.papel === "ceo" && d.ceoNome ? { ...m, nome: d.ceoNome.trim().slice(0, 24) } : m.papel === "atendente" && d.atendenteNome ? { ...m, nome: d.atendenteNome.trim().slice(0, 24) } : m));
        await tx`UPDATE terreno SET escritorio = ${sql.json(e as unknown as Parameters<typeof sql.json>[0])} WHERE chave = ${chave}`;
      } else if (!dono.escritorio) await tx`UPDATE terreno SET escritorio = ${escJson} WHERE chave = ${chave}`;
    } else {
      await tx`INSERT INTO terreno (chave, usuario_id, empresa_nome, cor, logo, logo_tipo, status, reservado_ate, escritorio) VALUES (${chave}, ${u.id}, ${nome}, ${cor}, ${logo}, ${logoTipo}, 'reservado', now() + make_interval(mins => ${MINUTOS_RESERVA}), ${escJson})`;
    }
    const [t] = await tx<Terreno[]>`SELECT ${CAMPOS()} FROM terreno t WHERE t.chave = ${chave}`;
    return t;
  });
}

export async function liberarTerreno(usuarioId: string, chave: string) {
  await migrar();
  const r = await sql`DELETE FROM terreno WHERE chave = ${chave} AND usuario_id = ${usuarioId}`;
  return r.count > 0;
}

// Pagamento aprovado: o chão fica ativo por mais `meses` (soma ao que já estava pago, se ainda valia)
export async function ativarTerreno(chave: string, meses = 1) {
  await migrar();
  await sql`UPDATE terreno SET status = 'ativo', reservado_ate = NULL, atualizado_em = now(),
    pago_ate = GREATEST(COALESCE(pago_ate, now()), now()) + make_interval(days => ${DIAS_MES * meses}) WHERE chave = ${chave}`;
  await garantirEscritorio(chave);
}
// Todo escritório nasce com atendente + CEO (nome do dono) e um setor de atendimento; só cria se ainda não tem
export async function garantirEscritorio(chave: string) {
  const [t] = await sql<{ empresaNome: string; cor: string; escritorio: Escritorio | null }[]>`SELECT t.empresa_nome, t.cor, t.escritorio FROM terreno t WHERE t.chave = ${chave}`;
  if (!t || t.escritorio) return t?.escritorio ?? null;
  const e = escritorioPadrao(t.empresaNome, t.cor);
  await sql`UPDATE terreno SET escritorio = ${sql.json(e as unknown as Parameters<typeof sql.json>[0])} WHERE chave = ${chave}`;
  return e;
}
// O dono (ou o admin) salva o escritório: validamos tudo e gravamos
export async function salvarEscritorio(u: Usuario, chave: string, dados: unknown) {
  await migrar();
  const t = await obterTerreno(chave);
  if (!t) throw new Error("Lote sem dono.");
  if (t.usuarioId !== u.id && !ehAdmin(u)) throw new Error("Esse chão não é seu.");
  if (t.status !== "ativo") throw new Error("Pague o 1º mês pra montar o escritório.");
  const base = t.escritorio ?? (await garantirEscritorio(chave)) ?? escritorioPadrao(t.empresaNome, t.cor);
  const e = normalizarEscritorio(dados, base);
  await sql`UPDATE terreno SET escritorio = ${sql.json(e as unknown as Parameters<typeof sql.json>[0])}, atualizado_em = now() WHERE chave = ${chave}`;
  return e;
}
// Enquanto o usuário está pagando, a reserva não pode expirar embaixo dele: estende por mais 30 min
export async function estenderReserva(chave: string, minutos = 30) {
  await sql`UPDATE terreno SET reservado_ate = GREATEST(reservado_ate, now() + make_interval(mins => ${minutos})) WHERE chave = ${chave} AND status = 'reservado'`;
}

export async function logoDoTerreno(chave: string) {
  await migrar();
  const [r] = await sql<{ logo: Uint8Array | null; logoTipo: string | null }[]>`SELECT logo, logo_tipo FROM terreno WHERE chave = ${chave}`;
  return r?.logo ? { dados: Buffer.from(r.logo), tipo: r.logoTipo ?? "image/png" } : null;
}

// ---------- admin ----------
export async function listarTerrenosAdmin(): Promise<TerrenoAdmin[]> {
  await migrar(); await limparVencidos();
  return sql<TerrenoAdmin[]>`SELECT ${CAMPOS()}, u.email, u.nome AS usuario_nome, u.banido_em FROM terreno t JOIN usuario u ON u.id = t.usuario_id ORDER BY t.reservado_em DESC`;
}
export async function adminLiberar(chave: string) { await migrar(); await sql`DELETE FROM terreno WHERE chave = ${chave}`; }
export async function adminAtivar(chave: string, meses: number) { await ativarTerreno(chave, Math.max(1, Math.min(12, meses | 0))); }
// Admin dá (ou tira) dias à mão: dias positivos somam ao pago; negativos encurtam (mínimo: agora)
export async function adminDias(chave: string, dias: number) {
  await migrar();
  const d = Math.max(-3650, Math.min(3650, Math.trunc(dias)));
  await sql`UPDATE terreno SET status = 'ativo', reservado_ate = NULL, atualizado_em = now(),
    pago_ate = GREATEST(now(), GREATEST(COALESCE(pago_ate, now()), now()) + make_interval(days => ${d})) WHERE chave = ${chave}`;
  await garantirEscritorio(chave);
}
// Admin edita a placa de qualquer lote (nome e cor); logo continua a do dono
export async function adminEditar(chave: string, d: { empresaNome?: string; cor?: string }) {
  await migrar();
  const nome = (d.empresaNome ?? "").trim().slice(0, 40);
  const cor = /^#[0-9a-fA-F]{6}$/.test(d.cor ?? "") ? (d.cor as string) : null;
  if (!nome && !cor) throw new Error("Nada pra mudar.");
  await sql`UPDATE terreno SET empresa_nome = COALESCE(NULLIF(${nome}, ''), empresa_nome), cor = COALESCE(${cor}, cor), atualizado_em = now() WHERE chave = ${chave}`;
}
// Admin passa o lote pra outro usuário (pelo e-mail) — útil pra corrigir compra feita na conta errada
export async function adminTransferir(chave: string, email: string) {
  await migrar();
  const [u] = await sql<{ id: string }[]>`SELECT id FROM usuario WHERE email = ${email.trim().toLowerCase()}`;
  if (!u) throw new Error("Não existe usuário com esse e-mail.");
  await sql`UPDATE terreno SET usuario_id = ${u.id}, atualizado_em = now() WHERE chave = ${chave}`;
}
// Banir um imóvel: tira a empresa do lote (o lote volta a ficar à venda) e suspende a conta do dono
export async function adminBanir(chave: string, motivo: string) {
  await migrar();
  const [t] = await sql<{ usuarioId: string }[]>`SELECT usuario_id FROM terreno WHERE chave = ${chave}`;
  if (!t) throw new Error("Lote não encontrado.");
  await sql.begin(async (tx) => {
    await tx`UPDATE usuario SET banido_em = now(), banido_motivo = ${motivo.trim().slice(0, 300) || "descumprimento das políticas de uso"} WHERE id = ${t.usuarioId}`;
    await tx`DELETE FROM terreno WHERE usuario_id = ${t.usuarioId}`;
  });
}
export async function adminDesbanir(usuarioId: string) { await migrar(); await sql`UPDATE usuario SET banido_em = NULL, banido_motivo = NULL WHERE id = ${usuarioId}`; }
