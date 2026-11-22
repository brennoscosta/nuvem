// Atendente de IA no WhatsApp do lojista (WE-18, 22/11/2026). A loja conecta o número dela na WhatsApp Business Platform
// (Cloud API) pelo painel (Minha equipe › WhatsApp) e a atendente da loja (equipeCliente.ts › falarNaLoja) responde quem
// escreve, com o mesmo contexto da loja (vitrine, preços, agenda e cupons, só para consulta) e as unidades de IA da empresa.
// Sem IA ou sem unidades, sai o recado fixo do roteiro, como no site.
//  - DESLIGADO sem as variáveis de ambiente (src/server/whatsappMeta.ts). O resto do site não depende disto.
//  - Conexão: (a) cadastro incorporado da Meta (Embedded Signup), com o aplicativo da plataforma WorkEnd; (b) manual: o
//    lojista cola o identificador do número (Phone Number ID), o da conta (WABA ID) e o token permanente do usuário do
//    sistema, e o servidor confere tudo na Graph API antes de guardar. O token fica cifrado (WHATSAPP_CHAVE).
//  - Quem escreve é um visitante sem conta (WE-14): o código anon_wa_... (HMAC do número com a empresa) vai em
//    mensagem.visitante_anonimo, com a conversa em nome da conta técnica. O número fica cifrado e o dono vê só a máscara.
//  - Webhook (/api/whatsapp/webhook): hub.challenge, assinatura X-Hub-Signature-256, idempotência pelo hash do id da
//    mensagem, 200 na hora e o trabalho depois.
//  - Janela de 24 h: fora dela só sai modelo aprovado; sem modelo, não responde e avisa o dono.
//  - Transbordo: o cliente pede uma pessoa ("falar com atendente", "humano") ou o dono toca em "Assumir": a IA para de
//    responder naquela conversa por HORAS_HUMANO ou até o dono devolver; o dono responde pelo painel e a mensagem sai pelo
//    WhatsApp. Sino e celular avisam o dono (avisos.ts).
//  - Custo: cada mensagem que sai desconta o custo da Meta das unidades de IA (whatsappMeta.ts › custoMeta), além do que a
//    IA gastou na resposta. Não é preço de venda.
//  - LGPD: a exclusão de conta apaga tudo da empresa (apagarWhatsAppDaConta, chamada por exclusao.ts) e o dono apaga uma
//    conversa a pedido de quem escreveu (apagarConversa).
//  - Fora do escopo agora: envio em massa e criar modelos na Meta.
import { randomBytes, randomInt } from "node:crypto";
import { sql, migrar } from "./db";
import type { Usuario } from "./usuarios";
import { obterTerreno, terrenoDoUsuario, type Terreno } from "./terrenos";
import { empresaDoDono, garantirEmpresaDoLote, falarNaLoja, agenteIdDe } from "./equipeCliente";
import { gravarMensagem } from "./agentes";
import { avisar } from "./avisos";
import { debitarUsoIA, unidadesDoCusto } from "./unidadesIA";
import { bloqueio, contar } from "./limite";
import type { VisitanteAnonimo } from "./visitanteAnonimo";
import { numeroDaLoja } from "@/office/data/numeroLoja";
import {
  ErroWhatsApp, ErroGraph, exigirLigado, whatsappLigado, cadastroIncorporado, segredoDaPlataforma, verificacaoDaPlataforma, graph,
  cifrar, decifrar, hmacWhatsApp, hashSimples, iguais, assinaturaConfere, custoMeta, mascararNumero, paraWhatsApp, CUSTO_META_BRL, type CategoriaMeta,
} from "./whatsappMeta";

type Db = typeof sql;
export const HORAS_HUMANO = 12; // o dono (ou o pedido do cliente) tira a IA da conversa por este tempo
const JANELA_MS = 24 * 3600_000; // janela de atendimento da Meta: 24 h desde a última mensagem do cliente
export const NOME_WHATSAPP = "Cliente do WhatsApp";
const SITE = "https://workend.online";
const LIMITE_CONECTAR_HORA = 10, LIMITE_RESPOSTA_DONO_HORA = 120;
const falaTransbordo = (empresa: string) => `Certo! Vou chamar uma pessoa da equipe da ${empresa} para falar com você. Ela responde por aqui mesmo, assim que puder.`;
const FALA_SO_TEXTO = "Por enquanto eu consigo ler só mensagens de texto por aqui. Pode escrever a sua pergunta?";
const NOME_TIPO: Record<string, string> = { image: "foto", audio: "áudio", video: "vídeo", document: "documento", sticker: "figurinha", location: "localização", contacts: "contato" };
export const linkDaConversa = (contatoId: string) => `/app/equipe?aba=visitantes&visitante=${encodeURIComponent(contatoId)}`;

interface ConexaoDB {
  empresaId: string; conectadoPor: string | null; terrenoChave: string; via: "manual" | "cadastro"; phoneNumberId: string; wabaId: string;
  tokenCifrado: string; segredoAppCifrado: string | null; verificacaoHash: string | null; verificacaoCifrada: string | null;
  numeroExibido: string; nomeVerificado: string; inscrito: boolean; modeloNome: string | null; modeloIdioma: string | null; modeloCategoria: string | null;
  criadoEm: Date; atualizadoEm: Date;
}
interface ContatoDB {
  id: string; empresaId: string; numeroHash: string; numeroCifrado: string; numeroMascara: string; ultimaDoCliente: Date | null;
  humanoAte: Date | null; humanoPor: string | null; avisoJanelaEm: Date | null; criadoEm: Date; atualizadoEm: Date;
}
const janelaAberta = (ct: Pick<ContatoDB, "ultimaDoCliente">) => !!ct.ultimaDoCliente && Date.now() - new Date(ct.ultimaDoCliente).getTime() < JANELA_MS;
const comHumano = (ct: Pick<ContatoDB, "humanoAte">) => !!ct.humanoAte && new Date(ct.humanoAte).getTime() > Date.now();

