// Lotes do mundo WorkEnd (tabela terreno). A planta (quais lotes existem) vem do código; aqui ficam as reservas,
// os chãos pagos e as ações do admin. Regras: a reserva vale 1 hora sem pagamento; pagar (R$ 99 por lote
// por mês) deixa o chão ativo por 30 dias, com 5 dias de tolerância depois do vencimento; um chão por conta
// (o admin não tem essa trava); usuário banido não reserva.
import { avisarSeguidores } from "./seguir";
import { sql, migrar } from "./db";
import { QUARTEIROES, nichoValido } from "@/office/data/mundo";
import type { Usuario } from "./usuarios";
import { escritorioPadrao, normalizarEscritorio, trocasRestantes, TROCAS_LAYOUT_GRATIS, PRECO_TROCA_LAYOUT, LAYOUT, type Escritorio } from "@/office/data/escritorio";
import { registrar } from "./eventos";
import { enviarEmail, emailLigado, brl, dataBR } from "./email";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";

declare global {
  var __workendAvisoEm: number | undefined;
}
type Db = typeof sql;

export interface Terreno {
  chave: string; usuarioId: string; status: "reservado" | "ativo"; empresaNome: string; cor: string; temLogo: boolean;
  reservadoEm: Date; reservadoAte: Date | null; pagoAte: Date | null;
  escritorio: Escritorio | null; // layout, setores e equipe (só quando ativo)
  nicho: string; // id em NICHOS (vai no balão)
  anexoDe: string | null; // lote duplo (12/11/2026): este lote é a ampliação do lote principal indicado
  promocao: Promocao | null; // promoção na fachada (12/11/2026); só vem enquanto vale
  inauguradoEm: Date | null; // 1ª vez que o lote ficou ativo (12/11/2026): a cena faz a festa de inauguração por 24 h
}
export interface Promocao { texto: string; ate: string; desde: string }
export interface TerrenoAdmin extends Terreno { email: string; usuarioNome: string; banidoEm: Date | null }

export const PRECO_LOTE = 99; // R$ por lote por mês
export const ADMIN_EMAIL = "souzacostabrenno@gmail.com"; // dono do WorkEnd: entra no /app/admin com a conta ou com a senha (ADMIN_SENHA)
// A conta admin paga 1/100 do preço (R$ 0,99) pra testar o pagamento de verdade sem gastar
export const precoPara = (u: Usuario | null | undefined) => (ehAdmin(u) ? Math.round(PRECO_LOTE) / 100 : PRECO_LOTE);
export const MINUTOS_RESERVA = 60; // 1 hora pra pagar (pedido do Brenno, 07/11)
export const DIAS_MES = 30;
export const DIAS_TOLERANCIA = 5;
export const DIAS_AVISO = 5; // quantos dias antes do vencimento o dono é avisado
const ERRO_PIX_ABERTO = "Você tem um Pix aberto deste lote. Pague ou espere ele vencer (até 1 hora) para trocar ou desistir.";
export const COR_PADRAO = "#1D4ED8";
const MAX_LOGO = 400 * 1024;

