// Conectores por empresa (17/11/2026, pedido do dono: "essa opção de conectar a empresa tem que ter, pode ser por api ou
// algum outro jeito, pois queremos automatizar muitas tarefas e precisamos ter conectores"). Quatro jeitos de ligar a
// empresa do lote a outros sistemas (a tela fica na aba Conectores de Minha equipe):
//  - chaves da API v1 (src/server/apiV1.ts): outro sistema dá tarefas à equipe e lê as entregas;
//  - avisos automáticos (webhooks de saída): POST assinado com HMAC-SHA256 quando algo acontece (tarefa entregue, pedido
//    interno respondido, visitante deixou contato), com 3 tentativas;
//  - fontes de dados: GET que os agentes leem antes de responder ("dados reais da empresa"), com cache de 10 minutos;
//  - destinos: para onde o dono envia uma entrega (rascunho de notícia, missão…), sempre com o clique dele.
// Segurança: só https (http://127.0.0.1 só em teste), nada de rede interna (o IP é conferido na hora de conectar, então
// trocar o DNS no meio não engana), resposta lida até 200 KB, segredos cifrados com AES-256-GCM e nunca no log.
// Este arquivo não importa equipeCliente nem delegacao (os dois importam daqui).
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import { sql, id, migrar } from "./db";
import { segredoSessao } from "./segredo";

export class ErroConector extends Error { constructor(msg: string, public status = 400) { super(msg); } }

export type TipoConector = "aviso" | "fonte" | "destino";
export const EVENTOS = [
  { id: "tarefa.entregue", nome: "Tarefa entregue", texto: "Uma tarefa dada pela API, ou uma tarefa que a equipe dividiu entre si, foi entregue." },
  { id: "pedido_interno.respondido", nome: "Pedido interno respondido", texto: "Alguém da equipe respondeu ao pedido do chefe." },
  { id: "visitante.contato", nome: "Visitante deixou contato", texto: "Um visitante da loja escreveu e-mail ou telefone na conversa com a atendente." },
] as const;
export type Evento = (typeof EVENTOS)[number]["id"];
export const TIPOS_DESTINO = [
  { id: "noticia", nome: "Notícia" }, { id: "guia", nome: "Guia" }, { id: "missao", nome: "Missão" }, { id: "evento", nome: "Evento" }, { id: "outro", nome: "Outro" },
] as const;
export type TipoDestino = (typeof TIPOS_DESTINO)[number]["id"];
const IDS_EVENTOS = EVENTOS.map((e) => e.id as string);
const IDS_TIPOS = TIPOS_DESTINO.map((t) => t.id as string);
const MAX_POR_TIPO = 10, MAX_CHAVES = 10;

// ---------- cifra, hash e assinatura ----------
async function chaveCifra() { return createHash("sha256").update(`conectores:${await segredoSessao()}`).digest(); }
export async function cifrar(texto: string) {
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", await chaveCifra(), iv);
  const ct = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${ct.toString("base64url")}`;
}
export async function decifrar(s: string | null | undefined): Promise<string | null> {
  if (!s) return null;
  const [v, iv, tag, ct] = s.split(".");
  if (v !== "v1" || !iv || !tag || !ct) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", await chaveCifra(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
  } catch { return null; }
}
export const hashChave = (k: string) => createHash("sha256").update(k).digest("hex");
// cabeçalho X-WorkEnd-Assinatura: "t=<unix>,v1=<hex>", HMAC-SHA256 do texto "<t>.<corpo>"
export function assinar(segredo: string, corpo: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac("sha256", segredo).update(`${t}.${corpo}`).digest("hex")}`;
}
const novoSegredo = () => `whsec_${randomBytes(32).toString("base64url")}`;