// pedido de uma pessoa: "falar com atendente", "quero um humano", "me passa pra alguém", "atendente" sozinho
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export function pedeHumano(texto: string) {
  const t = semAcento(texto);
  return /\bhuman[oa]s?\b/.test(t)
    || /^(um |uma |o |a )?(atendente|pessoa|atendimento)[.!?]*$/.test(t)
    || /\b(falar|fala|falo|conversar|chamar|chama|chame|transferir|transfere|passar|passa)\b (com |para |pra |pro )?(o |a |um |uma |algum |alguma |alguem )?(atendente|pessoa|alguem|dono|dona|gerente|responsavel|vendedor|vendedora)\b/.test(t)
    || /\b(atendente|pessoa) (de verdade|real)\b/.test(t);
}

async function conexaoDaEmpresa(empId: string) {
  const [c] = await sql<ConexaoDB[]>`SELECT * FROM whatsapp_conexao WHERE empresa_id = ${empId}`;
  return c ?? null;
}
const donoDaEmpresa = async (empId: string) => (await sql<{ usuarioId: string | null }[]>`SELECT usuario_id FROM empresa WHERE id = ${empId}`)[0]?.usuarioId ?? null;

// ---------- painel do dono ----------
export async function estadoWhatsApp(u: Usuario, chave: string | null) {
  if (!whatsappLigado()) return { ligado: false as const };
  const { t, empId } = await empresaDoDono(u, chave);
  const c = await conexaoDaEmpresa(empId);
  const [n] = await sql<{ conversas: number; enviadasMes: number; unidadesMes: number }[]>`SELECT
      (SELECT count(*)::int FROM whatsapp_contato WHERE empresa_id = ${empId}) AS conversas,
      (SELECT count(*)::int FROM whatsapp_envio WHERE empresa_id = ${empId} AND criado_em >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo') AS enviadas_mes,
      (SELECT COALESCE(-sum(inclusa + comprada), 0)::int FROM ia_lancamento WHERE empresa_id = ${empId} AND tipo = 'uso' AND categoria = 'whatsapp'
         AND criado_em >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo') AS unidades_mes`;
  const servico = custoMeta("servico");
  let tokenVerificacao: string | null = null;
  try { tokenVerificacao = c?.verificacaoCifrada ? decifrar(c.verificacaoCifrada) : null; } catch { tokenVerificacao = null; }
  return {
    ligado: true as const, empresa: t.empresaNome, lote: t.chave, cadastro: cadastroIncorporado(), webhook: `${SITE}/api/whatsapp/webhook`,
    custo: { servicoBrl: servico, unidadesServico: unidadesDoCusto(servico), marketingBrl: CUSTO_META_BRL.marketing, unidadesMarketing: unidadesDoCusto(CUSTO_META_BRL.marketing), horasHumano: HORAS_HUMANO },
    conversas: n?.conversas ?? 0, enviadasMes: n?.enviadasMes ?? 0, unidadesMes: n?.unidadesMes ?? 0,
    conexao: c ? {
      via: c.via, numero: c.numeroExibido, nome: c.nomeVerificado, phoneNumberId: c.phoneNumberId, wabaId: c.wabaId, inscrito: c.inscrito, criadoEm: c.criadoEm,
      proprioAplicativo: !!c.segredoAppCifrado, tokenVerificacao,
      modelo: c.modeloNome ? { nome: c.modeloNome, idioma: c.modeloIdioma ?? "pt_BR", categoria: c.modeloCategoria ?? "marketing" } : null,
    } : null,
  };
}

function limitarConexao(uid: string) {
  const k = `whats:conectar:${uid}`;
  if (bloqueio(k, LIMITE_CONECTAR_HORA)) throw new ErroWhatsApp("Muitas tentativas de conectar em pouco tempo. Espere alguns minutos.", 429);
  contar(k, 60);
}
const soDigitos = (v: unknown, nome: string) => {
  const s = String(v ?? "").trim();
  if (!/^\d{6,25}$/.test(s)) throw new ErroWhatsApp(`Confira o ${nome}: são só números, como aparece na Meta.`);
  return s;
};
function traduzir(e: unknown, onde: "numero" | "waba" | "modelo") {
  if (!(e instanceof ErroGraph)) return e;
  if (e.http === 0) return new ErroWhatsApp(e.message, 502);
  if (e.codigo === 190 || e.http === 401) return new ErroWhatsApp("A Meta não aceitou esse token. Use o token permanente do usuário do sistema, com as permissões whatsapp_business_messaging e whatsapp_business_management.");
  if (onde === "numero") return new ErroWhatsApp("A Meta não achou esse identificador do número (Phone Number ID) com esse token.");
  return new ErroWhatsApp("A Meta não achou essa conta do WhatsApp Business (WABA ID) com esse token.");
}
// confere na Graph API que o token vale, que o número existe e que ele é dessa conta (WABA)
async function conferirNumero(token: string, pnid: string, waba: string) {
  let info: { display_phone_number?: string; verified_name?: string };
  try { info = await graph("GET", pnid, { token, query: { fields: "id,display_phone_number,verified_name,quality_rating" } }); } catch (e) { throw traduzir(e, "numero"); }
  let lista: { data?: { id?: string }[] };
  try { lista = await graph("GET", `${waba}/phone_numbers`, { token, query: { fields: "id,display_phone_number" } }); } catch (e) { throw traduzir(e, "waba"); }
  if (!(lista.data ?? []).some((x) => String(x.id) === pnid)) throw new ErroWhatsApp("Esse número não está nessa conta do WhatsApp Business. Confira o identificador da conta (WABA ID).");
  return { numero: String(info.display_phone_number ?? "").slice(0, 30), nome: String(info.verified_name ?? "").slice(0, 120) };
}
// inscreve o aplicativo no WABA (sem isso o webhook não recebe as mensagens). Falhar não impede de guardar a conexão.
async function inscreverApp(token: string, waba: string) {
  try { const r = await graph<{ success?: boolean }>("POST", `${waba}/subscribed_apps`, { token }); return r.success !== false; }
  catch (e) { console.error("[whatsapp] inscrição no WABA falhou:", (e as Error).message); return false; }
}
async function desinscrever(c: { wabaId: string; tokenCifrado: string }) {
  try { await graph("DELETE", `${c.wabaId}/subscribed_apps`, { token: decifrar(c.tokenCifrado) }); }
  catch (e) { console.error("[whatsapp] desinscrição no WABA falhou:", (e as Error).message); }
}
async function gravarConexao(d: { u: Usuario; t: Terreno; empId: string; via: "manual" | "cadastro"; pnid: string; waba: string; token: string; segredo: string | null; info: { numero: string; nome: string }; inscrito: boolean }) {
  const [outra] = await sql`SELECT 1 FROM whatsapp_conexao WHERE phone_number_id = ${d.pnid} AND empresa_id <> ${d.empId}`;
  if (outra) throw new ErroWhatsApp("Esse número já está conectado a outra loja do WorkEnd.", 409);
  // aplicativo do próprio lojista (via manual): ele cola no painel da Meta o endereço e este token de verificação
  const verificacao = d.segredo ? randomBytes(18).toString("base64url") : null;
  await sql`INSERT INTO whatsapp_conexao (empresa_id, conectado_por, terreno_chave, via, phone_number_id, waba_id, token_cifrado, segredo_app_cifrado, verificacao_hash, verificacao_cifrada, numero_exibido, nome_verificado, inscrito)
    VALUES (${d.empId}, ${d.u.id}, ${d.t.chave}, ${d.via}, ${d.pnid}, ${d.waba}, ${cifrar(d.token)}, ${d.segredo ? cifrar(d.segredo) : null}, ${verificacao ? hashSimples(verificacao) : null}, ${verificacao ? cifrar(verificacao) : null}, ${d.info.numero}, ${d.info.nome}, ${d.inscrito})
    ON CONFLICT (empresa_id) DO UPDATE SET conectado_por = EXCLUDED.conectado_por, terreno_chave = EXCLUDED.terreno_chave, via = EXCLUDED.via, phone_number_id = EXCLUDED.phone_number_id,
      modelo_nome = CASE WHEN whatsapp_conexao.waba_id = EXCLUDED.waba_id THEN whatsapp_conexao.modelo_nome END,
      modelo_idioma = CASE WHEN whatsapp_conexao.waba_id = EXCLUDED.waba_id THEN whatsapp_conexao.modelo_idioma END,
      modelo_categoria = CASE WHEN whatsapp_conexao.waba_id = EXCLUDED.waba_id THEN whatsapp_conexao.modelo_categoria END,
      waba_id = EXCLUDED.waba_id, token_cifrado = EXCLUDED.token_cifrado, segredo_app_cifrado = EXCLUDED.segredo_app_cifrado, verificacao_hash = EXCLUDED.verificacao_hash,
      verificacao_cifrada = EXCLUDED.verificacao_cifrada, numero_exibido = EXCLUDED.numero_exibido, nome_verificado = EXCLUDED.nome_verificado, inscrito = EXCLUDED.inscrito, atualizado_em = now()`;
}

