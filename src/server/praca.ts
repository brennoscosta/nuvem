// Praça que dá lucro (20/11/2026): anúncios pagos no telão da Praça de Eventos, evento em destaque e patrocínio da praça.
// O dono compra em /app/divulgar; o Pix aprovado põe o anúncio na fila do admin (em_analise) e só depois de aprovado ele
// entra na grade do telão. Recusado: o dono é avisado com o motivo e o Pix é devolvido à mão (fica registrado).
// A cobrança é uma função só (cobrarAnuncioPraca), pelo caminho único da frente "creditos": créditos, Pix ou os dois.
import { sql, migrar, id } from "./db";
import { brl } from "./email";
import type { Usuario } from "./usuarios";
import { ehAdmin, terrenoDoUsuario } from "./terrenos";
import { cobrar, type CobrancaPix, type OpcoesCobranca } from "./mercadopago";
import { avisar } from "./avisos";
import { registrar } from "./eventos";
import { LOTE_POR_CHAVE } from "@/office/data/mundo";
import { hojeBrasilia, proximaFeira, feiraAberta } from "@/office/data/praca";
import {
  CASA, DIAS_PATROCINIO, DIAS_TELAO, HORAS_DESTAQUE_ANTES, MAX_ANUNCIOS_DIA, MAX_FRASE_TELAO, MAX_IMAGEM_KB, MAX_VIDEO_KB, NOME_TIPO,
  TIPOS_IMAGEM, TIPOS_VIDEO, precoAnuncio, type FormatoAnuncio, type GradeTelao, type ItemGrade, type Patrocinio, type StatusAnuncio, type TipoAnuncio,
} from "@/office/data/telao";

