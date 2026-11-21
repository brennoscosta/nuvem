// E-mails do WorkEnd pelo SendGrid. Liga com SENDGRID_API_KEY + EMAIL_REMETENTE (remetente verificado no SendGrid, por
// exemplo "WorkEnd <avisos@workend.online>") no CapRover; sem os dois, o envio só fica registrado em email_enviado
// (status sem_chave) pra conferir no admin. Nenhum endereço fica escrito no código: o remetente vem só da variável.
// Os modelos (assunto + corpo com {{variaveis}}) têm um padrão aqui e podem ser editados no /app/admin (tabela email_modelo).
// WE-17 (21/11/2026): todo e-mail sai em HTML e em texto puro, com a mesma moldura (logotipo, cartão branco e rodapé com a
// identificação da empresa de src/app/workend/_empresa.ts). Os de ciclo de vida (CICLO_DE_VIDA: loja incompleta, resumo da
// semana e unidades de IA) levam o link assinado para a página de preferências (/emails, sem login) e os cabeçalhos
// List-Unsubscribe e List-Unsubscribe-Post (descadastro de um clique); quem saiu deixa de recebê-los na hora. Os da conta
// (boas-vindas, reserva, pagamento, vencimento, senha) continuam saindo. A agenda dos de ciclo de vida fica em
// ./emailsCiclo.ts. SENDGRID_API_BASE troca o endereço da API, só para o SendGrid falso dos testes.
import { createHmac, timingSafeEqual } from "node:crypto";
import { sql, id, migrar } from "./db";
import { segredoSessao } from "./segredo";
import { identificacao } from "@/app/workend/_empresa";

const SITE = "https://workend.online";

// "WorkEnd <avisos@workend.online>" ou só "avisos@workend.online" (aí o nome fica WorkEnd)
export function remetente(): { email: string; name: string } | null {
  const v = process.env.EMAIL_REMETENTE?.trim(); if (!v) return null;
  const m = v.match(/^"?([^"<]*?)"?\s*<\s*([^<>\s]+)\s*>$/);
  const email = (m ? m[2] : v).trim(), name = (m ? m[1].trim() : "") || "WorkEnd";
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email) ? { email, name } : null;
}
export const emailLigado = () => !!process.env.SENDGRID_API_KEY?.trim() && !!remetente();
export const REMETENTE = () => process.env.EMAIL_REMETENTE?.trim() || "não configurado";
const apiSendgrid = () => (process.env.SENDGRID_API_BASE?.trim() || "https://api.sendgrid.com").replace(/\/+$/, "");

export type ChaveEmail = "cadastro" | "reserva" | "pagamento" | "vencimento" | "contato" | "atividade" | "senha" | "loja_dia2" | "loja_dia5" | "resumo" | "ia_80" | "ia_100";
export interface ModeloEmail { chave: ChaveEmail; nome: string; quando: string; variaveis: string[]; assunto: string; html: string }
type Vars = Record<string, string | number | null | undefined>;

// e-mails de ciclo de vida: cada um pertence a uma das 3 escolhas da página de preferências
export type CategoriaEmail = "dicas" | "resumo" | "unidades";
export const CICLO_DE_VIDA: Partial<Record<ChaveEmail, CategoriaEmail>> = { loja_dia2: "dicas", loja_dia5: "dicas", resumo: "resumo", ia_80: "unidades", ia_100: "unidades" };
export const CATEGORIAS_EMAIL: { id: CategoriaEmail; titulo: string; texto: string }[] = [
  { id: "dicas", titulo: "Dicas para completar a loja", texto: "No 2º e no 5º dia depois de a loja abrir, se ainda faltar algum item." },
  { id: "resumo", titulo: "Resumo da semana", texto: "Toda segunda: visitas e conversas da loja nos últimos 7 dias." },
  { id: "unidades", titulo: "Unidades de IA acabando", texto: "Quando a equipe usar 80% e 100% das unidades do mês." },
];