// (b) manual: Phone Number ID, WABA ID e o token permanente do usuário do sistema; a chave secreta do aplicativo só quando o
// webhook vem do aplicativo do próprio lojista (sem ela, vale o aplicativo da plataforma WorkEnd)
export async function conectarManual(u: Usuario, chave: string | null, d: { phoneNumberId?: unknown; wabaId?: unknown; token?: unknown; segredoApp?: unknown }) {
  exigirLigado();
  const { t, empId } = await empresaDoDono(u, chave);
  limitarConexao(u.id);
  const pnid = soDigitos(d.phoneNumberId, "identificador do número (Phone Number ID)");
  const waba = soDigitos(d.wabaId, "identificador da conta (WABA ID)");
  const token = String(d.token ?? "").trim();
  if (token.length < 20 || token.length > 2000 || /\s/.test(token)) throw new ErroWhatsApp("Cole o token permanente do usuário do sistema inteiro, sem espaços.");
  const segredo = String(d.segredoApp ?? "").trim();
  if (segredo && !/^[a-f0-9]{32}$/i.test(segredo)) throw new ErroWhatsApp("A chave secreta do aplicativo (App Secret) tem 32 letras e números. Confira ou deixe em branco.");
  if (!segredo && !segredoDaPlataforma()) throw new ErroWhatsApp("Sem o aplicativo da plataforma WorkEnd ligado, informe a chave secreta do seu aplicativo (App Secret) para o WorkEnd conferir as mensagens.");
  const info = await conferirNumero(token, pnid, waba);
  const inscrito = await inscreverApp(token, waba);
  await gravarConexao({ u, t, empId, via: "manual", pnid, waba, token, segredo: segredo ? segredo.toLowerCase() : null, info, inscrito });
  return estadoWhatsApp(u, t.chave);
}