export const ehAdmin = (u: Usuario | null | undefined) => !!u && (u.papel === "admin" || u.email === ADMIN_EMAIL || (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map((s) => s.trim()).includes(u.email));

// Lotes que podem ser comprados: os que estão em quarteirões de lotes (não a Nuvem nem o restaurante)
export function loteAVenda(chave: string) {
  const m = /^(-?\d+),(-?\d+),([0-3])$/.exec(chave); if (!m) return false;
  const q = QUARTEIROES.find((x) => x.i === +m[1] && x.j === +m[2]);
  return !!q?.lotes && q.lotes[+m[3]]?.tipo !== "praca"; // a praça de eventos não está à venda
}

// trecho comum do SELECT (função, não constante: no build do Next não existe banco e o `sql` não pode ser tocado na importação)
const CAMPOS = () => sql`t.chave, t.usuario_id, t.status, t.empresa_nome, t.cor, (t.logo IS NOT NULL) AS tem_logo, t.reservado_em, t.reservado_ate, t.pago_ate, t.escritorio, t.nicho, t.anexo_de,
  CASE WHEN (t.promocao->>'ate')::timestamptz > now() THEN t.promocao END AS promocao, t.inaugurado_em`;

// Limpa o que venceu: reserva sem pagamento depois de 1 h é apagada; chão pago sai do mapa depois do vencimento + tolerância,
// mas a marca e a equipe vão pro arquivo e voltam na próxima reserva do mesmo dono
async function limparVencidos() {
  await sql`DELETE FROM terreno WHERE status = 'reservado' AND reservado_ate IS NOT NULL AND reservado_ate < now()`;
  await sql`WITH saiu AS (
      DELETE FROM terreno WHERE status = 'ativo' AND pago_ate IS NOT NULL AND pago_ate + make_interval(days => ${DIAS_TOLERANCIA}) < now()
      RETURNING chave, usuario_id, empresa_nome, cor, nicho, logo, logo_tipo, escritorio, pago_ate)
    INSERT INTO terreno_arquivo (chave, usuario_id, empresa_nome, cor, nicho, logo, logo_tipo, escritorio, pago_ate)
    SELECT chave, usuario_id, empresa_nome, cor, nicho, logo, logo_tipo, escritorio, pago_ate FROM saiu`;
  // lote duplo: se o principal saiu do mapa, a ampliação vira um lote normal do mesmo dono (os dias pagos continuam)
  await sql`UPDATE terreno SET anexo_de = NULL WHERE anexo_de IS NOT NULL AND anexo_de NOT IN (SELECT chave FROM terreno WHERE status = 'ativo')`;
  void avisarVencimentos();
}

// Avisa por e-mail quem está perto de vencer, uma vez por ciclo pago. Sem e-mail ligado, não marca nada: o aviso sai quando ligar.
async function avisarVencimentos() {
  if (!emailLigado() || Date.now() - (globalThis.__workendAvisoEm ?? 0) < 3600_000) return;
  globalThis.__workendAvisoEm = Date.now();
  try {
    const lista = await sql<{ chave: string; empresaNome: string; pagoAte: Date; email: string; nome: string }[]>`UPDATE terreno t SET avisado_em = now() FROM usuario u
      WHERE u.id = t.usuario_id AND t.status = 'ativo' AND t.avisado_em IS NULL AND t.pago_ate < now() + make_interval(days => ${DIAS_AVISO})
      RETURNING t.chave, t.empresa_nome, t.pago_ate, u.email, u.nome`;
    for (const d of lista) void enviarEmail("vencimento", d.email, { nome: d.nome, empresa: d.empresaNome, lote: `Lote ${LOTE_POR_CHAVE[d.chave]?.numero ?? "?"}`, valor: brl(PRECO_LOTE), pago_ate: dataBR(d.pagoAte), link_pagar: `https://workend.online/mundo?lote=${encodeURIComponent(d.chave)}` });
  } catch (e) { console.error("[vencimento]", (e as Error).message); }
}

export async function listarTerrenos(): Promise<Terreno[]> {
  await migrar(); await limparVencidos();
  const lista = await sql<Terreno[]>`SELECT ${CAMPOS()} FROM terreno t ORDER BY t.reservado_em`;
  // lotes ativados antes do escritório existir (build 34) ganham o padrão na primeira leitura
  for (const t of lista) if (t.status === "ativo" && !t.escritorio && !t.anexoDe) t.escritorio = await garantirEscritorio(t.chave);
  return lista;
}
export async function terrenoDoUsuario(usuarioId: string): Promise<Terreno | null> {
  await migrar(); await limparVencidos();
  const [t] = await sql<Terreno[]>`SELECT ${CAMPOS()} FROM terreno t WHERE t.usuario_id = ${usuarioId} AND t.anexo_de IS NULL ORDER BY t.status = 'ativo' DESC, t.reservado_em DESC LIMIT 1`;
  return t ?? null;
}
export async function obterTerreno(chave: string): Promise<Terreno | null> {
  await migrar();
  const [t] = await sql<Terreno[]>`SELECT ${CAMPOS()} FROM terreno t WHERE t.chave = ${chave}`;
  return t ?? null;
}

function corValida(c: string) { return /^#[0-9a-fA-F]{6}$/.test(c); }

// Reserva (ou atualiza a placa de) um lote. Um lote por usuário; se ele já tinha outro reservado, o antigo é liberado.
export async function reservarTerreno(u: Usuario, chave: string, d: { empresaNome: string; cor?: string; logoBase64?: string | null; logoTipo?: string | null; manterLogo?: boolean; ceoNome?: string | null; atendenteNome?: string | null; nicho?: string | null }) {
  await migrar(); await limparVencidos();
  if (u.banidoEm) throw new Error("Sua conta foi suspensa por descumprir as políticas de uso. Fale com contato@workend.online.");
  if (!loteAVenda(chave)) throw new Error("Esse lote não está à venda.");
  const nome = (d.empresaNome ?? "").trim().slice(0, 60);
  if (nome.length < 2) throw new Error("Diga o nome da empresa.");
  const cor = d.cor && corValida(d.cor) ? d.cor.toUpperCase() : COR_PADRAO;
  const nicho = nichoValido(d.nicho);
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
      // quem está com Pix aberto não troca de lote: o pagamento precisa encontrar a reserva dele
      const [pix] = await tx<{ terrenoChave: string }[]>`SELECT p.terreno_chave FROM pagamento p JOIN terreno t ON t.chave = p.terreno_chave AND t.usuario_id = p.usuario_id AND t.status = 'reservado'
        WHERE p.usuario_id = ${u.id} AND p.terreno_chave <> ${chave} AND p.tipo = 'lote' AND p.status = 'pendente' AND p.criado_em > now() - interval '1 hour' LIMIT 1`;
      if (pix) throw new Error(ERRO_PIX_ABERTO);
      // libera uma reserva anterior (não paga) do mesmo usuário
      await tx`DELETE FROM terreno WHERE usuario_id = ${u.id} AND chave <> ${chave} AND status = 'reservado' AND anexo_de IS NULL`;
    }
    if (dono) {
      if (d.manterLogo && !logo) await tx`UPDATE terreno SET empresa_nome = ${nome}, cor = ${cor}, nicho = ${nicho}, atualizado_em = now() WHERE chave = ${chave}`;
      else await tx`UPDATE terreno SET empresa_nome = ${nome}, cor = ${cor}, nicho = ${nicho}, logo = ${logo}, logo_tipo = ${logoTipo}, atualizado_em = now() WHERE chave = ${chave}`;
      // editar a placa: só renomeia CEO/atendente se o dono preencheu os campos (não apaga o que ele já montou)
      if (dono.escritorio && (d.ceoNome || d.atendenteNome)) {
        const e = dono.escritorio;
        e.equipe = e.equipe.map((m) => (m.papel === "ceo" && d.ceoNome ? { ...m, nome: d.ceoNome.trim().slice(0, 24) } : m.papel === "atendente" && d.atendenteNome ? { ...m, nome: d.atendenteNome.trim().slice(0, 24) } : m));
        await tx`UPDATE terreno SET escritorio = ${sql.json(e as unknown as Parameters<typeof sql.json>[0])} WHERE chave = ${chave}`;
      } else if (!dono.escritorio) await tx`UPDATE terreno SET escritorio = ${escJson} WHERE chave = ${chave}`;
    } else {
      // quem já teve um lote recupera a marca e a equipe guardadas
      const [guardado] = await tx<{ logo: Uint8Array | null; logoTipo: string | null; escritorio: Escritorio | null }[]>`SELECT logo, logo_tipo, escritorio FROM terreno_arquivo WHERE usuario_id = ${u.id} ORDER BY arquivado_em DESC LIMIT 1`;
      const logoFinal = logo ?? (guardado?.logo ? Buffer.from(guardado.logo) : null);
      const tipoFinal = logo ? logoTipo : guardado?.logo ? guardado.logoTipo : null;
      const escFinal = guardado?.escritorio ? sql.json(guardado.escritorio as unknown as Parameters<typeof sql.json>[0]) : escJson;
      await tx`INSERT INTO terreno (chave, usuario_id, empresa_nome, cor, nicho, logo, logo_tipo, status, reservado_ate, escritorio) VALUES (${chave}, ${u.id}, ${nome}, ${cor}, ${nicho}, ${logoFinal}, ${tipoFinal}, 'reservado', now() + make_interval(mins => ${MINUTOS_RESERVA}), ${escFinal})`;
    }
    const [t] = await tx<Terreno[]>`SELECT ${CAMPOS()} FROM terreno t WHERE t.chave = ${chave}`;
    if (!dono) void registrar("reserva", `${nome} reservou um lote`, { usuarioId: u.id, terrenoChave: chave, dados: { detalhes: `Reserva de 1 hora pra pagar.` } });
    return t;
  });
}