const FONTE = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const btn = (texto: string, href: string) => `<p style="margin:24px 0"><a href="${href}" style="display:inline-block;background:#0A6CFF;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">${texto}</a></p>`;
const titulo = (t: string) => `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${t}</h1>`;
const nota = (t: string) => `<p style="margin:0;color:#5B6472;font-size:14px">${t}</p>`;
const numero = (rotulo: string, valor: string, antes: string, borda = false) => `<td width="50%" style="padding:16px 18px;vertical-align:top${borda ? ";border-left:1px solid #D6E4FA" : ""}"><div style="font-size:13px;color:#5B6472">${rotulo}</div><div style="font-size:30px;font-weight:700;line-height:1.25;color:#0A6CFF">${valor}</div><div style="font-size:13px;color:#5B6472">semana anterior: ${antes}</div></td>`;

// Lista dos itens que faltam (loja incompleta). Os textos vêm de painel.ts › passos e entram escapados.
export function listaItens(itens: { titulo: string; texto: string }[]) {
  return `<ul style="margin:4px 0 0;padding:0 0 0 20px">${itens.map((i) => `<li style="margin:0 0 10px"><b>${escapar(i.titulo)}</b><br><span style="color:#5B6472">${escapar(i.texto)}</span></li>`).join("")}</ul>`;
}