// (a) cadastro incorporado: a tela abre a janela da Meta (FB.login com o config_id) e manda o código e os ids que a
// janela devolveu; o servidor troca o código pelo token da loja com o segredo do aplicativo da plataforma
export async function conectarPeloCadastro(u: Usuario, chave: string | null, d: { code?: unknown; phoneNumberId?: unknown; wabaId?: unknown }) {
  exigirLigado();
  const cfg = cadastroIncorporado();
  if (!cfg) throw new ErroWhatsApp("O cadastro pela Meta ainda não está ligado no WorkEnd. Use a conexão manual.", 404);
  const { t, empId } = await empresaDoDono(u, chave);
  limitarConexao(u.id);
  const code = String(d.code ?? "").trim();
  if (!/^[A-Za-z0-9_.#-]{10,2000}$/.test(code)) throw new ErroWhatsApp("A Meta não devolveu o código do cadastro. Tente conectar de novo.");
  const pnid = soDigitos(d.phoneNumberId, "identificador do número"), waba = soDigitos(d.wabaId, "identificador da conta");
  let token = "";
  try { token = String((await graph<{ access_token?: string }>("GET", "oauth/access_token", { query: { client_id: cfg.appId, client_secret: segredoDaPlataforma() ?? "", code } })).access_token ?? ""); }
  catch (e) { console.error("[whatsapp] troca do código do cadastro:", (e as Error).message); }
  if (!token) throw new ErroWhatsApp("A Meta não aceitou o código do cadastro (ele vale poucos minutos). Tente conectar de novo.");
  const info = await conferirNumero(token, pnid, waba);
  const inscrito = await inscreverApp(token, waba);
  // número novo no cadastro precisa ser registrado na Cloud API. O PIN de duas etapas é sorteado e não fica guardado (o
  // dono troca no Gerenciador do WhatsApp se precisar); número que já estava registrado devolve erro e segue assim mesmo.
  await graph("POST", `${pnid}/register`, { token, corpo: { messaging_product: "whatsapp", pin: String(randomInt(100000, 1000000)) } })
    .catch((e: Error) => console.error("[whatsapp] registro do número:", e.message));
  await gravarConexao({ u, t, empId, via: "cadastro", pnid, waba, token, segredo: null, info, inscrito });
  return estadoWhatsApp(u, t.chave);
}

// desconectar: o WorkEnd esquece o token. Com o aplicativo da plataforma, também sai da inscrição do WABA; o aplicativo
// do próprio lojista fica como está (ele pode usar para outras coisas). As conversas continuam no histórico.
export async function desconectar(u: Usuario, chave: string | null) {
  exigirLigado();
  const { t, empId } = await empresaDoDono(u, chave);
  const c = await conexaoDaEmpresa(empId);
  if (c && !c.segredoAppCifrado) await desinscrever(c);
  await sql`DELETE FROM whatsapp_conexao WHERE empresa_id = ${empId}`;
  return estadoWhatsApp(u, t.chave);
}

// modelo aprovado na Meta (criado lá, fora do WorkEnd) para quando a conversa passou de 24 h. Só modelo sem campos.
export async function salvarModelo(u: Usuario, chave: string | null, d: { nome?: unknown; idioma?: unknown }) {
  exigirLigado();
  const { t, empId } = await empresaDoDono(u, chave);
  const c = await conexaoDaEmpresa(empId);
  if (!c) throw new ErroWhatsApp("Conecte o WhatsApp da loja antes.", 404);
  const nome = String(d.nome ?? "").trim().toLowerCase();
  if (!nome) {
    await sql`UPDATE whatsapp_conexao SET modelo_nome = NULL, modelo_idioma = NULL, modelo_categoria = NULL, atualizado_em = now() WHERE empresa_id = ${empId}`;
    return estadoWhatsApp(u, t.chave);
  }
  if (!/^[a-z0-9_]{1,512}$/.test(nome)) throw new ErroWhatsApp("O nome do modelo tem só letras minúsculas, números e _, como aparece na Meta.");
  const idioma = String(d.idioma ?? "").trim() || "pt_BR";
  if (!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(idioma)) throw new ErroWhatsApp("Escreva o idioma no formato da Meta, como pt_BR.");
  let r: { data?: { name?: string; language?: string; status?: string; category?: string; components?: unknown }[] };
  try { r = await graph("GET", `${c.wabaId}/message_templates`, { token: decifrar(c.tokenCifrado), query: { name: nome, fields: "name,language,status,category,components", limit: "50" } }); }
  catch (e) { throw traduzir(e, "modelo"); }
  const m = (r.data ?? []).find((x) => x.name === nome && x.language === idioma);
  if (!m) throw new ErroWhatsApp(`A Meta não tem o modelo "${nome}" em ${idioma} nessa conta.`, 404);
  if (String(m.status ?? "").toUpperCase() !== "APPROVED") throw new ErroWhatsApp(`O modelo "${nome}" ainda não foi aprovado pela Meta (situação: ${String(m.status ?? "desconhecida").toLowerCase()}).`, 409);
  if (/\{\{\s*[\w.]+\s*\}\}/.test(JSON.stringify(m.components ?? []))) throw new ErroWhatsApp("Use um modelo sem campos variáveis (sem {{1}}): o WorkEnd manda o modelo como ele está.");
  const cat = String(m.category ?? "").toUpperCase();
  if (cat === "AUTHENTICATION") throw new ErroWhatsApp("Modelo de autenticação (código de acesso) não serve para retomar a conversa. Use um de utilidade.");
  const categoria: CategoriaMeta = cat === "UTILITY" ? "utilidade" : "marketing"; // desconhecida: a tarifa mais alta
  await sql`UPDATE whatsapp_conexao SET modelo_nome = ${nome}, modelo_idioma = ${idioma}, modelo_categoria = ${categoria}, atualizado_em = now() WHERE empresa_id = ${empId}`;
  return estadoWhatsApp(u, t.chave);
}

// ---------- uma conversa, vista pelo dono ----------
async function contatoDoDono(u: Usuario, chave: string | null, contatoId: unknown) {
  exigirLigado();
  const { t, empId } = await empresaDoDono(u, chave);
  const [ct] = await sql<ContatoDB[]>`SELECT * FROM whatsapp_contato WHERE id = ${String(contatoId ?? "")} AND empresa_id = ${empId}`;
  if (!ct) throw new ErroWhatsApp("Essa conversa do WhatsApp não existe mais.", 404);
  return { t, empId, ct };
}
const atendenteDe = (t: Terreno) => t.escritorio?.equipe.find((m) => m.papel === "atendente") ?? null;
function situacao(ct: ContatoDB, c: ConexaoDB | null) {
  return {
    id: ct.id, numero: ct.numeroMascara, conectado: !!c, modelo: c?.modeloNome ?? null,
    humanoAte: comHumano(ct) ? ct.humanoAte : null, humanoPor: comHumano(ct) ? ct.humanoPor : null,
    janelaAberta: janelaAberta(ct), janelaAte: ct.ultimaDoCliente ? new Date(new Date(ct.ultimaDoCliente).getTime() + JANELA_MS) : null,
  };
}
export async function situacaoDoContato(u: Usuario, chave: string | null, contatoId: unknown) {
  const { empId, ct } = await contatoDoDono(u, chave, contatoId);
  return situacao(ct, await conexaoDaEmpresa(empId));
}
// "Assumir": a IA para de responder nesta conversa por HORAS_HUMANO (ou até "Devolver")
export async function assumirConversa(u: Usuario, chave: string | null, contatoId: unknown) {
  const { empId, ct } = await contatoDoDono(u, chave, contatoId);
  const [x] = await sql<ContatoDB[]>`UPDATE whatsapp_contato SET humano_ate = now() + make_interval(hours => ${HORAS_HUMANO}), humano_por = 'dono', atualizado_em = now() WHERE id = ${ct.id} RETURNING *`;
  return situacao(x, await conexaoDaEmpresa(empId));
}
export async function devolverConversa(u: Usuario, chave: string | null, contatoId: unknown) {
  const { empId, ct } = await contatoDoDono(u, chave, contatoId);
  const [x] = await sql<ContatoDB[]>`UPDATE whatsapp_contato SET humano_ate = NULL, humano_por = NULL, atualizado_em = now() WHERE id = ${ct.id} RETURNING *`;
  return situacao(x, await conexaoDaEmpresa(empId));
}
// o dono responde pelo painel: sai pelo WhatsApp (só dentro da janela) e a IA fica fora da conversa por HORAS_HUMANO
export async function responderPeloPainel(u: Usuario, chave: string | null, contatoId: unknown, texto: unknown) {
  const { t, empId, ct } = await contatoDoDono(u, chave, contatoId);
  const fala = String(texto ?? "").trim().slice(0, 4000);
  if (!fala) throw new ErroWhatsApp("Escreva a resposta.");
  const k = `whats:dono:${u.id}`;
  if (bloqueio(k, LIMITE_RESPOSTA_DONO_HORA)) throw new ErroWhatsApp("Muitas respostas em pouco tempo. Espere alguns minutos.", 429);
  const c = await conexaoDaEmpresa(empId);
  if (!c) throw new ErroWhatsApp("O WhatsApp da loja está desconectado. Conecte de novo na aba WhatsApp.", 409);
  if (!janelaAberta(ct)) throw new ErroWhatsApp(`Faz mais de 24 horas que o cliente escreveu. Agora o WhatsApp só deixa mandar um modelo aprovado${c.modeloNome ? ": use \"Mandar o modelo\"" : ": configure um na aba WhatsApp"}.`, 409);
  const at = atendenteDe(t);
  if (!at) throw new ErroWhatsApp("A loja está sem atendente no escritório.", 409);
  contar(k, 60);
  const aid = agenteIdDe(empId, at.id);
  const h = await enviarTexto(c, ct, fala, { quem: "dono", agenteId: aid }).catch((e: Error) => { throw new ErroWhatsApp(`A Meta não aceitou a mensagem: ${e.message}`, 502); });
  const m = await gravarMensagem({ agenteId: aid, papel: "assistant", autor: `dono:${u.id}`, conteudo: fala, visitanteId: ct.id });
  await sql`UPDATE whatsapp_envio SET mensagem_id = ${m.id} WHERE wamid_hash = ${h}`;
  const [x] = await sql<ContatoDB[]>`UPDATE whatsapp_contato SET humano_ate = GREATEST(COALESCE(humano_ate, now()), now() + make_interval(hours => ${HORAS_HUMANO})), humano_por = COALESCE(CASE WHEN humano_ate > now() THEN humano_por END, 'dono'), atualizado_em = now() WHERE id = ${ct.id} RETURNING *`;
  return { mensagem: { id: m.id, papel: "assistant", conteudo: m.conteudo, quem: "Você", criadoEm: m.criadoEm }, situacao: situacao(x, c) };
}
// fora da janela: o dono manda o modelo aprovado (a conversa recomeça quando o cliente responder)
export async function modeloPeloPainel(u: Usuario, chave: string | null, contatoId: unknown) {
  const { t, empId, ct } = await contatoDoDono(u, chave, contatoId);
  const c = await conexaoDaEmpresa(empId);
  if (!c) throw new ErroWhatsApp("O WhatsApp da loja está desconectado. Conecte de novo na aba WhatsApp.", 409);
  if (!c.modeloNome) throw new ErroWhatsApp("Configure um modelo aprovado na aba WhatsApp antes.", 409);
  const at = atendenteDe(t);
  if (!at) throw new ErroWhatsApp("A loja está sem atendente no escritório.", 409);
  await enviarModelo(c, ct, agenteIdDe(empId, at.id), { quem: "dono", autor: `dono:${u.id}` }).catch((e: Error) => { throw new ErroWhatsApp(`A Meta não aceitou o modelo: ${e.message}`, 502); });
  return situacao(ct, c);
}
// LGPD: quem escreveu pede para apagar. Some a conversa, o número cifrado, os registros e os avisos que citam a conversa.
export async function apagarConversa(u: Usuario, chave: string | null, contatoId: unknown) {
  const { empId, ct } = await contatoDoDono(u, chave, contatoId);
  const r = await sql.begin(async (tx) => {
    const db = tx as unknown as Db;
    const m = await db`DELETE FROM mensagem m USING agente a WHERE a.id = m.agente_id AND a.empresa_id = ${empId} AND m.visitante_anonimo = ${ct.id}`;
    await db`DELETE FROM aviso WHERE position(${ct.id} in ref) > 0 OR position(${ct.id} in COALESCE(link, '')) > 0`;
    await db`DELETE FROM whatsapp_contato WHERE id = ${ct.id}`; // recebidas e envios vão junto (ON DELETE CASCADE)
    return m.count;
  });
  return { apagadas: r };
}

// ---------- envio pela Cloud API ----------
type RespostaEnvio = { messages?: { id?: string }[] };
async function registrarEnvio(c: ConexaoDB, ct: ContatoDB, r: RespostaEnvio, d: { quem: string; tipo: "texto" | "modelo"; categoria: CategoriaMeta; mensagemId?: string | null; agenteId: string }) {
  const wamid = String(r.messages?.[0]?.id ?? "");
  const h = hashSimples(wamid || `sem-id:${randomBytes(12).toString("hex")}`); // o id da Meta carrega o número: só o hash
  const custo = custoMeta(d.categoria);
  await sql`INSERT INTO whatsapp_envio (wamid_hash, empresa_id, contato_id, mensagem_id, quem, tipo, categoria, custo_brl)
    VALUES (${h}, ${c.empresaId}, ${ct.id}, ${d.mensagemId ?? null}, ${d.quem}, ${d.tipo}, ${d.categoria}, ${custo}) ON CONFLICT (wamid_hash) DO NOTHING`;
  // o custo da Meta sai das unidades de IA da empresa, como o da própria IA (unidadesIA.ts, categoria whatsapp)
  if (custo > 0) await debitarUsoIA({ agenteId: d.agenteId, modelo: `whatsapp-${d.categoria}`, custoBrl: custo, categoria: "whatsapp" });
  return h;
}
async function enviarTexto(c: ConexaoDB, ct: ContatoDB, texto: string, d: { quem: string; agenteId: string; mensagemId?: string | null }) {
  const r = await graph<RespostaEnvio>("POST", `${c.phoneNumberId}/messages`, { token: decifrar(c.tokenCifrado), corpo: {
    messaging_product: "whatsapp", recipient_type: "individual", to: decifrar(ct.numeroCifrado), type: "text", text: { preview_url: false, body: paraWhatsApp(texto) },
  } });
  return registrarEnvio(c, ct, r, { quem: d.quem, tipo: "texto", categoria: "servico", mensagemId: d.mensagemId, agenteId: d.agenteId });
}
async function enviarModelo(c: ConexaoDB, ct: ContatoDB, agenteId: string, d: { quem: string; autor: string }) {
  const nome = c.modeloNome!, idioma = c.modeloIdioma ?? "pt_BR";
  const r = await graph<RespostaEnvio>("POST", `${c.phoneNumberId}/messages`, { token: decifrar(c.tokenCifrado), corpo: {
    messaging_product: "whatsapp", recipient_type: "individual", to: decifrar(ct.numeroCifrado), type: "template", template: { name: nome, language: { code: idioma } },
  } });
  const m = await gravarMensagem({ agenteId, papel: "assistant", autor: d.autor, conteudo: `(Modelo aprovado "${nome}" enviado pelo WhatsApp: a conversa passou de 24 horas e recomeça quando o cliente responder.)`, visitanteId: ct.id });
  return registrarEnvio(c, ct, r, { quem: d.quem, tipo: "modelo", categoria: (c.modeloCategoria as CategoriaMeta | null) ?? "marketing", mensagemId: m.id, agenteId });
}

// ---------- webhook ----------
interface MsgMeta { id?: string; from?: string; timestamp?: string; type?: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } } }
interface StatusMeta { id?: string; status?: string; errors?: { code?: number; title?: string; message?: string }[] }
interface ValorMeta { metadata?: { phone_number_id?: string }; messages?: MsgMeta[]; statuses?: StatusMeta[] }