// ---------- rede segura ----------
export const permiteLocal = () => process.env.CONECTORES_PERMITE_LOCAL === "1" || process.env.NODE_ENV !== "production";
export function ipPrivado(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const x = ip.toLowerCase();
  if (x.startsWith("::ffff:")) return ipPrivado(x.slice(7));
  return x === "::" || x === "::1" || /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith("ff");
}
export function validarUrl(bruta: unknown): string {
  const s = String(bruta ?? "").trim();
  if (!s || s.length > 500) throw new ErroConector("Informe um endereço (URL) de até 500 caracteres.");
  let u: URL;
  try { u = new URL(s); } catch { throw new ErroConector("Endereço inválido. Use o formato https://seusite.com/caminho"); }
  if (u.username || u.password) throw new ErroConector("Não coloque usuário e senha no endereço. Use o campo de autorização.");
  if (u.protocol === "https:") return u.toString();
  if (u.protocol === "http:" && permiteLocal() && (u.hostname === "127.0.0.1" || u.hostname === "localhost")) return u.toString();
  throw new ErroConector("O endereço precisa começar com https://");
}
export interface RespostaRede { status: number; tipo: string; texto: string; cortado: boolean }
const MSG_REDE: Record<string, string> = {
  ENOTFOUND: "Não encontrei esse endereço.", ECONNREFUSED: "O sistema recusou a conexão.", ECONNRESET: "A conexão caiu no meio.",
  CERT_HAS_EXPIRED: "O certificado https do sistema venceu.", DEPTH_ZERO_SELF_SIGNED_CERT: "O certificado https do sistema não é válido.",
  ERR_TLS_CERT_ALTNAME_INVALID: "O certificado https não é desse endereço.", UNABLE_TO_VERIFY_LEAF_SIGNATURE: "O certificado https do sistema não é válido.",
};
export function pedirSeguro(url: string, o: { metodo?: "GET" | "POST"; cabecalhos?: Record<string, string>; corpo?: string; tempo?: number; maxBytes?: number } = {}): Promise<RespostaRede> {
  const u = new URL(validarUrl(url));
  const mod = u.protocol === "https:" ? https : http;
  // IP escrito direto no endereço não passa pelo lookup: confere aqui
  const hostIp = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(hostIp) && ipPrivado(hostIp) && !permiteLocal()) return Promise.reject(new ErroConector("Esse endereço aponta para uma rede interna e não é permitido."));
  const max = o.maxBytes ?? 200_000, tempo = o.tempo ?? 8000;
  return new Promise<RespostaRede>((ok, falha) => {
    let terminou = false;
    const acabar = (e: Error | null, r?: RespostaRede) => { if (terminou) return; terminou = true; clearTimeout(relogio); if (e) falha(e); else ok(r!); };
    // o IP é conferido aqui, na hora de conectar (não antes): rede interna nunca, a não ser no teste
    const lookup = (host: string, opts: { all?: boolean } | number | undefined, cb: (e: Error | null, a?: string | dns.LookupAddress[], f?: number) => void) => {
      dns.lookup(host, { all: true }, (e, ends) => {
        if (e) return cb(e);
        const lista = (ends as dns.LookupAddress[]).filter((x) => permiteLocal() || !ipPrivado(x.address));
        if (!lista.length) return cb(new ErroConector("Esse endereço aponta para uma rede interna e não é permitido."));
        if (typeof opts === "object" && opts?.all) return cb(null, lista);
        cb(null, lista[0].address, lista[0].family);
      });
    };
    const corpo = o.corpo;
    const req = mod.request({
      protocol: u.protocol, hostname: u.hostname, port: u.port || undefined, path: `${u.pathname}${u.search}`, method: o.metodo ?? "GET",
      headers: { "user-agent": "WorkEnd-Conectores/1", accept: "application/json, text/plain;q=0.9, */*;q=0.5", ...(corpo !== undefined ? { "content-type": "application/json; charset=utf-8", "content-length": String(Buffer.byteLength(corpo)) } : {}), ...(o.cabecalhos ?? {}) },
      lookup: lookup as unknown as typeof dns.lookup, servername: net.isIP(u.hostname) ? undefined : u.hostname, timeout: tempo,
    }, (res) => {
      const partes: Buffer[] = []; let n = 0, cortado = false;
      const fim = () => acabar(null, { status: res.statusCode ?? 0, tipo: String(res.headers["content-type"] ?? ""), texto: Buffer.concat(partes).subarray(0, max).toString("utf8"), cortado });
      res.on("data", (c: Buffer) => { if (cortado) return; partes.push(c); n += c.length; if (n >= max) { cortado = true; fim(); res.destroy(); } });
      res.on("end", fim);
      res.on("error", (e) => acabar(e));
    });
    const relogio = setTimeout(() => req.destroy(new ErroConector("O sistema demorou demais para responder.")), tempo + 500);
    req.on("timeout", () => req.destroy(new ErroConector("O sistema demorou demais para responder.")));
    req.on("error", (e: NodeJS.ErrnoException) => acabar(e instanceof ErroConector ? e : new ErroConector(MSG_REDE[e.code ?? ""] ?? `Não consegui falar com o sistema (${e.code ?? e.message}).`, 502)));
    if (corpo !== undefined) req.write(corpo);
    req.end();
  });
}
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const curto = (s: string, n = 300) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ---------- cadastro ----------
export interface ConfigConector { eventos?: string[]; tipos?: string[]; setores?: string[]; cabecalho?: string }
interface ConectorDB { id: string; empresaId: string; tipo: TipoConector; nome: string; url: string; config: ConfigConector; segredo: string | null; ativo: boolean; criadoEm: Date; atualizadoEm: Date; ultimoUso: Date | null; ultimoErro: string | null }
const paraTela = (c: ConectorDB) => ({ id: c.id, tipo: c.tipo, nome: c.nome, url: c.url, config: c.config ?? {}, ativo: c.ativo, criadoEm: c.criadoEm, ultimoUso: c.ultimoUso, ultimoErro: c.ultimoErro, temSegredo: !!c.segredo });
export type ConectorTela = ReturnType<typeof paraTela>;