// Padrões (o admin pode reescrever qualquer um; "Restaurar padrão" volta pra isto)
export const MODELOS_PADRAO: ModeloEmail[] = [
  { chave: "cadastro", nome: "Boas-vindas (cadastro)", quando: "Quando alguém cria a conta no WorkEnd (e-mail e senha ou Google).", variaveis: ["nome", "primeiro_nome", "email", "empresa", "link_mapa"],
    assunto: "Boas-vindas ao WorkEnd, {{primeiro_nome}}",
    html: `${titulo("Sua conta está pronta, {{primeiro_nome}}")}<p style="margin:0 0 12px">No WorkEnd, a sua empresa ganha um endereço na cidade: escolha um lote no mapa, ponha o nome e a logomarca na placa e monte a equipe que atende quem passa.</p>${btn("Escolher meu lote no mapa", "{{link_mapa}}")}${nota("Conta criada com {{email}}.")}` },
  { chave: "reserva", nome: "Lote reservado (1 hora pra pagar)", quando: "Quando o usuário reserva um lote. Leva o link pra pagar.", variaveis: ["nome", "empresa", "lote", "descricao", "valor", "prazo", "link_pagar"],
    assunto: "{{empresa}} reservou o {{lote}} — pague em até {{prazo}}",
    html: `<h1 style="margin:0 0 12px;font-size:24px">Seu chão está reservado, {{nome}}!</h1><p>A placa <b>{{empresa}}</b> já aparece no <b>{{lote}}</b> ({{descricao}}). A reserva vale <b>{{prazo}}</b>: pague o 1º mês (<b>{{valor}}</b>, Pix, direto no mapa) pra garantir o lote. Sem pagamento, ele volta a ficar à venda.</p>${btn("Pagar {{valor}} agora", "{{link_pagar}}")}` },
  { chave: "pagamento", nome: "Pagamento aprovado", quando: "Quando o Mercado Pago aprova o pagamento do lote.", variaveis: ["nome", "empresa", "lote", "valor", "pago_ate", "link_mapa", "link_painel"],
    assunto: "Pagamento aprovado: o {{lote}} é da {{empresa}} até {{pago_ate}}",
    html: `<h1 style="margin:0 0 12px;font-size:24px">Pagamento confirmado!</h1><p>Recebemos <b>{{valor}}</b>. O <b>{{lote}}</b> está ativo pra <b>{{empresa}}</b> até <b>{{pago_ate}}</b>. Agora é montar o escritório: em breve você escolhe os setores e treina sua atendente e seu CEO.</p>${btn("Ver meu chão no mapa", "{{link_mapa}}")}<p style="color:#5B6472;font-size:14px">Seu painel: <a href="{{link_painel}}">{{link_painel}}</a></p>` },
  { chave: "vencimento", nome: "Aviso de vencimento", quando: "5 dias antes do lote vencer, uma vez por período pago (terreno.avisado_em).", variaveis: ["nome", "primeiro_nome", "empresa", "lote", "valor", "pago_ate", "link_pagar"],
    assunto: "O {{lote}} da {{empresa}} vence em {{pago_ate}}",
    html: `${titulo("{{primeiro_nome}}, o {{lote}} vence em {{pago_ate}}")}<p style="margin:0 0 12px">A <b>{{empresa}}</b> continua no mapa até <b>{{pago_ate}}</b>. Depois disso há 5 dias de tolerância; sem renovação, o lote volta a ficar à venda e a placa sai do mapa. A marca e a equipe ficam guardadas na sua conta.</p>${btn("Renovar por {{valor}}", "{{link_pagar}}")}` },
  { chave: "atividade", nome: "Atividade na sua loja", quando: "Toda vez que algo acontece na loja do dono (escritório montado, contratação, troca de prédio, pagamento…).", variaveis: ["nome", "empresa", "lote", "titulo", "detalhes", "link_mapa", "link_painel"],
    assunto: "{{empresa}}: {{titulo}}",
    html: `<h1 style="margin:0 0 12px;font-size:22px">{{titulo}}</h1><p>Olá, {{nome}}! Aconteceu na <b>{{empresa}}</b> ({{lote}}):</p><blockquote style="margin:16px 0;padding:12px 16px;background:#F5F6F8;border-left:4px solid #0A6CFF;border-radius:8px">{{detalhes}}</blockquote>${btn("Ver minha loja no mapa", "{{link_mapa}}")}<p style="color:#5B6472;font-size:14px">Painel: <a href="{{link_painel}}">{{link_painel}}</a></p>` },
  { chave: "contato", nome: "Alguém falou com a sua loja", quando: "Quando um visitante fala com o atendimento da loja e deixa contato.", variaveis: ["nome", "empresa", "contato_nome", "contato_email", "contato_telefone", "mensagem", "link_painel"],
    assunto: "{{contato_nome}} falou com a {{empresa}} no WorkEnd",
    html: `<h1 style="margin:0 0 12px;font-size:24px">Novo contato na {{empresa}}</h1><p><b>{{contato_nome}}</b> falou com o atendimento da sua loja.</p><table style="border-collapse:collapse;font-size:15px"><tr><td style="padding:4px 12px 4px 0;color:#5B6472">E-mail</td><td>{{contato_email}}</td></tr><tr><td style="padding:4px 12px 4px 0;color:#5B6472">Telefone</td><td>{{contato_telefone}}</td></tr></table><blockquote style="margin:16px 0;padding:12px 16px;background:#F5F6F8;border-left:4px solid #0A6CFF;border-radius:8px">{{mensagem}}</blockquote>${btn("Responder no painel", "{{link_painel}}")}` },
  { chave: "senha", nome: "Criar nova senha", quando: "Quando alguém pede para trocar a senha.", variaveis: ["nome", "link_senha"],
    assunto: "Crie uma nova senha no WorkEnd",
    html: `<h1 style="margin:0 0 12px;font-size:24px">Nova senha, {{nome}}</h1><p>Recebemos um pedido para trocar a senha da sua conta. O link vale 1 hora.</p>${btn("Criar nova senha", "{{link_senha}}")}<p style="color:#5B6472;font-size:14px">Se não foi você, é só ignorar este e-mail.</p>` },
  // ----- ciclo de vida (WE-17): com descadastro -----
  { chave: "loja_dia2", nome: "Loja incompleta (2º dia)", quando: "2 dias depois de a loja abrir, se ainda faltar algum dos 6 itens de \"Deixe a loja completa\" do painel. Uma vez por loja.", variaveis: ["nome", "primeiro_nome", "empresa", "dias", "faltam", "faltam_texto", "itens", "link_painel"],
    assunto: "{{empresa}}: {{faltam_texto}} para a loja ficar completa",
    html: `${titulo("Sua loja já está no mapa, {{primeiro_nome}}")}<p style="margin:0 0 12px">A <b>{{empresa}}</b> abriu há {{dias}} dias. Ainda {{faltam_texto}} dos 6 que deixam a loja completa para quem passa:</p>{{{itens}}}${btn("Completar a loja", "{{link_painel}}")}` },
  { chave: "loja_dia5", nome: "Loja incompleta (5º dia)", quando: "5 dias depois de a loja abrir, se ainda faltar algum dos 6 itens. Uma vez por loja.", variaveis: ["nome", "primeiro_nome", "empresa", "dias", "faltam", "faltam_texto", "itens", "link_painel"],
    assunto: "{{empresa}}: ainda {{faltam_texto}} para completar a loja",
    html: `${titulo("Falta pouco para a loja ficar completa")}<p style="margin:0 0 12px">{{primeiro_nome}}, cada item aparece para quem visita a <b>{{empresa}}</b> no mapa e na página da loja. Ainda {{faltam_texto}}:</p>{{{itens}}}${btn("Ver o que falta", "{{link_painel}}")}` },
  { chave: "resumo", nome: "Resumo da semana", quando: "Segunda e terça, a partir das 6h de segunda (horário de Brasília), uma vez por semana, para loja aberta há pelo menos 6 dias. Os números são os da página Resultados (últimos 7 dias).", variaveis: ["nome", "primeiro_nome", "empresa", "visitas", "visitas_antes", "visitas_texto", "conversas", "conversas_antes", "conversas_texto", "de", "ate", "dica", "link_resultados"],
    assunto: "{{empresa}} na semana: {{visitas_texto}} e {{conversas_texto}}",
    html: `${titulo("A semana da {{empresa}}")}<p style="margin:0 0 4px">De {{de}} a {{ate}}, {{primeiro_nome}}, com os números da página Resultados:</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 4px;background:#F0F6FF;border-radius:12px"><tr>${numero("Visitas", "{{visitas}}", "{{visitas_antes}}")}${numero("Conversas", "{{conversas}}", "{{conversas_antes}}", true)}</tr></table>{{{dica}}}${btn("Ver os resultados", "{{link_resultados}}")}` },
  { chave: "ia_80", nome: "Unidades de IA: 80% do mês", quando: "Quando a equipe usa 80% das unidades de IA do mês (restam 20%). Uma vez por mês.", variaveis: ["nome", "primeiro_nome", "empresa", "usado_pct", "restam", "base", "mes", "link_unidades"],
    assunto: "{{empresa}}: a equipe já usou {{usado_pct}}% das unidades de IA de {{mes}}",
    html: `${titulo("As unidades de IA estão acabando")}<p style="margin:0 0 12px">A equipe da <b>{{empresa}}</b> já usou {{usado_pct}}% das unidades de IA de {{mes}}. Restam <b>{{restam}}</b> de {{base}}.</p><p style="margin:0 0 12px">Quando acabarem, a equipe para de usar IA e responde com um recado fixo, até você comprar mais ou até as unidades do mês que vem.</p>${btn("Comprar unidades", "{{link_unidades}}")}${nota("As unidades compradas não vencem.")}` },
  { chave: "ia_100", nome: "Unidades de IA: acabaram", quando: "Quando as unidades de IA do mês acabam. Uma vez por mês.", variaveis: ["nome", "primeiro_nome", "empresa", "base", "mes", "link_unidades"],
    assunto: "{{empresa}}: as unidades de IA de {{mes}} acabaram",
    html: `${titulo("As unidades de IA acabaram")}<p style="margin:0 0 12px">A equipe da <b>{{empresa}}</b> usou as {{base}} unidades de IA de {{mes}} e agora responde com um recado fixo. Compre unidades para ela voltar a responder agora, ou espere as unidades inclusas do mês que vem, que entram com o lote ativo.</p>${btn("Comprar unidades", "{{link_unidades}}")}${nota("As unidades compradas não vencem.")}` },
];
const PADRAO: Record<string, ModeloEmail> = Object.fromEntries(MODELOS_PADRAO.map((m) => [m.chave, m]));