// GET: a Meta confere o endereço. Vale o token da plataforma ou o de uma conexão manual com aplicativo próprio.
export async function verificarWebhook(p: URLSearchParams): Promise<string | null> {
  if (!whatsappLigado() || p.get("hub.mode") !== "subscribe") return null;
  const tk = p.get("hub.verify_token") ?? "", desafio = p.get("hub.challenge") ?? "";
  if (!tk || !desafio || desafio.length > 200) return null;
  const daPlataforma = verificacaoDaPlataforma();
  if (daPlataforma && iguais(tk, daPlataforma)) return desafio;
  await migrar();
  const [c] = await sql`SELECT 1 FROM whatsapp_conexao WHERE verificacao_hash = ${hashSimples(tk)}`;
  return c ? desafio : null;
}

const decifrarOuNada = (s: string) => { try { return decifrar(s); } catch { return ""; } };
// POST: confere a assinatura, marca cada mensagem nova (idempotência) e devolve o trabalho para depois do 200
export async function receberWebhook(bruto: Buffer, assinatura: string | null): Promise<{ status: number; depois?: () => Promise<void> }> {
  if (!whatsappLigado()) return { status: 404 };
  let corpo: { entry?: { changes?: { field?: string; value?: ValorMeta }[] }[] };
  try { corpo = JSON.parse(bruto.toString("utf8")); } catch { return { status: 400 }; }
  await migrar();
  const valores = (Array.isArray(corpo?.entry) ? corpo.entry : []).flatMap((e) => (Array.isArray(e?.changes) ? e.changes : [])).filter((ch) => ch?.field === "messages" && ch.value).map((ch) => ch.value!);
  const pnids = [...new Set(valores.map((v) => String(v.metadata?.phone_number_id ?? "")).filter((x) => /^\d{1,25}$/.test(x)))];
  const conexoes = pnids.length ? await sql<ConexaoDB[]>`SELECT * FROM whatsapp_conexao WHERE phone_number_id = ANY(${sql.array(pnids)}::text[])` : [];
  // a assinatura é do aplicativo que recebeu: o da plataforma (META_APP_SECRET) ou, na via manual, o do próprio lojista
  const sp = segredoDaPlataforma();
  const daPlataforma = !!sp && assinaturaConfere(bruto, assinatura, sp);
  const proprios = new Set(conexoes.filter((c) => c.segredoAppCifrado && assinaturaConfere(bruto, assinatura, decifrarOuNada(c.segredoAppCifrado))).map((c) => c.empresaId));
  if (!daPlataforma && !proprios.size) { console.error("[whatsapp] webhook com assinatura inválida: recusado"); return { status: 401 }; }
  const tarefas: (() => Promise<void>)[] = [];
  for (const v of valores) {
    const c = conexoes.find((x) => x.phoneNumberId === String(v.metadata?.phone_number_id ?? ""));
    if (!c) continue;
    if (c.segredoAppCifrado ? !proprios.has(c.empresaId) : !daPlataforma) continue; // assinado por outro aplicativo: não vale para este número
    for (const m of Array.isArray(v.messages) ? v.messages : []) {
      if (typeof m?.id !== "string" || !m.id || typeof m.from !== "string") continue;
      const [novo] = await sql`INSERT INTO whatsapp_recebida (wamid_hash, empresa_id) VALUES (${hashSimples(m.id)}, ${c.empresaId}) ON CONFLICT (wamid_hash) DO NOTHING RETURNING wamid_hash`;
      if (novo) tarefas.push(() => processarMensagem(c, m));
    }
    for (const s of Array.isArray(v.statuses) ? v.statuses : []) if (typeof s?.id === "string") tarefas.push(() => processarStatus(c, s));
  }
  return { status: 200, depois: tarefas.length ? async () => { for (const f of tarefas) await f().catch((e: Error) => console.error("[whatsapp] processar:", e.message)); } : undefined };
}