const texto = (t: unknown, max: number) => (typeof t === "string" ? t : "").replace(/https?:\/\/\S+|www\.\S+/gi, "").replace(/[<>{}\[\]\\]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const dataValida = (s: unknown) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00-03:00`).getTime()) ? s : null);
const somaDias = (d: string, n: number) => { const x = new Date(`${d}T12:00:00-03:00`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
// ocupam vaga: aprovado e em_analise; aguardando_pagamento ocupa enquanto a reserva vale
const urlLogo = (chave: string | null, temLogo: boolean | null) => (temLogo && chave ? `/api/terrenos/${encodeURIComponent(chave)}/logo` : null);
type Db = typeof sql;

export interface AnuncioPraca {
  id: string; usuarioId: string; terrenoChave: string | null; tipo: TipoAnuncio; formato: FormatoAnuncio; frase: string; midiaTipo: string | null;
  eventoId: string | null; inicio: string; dias: number; valor: string; status: StatusAnuncio; reservadoAte: Date | null; pagamentoRef: string | null;
  pagoEm: Date | null; decididoEm: Date | null; motivo: string; criadoEm: Date; eventoTitulo?: string | null; eventoInicio?: Date | null;
}
const CAMPOS = () => sql`a.id, a.usuario_id, a.terreno_chave, a.tipo, a.formato, a.frase, a.midia_tipo, a.evento_id, to_char(a.inicio, 'YYYY-MM-DD') AS inicio, a.dias, a.valor,
  a.status, a.reservado_ate, a.pagamento_ref, a.pago_em, a.decidido_em, a.motivo, a.criado_em, e.titulo AS evento_titulo, e.inicio AS evento_inicio`;

// ---------------- compra ----------------
export interface PedidoAnuncio { tipo?: unknown; formato?: unknown; frase?: unknown; inicio?: unknown; dias?: unknown; eventoId?: unknown; arquivo?: { dados: Buffer; tipo: string } | null }

// primeiro dia livre do patrocínio (uma vaga só, 30 dias por vez)
export async function patrocinioLivreDesde(db: Db = sql): Promise<string> {
  const hoje = hojeBrasilia().data;
  const [r] = await db<{ ate: string | null }[]>`SELECT to_char(max(inicio + dias), 'YYYY-MM-DD') AS ate FROM anuncio_praca
    WHERE tipo = 'patrocinio' AND (status IN ('aprovado', 'em_analise') OR (status = 'aguardando_pagamento' AND reservado_ate > now())) AND inicio + dias > ${hoje}::date`;
  return r?.ate && r.ate > hoje ? r.ate : hoje;
}

export async function criarAnuncio(u: Usuario, p: PedidoAnuncio): Promise<{ id: string; valor: number }> {
  await migrar();
  if (u.banidoEm) throw new Error("Conta suspensa.");
  const lote = await terrenoDoUsuario(u.id);
  if (!lote || lote.status !== "ativo") throw new Error("Anunciar na praça é para empresas com lote ativo no mapa: o anúncio usa a marca da sua loja.");
  const tipo = (["telao", "destaque", "patrocinio"] as const).find((t) => t === p.tipo); if (!tipo) throw new Error("Escolha o que quer anunciar.");
  const formato = (["modelo", "imagem", "video"] as const).find((f) => f === p.formato) ?? "modelo";
  const frase = texto(p.frase, MAX_FRASE_TELAO);
  let midia: Buffer | null = null, midiaTipo: string | null = null;
  if (formato !== "modelo") {
    const a = p.arquivo; if (!a) throw new Error(formato === "imagem" ? "Envie a imagem do anúncio." : "Envie o vídeo do anúncio.");
    const ok = formato === "imagem" ? TIPOS_IMAGEM.includes(a.tipo) : TIPOS_VIDEO.includes(a.tipo);
    if (!ok) throw new Error(formato === "imagem" ? "A imagem precisa ser PNG, JPG ou WEBP." : "O vídeo precisa ser MP4 ou WEBM.");
    const max = (formato === "imagem" ? MAX_IMAGEM_KB : MAX_VIDEO_KB) * 1024;
    if (a.dados.length > max) throw new Error(`Arquivo grande demais: até ${Math.round(max / 1024 / 1024 * 10) / 10} MB.`);
    midia = a.dados; midiaTipo = a.tipo;
  } else if (frase.length < 3 && tipo !== "destaque") throw new Error("Escreva a frase do anúncio.");
  const hoje = hojeBrasilia().data;
  const novo = id("anp");
  const valor = await sql.begin(async (tx) => {
    const db = tx as unknown as Db;
    await db`SELECT pg_advisory_xact_lock(hashtext('anuncio_praca'))`;
    let inicio = dataValida(p.inicio) ?? hoje, dias = 1, eventoId: string | null = null;
    if (inicio < hoje) inicio = hoje;
    if (inicio > somaDias(hoje, 60)) throw new Error("Agende para os próximos 60 dias.");
    if (tipo === "telao") {
      dias = DIAS_TELAO.includes(Number(p.dias)) ? Number(p.dias) : 1;
      const [cheio] = await db<{ dia: string }[]>`SELECT to_char(d, 'DD/MM') AS dia FROM generate_series(${inicio}::date, ${inicio}::date + ${dias - 1}::int, interval '1 day') d
        WHERE (SELECT count(*) FROM anuncio_praca a WHERE a.tipo = 'telao' AND (a.status IN ('aprovado', 'em_analise') OR (a.status = 'aguardando_pagamento' AND a.reservado_ate > now()))
          AND a.inicio <= d::date AND a.inicio + a.dias > d::date) >= ${MAX_ANUNCIOS_DIA} LIMIT 1`;
      if (cheio) throw new Error(`O telão já está com a rotação cheia em ${cheio.dia}. Escolha outro dia.`);
    } else if (tipo === "destaque") {
      const ev = String(p.eventoId ?? "");
      const [e] = await db<{ id: string; dia: string }[]>`SELECT id, to_char(inicio AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia FROM evento_praca WHERE id = ${ev} AND usuario_id = ${u.id} AND NOT cancelado AND fim > now()`;
      if (!e) throw new Error("Escolha um dos seus eventos marcados no palco.");
      const [ja] = await db`SELECT 1 FROM anuncio_praca WHERE evento_id = ${e.id} AND (status IN ('aprovado', 'em_analise') OR (status = 'aguardando_pagamento' AND reservado_ate > now()))`;
      if (ja) throw new Error("Este evento já está em destaque (ou aguardando o Pix).");
      eventoId = e.id; inicio = e.dia < hoje ? hoje : e.dia;
    } else {
      dias = DIAS_PATROCINIO;
      const livre = await patrocinioLivreDesde(db);
      if (inicio < livre) throw new Error(`A praça já tem patrocinador até ${livre.split("-").reverse().join("/")}. Escolha começar a partir desse dia.`);
    }
    const v = precoAnuncio(tipo, dias);
    await db`INSERT INTO anuncio_praca (id, usuario_id, terreno_chave, tipo, formato, frase, midia, midia_tipo, evento_id, inicio, dias, valor, reservado_ate)
      VALUES (${novo}, ${u.id}, ${lote.chave}, ${tipo}, ${formato}, ${frase}, ${midia}, ${midiaTipo}, ${eventoId}, ${inicio}, ${dias}, ${v}, now() + interval '70 minutes')`;
    return v;
  });
  return { id: novo, valor };
}

// A cobrança da praça, numa função só (Pix hoje; créditos depois): confere o pedido, renova a reserva e gera o Pix.
export async function cobrarAnuncioPraca(u: Usuario, base: string, anuncioId: string, opc: OpcoesCobranca = {}): Promise<CobrancaPix> {
  await migrar();
  const [a] = await sql<AnuncioPraca[]>`SELECT ${CAMPOS()} FROM anuncio_praca a LEFT JOIN evento_praca e ON e.id = a.evento_id WHERE a.id = ${anuncioId} AND a.usuario_id = ${u.id}`;
  if (!a) throw new Error("Anúncio não encontrado.");
  if (a.status !== "aguardando_pagamento") throw new Error("Este anúncio já foi pago ou cancelado.");
  if (a.tipo === "patrocinio" && a.inicio < (await patrocinioLivreDesde()) && !(a.reservadoAte && new Date(a.reservadoAte).getTime() > Date.now())) throw new Error("A vaga de patrocínio desse período foi ocupada. Cancele e escolha outra data.");
  await sql`UPDATE anuncio_praca SET reservado_ate = now() + interval '70 minutes' WHERE id = ${a.id}`;
  const valor = ehAdmin(u) ? Math.round(Number(a.valor) * 100) / 10000 : Number(a.valor); // admin paga 1/100 para testar de verdade
  const quando = a.tipo === "telao" ? ` · ${a.dias} dia${a.dias > 1 ? "s" : ""} desde ${a.inicio.split("-").reverse().join("/")}` : a.tipo === "patrocinio" ? ` · 30 dias desde ${a.inicio.split("-").reverse().join("/")}` : a.eventoTitulo ? ` · ${a.eventoTitulo.slice(0, 40)}` : "";
  const pix = await cobrar(u, base, { tipo: "praca", chave: `praca:${a.id}`, valor, meses: 1, descricao: `WorkEnd · ${NOME_TIPO[a.tipo]}${quando}`, metadata: { anuncio: a.id } }, opc);
  await sql`UPDATE anuncio_praca SET pagamento_ref = ${pix.id} WHERE id = ${a.id}`;
  return pix;
}
// o Pix aprovou: vai para a fila do admin
export async function ativarAnuncioPraca(chave: string, usuarioId: string, db: Db = sql) {
  const r = await db`UPDATE anuncio_praca SET status = 'em_analise', pago_em = now(), reservado_ate = NULL WHERE id = ${chave.replace(/^praca:/, "")} AND usuario_id = ${usuarioId} AND status IN ('aguardando_pagamento', 'cancelado')`;
  return r.count > 0;
}
export async function reverterAnuncioPraca(chave: string, usuarioId: string, db: Db = sql) {
  await db`UPDATE anuncio_praca SET status = 'estornado' WHERE id = ${chave.replace(/^praca:/, "")} AND usuario_id = ${usuarioId}`;
}
export async function cancelarAnuncio(u: Usuario, anuncioId: string) {
  await migrar();
  const r = await sql`UPDATE anuncio_praca SET status = 'cancelado', reservado_ate = NULL WHERE id = ${anuncioId} AND usuario_id = ${u.id} AND status = 'aguardando_pagamento'`;
  if (!r.count) throw new Error("Só dá para cancelar um anúncio que ainda não foi pago.");
}

// ---------------- painel do dono ----------------
export async function meusAnuncios(u: Usuario) {
  await migrar();
  const [anuncios, eventos, livre] = await Promise.all([
    sql<AnuncioPraca[]>`SELECT ${CAMPOS()} FROM anuncio_praca a LEFT JOIN evento_praca e ON e.id = a.evento_id WHERE a.usuario_id = ${u.id} AND a.status <> 'cancelado' ORDER BY a.criado_em DESC LIMIT 30`,
    sql<{ id: string; titulo: string; inicio: Date; fim: Date; destacado: boolean }[]>`SELECT e.id, e.titulo, e.inicio, e.fim,
      EXISTS (SELECT 1 FROM anuncio_praca a WHERE a.evento_id = e.id AND (a.status IN ('aprovado', 'em_analise') OR (a.status = 'aguardando_pagamento' AND a.reservado_ate > now()))) AS destacado
      FROM evento_praca e WHERE e.usuario_id = ${u.id} AND NOT e.cancelado AND e.fim > now() ORDER BY e.inicio LIMIT 10`,
    patrocinioLivreDesde(),
  ]);
  return { anuncios, eventos, patrocinioLivreDesde: livre, hoje: hojeBrasilia().data };
}

// ---------------- admin ----------------
export async function filaAdmin() {
  await migrar();
  return sql<(AnuncioPraca & { email: string; empresaNome: string | null; cor: string | null; temLogo: boolean | null })[]>`SELECT ${CAMPOS()}, u.email, t.empresa_nome, t.cor, (t.logo IS NOT NULL) AS tem_logo
    FROM anuncio_praca a JOIN usuario u ON u.id = a.usuario_id LEFT JOIN terreno t ON t.chave = a.terreno_chave LEFT JOIN evento_praca e ON e.id = a.evento_id
    WHERE a.status IN ('em_analise', 'aprovado', 'recusado', 'estornado') ORDER BY (a.status = 'em_analise') DESC, COALESCE(a.decidido_em, a.pago_em, a.criado_em) DESC LIMIT 60`;
}
export async function decidirAnuncio(admin: Usuario, anuncioId: string, acao: unknown, motivoIn: unknown) {
  await migrar();
  const motivo = texto(motivoIn, 200);
  if (acao !== "aprovar" && acao !== "recusar") throw new Error("Ação desconhecida.");
  if (acao === "recusar" && motivo.length < 3) throw new Error("Escreva o motivo da recusa (o dono vai ver).");
  const hoje = hojeBrasilia().data;
  // aprovado depois do dia marcado: o anúncio ganha os dias inteiros a partir de hoje
  const [a] = acao === "aprovar"
    ? await sql<{ usuarioId: string; tipo: TipoAnuncio; valor: string }[]>`UPDATE anuncio_praca SET status = 'aprovado', decidido_em = now(), decidido_por = ${admin.email}, motivo = '', inicio = GREATEST(inicio, ${hoje}::date)
        WHERE id = ${anuncioId} AND status = 'em_analise' RETURNING usuario_id, tipo, valor`
    : await sql<{ usuarioId: string; tipo: TipoAnuncio; valor: string }[]>`UPDATE anuncio_praca SET status = 'recusado', decidido_em = now(), decidido_por = ${admin.email}, motivo = ${motivo}
        WHERE id = ${anuncioId} AND status = 'em_analise' RETURNING usuario_id, tipo, valor`;
  if (!a) throw new Error("Esse anúncio não está mais na fila.");
  const nome = NOME_TIPO[a.tipo];
  if (acao === "aprovar") void avisar(a.usuarioId, { tipo: "pagamento", ref: `praca:${anuncioId}:ok`, titulo: `${nome} aprovado`, texto: a.tipo === "patrocinio" ? "A sua marca já está na placa e no telão da Praça de Eventos." : "O seu anúncio entrou na grade do telão da Praça de Eventos.", link: "/app/divulgar" });
  else {
    void avisar(a.usuarioId, { tipo: "pagamento", ref: `praca:${anuncioId}:recusa`, titulo: `${nome} recusado`, texto: `Motivo: ${motivo}. O valor do Pix será devolvido.`, link: "/app/divulgar" });
    void registrar("pagamento", `ATENÇÃO: devolver o Pix de ${brl(Number(a.valor))} (${nome} recusado)`, { usuarioId: a.usuarioId, dados: { detalhes: `Anúncio ${anuncioId} recusado: ${motivo}. Devolva o valor pelo Mercado Pago.` }, avisarDono: true });
  }
  return { ok: true, status: acao === "aprovar" ? "aprovado" : "recusado" };
}

// ---------------- grade do telão (pública) ----------------
export async function gradeTelao(): Promise<GradeTelao> {
  await migrar();
  const hoje = hojeBrasilia().data;
  const linhas = await sql<{ id: string; tipo: TipoAnuncio; formato: FormatoAnuncio; frase: string; inicio: string; dias: number; temMidia: boolean; eventoId: string | null; eventoTitulo: string | null; eventoInicio: Date | null; eventoFim: Date | null; ate: string;
    empresaNome: string | null; cor: string | null; chave: string | null; temLogo: boolean | null }[]>`
    SELECT a.id, a.tipo, a.formato, a.frase, to_char(a.inicio, 'YYYY-MM-DD') AS inicio, a.dias, (a.midia IS NOT NULL) AS tem_midia, a.evento_id, e.titulo AS evento_titulo, e.inicio AS evento_inicio, e.fim AS evento_fim,
      to_char(a.inicio + a.dias, 'YYYY-MM-DD') AS ate, t.empresa_nome, t.cor, t.chave, (t.logo IS NOT NULL) AS tem_logo
    FROM anuncio_praca a LEFT JOIN evento_praca e ON e.id = a.evento_id
    LEFT JOIN LATERAL (SELECT * FROM terreno x WHERE x.usuario_id = a.usuario_id AND x.status = 'ativo' AND x.anexo_de IS NULL ORDER BY (x.chave = a.terreno_chave) DESC LIMIT 1) t ON true
    WHERE a.status = 'aprovado' AND t.chave IS NOT NULL AND (
      (a.tipo IN ('telao', 'patrocinio') AND a.inicio <= ${hoje}::date AND a.inicio + a.dias > ${hoje}::date)
      OR (a.tipo = 'destaque' AND NOT e.cancelado AND e.fim > now() AND e.inicio < now() + make_interval(hours => ${HORAS_DESTAQUE_ANTES}::int)))
    ORDER BY a.pago_em NULLS LAST, a.criado_em`;
  const marca = (l: (typeof linhas)[number]) => ({ nome: l.empresaNome ?? "Empresa do WorkEnd", cor: l.cor ?? "#1D4ED8", logo: urlLogo(l.chave, l.temLogo), numero: l.chave ? LOTE_POR_CHAVE[l.chave]?.numero ?? null : null, chave: l.chave });
  const midia = (l: (typeof linhas)[number]) => (l.temMidia && l.formato !== "modelo" ? `/api/workend/telao/${l.id}/midia` : null);
  const pagos: ItemGrade[] = linhas.filter((l) => l.tipo === "telao").map((l) => ({ tipo: "anuncio", id: l.id, formato: l.formato, frase: l.frase, midia: midia(l), ...marca(l) }));
  const dest = linhas.filter((l) => l.tipo === "destaque" && l.eventoId && l.eventoInicio && l.eventoFim);
  const destaques: ItemGrade[] = dest.map((l) => ({ tipo: "destaque", id: l.id, eventoId: l.eventoId!, titulo: l.eventoTitulo ?? "", frase: l.frase, inicio: new Date(l.eventoInicio!).toISOString(), fim: new Date(l.eventoFim!).toISOString(), formato: l.formato, midia: midia(l), ...marca(l) }));
  const p = linhas.find((l) => l.tipo === "patrocinio");
  const patrocinio: Patrocinio | null = p ? { id: p.id, frase: p.frase, ate: p.ate, ...marca(p) } : null;
  // ordem da grade: destaques pagos, anúncios pagos, agenda (eventos grátis), feira (perto do sábado), patrocínio, loja da semana
  // e a propaganda do WorkEnd (toda ela quando não há anúncio pago; só a do telão enquanto sobra vaga na rotação)
  const itens: ItemGrade[] = [...destaques, ...pagos, { tipo: "agenda" }];
  const diasFeira = (new Date(`${proximaFeira()}T12:00:00-03:00`).getTime() - new Date(`${hoje}T12:00:00-03:00`).getTime()) / 86400_000;
  if (feiraAberta() || diasFeira <= 3) itens.push({ tipo: "feira" });
  if (patrocinio) itens.push({ tipo: "patrocinio" });
  itens.push({ tipo: "semana" });
  if (!pagos.length) for (const c of CASA) itens.push({ tipo: "casa", id: c.id });
  else if (pagos.length < MAX_ANUNCIOS_DIA) itens.push({ tipo: "casa", id: "telao" });
  return { itens, patrocinio, destaques: dest.map((l) => ({ eventoId: l.eventoId!, titulo: l.eventoTitulo ?? "", inicio: new Date(l.eventoInicio!).toISOString(), fim: new Date(l.eventoFim!).toISOString(), nome: l.empresaNome ?? "" })), agora: new Date().toISOString() };
}

// imagem ou vídeo do anúncio: público só depois de aprovado; antes, o dono e o admin (prévia e fila)
export async function midiaAnuncio(anuncioId: string, u: Usuario | null) {
  await migrar();
  const [m] = await sql<{ midia: Buffer | null; midiaTipo: string | null; status: string; usuarioId: string }[]>`SELECT midia, midia_tipo, status, usuario_id FROM anuncio_praca WHERE id = ${anuncioId}`;
  if (!m?.midia || !m.midiaTipo) return null;
  if (m.status !== "aprovado" && !(u && (u.id === m.usuarioId || ehAdmin(u)))) return null;
  return { dados: m.midia, tipo: m.midiaTipo, publico: m.status === "aprovado" };
}
