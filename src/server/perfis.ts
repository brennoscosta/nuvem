// Perfil de cadastro (20/11/2026, frente "cadastro", migração 0043): o formulário em etapas logo depois de criar a conta,
// o perfil público em /perfil/<apelido>, a busca de perfis em /encontrar (casando "oferece" com "procura") e a lista de
// cadastros do admin (com CSV). As opções e as etapas ficam em src/office/data/cadastro.ts.
// Privacidade: o perfil público só mostra o que a pessoa marcou; WhatsApp e e-mail ficam escondidos até ela ligar.
import { randomBytes } from "node:crypto";
import { sql, migrar } from "./db";
import type { Usuario } from "./usuarios";
import { terrenoDoUsuario } from "./terrenos";
import { tipoDaFoto, MAX_FOTO } from "./vitrine";
import { NICHOS, nomeNicho } from "@/office/data/mundo";
import { numeroDaLoja } from "@/office/data/numeroLoja";
import {
  ETAPAS, OBJETIVOS, TIPOS, ATENDIMENTOS, UFS, MOSTRAR_PADRAO, MAX_ETIQUETAS, MAX_ETIQUETA, MAX_TEXTO, MAX_NICHOS, APELIDO_VALIDO,
  normalizar, paraApelido, nomeTipo, nomeObjetivo, nomeAtendimento, ehEtapa,
  type EtapaId, type Mostrar, type PerfilCadastro, type Objetivo, type TipoCadastro, type Atendimento,
} from "@/office/data/cadastro";

export class ErroPerfil extends Error { constructor(msg: string, public status = 400) { super(msg); } }

// ---------- leitura da linha ----------
type Linha = Omit<PerfilCadastro, "foto" | "pulouEm" | "concluidoEm" | "mostrar"> & {
  usuarioId: string; temFoto: boolean; mostrar: Partial<Mostrar> | null; pulouEm: Date | null; concluidoEm: Date | null; criadoEm: Date; atualizadoEm: Date;
};
// sempre com a tabela como "p" (a junção com usuario tem nome e criado_em repetidos)
const CAMPOS = () => sql`p.usuario_id, p.apelido, p.objetivo, p.tipo, p.nome, p.nichos, p.cidade, p.uf, p.atendimento, p.oferece, p.oferece_texto, p.procura, p.procura_texto,
  p.site, p.instagram, p.whatsapp, (p.foto IS NOT NULL) AS tem_foto, p.publico, p.mostrar, p.etapas, p.pulou_em, p.concluido_em, p.criado_em, p.atualizado_em`;
const urlFoto = (l: { apelido: string | null; temFoto: boolean; atualizadoEm: Date }) =>
  l.temFoto && l.apelido ? `/api/workend/perfil/foto/${l.apelido}?v=${Math.floor(new Date(l.atualizadoEm).getTime() / 1000)}` : null;
const mostrarDe = (m: Partial<Mostrar> | null | undefined): Mostrar => ({ ...MOSTRAR_PADRAO, ...(m ?? {}) });
function paraPerfil(l: Linha): PerfilCadastro {
  return {
    apelido: l.apelido, objetivo: l.objetivo, tipo: l.tipo, nome: l.nome, nichos: l.nichos ?? [], cidade: l.cidade, uf: l.uf, atendimento: l.atendimento,
    oferece: l.oferece ?? [], ofereceTexto: l.ofereceTexto, procura: l.procura ?? [], procuraTexto: l.procuraTexto,
    site: l.site, instagram: l.instagram, whatsapp: l.whatsapp, foto: urlFoto(l), publico: l.publico, mostrar: mostrarDe(l.mostrar),
    etapas: (l.etapas ?? []).filter(ehEtapa), pulouEm: l.pulouEm ? new Date(l.pulouEm).toISOString() : null, concluidoEm: l.concluidoEm ? new Date(l.concluidoEm).toISOString() : null,
  };
}
async function linhaDe(usuarioId: string): Promise<Linha | null> {
  await migrar();
  const [l] = await sql<Linha[]>`SELECT ${CAMPOS()} FROM perfil_cadastro p WHERE p.usuario_id = ${usuarioId}`;
  return l ?? null;
}
export async function meuPerfil(usuarioId: string): Promise<PerfilCadastro | null> {
  const l = await linhaDe(usuarioId);
  return l ? paraPerfil(l) : null;
}