// a loja da conexão; se o dono trocou de chão (a empresa é da conta), segue para o lote ativo da mesma conta
async function loteDaConexao(c: ConexaoDB): Promise<Terreno | null> {
  let t = await obterTerreno(c.terrenoChave);
  if (t?.anexoDe) t = await obterTerreno(t.anexoDe);
  if (t && t.status === "ativo") return t;
  const dono = await donoDaEmpresa(c.empresaId);
  const novo = dono ? await terrenoDoUsuario(dono).catch(() => null) : null;
  if (novo && novo.status === "ativo" && (await garantirEmpresaDoLote(novo)) === c.empresaId) {
    await sql`UPDATE whatsapp_conexao SET terreno_chave = ${novo.chave} WHERE empresa_id = ${c.empresaId}`;
    return novo;
  }
  return t ?? null;
}
async function garantirContato(empId: string, waId: string, em: Date): Promise<ContatoDB> {
  const h = hmacWhatsApp(`numero:${empId}:${waId}`);
  const [ct] = await sql<ContatoDB[]>`INSERT INTO whatsapp_contato (id, empresa_id, numero_hash, numero_cifrado, numero_mascara, ultima_do_cliente)
    VALUES (${`anon_wa_${h.slice(0, 16)}`}, ${empId}, ${h}, ${cifrar(waId)}, ${mascararNumero(waId)}, ${em})
    ON CONFLICT (empresa_id, numero_hash) DO UPDATE SET ultima_do_cliente = GREATEST(whatsapp_contato.ultima_do_cliente, EXCLUDED.ultima_do_cliente), atualizado_em = now()
    RETURNING *`;
  return ct;
}
const textoDe = (m: MsgMeta) => {
  const t = m.type === "text" ? m.text?.body : m.type === "button" ? m.button?.text : m.type === "interactive" ? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title : null;
  return typeof t === "string" && t.trim() ? t.trim().slice(0, 800) : null;
};