export async function listarConectores(empId: string) {
  await migrar();
  const chaves = await sql<{ id: string; nome: string; prefixo: string; criadoEm: Date; ultimoUso: Date | null }[]>`
    SELECT id, nome, prefixo, criado_em, ultimo_uso FROM chave_api WHERE empresa_id = ${empId} AND revogada_em IS NULL ORDER BY criado_em`;
  const conectores = (await sql<ConectorDB[]>`SELECT * FROM conector WHERE empresa_id = ${empId} ORDER BY tipo, criado_em`).map(paraTela);
  const registros = await sql<{ id: string; conectorId: string | null; tipo: string; evento: string | null; status: string; codigo: number | null; tentativas: number; resumo: string | null; resposta: string | null; criadoEm: Date }[]>`
    SELECT id, conector_id, tipo, evento, status, codigo, tentativas, resumo, resposta, criado_em FROM conector_registro WHERE empresa_id = ${empId} ORDER BY criado_em DESC LIMIT 20`;
  const tarefas = await sql<{ id: string; membroId: string; status: string; texto: string; criadoEm: Date; entregueEm: Date | null }[]>`
    SELECT id, membro_id, status, left(texto, 140) AS texto, criado_em, entregue_em FROM tarefa_api WHERE empresa_id = ${empId} ORDER BY criado_em DESC LIMIT 8`;
  return { chaves, conectores, registros, tarefas, eventos: EVENTOS, tiposDestino: TIPOS_DESTINO };
}