// o que já dá para preencher sozinho: nome da empresa, área do lote e as redes do personagem
export async function sugestaoInicial(u: Usuario): Promise<Partial<PerfilCadastro>> {
  const [t, pe] = await Promise.all([
    terrenoDoUsuario(u.id).catch(() => null),
    sql<{ redes: { instagram?: string; whatsapp?: string; site?: string } | null }[]>`SELECT redes FROM personagem WHERE usuario_id = ${u.id}`.then((r) => r[0] ?? null).catch(() => null),
  ]);
  const r = pe?.redes ?? {};
  return {
    nome: (t?.empresaNome || u.empresaNome || u.nome || "").slice(0, 80),
    nichos: t?.nicho && NICHOS.some((n) => n.id === t.nicho) ? [t.nicho] : [],
    instagram: (r.instagram ?? "").replace(/^@/, "").slice(0, 30),
    whatsapp: (r.whatsapp ?? "").replace(/\D/g, "").slice(0, 11),
    site: (r.site ?? "").slice(0, 200),
  };
}

// ---------- validação ----------
const texto = (t: unknown, max: number) => (typeof t === "string" ? t : "").replace(/[<>{}\[\]\\]/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
function etiquetas(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const vistos = new Set<string>(), saida: string[] = [];
  for (const x of v) {
    const t = texto(x, MAX_ETIQUETA).replace(/\n/g, " ").replace(/[,;]+/g, " ").trim();
    const n = normalizar(t);
    if (!t || vistos.has(n)) continue;
    vistos.add(n); saida.push(t);
    if (saida.length >= MAX_ETIQUETAS) break;
  }
  return saida;
}
const umDe = <T extends string>(v: unknown, lista: readonly { id: T }[]): T | null => (typeof v === "string" && lista.some((x) => x.id === v) ? (v as T) : null);
function lerSite(v: unknown): string {
  const s = texto(v, 200).replace(/\s/g, "");
  if (!s) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) throw new Error();
    return u.toString().replace(/\/$/, "");
  } catch { throw new ErroPerfil("Esse site não parece um endereço válido. Escreva assim: www.seusite.com.br"); }
}
function lerInstagram(v: unknown): string {
  const s = texto(v, 120).replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  if (!s) return "";
  if (!/^[A-Za-z0-9._]{1,30}$/.test(s)) throw new ErroPerfil("O Instagram vai sem espaços: só letras, números, ponto e sublinhado.");
  return s;
}
function lerWhatsapp(v: unknown): string {
  let d = (typeof v === "string" ? v : "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 10 || d.length > 11) throw new ErroPerfil("Escreva o WhatsApp com DDD, só números (ex.: 79 99999-0000).");
  return d;
}
function lerFoto(base64: unknown): { dados: Buffer; tipo: string } {
  if (typeof base64 !== "string" || !base64) throw new ErroPerfil("Foto vazia.");
  const dados = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");
  if (dados.length > MAX_FOTO) throw new ErroPerfil("Foto grande demais (máximo 200 KB). Escolha outra.", 413);
  const tipo = tipoDaFoto(dados);
  if (!tipo) throw new ErroPerfil("A foto precisa ser JPG, PNG ou WebP.");
  return { dados, tipo };
}
const lerMostrar = (v: unknown, atual: Mostrar): Mostrar => {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const b = (k: keyof Mostrar) => (typeof o[k] === "boolean" ? (o[k] as boolean) : atual[k]);
  return { procura: b("procura"), cidade: b("cidade"), links: b("links"), cidade3d: b("cidade3d"), whatsapp: b("whatsapp"), email: b("email") };
};

// quando uma etapa conta como respondida
function respondida(e: EtapaId, p: PerfilCadastro): boolean {
  switch (e) {
    case "objetivo": return !!p.objetivo;
    case "quem": return !!p.tipo;
    case "negocio": return !!p.nome.trim();
    case "local": return !!p.atendimento && (p.atendimento === "online" || !!p.cidade.trim());
    case "oferece": return p.oferece.length > 0 || !!p.ofereceTexto.trim() || p.objetivo === "encontrar";
    case "procura": return p.procura.length > 0 || !!p.procuraTexto.trim() || p.objetivo === "mostrar";
    case "links": case "privacidade": return true;
  }
}
// campos de cada etapa (o editor do painel manda todas de uma vez: "tudo")
const CAMPOS_ETAPA: Record<EtapaId, string[]> = {
  objetivo: ["objetivo"], quem: ["tipo"], negocio: ["nome", "nichos"], local: ["cidade", "uf", "atendimento"],
  oferece: ["oferece", "ofereceTexto"], procura: ["procura", "procuraTexto"], links: ["site", "instagram", "whatsapp", "foto", "removerFoto"],
  privacidade: ["apelido", "publico", "mostrar"],
};

async function apelidoLivre(base: string, usuarioId: string): Promise<string> {
  let b = paraApelido(base);
  if (b.length < 3) b = `${b || "perfil"}-${b ? "perfil" : randomBytes(2).toString("hex")}`.replace(/^-/, "");
  for (let i = 1; i <= 30; i++) {
    const tentativa = i === 1 ? b : `${b}-${i}`;
    const [x] = await sql`SELECT 1 FROM perfil_cadastro WHERE apelido = ${tentativa} AND usuario_id <> ${usuarioId}`;
    if (!x) return tentativa;
  }
  return `${b}-${randomBytes(3).toString("hex")}`;
}

// texto da busca: sem acento, com o que o perfil público mostra
function textoBusca(p: PerfilCadastro): string {
  return normalizar([p.nome, nomeTipo(p.tipo), ...p.nichos.map(nomeNicho), p.mostrar.cidade ? `${p.cidade} ${p.uf}` : "", nomeAtendimento(p.atendimento),
    ...p.oferece, p.ofereceTexto, ...(p.mostrar.procura ? [...p.procura, p.procuraTexto] : [])].join(" ")).slice(0, 4000);
}

// Salva uma etapa (ou "tudo", no editor do painel). Devolve o perfil salvo.
export async function salvarPerfil(u: Usuario, etapa: EtapaId | "tudo", d: Record<string, unknown>): Promise<PerfilCadastro> {
  await migrar();
  if (u.banidoEm) throw new ErroPerfil("Conta suspensa.", 403);
  const linha = await linhaDe(u.id);
  const atual = linha ? paraPerfil(linha) : null;
  const p: PerfilCadastro = atual ? { ...atual } : { apelido: null, objetivo: null, tipo: null, nome: "", nichos: [], cidade: "", uf: "", atendimento: null, oferece: [], ofereceTexto: "", procura: [], procuraTexto: "", site: "", instagram: "", whatsapp: "", foto: null, publico: true, mostrar: MOSTRAR_PADRAO, etapas: [], pulouEm: null, concluidoEm: null };
  const etapas: EtapaId[] = etapa === "tudo" ? ETAPAS.map((e) => e.id) : [etapa];
  const tem = (k: string) => etapas.some((e) => CAMPOS_ETAPA[e].includes(k)) && k in d;
  if (tem("objetivo")) p.objetivo = umDe<Objetivo>(d.objetivo, OBJETIVOS);
  if (tem("tipo")) p.tipo = umDe<TipoCadastro>(d.tipo, TIPOS);
  if (tem("nome")) p.nome = texto(d.nome, 80).replace(/\n/g, " ");
  if (tem("nichos")) p.nichos = Array.isArray(d.nichos) ? [...new Set(d.nichos.filter((n): n is string => typeof n === "string" && NICHOS.some((x) => x.id === n)))].slice(0, MAX_NICHOS) : [];
  if (tem("cidade")) p.cidade = texto(d.cidade, 60).replace(/\n/g, " ");
  if (tem("uf")) p.uf = typeof d.uf === "string" && (UFS as readonly string[]).includes(d.uf.toUpperCase()) ? d.uf.toUpperCase() : "";
  if (tem("atendimento")) p.atendimento = umDe<Atendimento>(d.atendimento, ATENDIMENTOS);
  if (tem("oferece")) p.oferece = etiquetas(d.oferece);
  if (tem("ofereceTexto")) p.ofereceTexto = texto(d.ofereceTexto, MAX_TEXTO);
  if (tem("procura")) p.procura = etiquetas(d.procura);
  if (tem("procuraTexto")) p.procuraTexto = texto(d.procuraTexto, MAX_TEXTO);
  if (tem("site")) p.site = lerSite(d.site);
  if (tem("instagram")) p.instagram = lerInstagram(d.instagram);
  if (tem("whatsapp")) p.whatsapp = lerWhatsapp(d.whatsapp);
  if (tem("publico")) p.publico = d.publico !== false;
  if (tem("mostrar")) p.mostrar = lerMostrar(d.mostrar, p.mostrar);
  const foto = tem("foto") && d.foto ? lerFoto(d.foto) : null;
  const tirarFoto = tem("removerFoto") && d.removerFoto === true;

  // endereço do perfil: o escolhido (privacidade) ou um criado do nome
  if (tem("apelido") && typeof d.apelido === "string" && d.apelido.trim()) {
    const a = d.apelido.trim().toLowerCase();
    if (!APELIDO_VALIDO.test(a)) throw new ErroPerfil("O endereço do perfil usa de 3 a 40 letras minúsculas, números e hífen (sem acento nem espaço).");
    const [x] = await sql`SELECT 1 FROM perfil_cadastro WHERE apelido = ${a} AND usuario_id <> ${u.id}`;
    if (x) throw new ErroPerfil("Esse endereço já é de outra pessoa. Escolha outro.", 409);
    p.apelido = a;
  }
  if (!p.apelido) p.apelido = await apelidoLivre(p.nome || u.empresaNome || u.nome, u.id);

  // etapas respondidas: cada etapa salva entra (ou sai, se ficou vazia)
  const feitas = new Set<EtapaId>(p.etapas);
  for (const e of etapas) { if (respondida(e, p)) feitas.add(e); else feitas.delete(e); }
  p.etapas = ETAPAS.map((e) => e.id).filter((e) => feitas.has(e));
  const completo = p.etapas.length === ETAPAS.length;
  const busca = textoBusca(p);

  await sql`INSERT INTO perfil_cadastro (usuario_id, apelido, objetivo, tipo, nome, nichos, cidade, uf, atendimento, oferece, oferece_texto, procura, procura_texto,
      site, instagram, whatsapp, publico, mostrar, busca, etapas, concluido_em, foto, foto_tipo)
    VALUES (${u.id}, ${p.apelido}, ${p.objetivo}, ${p.tipo}, ${p.nome}, ${p.nichos}::text[], ${p.cidade}, ${p.uf}, ${p.atendimento}, ${p.oferece}::text[], ${p.ofereceTexto}, ${p.procura}::text[], ${p.procuraTexto},
      ${p.site}, ${p.instagram}, ${p.whatsapp}, ${p.publico}, ${sql.json({ ...p.mostrar })}, ${busca}, ${p.etapas}::text[], ${completo ? sql`now()` : null}, ${foto?.dados ?? null}, ${foto?.tipo ?? null})
    ON CONFLICT (usuario_id) DO UPDATE SET apelido = EXCLUDED.apelido, objetivo = EXCLUDED.objetivo, tipo = EXCLUDED.tipo, nome = EXCLUDED.nome, nichos = EXCLUDED.nichos,
      cidade = EXCLUDED.cidade, uf = EXCLUDED.uf, atendimento = EXCLUDED.atendimento, oferece = EXCLUDED.oferece, oferece_texto = EXCLUDED.oferece_texto,
      procura = EXCLUDED.procura, procura_texto = EXCLUDED.procura_texto, site = EXCLUDED.site, instagram = EXCLUDED.instagram, whatsapp = EXCLUDED.whatsapp,
      publico = EXCLUDED.publico, mostrar = EXCLUDED.mostrar, busca = EXCLUDED.busca, etapas = EXCLUDED.etapas,
      concluido_em = CASE WHEN ${completo} THEN COALESCE(perfil_cadastro.concluido_em, now()) ELSE NULL END,
      foto = CASE WHEN ${!!foto} THEN EXCLUDED.foto WHEN ${tirarFoto} THEN NULL ELSE perfil_cadastro.foto END,
      foto_tipo = CASE WHEN ${!!foto} THEN EXCLUDED.foto_tipo WHEN ${tirarFoto} THEN NULL ELSE perfil_cadastro.foto_tipo END,
      atualizado_em = now()`;
  return (await meuPerfil(u.id))!;
}

// "Terminar depois": guarda que a pessoa pulou (o painel lembra o que falta)
export async function pularPerfil(u: Usuario) {
  await migrar();
  const apelido = (await linhaDe(u.id))?.apelido ?? (await apelidoLivre(u.empresaNome || u.nome, u.id));
  await sql`INSERT INTO perfil_cadastro (usuario_id, apelido, nome, pulou_em) VALUES (${u.id}, ${apelido}, ${(u.empresaNome || "").slice(0, 80)}, now())
    ON CONFLICT (usuario_id) DO UPDATE SET pulou_em = now(), atualizado_em = now()`;
}

export interface ResumoPerfil { existe: boolean; respondidas: EtapaId[]; faltam: { id: EtapaId; curto: string }[]; total: number; apelido: string | null; publico: boolean; completo: boolean; nome: string }
export async function resumoPerfil(usuarioId: string): Promise<ResumoPerfil> {
  const p = await meuPerfil(usuarioId);
  const respondidas = p?.etapas ?? [];
  const faltam = ETAPAS.filter((e) => !respondidas.includes(e.id)).map((e) => ({ id: e.id as EtapaId, curto: e.curto }));
  return { existe: !!p, respondidas, faltam, total: ETAPAS.length, apelido: p?.apelido ?? null, publico: p?.publico ?? false, completo: faltam.length === 0, nome: p?.nome ?? "" };
}
// conta criada agora há pouco e sem perfil começado (o Google cria a conta na volta do login)
export async function precisaDoFormulario(u: Usuario): Promise<boolean> {
  if (Date.now() - new Date(u.criadoEm).getTime() > 10 * 60_000) return false;
  return !(await linhaDe(u.id).catch(() => null));
}

// ---------- perfil público ----------
export interface CartaoPerfil {
  apelido: string; nome: string; tipo: string; objetivo: Objetivo | null; nichos: string[]; local: string; atendimento: string;
  oferece: string[]; ofereceTexto: string; procura: string[]; procuraTexto: string; foto: string | null; loja: number | null; motivos?: string[];
}
type LinhaPublica = Linha & { email: string; lojaChave: string | null };
const PUBLICOS = () => sql`p.publico AND p.nome <> '' AND u.banido_em IS NULL`;
function paraCartao(l: LinhaPublica, motivos?: string[]): CartaoPerfil {
  const p = paraPerfil(l);
  const loja = p.mostrar.cidade3d && l.lojaChave ? numeroDaLoja({ chave: l.lojaChave }) : null;
  return {
    apelido: p.apelido!, nome: p.nome, tipo: nomeTipo(p.tipo), objetivo: p.objetivo, nichos: p.nichos.map(nomeNicho),
    local: p.mostrar.cidade ? [p.cidade, p.uf].filter(Boolean).join(" / ") : "", atendimento: nomeAtendimento(p.atendimento),
    oferece: p.oferece, ofereceTexto: p.ofereceTexto, procura: p.mostrar.procura ? p.procura : [], procuraTexto: p.mostrar.procura ? p.procuraTexto : "",
    foto: p.foto, loja, ...(motivos ? { motivos } : {}),
  };
}
const SELECT_PUBLICO = () => sql`SELECT ${CAMPOS()}, u.email,
    (SELECT t.chave FROM terreno t WHERE t.usuario_id = p.usuario_id AND t.anexo_de IS NULL AND t.status = 'ativo' ORDER BY t.reservado_em LIMIT 1) AS loja_chave
  FROM perfil_cadastro p JOIN usuario u ON u.id = p.usuario_id`;

export interface PerfilPublico {
  dono: boolean; soVoce: boolean; usuarioId: string; apelido: string; nome: string; tipo: string; objetivo: Objetivo | null; objetivoNome: string;
  nichos: { id: string; nome: string }[]; local: string; atendimento: string; oferece: string[]; ofereceTexto: string; procura: string[]; procuraTexto: string;
  site: string | null; instagram: string | null; whatsapp: string | null; email: string | null; foto: string | null; desde: string;
  loja: { numero: number; nome: string; chave: string } | null;
  personagem: { nome: string; boneco: string; roupa: string; profissao: string; acessorios: string[] } | null;
}
export async function perfilPublico(apelido: string, quemPede: Usuario | null): Promise<PerfilPublico | null> {
  await migrar();
  if (!APELIDO_VALIDO.test(apelido)) return null;
  const [l] = await sql<(LinhaPublica & { banidoEm: Date | null; usuarioCriado: Date })[]>`SELECT ${CAMPOS()}, u.email, u.banido_em, u.criado_em AS usuario_criado, NULL::text AS loja_chave
    FROM perfil_cadastro p JOIN usuario u ON u.id = p.usuario_id WHERE p.apelido = ${apelido}`;
  if (!l) return null;
  const dono = quemPede?.id === l.usuarioId;
  const aberto = l.publico && !!l.nome && !l.banidoEm;
  if (!aberto && !dono) return null;
  const p = paraPerfil(l);
  const m = p.mostrar;
  const [t, pe] = await Promise.all([
    m.cidade3d ? terrenoDoUsuario(l.usuarioId).catch(() => null) : null,
    m.cidade3d ? sql<{ nome: string; boneco: string; roupa: string; profissao: string; acessorios: string[] | null }[]>`SELECT nome, boneco, roupa, profissao, acessorios FROM personagem WHERE usuario_id = ${l.usuarioId} AND pago_ate > now()`.then((r) => r[0] ?? null).catch(() => null) : null,
  ]);
  const numero = t?.status === "ativo" ? numeroDaLoja(t) : null;
  return {
    dono, soVoce: !aberto, usuarioId: l.usuarioId, apelido: p.apelido!, nome: p.nome || "Perfil sem nome", tipo: nomeTipo(p.tipo), objetivo: p.objetivo, objetivoNome: nomeObjetivo(p.objetivo),
    nichos: p.nichos.map((id) => ({ id, nome: nomeNicho(id) })), local: m.cidade ? [p.cidade, p.uf].filter(Boolean).join(" / ") : "", atendimento: nomeAtendimento(p.atendimento),
    oferece: p.oferece, ofereceTexto: p.ofereceTexto, procura: m.procura ? p.procura : [], procuraTexto: m.procura ? p.procuraTexto : "",
    site: m.links && p.site ? p.site : null, instagram: m.links && p.instagram ? p.instagram : null, whatsapp: m.whatsapp && p.whatsapp ? p.whatsapp : null,
    email: m.email ? l.email : null, foto: p.foto, desde: new Date(l.usuarioCriado).toISOString(),
    loja: t && numero != null ? { numero, nome: t.empresaNome, chave: t.chave } : null,
    personagem: pe ? { nome: pe.nome, boneco: pe.boneco, roupa: pe.roupa, profissao: pe.profissao, acessorios: pe.acessorios ?? [] } : null,
  };
}
// apelido do perfil público de alguém (para a ficha do personagem no mapa abrir o perfil)
export async function apelidoPublico(usuarioId: string): Promise<string | null> {
  await migrar();
  const [r] = await sql<{ apelido: string }[]>`SELECT p.apelido FROM perfil_cadastro p JOIN usuario u ON u.id = p.usuario_id WHERE p.usuario_id = ${usuarioId} AND ${PUBLICOS()}`;
  return r?.apelido ?? null;
}
export async function fotoDoPerfil(apelido: string, quemPede: Usuario | null) {
  await migrar();
  if (!APELIDO_VALIDO.test(apelido)) return null;
  const [r] = await sql<{ foto: Uint8Array | null; fotoTipo: string | null; publico: boolean; nome: string; usuarioId: string; banidoEm: Date | null; atualizadoEm: Date }[]>`SELECT p.foto, p.foto_tipo, p.publico, p.nome, p.usuario_id, u.banido_em, p.atualizado_em
    FROM perfil_cadastro p JOIN usuario u ON u.id = p.usuario_id WHERE p.apelido = ${apelido}`;
  if (!r?.foto) return null;
  const publico = r.publico && !!r.nome && !r.banidoEm;
  if (!publico && quemPede?.id !== r.usuarioId) return null;
  return { dados: Buffer.from(r.foto), tipo: r.fotoTipo ?? "image/jpeg", publico, versao: Math.floor(new Date(r.atualizadoEm).getTime() / 1000) };
}

// ---------- busca e casamento ----------
export async function buscarPerfis(f: { q?: string | null; nicho?: string | null; excluir?: string | null }): Promise<CartaoPerfil[]> {
  await migrar();
  const q = normalizar((f.q ?? "").slice(0, 60)).replace(/[%_\\]/g, "");
  const nicho = f.nicho && NICHOS.some((n) => n.id === f.nicho) ? f.nicho : null;
  const palavras = q.split(" ").filter(Boolean).slice(0, 5);
  const porPalavra = palavras.reduce((acc, w) => sql`${acc} AND p.busca LIKE ${`%${w}%`}`, sql``);
  const rows = await sql<LinhaPublica[]>`${SELECT_PUBLICO()}
    WHERE ${PUBLICOS()} AND (cardinality(p.oferece) > 0 OR p.oferece_texto <> '' OR cardinality(p.procura) > 0 OR p.procura_texto <> '')
      AND (${nicho}::text IS NULL OR ${nicho} = ANY(p.nichos)) ${porPalavra}
    ORDER BY p.concluido_em IS NOT NULL DESC, p.atualizado_em DESC LIMIT 60`;
  return rows.filter((r) => r.usuarioId !== f.excluir).map((r) => paraCartao(r));
}

// palavras que não dizem nada sozinhas ("serviços", "empresa") ficam fora do casamento
const PARADAS = new Set(["para", "com", "sem", "dos", "das", "uma", "uns", "umas", "que", "por", "mais", "meu", "minha", "meus", "minhas", "seu", "sua", "seus", "suas", "nos", "nas", "como", "quem",
  "algo", "alguem", "tudo", "todo", "toda", "todos", "bem", "muito", "servico", "servicos", "produto", "produtos", "empresa", "empresas", "cliente", "clientes", "pessoa", "pessoas", "coisa", "coisas",
  "geral", "online", "presencial", "trabalho", "trabalhos", "quero", "procuro", "busco", "preciso", "ofereco", "fazemos", "faco", "atendo", "atendemos", "voce", "voces", "aqui", "tambem", "outro", "outros"]);
// raiz curta de cada palavra: "fotógrafo" e "fotografia" viram "fotog"; "designer" e "design", "desig"
const raizes = (s: string) => normalizar(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !PARADAS.has(w)).map((w) => w.slice(0, 5));
function casar(tagsA: string[], textoA: string, tagsB: string[], textoB: string): { pontos: number; motivos: string[] } {
  const exatasB = new Set(tagsB.map(normalizar));
  const raizB = new Set(tagsB.flatMap(raizes)), raizTextoB = new Set(raizes(textoB));
  let pontos = 0; const motivos: string[] = [];
  for (const t of tagsA) {
    const r = raizes(t); if (!r.length) continue;
    if (exatasB.has(normalizar(t))) { pontos += 3; motivos.push(t); }
    else if (r.some((x) => raizB.has(x))) { pontos += 2; motivos.push(t); }
    else if (r.some((x) => raizTextoB.has(x))) { pontos += 1; motivos.push(t); }
  }
  // o outro só escreveu a descrição ou eu só escrevi a minha: compara as descrições com as etiquetas do outro lado
  if (!motivos.length && textoA) { const rA = new Set(raizes(textoA)); for (const b of tagsB) if (raizes(b).some((x) => rA.has(x))) { pontos += 1; motivos.push(b); } }
  if (!motivos.length && textoA && textoB) { const rA = new Set(raizes(textoA)); const comuns = [...new Set(raizes(textoB))].filter((x) => rA.has(x)); if (comuns.length >= 2) pontos += 1; }
  return { pontos, motivos: [...new Set(motivos)].slice(0, 3) };
}

export interface Combina { temPerfil: boolean; ofereco: boolean; procuro: boolean; procuramOQueOfereco: CartaoPerfil[]; oferecemOQueProcuro: CartaoPerfil[] }
export async function combinar(usuarioId: string): Promise<Combina> {
  const eu = await meuPerfil(usuarioId);
  const vazio: Combina = { temPerfil: !!eu, ofereco: false, procuro: false, procuramOQueOfereco: [], oferecemOQueProcuro: [] };
  if (!eu) return vazio;
  const ofereco = eu.oferece.length > 0 || !!eu.ofereceTexto, procuro = eu.procura.length > 0 || !!eu.procuraTexto;
  if (!ofereco && !procuro) return { ...vazio, ofereco, procuro };
  const outros = await sql<LinhaPublica[]>`${SELECT_PUBLICO()} WHERE ${PUBLICOS()} AND p.usuario_id <> ${usuarioId} ORDER BY p.atualizado_em DESC LIMIT 500`;
  const bonus = (l: LinhaPublica) => (eu.nichos.some((n) => (l.nichos ?? []).includes(n)) ? 1 : 0) + (eu.cidade && normalizar(l.cidade) === normalizar(eu.cidade) && l.uf === eu.uf ? 1 : 0);
  const ordenar = (lista: { l: LinhaPublica; pontos: number; motivos: string[] }[]) => lista.filter((x) => x.pontos > 0).sort((a, b) => b.pontos - a.pontos).slice(0, 6).map((x) => paraCartao(x.l, x.motivos));
  // só casa com o "procura" de quem deixou o que procura à mostra
  const procuram = ofereco ? ordenar(outros.filter((l) => mostrarDe(l.mostrar).procura).map((l) => { const c = casar(eu.oferece, eu.ofereceTexto, l.procura ?? [], l.procuraTexto); return { l, pontos: c.pontos ? c.pontos + bonus(l) : 0, motivos: c.motivos }; })) : [];
  const oferecem = procuro ? ordenar(outros.map((l) => { const c = casar(eu.procura, eu.procuraTexto, l.oferece ?? [], l.ofereceTexto); return { l, pontos: c.pontos ? c.pontos + bonus(l) : 0, motivos: c.motivos }; })) : [];
  return { temPerfil: true, ofereco, procuro, procuramOQueOfereco: procuram, oferecemOQueProcuro: oferecem };
}

// ---------- admin: lista dos cadastros (para a equipe do WorkEnd) ----------
export type Situacao = "completo" | "parcial" | "pulou" | "sem";
export interface FiltrosCadastro { objetivo?: string | null; tipo?: string | null; nicho?: string | null; uf?: string | null; situacao?: string | null; q?: string | null; de?: string | null; ate?: string | null }
export interface LinhaCadastro {
  usuarioId: string; email: string; nomeConta: string; criadoEm: string; objetivo: string | null; tipo: string | null; nome: string; nichos: string[];
  cidade: string; uf: string; atendimento: string | null; oferece: string[]; ofereceTexto: string; procura: string[]; procuraTexto: string;
  site: string; instagram: string; whatsapp: string; publico: boolean; apelido: string | null; etapas: number; situacao: Situacao; lote: number | null;
}
const dataValida = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
export async function listarCadastros(f: FiltrosCadastro, limite = 2000): Promise<LinhaCadastro[]> {
  await migrar();
  const objetivo = umDe<Objetivo>(f.objetivo, OBJETIVOS), tipo = umDe<TipoCadastro>(f.tipo, TIPOS);
  const nicho = f.nicho && NICHOS.some((n) => n.id === f.nicho) ? f.nicho : null;
  const uf = f.uf && (UFS as readonly string[]).includes(f.uf) ? f.uf : null;
  const situacao = ["completo", "parcial", "pulou", "sem"].includes(f.situacao ?? "") ? (f.situacao as Situacao) : null;
  const q = normalizar((f.q ?? "").slice(0, 60)).replace(/[%_\\]/g, ""), like = `%${q}%`;
  const de = dataValida(f.de), ate = dataValida(f.ate);
  const rows = await sql<(Omit<LinhaCadastro, "situacao" | "criadoEm" | "lote" | "etapas"> & { criadoEm: Date; concluidoEm: Date | null; pulouEm: Date | null; nEtapas: number | null; loteChave: string | null; existe: boolean })[]>`
    SELECT u.id AS usuario_id, u.email, u.nome AS nome_conta, u.criado_em, (p.usuario_id IS NOT NULL) AS existe,
      p.objetivo, p.tipo, COALESCE(p.nome, '') AS nome, COALESCE(p.nichos, '{}') AS nichos, COALESCE(p.cidade, '') AS cidade, COALESCE(p.uf, '') AS uf, p.atendimento,
      COALESCE(p.oferece, '{}') AS oferece, COALESCE(p.oferece_texto, '') AS oferece_texto, COALESCE(p.procura, '{}') AS procura, COALESCE(p.procura_texto, '') AS procura_texto,
      COALESCE(p.site, '') AS site, COALESCE(p.instagram, '') AS instagram, COALESCE(p.whatsapp, '') AS whatsapp, COALESCE(p.publico, false) AS publico, p.apelido,
      cardinality(p.etapas) AS n_etapas, p.concluido_em, p.pulou_em,
      (SELECT t.chave FROM terreno t WHERE t.usuario_id = u.id AND t.anexo_de IS NULL AND t.status = 'ativo' ORDER BY t.reservado_em LIMIT 1) AS lote_chave
    FROM usuario u LEFT JOIN perfil_cadastro p ON p.usuario_id = u.id
    WHERE (${objetivo}::text IS NULL OR p.objetivo = ${objetivo})
      AND (${tipo}::text IS NULL OR p.tipo = ${tipo})
      AND (${nicho}::text IS NULL OR ${nicho} = ANY(p.nichos))
      AND (${uf}::text IS NULL OR p.uf = ${uf})
      AND (${situacao}::text IS NULL
        OR (${situacao} = 'completo' AND p.concluido_em IS NOT NULL)
        OR (${situacao} = 'pulou' AND p.concluido_em IS NULL AND p.pulou_em IS NOT NULL)
        OR (${situacao} = 'parcial' AND p.concluido_em IS NULL AND p.pulou_em IS NULL AND cardinality(p.etapas) > 0)
        OR (${situacao} = 'sem' AND (p.usuario_id IS NULL OR (cardinality(p.etapas) = 0 AND p.pulou_em IS NULL))))
      AND (${q} = '' OR lower(u.email) LIKE ${like} OR lower(u.nome) LIKE ${like} OR COALESCE(p.busca, '') LIKE ${like} OR lower(COALESCE(p.cidade, '')) LIKE ${like})
      AND (${de}::date IS NULL OR u.criado_em >= ${de}::date)
      AND (${ate}::date IS NULL OR u.criado_em < ${ate}::date + 1)
    ORDER BY u.criado_em DESC LIMIT ${limite}`;
  return rows.map((r) => ({
    usuarioId: r.usuarioId, email: r.email, nomeConta: r.nomeConta, criadoEm: new Date(r.criadoEm).toISOString(), objetivo: r.objetivo, tipo: r.tipo, nome: r.nome, nichos: r.nichos,
    cidade: r.cidade, uf: r.uf, atendimento: r.atendimento, oferece: r.oferece, ofereceTexto: r.ofereceTexto, procura: r.procura, procuraTexto: r.procuraTexto,
    site: r.site, instagram: r.instagram, whatsapp: r.whatsapp, publico: r.publico, apelido: r.apelido, etapas: r.nEtapas ?? 0,
    situacao: r.concluidoEm ? "completo" : r.pulouEm ? "pulou" : (r.nEtapas ?? 0) > 0 ? "parcial" : "sem",
    lote: r.loteChave ? numeroDaLoja({ chave: r.loteChave }) : null,
  }));
}
export const NOME_SITUACAO: Record<Situacao, string> = { completo: "Completo", parcial: "Em andamento", pulou: "Deixou para depois", sem: "Não respondeu" };

// CSV para abrir no Excel em português: ponto e vírgula, BOM UTF-8 e proteção contra fórmula no começo da célula
export function csvCadastros(rows: LinhaCadastro[]): string {
  const cel = (v: unknown) => { let s = String(v ?? "").replace(/\r?\n/g, " "); if (/^[=+\-@\t]/.test(s)) s = `'${s}`; return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const cab = ["Data do cadastro", "Nome da conta", "E-mail", "Situação", "Etapas respondidas", "Objetivo", "Tipo", "Nome do negócio", "Áreas", "Cidade", "UF", "Atendimento",
    "Oferece", "Oferece (descrição)", "Procura", "Procura (descrição)", "Site", "Instagram", "WhatsApp", "Perfil público", "Endereço do perfil", "Lote"];
  const linhas = rows.map((r) => [
    new Date(r.criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }), r.nomeConta, r.email, NOME_SITUACAO[r.situacao], `${r.etapas}/${ETAPAS.length}`,
    nomeObjetivo(r.objetivo), nomeTipo(r.tipo), r.nome, r.nichos.map(nomeNicho).join(", "), r.cidade, r.uf, nomeAtendimento(r.atendimento),
    r.oferece.join(", "), r.ofereceTexto, r.procura.join(", "), r.procuraTexto, r.site, r.instagram ? `@${r.instagram}` : "", r.whatsapp,
    r.publico ? "sim" : "não", r.apelido ? `https://workend.online/perfil/${r.apelido}` : "", r.lote ?? "",
  ].map(cel).join(";"));
  return "﻿" + [cab.map(cel).join(";"), ...linhas].join("\r\n") + "\r\n";
}