async function processarMensagem(c: ConexaoDB, m: MsgMeta) {
  const hm = hashSimples(m.id!);
  const marcar = (status: string, contatoId?: string) => sql`UPDATE whatsapp_recebida SET status = ${status}, contato_id = COALESCE(${contatoId ?? null}, contato_id) WHERE wamid_hash = ${hm}`;
  const waId = String(m.from).replace(/\D/g, "").slice(0, 20);
  if (waId.length < 8) { await marcar("erro"); return; }
  const em = Number(m.timestamp) > 0 ? new Date(Number(m.timestamp) * 1000) : new Date();
  const ct = await garantirContato(c.empresaId, waId, em);
  await marcar("recebida", ct.id);
  const t = await loteDaConexao(c);
  const numero = t && t.status === "ativo" ? numeroDaLoja(t) : null;
  const at = t ? atendenteDe(t) : null;
  if (!t || numero == null || !at) {
    await marcar("sem_resposta");
    const dono = t?.usuarioId ?? (await donoDaEmpresa(c.empresaId));
    void avisar(dono, { tipo: "sistema", ref: `whats:parada:${c.empresaId}:${new Date().toISOString().slice(0, 10)}`, titulo: "Mensagem no WhatsApp sem resposta", texto: !t || numero == null ? "O lote da loja não está ativo: a atendente não responde pelo WhatsApp até ele voltar." : "A loja está sem atendente no escritório: ninguém respondeu pelo WhatsApp.", link: "/app/equipe?aba=whatsapp" });
    return;
  }
  const aid = agenteIdDe(c.empresaId, at.id);
  const texto = textoDe(m);
  const fala = texto ?? `(O cliente mandou ${NOME_TIPO[String(m.type)] ?? "uma mensagem"} pelo WhatsApp.)`;
  const link = linkDaConversa(ct.id);
  const gravarDele = () => gravarMensagem({ agenteId: aid, papel: "user", autor: `visitante:${ct.id}`, conteudo: fala, visitanteId: ct.id });
  // sino e celular do dono: uma conversa = um aviso, que volta ao topo a cada mensagem nova (como no site)
  const avisarDono = (titulo: string) => avisar(t.usuarioId, { tipo: "loja", ref: `loja:${ct.id}`, renovar: true, titulo, texto: fala.slice(0, 140), link });
  const enviar = async (txt: string, quem: string, mensagemId: string | null) => {
    try { await enviarTexto(c, ct, txt, { quem, agenteId: aid, mensagemId }); return true; }
    catch (e) {
      console.error("[whatsapp] envio recusado pela Meta:", (e as Error).message);
      void avisar(t.usuarioId, { tipo: "sistema", ref: `whats:erro:${ct.id}`, renovar: true, titulo: "A resposta do WhatsApp não saiu", texto: `A Meta recusou a mensagem para ${ct.numeroMascara}: ${(e as Error).message.slice(0, 160)}`, link });
      return false;
    }
  };

  // 1) a Meta entregou depois de 24 h (o webhook atrasou): só modelo aprovado; sem modelo, não responde e avisa o dono
  if (Date.now() - em.getTime() >= JANELA_MS) {
    await gravarDele();
    if (c.modeloNome) {
      const ok = await enviarModelo(c, ct, aid, { quem: "modelo", autor: `agente:${aid}` }).then(() => true, (e: Error) => { console.error("[whatsapp] modelo recusado:", e.message); return false; });
      await marcar(ok ? "respondida" : "erro");
      return;
    }
    if (!ct.avisoJanelaEm || Date.now() - new Date(ct.avisoJanelaEm).getTime() > 6 * 3600_000) {
      await sql`UPDATE whatsapp_contato SET aviso_janela_em = now() WHERE id = ${ct.id}`;
      await avisar(t.usuarioId, { tipo: "sistema", ref: `whats:janela:${ct.id}`, renovar: true, titulo: "Conversa do WhatsApp fora da janela de 24 horas", texto: `${ct.numeroMascara} escreveu, mas a mensagem chegou depois de 24 horas. Sem um modelo aprovado, ninguém pode responder: configure um na aba WhatsApp.`, link: "/app/equipe?aba=whatsapp" });
    }
    await marcar("sem_resposta");
    return;
  }
  // 2) foto, áudio, figurinha…: a atendente lê só texto por enquanto
  if (!texto) {
    await gravarDele();
    const r = await gravarMensagem({ agenteId: aid, papel: "assistant", autor: `agente:${aid}`, conteudo: FALA_SO_TEXTO, visitanteId: ct.id });
    await marcar((await enviar(FALA_SO_TEXTO, "aviso", r.id)) ? "respondida" : "erro");
    void avisarDono(`${ct.numeroMascara} falou com a sua atendente pelo WhatsApp`);
    return;
  }
  // 3) transbordo pedido pelo cliente: resposta fixa, a IA sai da conversa por HORAS_HUMANO e o dono é avisado
  if (pedeHumano(texto)) {
    await gravarDele();
    const fixo = falaTransbordo(t.empresaNome);
    const r = await gravarMensagem({ agenteId: aid, papel: "assistant", autor: `agente:${aid}`, conteudo: fixo, visitanteId: ct.id });
    await sql`UPDATE whatsapp_contato SET humano_ate = now() + make_interval(hours => ${HORAS_HUMANO}), humano_por = 'cliente', atualizado_em = now() WHERE id = ${ct.id}`;
    await marcar((await enviar(fixo, "transbordo", r.id)) ? "respondida" : "erro");
    await avisar(t.usuarioId, { tipo: "loja", ref: `whats:humano:${ct.id}`, renovar: true, titulo: `${ct.numeroMascara} pediu para falar com uma pessoa no WhatsApp`, texto: `"${texto.slice(0, 110)}" A atendente parou de responder nesta conversa por ${HORAS_HUMANO} horas: responda pelo painel.`, link });
    return;
  }
  // 4) conversa com uma pessoa (o dono assumiu ou o cliente pediu): a IA não responde, só guarda e avisa
  if (comHumano(ct)) {
    await gravarDele();
    await marcar("sem_resposta");
    void avisarDono(`${ct.numeroMascara} escreveu na conversa do WhatsApp que está com você`);
    return;
  }
  // 5) a atendente da loja, com o contexto de sempre e as unidades de IA da empresa (sem IA: o recado fixo do roteiro)
  const visitante: VisitanteAnonimo = { anonimo: true, id: ct.id, nome: NOME_WHATSAPP, canal: "whatsapp" };
  let r: Awaited<ReturnType<typeof falarNaLoja>>;
  try { r = await falarNaLoja(visitante, numero, texto, null, null); }
  catch (e) {
    // limite de mensagens por conversa ou loja fechada: guarda o que ele disse e não responde
    console.error("[whatsapp] atendente não respondeu:", (e as Error).message);
    await gravarDele().catch(() => null);
    await marcar("sem_resposta");
    return;
  }
  await marcar((await enviar(r.conteudo, "ia", r.id)) ? "respondida" : "erro");
  void avisarDono(`${ct.numeroMascara} falou com a sua atendente pelo WhatsApp`);
}