export async function criarChave(empId: string, usuarioId: string, lote: string, nomeBruto: unknown) {
  await migrar();
  const nome = String(nomeBruto ?? "").trim().slice(0, 60) || "Chave sem nome";
  const [n] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM chave_api WHERE empresa_id = ${empId} AND revogada_em IS NULL`;
  if ((n?.n ?? 0) >= MAX_CHAVES) throw new ErroConector(`Cada empresa pode ter até ${MAX_CHAVES} chaves ativas. Revogue uma antes.`);
  const chave = `we_${randomBytes(30).toString("base64url")}`;
  const cid = id("ch");
  await sql`INSERT INTO chave_api (id, empresa_id, usuario_id, lote, nome, prefixo, hash) VALUES (${cid}, ${empId}, ${usuarioId}, ${lote}, ${nome}, ${chave.slice(0, 10)}, ${hashChave(chave)})`;
  return { chave, item: { id: cid, nome, prefixo: chave.slice(0, 10), criadoEm: new Date(), ultimoUso: null } };
}
export async function revogarChave(empId: string, chaveId: unknown) {
  const r = await sql`UPDATE chave_api SET revogada_em = now() WHERE id = ${String(chaveId ?? "")} AND empresa_id = ${empId} AND revogada_em IS NULL`;
  if (!r.count) throw new ErroConector("Chave não encontrada.", 404);
  return { ok: true };
}

const lista = (x: unknown, validos?: string[], max = 30) => (Array.isArray(x) ? x : []).map((v) => String(v).trim()).filter((v) => v && v.length <= 60 && (!validos || validos.includes(v))).filter((v, i, a) => a.indexOf(v) === i).slice(0, max);
const CABECALHO_OK = /^[A-Za-z0-9-]{1,40}$/;
export interface DadosConector { tipo?: unknown; nome?: unknown; url?: unknown; eventos?: unknown; tipos?: unknown; setores?: unknown; cabecalho?: unknown; valor?: unknown; ativo?: unknown }

export async function criarConector(empId: string, d: DadosConector) {
  await migrar();
  const tipo = String(d.tipo ?? "") as TipoConector;
  if (!["aviso", "fonte", "destino"].includes(tipo)) throw new ErroConector("Tipo de conector desconhecido.");
  const nome = String(d.nome ?? "").trim().slice(0, 60);
  if (!nome) throw new ErroConector("Dê um nome ao conector (ex.: Site da empresa).");
  const url = validarUrl(d.url);
  const [n] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM conector WHERE empresa_id = ${empId} AND tipo = ${tipo}`;
  if ((n?.n ?? 0) >= MAX_POR_TIPO) throw new ErroConector(`Até ${MAX_POR_TIPO} conectores de cada tipo por empresa.`);
  const config: ConfigConector = {};
  let segredo: string | null = null, segredoCifrado: string | null = null;
  if (tipo === "aviso") {
    config.eventos = lista(d.eventos, IDS_EVENTOS);
    if (!config.eventos.length) throw new ErroConector("Escolha pelo menos um evento para avisar.");
  }
  if (tipo === "destino") {
    config.tipos = lista(d.tipos, IDS_TIPOS);
    if (!config.tipos.length) throw new ErroConector("Escolha pelo menos um tipo de conteúdo que o destino aceita.");
  }
  if (tipo === "aviso" || tipo === "destino") { segredo = novoSegredo(); segredoCifrado = await cifrar(segredo); }
  if (tipo === "fonte") {
    config.setores = lista(d.setores);
    const cab = String(d.cabecalho ?? "").trim() || "Authorization", valor = String(d.valor ?? "").trim().slice(0, 600);
    if (valor) {
      if (!CABECALHO_OK.test(cab)) throw new ErroConector("Nome de cabeçalho inválido (use letras, números e hífen).");
      config.cabecalho = cab;
      segredoCifrado = await cifrar(JSON.stringify({ nome: cab, valor }));
    }
  }
  const cid = id("cx");
  await sql`INSERT INTO conector (id, empresa_id, tipo, nome, url, config, segredo) VALUES (${cid}, ${empId}, ${tipo}, ${nome}, ${url}, ${sql.json(config as Record<string, string[] | string>)}, ${segredoCifrado})`;
  const [c] = await sql<ConectorDB[]>`SELECT * FROM conector WHERE id = ${cid}`;
  return { item: paraTela(c), segredo }; // o segredo aparece só agora
}

