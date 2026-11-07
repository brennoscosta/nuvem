// E-mails do WorkEnd pelo SendGrid. Liga com SENDGRID_API_KEY + EMAIL_REMETENTE (remetente verificado no SendGrid)
// no CapRover; sem a chave, o envio só fica registrado em email_enviado (status sem_chave) pra conferir no admin.
// Os modelos (assunto + corpo com {{variaveis}}) têm um padrão aqui e podem ser editados no /app/admin (tabela email_modelo).
import { sql, id, migrar } from "./db";

export const emailLigado = () => !!process.env.SENDGRID_API_KEY && !!process.env.EMAIL_REMETENTE;
export const REMETENTE = () => process.env.EMAIL_REMETENTE ?? "contato@workend.online";
const SITE = "https://workend.online";

export type ChaveEmail = "cadastro" | "reserva" | "pagamento" | "vencimento" | "contato";
export interface ModeloEmail { chave: ChaveEmail; nome: string; quando: string; variaveis: string[]; assunto: string; html: string }

const btn = (texto: string, href: string) => `<p style="margin:24px 0"><a href="${href}" style="display:inline-block;background:#0A6CFF;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">${texto}</a></p>`;

// Padrões (o admin pode reescrever qualquer um; "Restaurar padrão" volta pra isto)
export const MODELOS_PADRAO: ModeloEmail[] = [
  { chave: "cadastro", nome: "Boas-vindas (cadastro)", quando: "Quando alguém cria a conta no WorkEnd.", variaveis: ["nome", "email", "empresa", "link_mapa"],
    assunto: "Bem-vindo ao WorkEnd, {{nome}}!",
    html: `<h1 style="margin:0 0 12px;font-size:24px">Olá, {{nome}}!</h1><p>Sua conta no <b>WorkEnd</b> está pronta. O WorkEnd é um mundo com lotes à venda: você escolhe um chão no mapa, coloca o nome e a logomarca da sua empresa na placa e monta seu escritório com atendentes que trabalham por você.</p>${btn("Escolher meu chão no mapa", "{{link_mapa}}")}<p style="color:#5B6472;font-size:14px">Dúvidas? Responda este e-mail.</p>` },
  { chave: "reserva", nome: "Lote reservado (1 hora pra pagar)", quando: "Quando o usuário reserva um lote. Leva o link pra pagar.", variaveis: ["nome", "empresa", "lote", "descricao", "valor", "prazo", "link_pagar"],
    assunto: "{{empresa}} reservou o {{lote}} — pague em até {{prazo}}",
    html: `<h1 style="margin:0 0 12px;font-size:24px">Seu chão está reservado, {{nome}}!</h1><p>A placa <b>{{empresa}}</b> já aparece no <b>{{lote}}</b> ({{descricao}}). A reserva vale <b>{{prazo}}</b>: pague o 1º mês (<b>{{valor}}</b>, Pix ou saldo do Mercado Pago) pra garantir o lote. Sem pagamento, ele volta a ficar à venda.</p>${btn("Pagar {{valor}} agora", "{{link_pagar}}")}` },
  { chave: "pagamento", nome: "Pagamento aprovado", quando: "Quando o Mercado Pago aprova o pagamento do lote.", variaveis: ["nome", "empresa", "lote", "valor", "pago_ate", "link_mapa", "link_painel"],
    assunto: "Pagamento aprovado: o {{lote}} é da {{empresa}} até {{pago_ate}}",
    html: `<h1 style="margin:0 0 12px;font-size:24px">Pagamento confirmado!</h1><p>Recebemos <b>{{valor}}</b>. O <b>{{lote}}</b> está ativo pra <b>{{empresa}}</b> até <b>{{pago_ate}}</b>. Agora é montar o escritório: em breve você escolhe os setores e treina sua atendente e seu CEO.</p>${btn("Ver meu chão no mapa", "{{link_mapa}}")}<p style="color:#5B6472;font-size:14px">Seu painel: <a href="{{link_painel}}">{{link_painel}}</a></p>` },
  { chave: "vencimento", nome: "Aviso de vencimento", quando: "Alguns dias antes do lote vencer (e na tolerância).", variaveis: ["nome", "empresa", "lote", "valor", "pago_ate", "link_pagar"],
    assunto: "O {{lote}} da {{empresa}} vence em {{pago_ate}}",
    html: `<h1 style="margin:0 0 12px;font-size:24px">Renove seu chão, {{nome}}</h1><p>O <b>{{lote}}</b> ({{empresa}}) vence em <b>{{pago_ate}}</b>. Depois disso há 5 dias de tolerância; sem renovação, o lote volta a ficar à venda e a placa sai do mapa.</p>${btn("Renovar +30 dias · {{valor}}", "{{link_pagar}}")}` },
  { chave: "contato", nome: "Alguém falou com a sua loja", quando: "Quando um visitante fala com o atendimento da loja e deixa contato.", variaveis: ["nome", "empresa", "contato_nome", "contato_email", "contato_telefone", "mensagem", "link_painel"],
    assunto: "{{contato_nome}} falou com a {{empresa}} no WorkEnd",
    html: `<h1 style="margin:0 0 12px;font-size:24px">Novo contato na {{empresa}}</h1><p><b>{{contato_nome}}</b> falou com o atendimento da sua loja.</p><table style="border-collapse:collapse;font-size:15px"><tr><td style="padding:4px 12px 4px 0;color:#5B6472">E-mail</td><td>{{contato_email}}</td></tr><tr><td style="padding:4px 12px 4px 0;color:#5B6472">Telefone</td><td>{{contato_telefone}}</td></tr></table><blockquote style="margin:16px 0;padding:12px 16px;background:#F5F6F8;border-left:4px solid #0A6CFF;border-radius:8px">{{mensagem}}</blockquote>${btn("Responder no painel", "{{link_painel}}")}` },
];
const PADRAO: Record<string, ModeloEmail> = Object.fromEntries(MODELOS_PADRAO.map((m) => [m.chave, m]));