const ORDEM_STATUS: Record<string, number> = { enviada: 1, entregue: 2, lida: 3, falhou: 9 };
async function processarStatus(c: ConexaoDB, s: StatusMeta) {
  const st = ({ sent: "enviada", delivered: "entregue", read: "lida", failed: "falhou" } as Record<string, string>)[String(s.status)];
  if (!st) return;
  const e0 = Array.isArray(s.errors) ? s.errors[0] : null;
  const erro = e0 ? `${e0.code ?? ""} ${e0.title ?? e0.message ?? ""}`.trim().slice(0, 200) : null;
  const [x] = await sql<{ contatoId: string | null }[]>`UPDATE whatsapp_envio SET status = ${st}, erro = COALESCE(${erro}, erro), atualizado_em = now()
    WHERE wamid_hash = ${hashSimples(s.id!)} AND empresa_id = ${c.empresaId}
      AND (CASE status WHEN 'enviada' THEN 1 WHEN 'entregue' THEN 2 WHEN 'lida' THEN 3 ELSE 9 END) < ${ORDEM_STATUS[st]} RETURNING contato_id`;
  if (x && st === "falhou") {
    const dono = await donoDaEmpresa(c.empresaId);
    void avisar(dono, { tipo: "sistema", ref: `whats:falhou:${x.contatoId ?? c.empresaId}`, renovar: true, titulo: "Uma mensagem do WhatsApp não chegou ao cliente", texto: erro ? `A Meta respondeu: ${erro}` : "A Meta não entregou a mensagem.", link: x.contatoId ? linkDaConversa(x.contatoId) : "/app/equipe?aba=whatsapp" });
  }
}

// ---------- exclusão de conta (exclusao.ts, LGPD) ----------
// Dentro da transação da exclusão: apaga a conexão (com o token cifrado), quem escreveu (número cifrado), as conversas
// recebidas pelo WhatsApp e os registros de recebidas e envios das empresas da conta. Devolve as contagens e o que
// desinscrever na Meta depois que a transação fechar (só com o aplicativo da plataforma).
export async function apagarWhatsAppDaConta(db: Db, empresas: string[]) {
  const E = db.array(empresas);
  const conexoes = await db<{ wabaId: string; tokenCifrado: string; segredoAppCifrado: string | null }[]>`SELECT waba_id, token_cifrado, segredo_app_cifrado FROM whatsapp_conexao WHERE empresa_id = ANY(${E}::text[])`;
  const mensagens = await db`DELETE FROM mensagem m USING whatsapp_contato w WHERE w.empresa_id = ANY(${E}::text[]) AND m.visitante_anonimo = w.id`;
  const contatos = await db`DELETE FROM whatsapp_contato WHERE empresa_id = ANY(${E}::text[])`;
  await db`DELETE FROM whatsapp_recebida WHERE empresa_id = ANY(${E}::text[])`;
  await db`DELETE FROM whatsapp_envio WHERE empresa_id = ANY(${E}::text[])`;
  const cx = await db`DELETE FROM whatsapp_conexao WHERE empresa_id = ANY(${E}::text[])`;
  return { conexoes: cx.count, contatos: contatos.count, mensagens: mensagens.count, desinscrever: conexoes.filter((c) => !c.segredoAppCifrado).map((c) => ({ wabaId: c.wabaId, tokenCifrado: c.tokenCifrado })) };
}
export function desinscreverDepois(lista: { wabaId: string; tokenCifrado: string }[]) { for (const c of lista) void desinscrever(c); }
// o que a tela de exclusão mostra antes de confirmar
export async function whatsAppDaConta(uid: string) {
  const [c] = await sql<{ numero: string }[]>`SELECT numero_exibido AS numero FROM whatsapp_conexao WHERE empresa_id IN (SELECT id FROM empresa WHERE usuario_id = ${uid}) LIMIT 1`;
  return c ?? null;
}