// Cabeçalho e rodapé do WorkEnd em volta do corpo editável. Com `preferencias` (e-mails de ciclo de vida), o rodapé leva
// o link para escolher os avisos ou parar de recebê-los.
export function moldura(corpo: string, o: { preferencias?: string | null } = {}) {
  const cinza = "color:#8A919C";
  const pref = o.preferencias ? `<p style="margin:0 0 8px">Você recebe este aviso porque tem uma loja no WorkEnd. <a href="${o.preferencias}" style="color:#5B6472">Escolher quais avisos receber ou parar de receber</a>.</p>` : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#F5F6F8;font-family:${FONTE};color:#1C1F24;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F6F8"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
  <tr><td style="padding:0 4px 16px"><a href="${SITE}"><img src="${SITE}/workend/marca/workend-logotipo-email.png" alt="WorkEnd" width="161" height="30" style="display:block;height:30px;width:161px;border:0"></a></td></tr>
  <tr><td style="background:#fff;border-radius:16px;padding:28px 28px 24px;line-height:1.55;font-size:16px;font-family:${FONTE}">${corpo}</td></tr>
  <tr><td style="padding:16px 4px 0;font-size:12px;line-height:1.6;${cinza};font-family:${FONTE}">${pref}<p style="margin:0">WorkEnd · o mundo onde as empresas atendem · <a href="${SITE}" style="${cinza}">workend.online</a> · <a href="${SITE}/politicas" style="${cinza}">políticas de uso</a></p><p style="margin:4px 0 0">${escapar(identificacao())}</p></td></tr>
</table></td></tr></table></body></html>`;
}

// Versão em texto puro, tirada do mesmo corpo (assim um modelo editado no admin continua com as duas versões)
const ENTIDADES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
export function htmlParaTexto(html: string) {
  const semTags = (s: string) => s.replace(/<[^>]+>/g, "");
  return html
    .replace(/<a\b[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, t: string) => { const tx = semTags(t).trim(); return !tx || tx === href ? href : `${tx}: ${href}`; })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/(p|h[1-6]|ul|ol|table|blockquote)>/gi, "\n\n")
    .replace(/<\/(div|td|tr|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (e) => ENTIDADES[e] ?? e)
    .split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim();
}
export function textoDoEmail(corpo: string, o: { preferencias?: string | null } = {}) {
  return [
    "WorkEnd", "", htmlParaTexto(corpo), "", "--",
    ...(o.preferencias ? [`Você recebe este aviso porque tem uma loja no WorkEnd. Escolher quais avisos receber ou parar de receber: ${o.preferencias}`, ""] : []),
    "WorkEnd · o mundo onde as empresas atendem · https://workend.online", identificacao(),
  ].join("\n");
}

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
// {{x}} entra escapado (no assunto, como texto); {{{x}}} entra como HTML, só para o que o próprio servidor monta (listaItens)
export function preencher(texto: string, vars: Vars, html = true) {
  return texto.replace(/\{\{\{\s*([a-z_]+)\s*\}\}\}|\{\{\s*([a-z_]+)\s*\}\}/g, (_m, cru: string | undefined, k: string | undefined) => {
    const v = vars[(cru ?? k) as string]; if (v == null) return "";
    return cru || !html ? String(v) : escapar(String(v));
  });
}
const primeiroNome = (n: unknown) => (typeof n === "string" ? n.trim().split(/\s+/)[0] ?? "" : "");

export async function listarModelos(): Promise<(ModeloEmail & { editado: boolean })[]> {
  await migrar();
  const salvos = await sql<{ chave: string; assunto: string; html: string }[]>`SELECT chave, assunto, html FROM email_modelo`;
  const porChave = new Map(salvos.map((s) => [s.chave, s]));
  return MODELOS_PADRAO.map((m) => { const s = porChave.get(m.chave); return s ? { ...m, assunto: s.assunto, html: s.html, editado: true } : { ...m, editado: false }; });
}
export async function obterModelo(chave: ChaveEmail): Promise<ModeloEmail> {
  await migrar();
  const [s] = await sql<{ assunto: string; html: string }[]>`SELECT assunto, html FROM email_modelo WHERE chave = ${chave}`;
  return s ? { ...PADRAO[chave], ...s } : PADRAO[chave];
}
export async function salvarModelo(chave: ChaveEmail, assunto: string, html: string) {
  await migrar();
  if (!PADRAO[chave]) throw new Error("Modelo desconhecido.");
  if (!assunto.trim() || !html.trim()) throw new Error("Assunto e corpo são obrigatórios.");
  await sql`INSERT INTO email_modelo (chave, assunto, html) VALUES (${chave}, ${assunto.trim().slice(0, 200)}, ${html.slice(0, 50000)})
    ON CONFLICT (chave) DO UPDATE SET assunto = EXCLUDED.assunto, html = EXCLUDED.html, atualizado_em = now()`;
}
export async function restaurarModelo(chave: ChaveEmail) { await migrar(); await sql`DELETE FROM email_modelo WHERE chave = ${chave}`; }

// Variáveis de exemplo pra pré-visualizar e testar no admin (só exemplo: nunca vão num e-mail de verdade)
export const EXEMPLO: Record<string, string> = {
  nome: "Brenno", primeiro_nome: "Brenno", email: "voce@exemplo.com", empresa: "Padaria da Maria", lote: "Lote 7", descricao: "casinha térrea", valor: "R$ 99,00", prazo: "1 hora", pago_ate: "07/12/2026",
  link_mapa: `${SITE}/mundo`, link_pagar: `${SITE}/mundo?lote=0%2C-1%2C2`, link_painel: `${SITE}/app`,
  link_senha: `${SITE}/redefinir?t=exemplo`,
  titulo: "Novo profissional contratado", detalhes: "Rodrigo (Vendedor) entrou no setor Vendas.",
  contato_nome: "João Silva", contato_email: "joao@exemplo.com", contato_telefone: "(79) 99999-0000", mensagem: "Quero um orçamento de 200 salgados pra sexta-feira.",
  dias: "2", faltam: "2", faltam_texto: "faltam 2 itens",
  itens: listaItens([{ titulo: "Um produto na vitrine", texto: "Foto, nome e preço, com pedido pelo WhatsApp." }, { titulo: "O primeiro cupom", texto: "Um motivo para o visitante voltar e comprar." }]),
  visitas: "12", visitas_antes: "8", visitas_texto: "12 visitas", conversas: "3", conversas_antes: "1", conversas_texto: "3 conversas", de: "15/11", ate: "21/11", dica: "", link_resultados: `${SITE}/app/resultados?dias=7`,
  usado_pct: "80", restam: "200", base: "1.000", mes: "novembro de 2026", link_unidades: `${SITE}/app/creditos#unidades`,
};