export async function liberarTerreno(usuarioId: string, chave: string) {
  await migrar();
  const [pix] = await sql`SELECT 1 FROM pagamento WHERE usuario_id = ${usuarioId} AND terreno_chave = ${chave} AND tipo = 'lote' AND status = 'pendente' AND criado_em > now() - interval '1 hour' LIMIT 1`;
  if (pix) throw new Error(ERRO_PIX_ABERTO);
  const r = await sql`DELETE FROM terreno WHERE chave = ${chave} AND usuario_id = ${usuarioId}`;
  return r.count > 0;
}

// Pagamento aprovado: o chão fica ativo por mais `meses` (soma ao que já estava pago, se ainda valia).
// Com usuarioId, só ativa se o lote ainda for de quem pagou; devolve false se não for.
export async function ativarTerreno(chave: string, meses = 1, usuarioId: string | null = null, db: Db = sql) {
  await migrar();
  const r = await db`UPDATE terreno SET status = 'ativo', reservado_ate = NULL, avisado_em = NULL, atualizado_em = now(),
    inaugurado_em = CASE WHEN status = 'reservado' THEN COALESCE(inaugurado_em, now()) ELSE inaugurado_em END,
    pago_ate = GREATEST(COALESCE(pago_ate, now()), now()) + make_interval(days => ${DIAS_MES * meses}) WHERE chave = ${chave} AND (${usuarioId}::text IS NULL OR usuario_id = ${usuarioId})`;
  if (!r.count) return false;
  await garantirEscritorio(chave, db);
  return true;
}
// Pagamento estornado: tira os dias pagos. Se não sobrar nada, o lote sai do mapa na próxima limpeza, sem tolerância.
export async function reverterTerreno(chave: string, meses: number, usuarioId: string, db: Db = sql) {
  const dias = DIAS_MES * meses;
  await db`UPDATE terreno SET atualizado_em = now(), pago_ate = CASE WHEN pago_ate - make_interval(days => ${dias}) > now() THEN pago_ate - make_interval(days => ${dias}) ELSE now() - make_interval(days => ${DIAS_TOLERANCIA + 1}) END
    WHERE chave = ${chave} AND usuario_id = ${usuarioId} AND status = 'ativo'`;
}
// Todo escritório nasce com atendente + CEO (nome do dono) e um setor de atendimento; só cria se ainda não tem
export async function garantirEscritorio(chave: string, db: Db = sql) {
  const [t] = await db<{ empresaNome: string; cor: string; escritorio: Escritorio | null; anexoDe: string | null }[]>`SELECT t.empresa_nome, t.cor, t.escritorio, t.anexo_de FROM terreno t WHERE t.chave = ${chave}`;
  if (!t || t.escritorio || t.anexoDe) return t?.escritorio ?? null; // a ampliação usa o escritório do lote principal
  const e = escritorioPadrao(t.empresaNome, t.cor);
  await db`UPDATE terreno SET escritorio = ${sql.json(e as unknown as Parameters<typeof sql.json>[0])} WHERE chave = ${chave}`;
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
  const detalhes: string[] = [];
  // troca de prédio: 3 grátis, depois cada uma custa R$ 9,90 (crédito comprado no Pix); admin não paga
  if (e.layout !== base.layout) {
    if (!ehAdmin(u)) {
      if (trocasRestantes(base) <= 0) throw new Error(`Você já usou as ${TROCAS_LAYOUT_GRATIS} trocas de prédio grátis. Cada troca agora custa R$ ${PRECO_TROCA_LAYOUT.toFixed(2).replace(".", ",")}.`);
      if ((base.trocasLayout ?? 0) < TROCAS_LAYOUT_GRATIS) e.trocasLayout = (base.trocasLayout ?? 0) + 1;
      else e.creditosLayout = Math.max(0, (base.creditosLayout ?? 0) - 1);
    }
    detalhes.push(`Prédio trocado para "${LAYOUT[e.layout].nome}".`);
  }
  const antes = new Set(base.equipe.map((m) => m.id));
  const novos = e.equipe.filter((m) => !antes.has(m.id));
  const saidas = base.equipe.filter((m) => !e.equipe.some((x) => x.id === m.id));
  for (const m of novos) detalhes.push(`${m.nome} (${m.cargo}) entrou na equipe.`);
  for (const m of saidas) detalhes.push(`${m.nome} (${m.cargo}) saiu da equipe.`);
  if (e.setores.length !== base.setores.length) detalhes.push(`Setores: ${e.setores.map((s) => s.nome).join(", ")}.`);
  await sql`UPDATE terreno SET escritorio = ${sql.json(e as unknown as Parameters<typeof sql.json>[0])}, atualizado_em = now() WHERE chave = ${chave}`;
  if (detalhes.length) void registrar(novos.length ? "contratacao" : e.layout !== base.layout ? "layout" : "escritorio", novos.length ? `Equipe atualizada (${novos.length} contratação${novos.length > 1 ? "ões" : ""})` : e.layout !== base.layout ? "Prédio trocado" : "Escritório atualizado", { usuarioId: u.id, terrenoChave: chave, dados: { detalhes: detalhes.join(" ") }, avisarDono: true });
  else void registrar("escritorio", "Escritório editado", { usuarioId: u.id, terrenoChave: chave, dados: { detalhes: "Nomes, cargos, aparência ou treino da equipe." } });
  return e;
}
// Crédito de troca de prédio (R$ 9,90 no Pix): soma ao pagar e retira no estorno; só vale se o lote ainda for de quem pagou
async function ajustarCreditoLayout(chave: string, usuarioId: string, delta: number, db: Db) {
  await migrar();
  const [t] = await db<{ usuarioId: string; escritorio: Escritorio | null }[]>`SELECT usuario_id, escritorio FROM terreno WHERE chave = ${chave} FOR UPDATE`;
  if (!t?.escritorio || t.usuarioId !== usuarioId) return false;
  const e = { ...t.escritorio, creditosLayout: Math.max(0, (t.escritorio.creditosLayout ?? 0) + delta) };
  await db`UPDATE terreno SET escritorio = ${sql.json(e as unknown as Parameters<typeof sql.json>[0])} WHERE chave = ${chave}`;
  return true;
}
export const creditarTrocaLayout = (chave: string, usuarioId: string, db: Db = sql) => ajustarCreditoLayout(chave, usuarioId, 1, db);
export const retirarCreditoLayout = (chave: string, usuarioId: string, db: Db = sql) => ajustarCreditoLayout(chave, usuarioId, -1, db);
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
    inaugurado_em = CASE WHEN status = 'reservado' THEN COALESCE(inaugurado_em, now()) ELSE inaugurado_em END,
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