// Cabeçalho e rodapé do WorkEnd em volta do corpo editável
export function moldura(corpo: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F5F6F8;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1C1F24">
<div style="max-width:560px;margin:0 auto;padding:32px 16px">
  <div style="margin-bottom:16px"><img src="${SITE}/workend/logo.png" alt="WorkEnd" height="34" style="height:34px"></div>
  <div style="background:#fff;border-radius:16px;padding:28px 28px 20px;line-height:1.55;font-size:16px">${corpo}</div>
  <p style="color:#8A919C;font-size:12px;margin:16px 4px">WorkEnd · o mundo onde as empresas atendem · <a href="${SITE}" style="color:#8A919C">workend.online</a> · <a href="${SITE}/politicas" style="color:#8A919C">políticas de uso</a></p>
</div></body></html>`;
}

const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
export function preencher(texto: string, vars: Record<string, string | number | null | undefined>) {
  return texto.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => { const v = vars[k]; return v == null ? "" : escapar(String(v)); });
}

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

// Variáveis de exemplo pra pré-visualizar e testar no admin
export const EXEMPLO: Record<string, string> = {
  nome: "Brenno", email: "voce@exemplo.com", empresa: "Padaria da Maria", lote: "Lote 7", descricao: "casinha térrea", valor: "R$ 99,00", prazo: "1 hora", pago_ate: "07/12/2026",
  link_mapa: `${SITE}/mundo`, link_pagar: `${SITE}/mundo?lote=0%2C-1%2C2`, link_painel: `${SITE}/app`,
  contato_nome: "João Silva", contato_email: "joao@exemplo.com", contato_telefone: "(79) 99999-0000", mensagem: "Quero um orçamento de 200 salgados pra sexta-feira.",
};

// Envia (ou só registra, sem chave). Nunca lança: e-mail não pode derrubar cadastro, reserva nem webhook.
export async function enviarEmail(chave: ChaveEmail, para: string, vars: Record<string, string | number | null | undefined>, opcoes: { responderPara?: string } = {}) {
  const eid = id("eml");
  let assunto = "";
  try {
    const m = await obterModelo(chave);
    assunto = preencher(m.assunto, vars);
    const html = moldura(preencher(m.html, vars));
    if (!emailLigado()) { await sql`INSERT INTO email_enviado (id, para, chave, assunto, status, erro) VALUES (${eid}, ${para}, ${chave}, ${assunto}, 'sem_chave', 'SENDGRID_API_KEY/EMAIL_REMETENTE não configurados')`; return { status: "sem_chave" as const }; }
    const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST", headers: { authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ personalizations: [{ to: [{ email: para }] }], from: { email: REMETENTE(), name: "WorkEnd" }, ...(opcoes.responderPara ? { reply_to: { email: opcoes.responderPara } } : {}), subject: assunto, content: [{ type: "text/html", value: html }] }),
    });
    if (r.status >= 300) { const t = await r.text().catch(() => ""); throw new Error(`SendGrid ${r.status}: ${t.slice(0, 300)}`); }
    await sql`INSERT INTO email_enviado (id, para, chave, assunto, status) VALUES (${eid}, ${para}, ${chave}, ${assunto}, 'enviado')`;
    return { status: "enviado" as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email]", chave, para, msg);
    try { await sql`INSERT INTO email_enviado (id, para, chave, assunto, status, erro) VALUES (${eid}, ${para}, ${chave}, ${assunto}, 'erro', ${msg.slice(0, 500)})`; } catch { /* sem banco */ }
    return { status: "erro" as const, erro: msg };
  }
}

export async function ultimosEnvios(n = 50) {
  await migrar();
  return sql<{ id: string; para: string; chave: string; assunto: string; status: string; erro: string | null; criadoEm: Date }[]>`SELECT id, para, chave, assunto, status, erro, criado_em FROM email_enviado ORDER BY criado_em DESC LIMIT ${n}`;
}

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBR = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