// ---------- descadastro: link assinado, sem login ----------
// token = id da conta (base64url) + HMAC com o segredo das sessões, num propósito próprio (não serve como sessão)
const assinaturaEmail = async (uid: string) => createHmac("sha256", "workend-emails:" + (await segredoSessao())).update(uid).digest("base64url").slice(0, 32);
export async function tokenEmail(usuarioId: string) { return `${Buffer.from(usuarioId).toString("base64url")}.${await assinaturaEmail(usuarioId)}`; }
export async function usuarioDoToken(t: string | null | undefined): Promise<string | null> {
  if (!t || t.length > 200) return null;
  const i = t.indexOf("."); if (i <= 0) return null;
  const uid = Buffer.from(t.slice(0, i), "base64url").toString("utf8");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(uid)) return null;
  const sig = t.slice(i + 1), esperado = await assinaturaEmail(uid);
  if (sig.length !== esperado.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return null;
  return uid;
}
export const linkPreferencias = (token: string) => `${SITE}/emails?t=${token}`;
export const linkDescadastro = (token: string) => `${SITE}/api/workend/emails/sair?t=${token}`;

export type PreferenciasEmail = Record<CategoriaEmail, boolean>;
const TUDO: PreferenciasEmail = { dicas: true, resumo: true, unidades: true };
export async function preferenciasEmail(usuarioId: string): Promise<PreferenciasEmail> {
  await migrar();
  const [p] = await sql<PreferenciasEmail[]>`SELECT dicas, resumo, unidades FROM email_preferencia WHERE usuario_id = ${usuarioId}`;
  return p ? { dicas: p.dicas, resumo: p.resumo, unidades: p.unidades } : { ...TUDO };
}
export async function salvarPreferenciasEmail(usuarioId: string, mudar: Partial<Record<CategoriaEmail, unknown>>) {
  const p = await preferenciasEmail(usuarioId);
  for (const c of CATEGORIAS_EMAIL) if (typeof mudar[c.id] === "boolean") p[c.id] = mudar[c.id] as boolean;
  await sql`INSERT INTO email_preferencia (usuario_id, dicas, resumo, unidades) VALUES (${usuarioId}, ${p.dicas}, ${p.resumo}, ${p.unidades})
    ON CONFLICT (usuario_id) DO UPDATE SET dicas = EXCLUDED.dicas, resumo = EXCLUDED.resumo, unidades = EXCLUDED.unidades, atualizado_em = now()`;
  return p;
}
export async function recebeEmail(usuarioId: string, c: CategoriaEmail) { return (await preferenciasEmail(usuarioId))[c]; }