// ---------- promoção na fachada (12/11/2026) ----------
// O dono liga uma frase curta ("20% hoje") com hora para acabar: faixa na frente do prédio, selo no balão e no mini-mapa.
export const DURACOES_PROMO: Record<string, { nome: string; horas: number }> = {
  "2h": { nome: "2 horas", horas: 2 }, "4h": { nome: "4 horas", horas: 4 }, "hoje": { nome: "Até o fim do dia", horas: 0 },
  "24h": { nome: "24 horas", horas: 24 }, "3d": { nome: "3 dias", horas: 72 }, "7d": { nome: "7 dias", horas: 168 },
};
export async function salvarPromocao(u: Usuario, chave: string, d: { texto?: unknown; duracao?: unknown }) {
  await migrar();
  const t = await obterTerreno(chave);
  const alvo = t?.anexoDe ? await obterTerreno(t.anexoDe) : t; // na ampliação, vale para o lote principal
  if (!alvo || (alvo.usuarioId !== u.id && !ehAdmin(u))) throw new Error("Esse lote não é seu.");
  if (alvo.status !== "ativo") throw new Error("A promoção é para lojas abertas no mapa.");
  const texto = (typeof d.texto === "string" ? d.texto : "").replace(/[<>{}\[\]\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 28);
  if (texto.length < 3) throw new Error("Escreva a promoção (ex.: 20% hoje, Frete grátis, Leve 3 pague 2).");
  const dur = DURACOES_PROMO[String(d.duracao ?? "")] ?? DURACOES_PROMO["hoje"];
  // "até o fim do dia" = 23h59 no horário de Brasília (sem horário de verão desde 2019)
  const diaBR = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const ate = dur.horas ? new Date(Date.now() + dur.horas * 3600_000) : new Date(`${diaBR}T23:59:00-03:00`);
  const p: Promocao = { texto, ate: ate.toISOString(), desde: new Date().toISOString() };
  await sql`UPDATE terreno SET promocao = ${sql.json(p as unknown as Parameters<typeof sql.json>[0])} WHERE chave = ${alvo.chave}`;
  void avisarSeguidores(alvo.usuarioId, "promocao", { texto }); // quem segue a loja (no máximo 1 aviso a cada 6 h)
  void registrar("escritorio", `Promoção na fachada: ${texto}`, { usuarioId: u.id, terrenoChave: alvo.chave, dados: { detalhes: `Até ${ate.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.` } });
  return p;
}
export async function encerrarPromocao(u: Usuario, chave: string) {
  await migrar();
  const t = await obterTerreno(chave);
  const alvo = t?.anexoDe ? await obterTerreno(t.anexoDe) : t;
  if (!alvo || (alvo.usuarioId !== u.id && !ehAdmin(u))) throw new Error("Esse lote não é seu.");
  await sql`UPDATE terreno SET promocao = NULL WHERE chave = ${alvo.chave}`;
}

// ---------- lote duplo (12/11/2026) ----------
// Quem tem lote ativo pode alugar UM lote vizinho do mesmo quarteirão (que divide um lado com o seu) como ampliação: o
// prédio fica maior e passa a ocupar os dois. A ampliação tem o preço de um lote e é paga e renovada à parte.
export function vizinhosDoLote(chave: string): string[] {
  const m = /^(-?\d+),(-?\d+),([0-3])$/.exec(chave); if (!m) return [];
  // só o vizinho do lado (0↔1 e 2↔3: mesma rua). Um atrás do outro (0↔2) daria um lote de fundo, com a frente no meio.
  const lado = +m[3] ^ 1;
  return [`${m[1]},${m[2]},${lado}`].filter((c) => loteAVenda(c));
}
export async function reservarAnexo(u: Usuario, anexo: string) {
  await migrar(); await limparVencidos();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  const principal = await terrenoDoUsuario(u.id);
  if (!principal || principal.status !== "ativo") throw new Error("Para ampliar, o seu lote precisa estar ativo.");
  if (!vizinhosDoLote(principal.chave).includes(anexo)) throw new Error("A ampliação precisa ser num lote vizinho do seu, no mesmo quarteirão.");
  return sql.begin(async (tx) => {
    const [ja] = await tx`SELECT chave FROM terreno WHERE anexo_de = ${principal.chave} AND chave <> ${anexo}`;
    if (ja) throw new Error("O seu lote já tem uma ampliação.");
    const [dono] = await tx<{ usuarioId: string }[]>`SELECT usuario_id FROM terreno WHERE chave = ${anexo} FOR UPDATE`;
    if (dono && dono.usuarioId !== u.id) throw new Error("Esse lote já tem dono.");
    if (!dono) await tx`INSERT INTO terreno (chave, usuario_id, empresa_nome, cor, nicho, status, reservado_ate, anexo_de) VALUES (${anexo}, ${u.id}, ${principal.empresaNome}, ${principal.cor}, ${principal.nicho}, 'reservado', now() + make_interval(mins => ${MINUTOS_RESERVA}), ${principal.chave})`;
    void registrar("reserva", `${principal.empresaNome} reservou a ampliação do lote`, { usuarioId: u.id, terrenoChave: anexo, dados: { detalhes: `Lote duplo com ${principal.chave}.` } });
    const [t] = await tx<Terreno[]>`SELECT ${CAMPOS()} FROM terreno t WHERE t.chave = ${anexo}`;
    return t;
  });
}