export async function editarConector(empId: string, cid: unknown, d: DadosConector) {
  const [c] = await sql<ConectorDB[]>`SELECT * FROM conector WHERE id = ${String(cid ?? "")} AND empresa_id = ${empId}`;
  if (!c) throw new ErroConector("Conector não encontrado.", 404);
  const config: ConfigConector = { ...(c.config ?? {}) };
  let segredo = c.segredo;
  const nome = d.nome !== undefined ? String(d.nome).trim().slice(0, 60) || c.nome : c.nome;
  const url = d.url !== undefined ? validarUrl(d.url) : c.url;
  if (c.tipo === "aviso" && d.eventos !== undefined) { config.eventos = lista(d.eventos, IDS_EVENTOS); if (!config.eventos.length) throw new ErroConector("Escolha pelo menos um evento."); }
  if (c.tipo === "destino" && d.tipos !== undefined) { config.tipos = lista(d.tipos, IDS_TIPOS); if (!config.tipos.length) throw new ErroConector("Escolha pelo menos um tipo."); }
  if (c.tipo === "fonte" && d.setores !== undefined) config.setores = lista(d.setores);
  if (c.tipo === "fonte" && d.valor !== undefined) {
    const valor = String(d.valor ?? "").trim().slice(0, 600), cab = String(d.cabecalho ?? config.cabecalho ?? "Authorization").trim() || "Authorization";
    if (!valor) { segredo = null; delete config.cabecalho; }
    else { if (!CABECALHO_OK.test(cab)) throw new ErroConector("Nome de cabeçalho inválido."); config.cabecalho = cab; segredo = await cifrar(JSON.stringify({ nome: cab, valor })); }
  }
  const ativo = d.ativo === undefined ? c.ativo : !!d.ativo;
  await sql`UPDATE conector SET nome = ${nome}, url = ${url}, config = ${sql.json(config as Record<string, string[] | string>)}, segredo = ${segredo}, ativo = ${ativo}, atualizado_em = now() WHERE id = ${c.id}`;
  cacheFontes().delete(c.id);
  const [n] = await sql<ConectorDB[]>`SELECT * FROM conector WHERE id = ${c.id}`;
  return { item: paraTela(n) };
}
export async function apagarConector(empId: string, cid: unknown) {
  const r = await sql`DELETE FROM conector WHERE id = ${String(cid ?? "")} AND empresa_id = ${empId}`;
  if (!r.count) throw new ErroConector("Conector não encontrado.", 404);
  cacheFontes().delete(String(cid));
  return { ok: true };
}