// Envia (ou só registra, sem chave). Nunca lança: e-mail não pode derrubar cadastro, reserva nem webhook.
// Os de ciclo de vida pedem `usuarioId`: confere o descadastro na hora do envio e põe o link e os cabeçalhos de saída.
export async function enviarEmail(chave: ChaveEmail, para: string, vars: Vars, opcoes: { responderPara?: string; usuarioId?: string } = {}) {
  const eid = id("eml");
  let assunto = "";
  try {
    const categoria = CICLO_DE_VIDA[chave];
    let preferencias: string | null = null, sair: string | null = null;
    if (categoria) {
      if (!opcoes.usuarioId) throw new Error("E-mail de ciclo de vida sem a conta (usuarioId).");
      if (!(await recebeEmail(opcoes.usuarioId, categoria))) return { status: "descadastrado" as const, id: null };
      const t = await tokenEmail(opcoes.usuarioId);
      preferencias = linkPreferencias(t); sair = linkDescadastro(t);
    }
    const m = await obterModelo(chave);
    const v: Vars = { primeiro_nome: primeiroNome(vars.nome), ...vars };
    assunto = preencher(m.assunto, v, false).replace(/\s+/g, " ").trim();
    const corpo = preencher(m.html, v);
    const html = moldura(corpo, { preferencias }), texto = textoDoEmail(corpo, { preferencias });
    if (!emailLigado()) { await sql`INSERT INTO email_enviado (id, para, chave, assunto, status, erro) VALUES (${eid}, ${para}, ${chave}, ${assunto}, 'sem_chave', 'SENDGRID_API_KEY/EMAIL_REMETENTE não configurados')`; return { status: "sem_chave" as const, id: eid }; }
    const r = await fetch(`${apiSendgrid()}/v3/mail/send`, {
      method: "POST", headers: { authorization: `Bearer ${process.env.SENDGRID_API_KEY?.trim()}`, "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: para }] }], from: remetente(), ...(opcoes.responderPara ? { reply_to: { email: opcoes.responderPara } } : {}), subject: assunto,
        content: [{ type: "text/plain", value: texto }, { type: "text/html", value: html }],
        ...(sair ? { headers: { "List-Unsubscribe": `<${sair}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
      }),
    });
    if (r.status >= 300) { const t = await r.text().catch(() => ""); throw new Error(`SendGrid ${r.status}: ${t.slice(0, 300)}`); }
    await sql`INSERT INTO email_enviado (id, para, chave, assunto, status) VALUES (${eid}, ${para}, ${chave}, ${assunto}, 'enviado')`;
    return { status: "enviado" as const, id: eid };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email]", chave, para, msg);
    try { await sql`INSERT INTO email_enviado (id, para, chave, assunto, status, erro) VALUES (${eid}, ${para}, ${chave}, ${assunto}, 'erro', ${msg.slice(0, 500)})`; } catch { /* sem banco */ }
    return { status: "erro" as const, id: eid, erro: msg };
  }
}

export async function ultimosEnvios(n = 50) {
  await migrar();
  return sql<{ id: string; para: string; chave: string; assunto: string; status: string; erro: string | null; criadoEm: Date }[]>`SELECT id, para, chave, assunto, status, erro, criado_em FROM email_enviado ORDER BY criado_em DESC LIMIT ${n}`;
}

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBR = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