// ---------- avisos (webhooks de saída) ----------
const ESPERAS = [0, 5_000, 30_000];
async function postAssinado(c: Pick<ConectorDB, "url" | "segredo">, evento: string, entregaId: string, corpo: string, tempo = 8000) {
  const segredo = (await decifrar(c.segredo)) ?? "";
  return pedirSeguro(c.url, { metodo: "POST", corpo, tempo, maxBytes: 20_000, cabecalhos: { "x-workend-evento": evento, "x-workend-entrega": entregaId, "x-workend-assinatura": assinar(segredo, corpo) } });
}
async function entregarAviso(empId: string, c: ConectorDB, evento: string, dados: Record<string, unknown>, tentativas = 3) {
  const rid = id("cr");
  const corpo = JSON.stringify({ id: rid, evento, criado_em: new Date().toISOString(), dados });
  await sql`INSERT INTO conector_registro (id, empresa_id, conector_id, tipo, evento, status, resumo) VALUES (${rid}, ${empId}, ${c.id}, ${evento === "teste" ? "teste" : "aviso"}, ${evento}, 'tentando', ${curto(`Aviso para ${c.nome}`, 140)})`;
  let ultimo = "", codigo: number | null = null;
  for (let k = 0; k < tentativas; k++) {
    if (ESPERAS[k]) await espera(ESPERAS[k]);
    try {
      const r = await postAssinado(c, evento, rid, corpo);
      codigo = r.status;
      if (r.status >= 200 && r.status < 300) {
        await sql`UPDATE conector_registro SET status = 'ok', codigo = ${r.status}, tentativas = ${k + 1}, resposta = ${curto(r.texto)} WHERE id = ${rid}`;
        await sql`UPDATE conector SET ultimo_uso = now(), ultimo_erro = NULL WHERE id = ${c.id}`;
        return { ok: true, status: r.status, resposta: curto(r.texto) };
      }
      ultimo = `O sistema respondeu ${r.status}.`;
    } catch (e) { ultimo = (e as Error).message; }
    await sql`UPDATE conector_registro SET tentativas = ${k + 1}, codigo = ${codigo} WHERE id = ${rid}`;
  }
  await sql`UPDATE conector_registro SET status = 'erro', resposta = ${curto(ultimo)} WHERE id = ${rid}`;
  await sql`UPDATE conector SET ultimo_erro = ${curto(ultimo, 200)} WHERE id = ${c.id}`;
  return { ok: false, status: codigo, resposta: ultimo };
}
// dispara o evento para os avisos da empresa (em segundo plano: nunca atrasa nem derruba a conversa)
export function avisar(empId: string, evento: Evento, dados: Record<string, unknown>) {
  void (async () => {
    await migrar();
    const lista = await sql<ConectorDB[]>`SELECT * FROM conector WHERE empresa_id = ${empId} AND tipo = 'aviso' AND ativo AND config->'eventos' @> ${sql.json([evento])}`;
    await Promise.all(lista.map((c) => entregarAviso(empId, c, evento, dados)));
  })().catch((e) => console.error("[conectores] aviso:", (e as Error).message));
}

// ---------- fontes de dados ----------
type CacheFonte = { em: Date; texto: string; ate: number };
const cacheFontes = () => { const g = globalThis as unknown as { __workendFontes?: Map<string, CacheFonte> }; return (g.__workendFontes ??= new Map()); };
const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
async function lerFonte(c: ConectorDB, usarCache = true): Promise<{ texto: string; em: Date }> {
  const cache = cacheFontes(), em = cache.get(c.id);
  if (usarCache && em && em.ate > Date.now()) return em;
  const cab = c.segredo ? (JSON.parse((await decifrar(c.segredo)) ?? "null") as { nome: string; valor: string } | null) : null;
  const r = await pedirSeguro(c.url, { metodo: "GET", cabecalhos: cab ? { [cab.nome]: cab.valor } : {}, tempo: 6000, maxBytes: 200_000 });
  if (r.status < 200 || r.status >= 300) throw new ErroConector(`A fonte respondeu ${r.status}.`, 502);
  let texto = r.texto;
  if (/json/i.test(r.tipo) || /^\s*[[{]/.test(texto)) { try { texto = JSON.stringify(JSON.parse(texto)); } catch { /* fica como veio */ } }
  else if (/html/i.test(r.tipo)) texto = texto.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
  texto = texto.replace(/\s+/g, " ").trim().slice(0, 8000);
  const novo = { em: new Date(), texto, ate: Date.now() + 10 * 60_000 };
  cache.set(c.id, novo);
  if (cache.size > 500) for (const [k, v] of cache) if (v.ate < Date.now()) cache.delete(k);
  return novo;
}
// departamento do agente (o escritório do lote guarda o setor de cada pessoa)
async function setorDoMembro(empId: string, membroId: string | undefined) {
  if (!membroId) return null;
  const ts = await sql<{ escritorio: { equipe?: { id: string; setorId: string | null }[] } | null }[]>`
    SELECT t.escritorio FROM terreno t JOIN empresa e ON e.usuario_id = t.usuario_id WHERE e.id = ${empId} AND t.escritorio IS NOT NULL`;
  for (const t of ts) { const m = t.escritorio?.equipe?.find((x) => x.id === membroId); if (m) return m.setorId ?? null; }
  return null;
}
// "Dados reais da empresa" para o contexto do agente que vai responder ao dono (nunca na conversa com visitantes).
// O CEO lê todas as fontes; os outros, as fontes de "todos" e as do próprio departamento. Erro numa fonte não para nada.
export async function dadosParaAgente(empId: string, agente: { config?: { membroId?: string; papel?: string; setorId?: string | null } | null }): Promise<string | null> {
  await migrar();
  const fontes = await sql<ConectorDB[]>`SELECT * FROM conector WHERE empresa_id = ${empId} AND tipo = 'fonte' AND ativo ORDER BY criado_em`;
  if (!fontes.length) return null;
  const ceo = agente.config?.papel === "ceo";
  const setor = ceo ? null : agente.config?.setorId ?? (await setorDoMembro(empId, agente.config?.membroId));
  const minhas = fontes.filter((f) => ceo || !(f.config?.setores?.length) || (!!setor && f.config.setores.includes(setor))).slice(0, 3);
  const partes = await Promise.all(minhas.map(async (f) => {
    try {
      const { texto, em } = await lerFonte(f);
      void sql`UPDATE conector SET ultimo_uso = now(), ultimo_erro = NULL WHERE id = ${f.id}`.catch(() => {});
      return texto ? `Dados reais da empresa (fonte "${f.nome}", lidos às ${hora(em)}):\n${texto}` : null;
    } catch (e) {
      void sql`UPDATE conector SET ultimo_erro = ${curto((e as Error).message, 200)} WHERE id = ${f.id}`.catch(() => {});
      return null;
    }
  }));
  const ok = partes.filter(Boolean);
  if (!ok.length) return null;
  return `${ok.join("\n\n")}\n\nEstes são dados reais e atuais da empresa. Quando forem úteis para o pedido, use e cite os números exatos daqui. Não invente números que não estão nos dados.`;
}

// ---------- testes (botões da tela) ----------
export async function testarConector(empId: string, cid: unknown) {
  const [c] = await sql<ConectorDB[]>`SELECT * FROM conector WHERE id = ${String(cid ?? "")} AND empresa_id = ${empId}`;
  if (!c) throw new ErroConector("Conector não encontrado.", 404);
  if (c.tipo === "fonte") {
    try {
      const r = await lerFonte(c, false);
      await sql`UPDATE conector SET ultimo_uso = now(), ultimo_erro = NULL WHERE id = ${c.id}`;
      return { ok: true, amostra: r.texto.slice(0, 600), tamanho: r.texto.length };
    } catch (e) {
      await sql`UPDATE conector SET ultimo_erro = ${curto((e as Error).message, 200)} WHERE id = ${c.id}`;
      return { ok: false, resposta: (e as Error).message };
    }
  }
  if (c.tipo === "aviso") return entregarAviso(empId, c, "teste", { mensagem: "Teste do WorkEnd: se você recebeu isto, o aviso está funcionando." }, 1);
  // destino: um envio de teste (o sistema deve responder 2xx e pode ignorar o tipo "teste")
  return enviarConteudo(empId, c, { tipo: "teste", titulo: "Teste do WorkEnd", texto: "Se você recebeu isto, o destino está ligado. Pode ignorar este envio.", autor: null, empresa: null, origem: null });
}

// ---------- destinos (enviar uma entrega) ----------
export interface Conteudo { tipo: string; titulo: string; texto: string; autor: { nome: string; cargo: string; departamento: string } | null; empresa: { nome: string; lote: string } | null; origem: { mensagemId: string | null; conversa: string | null } | null }
async function enviarConteudo(empId: string, c: ConectorDB, d: Conteudo) {
  const rid = id("cr");
  const corpo = JSON.stringify({ id: rid, ...d, enviado_em: new Date().toISOString() });
  await sql`INSERT INTO conector_registro (id, empresa_id, conector_id, tipo, evento, status, resumo) VALUES (${rid}, ${empId}, ${c.id}, ${d.tipo === "teste" ? "teste" : "envio"}, ${d.tipo}, 'tentando', ${curto(d.titulo, 140)})`;
  try {
    const r = await postAssinado(c, `envio.${d.tipo}`, rid, corpo, 10_000);
    const ok = r.status >= 200 && r.status < 300;
    let retorno: { id?: string; url?: string } = {};
    try { const j = JSON.parse(r.texto) as { id?: unknown; url?: unknown }; retorno = { id: j.id ? String(j.id).slice(0, 120) : undefined, url: typeof j.url === "string" && /^https?:\/\//.test(j.url) ? j.url.slice(0, 500) : undefined }; } catch { /* resposta sem JSON */ }
    await sql`UPDATE conector_registro SET status = ${ok ? "ok" : "erro"}, codigo = ${r.status}, tentativas = 1, resposta = ${curto(r.texto)} WHERE id = ${rid}`;
    await sql`UPDATE conector SET ultimo_uso = now(), ultimo_erro = ${ok ? null : `O sistema respondeu ${r.status}.`} WHERE id = ${c.id}`;
    return { ok, status: r.status, ...retorno, resposta: ok ? undefined : curto(r.texto, 200) || `O sistema respondeu ${r.status}.` };
  } catch (e) {
    const msg = (e as Error).message;
    await sql`UPDATE conector_registro SET status = 'erro', tentativas = 1, resposta = ${curto(msg)} WHERE id = ${rid}`;
    await sql`UPDATE conector SET ultimo_erro = ${curto(msg, 200)} WHERE id = ${c.id}`;
    return { ok: false, status: null, resposta: msg };
  }
}
export async function enviarParaDestino(empId: string, destinoId: unknown, d: Conteudo) {
  const [c] = await sql<ConectorDB[]>`SELECT * FROM conector WHERE id = ${String(destinoId ?? "")} AND empresa_id = ${empId} AND tipo = 'destino'`;
  if (!c) throw new ErroConector("Destino não encontrado.", 404);
  if (!c.ativo) throw new ErroConector("Este destino está pausado. Ative na aba Conectores.");
  if (!(c.config?.tipos ?? []).includes(d.tipo)) throw new ErroConector("Este destino não aceita esse tipo de conteúdo.");
  const titulo = d.titulo.trim().slice(0, 200), texto = d.texto.trim().slice(0, 20_000);
  if (!titulo || !texto) throw new ErroConector("Preencha o título e o texto.");
  return enviarConteudo(empId, c, { ...d, titulo, texto });
}
export async function destinosDaEmpresa(empId: string) {
  await migrar();
  return (await sql<ConectorDB[]>`SELECT * FROM conector WHERE empresa_id = ${empId} AND tipo = 'destino' AND ativo ORDER BY criado_em`).map((c) => ({ id: c.id, nome: c.nome, tipos: c.config?.tipos ?? [] }));
}

// e-mail ou telefone (10+ dígitos) numa fala de visitante
export function contatosNaFala(t: string) {
  const email = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(t)?.[0] ?? null;
  const tel = /(?:\+?55\s?)?(?:\(?\d{2}\)?[\s-]?)?9?\d{4}[\s-]?\d{4}/.exec(t)?.[0] ?? null;
  const telOk = tel && tel.replace(/\D/g, "").length >= 10 ? tel : null;
  return email || telOk ? { email, telefone: telOk } : null;
}
