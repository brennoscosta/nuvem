// E-mails de ciclo de vida do WorkEnd (WE-17, 21/11/2026), na agenda interna do servidor (src/instrumentation.ts):
//  - loja incompleta: no 2º e no 5º dia depois de a loja abrir (terreno.inaugurado_em), se ainda faltar algum dos 6 itens
//    de "Deixe a loja completa". Os itens vêm de painel.ts › painelDoDono, a mesma conta do /app;
//  - resumo da semana: segunda (a partir das 6h, horário de Brasília) e terça, na mesma semana do aviso do sino
//    (avisos.ts › semanaBR) e com os números da página Resultados (resultados.ts, últimos 7 dias), para loja aberta há
//    pelo menos 6 dias. Não sai de quarta a domingo, para não chegar um resumo atrasado perto do da semana seguinte;
//  - unidades de IA: a 80% e a 100% das unidades do mês (ia_carteira, a mesma conta do medidor e do aviso do sino em
//    unidadesIA.ts), uma vez cada por mês. Se acabar de uma vez, só sai o de 100%;
//  - vencimento do lote: o aviso que já existia (terrenos.ts › avisarVencimentos, por avisado_em), chamado também daqui
//    para sair mesmo sem ninguém abrir o mapa. Continua sendo e-mail da conta, sem descadastro.
// Cada e-mail de ciclo de vida sai uma vez só por gatilho (email_gatilho, migração 0056): a chave é gravada antes do envio.
// Quem se descadastrou (email_preferencia) não recebe e não gasta o gatilho. Sedes, admin e contas suspensas ficam de fora.
// Sem SENDGRID_API_KEY, enviarEmail só registra (status sem_chave), como os outros e-mails.
// Só para teste: EMAILS_CICLO_MS (intervalo, padrão 10 min), EMAILS_PRIMEIRO_CICLO_MS (padrão 2 min) e EMAILS_ADIANTAR_MS
// (adianta o relógio do ciclo). Em produção as três ficam vazias.
import { sql, migrar, temBanco } from "./db";
import { enviarEmail, recebeEmail, listaItens, CICLO_DE_VIDA, type ChaveEmail } from "./email";
import type { Usuario } from "./usuarios";
import { terrenoDoUsuario, ehAdmin, avisarVencimentos } from "./terrenos";
import { painelDoDono } from "./painel";
import { resultadosDoDono } from "./resultados";
import { semanaBR } from "./avisos";
import { mesAtual, AVISO_UNIDADES, EMPRESAS_SEM_COBRANCA } from "./unidadesIA";
import { ehSede } from "@/office/data/sedes";
import { numeroDaLoja, temNumero } from "@/office/data/numeroLoja";

declare global {
  var __workendEmailsTimer: ReturnType<typeof setInterval> | undefined;
  var __workendEmailsRodando: boolean | undefined;
}

const SITE = "https://workend.online";
const TZ = "America/Sao_Paulo";
const DIA = 86400_000;
const fmt = (x: number) => x.toLocaleString("pt-BR");
const plural = (x: number, um: string, varios: string) => `${fmt(x)} ${x === 1 ? um : varios}`;
const diaMes = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(d);
const nomeMes = (m: string) => { const [a, n] = m.split("-").map(Number); return new Date(Date.UTC(a, n - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }); };
const diaDaSemanaBR = (d: Date) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(d)); // 0 = segunda
const agoraCiclo = () => new Date(Date.now() + (Number(process.env.EMAILS_ADIANTAR_MS) || 0));
const erroDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

const CAMPOS_USUARIO = () => sql`u.id, u.email, u.nome, u.empresa_nome, u.interesse_em, u.criado_em, u.ultimo_acesso, u.papel, u.banido_em, u.banido_motivo`;
async function usuarioPorId(uid: string) {
  const [u] = await sql<Usuario[]>`SELECT ${CAMPOS_USUARIO()} FROM usuario u WHERE u.id = ${uid}`;
  return u ?? null;
}
// donos de loja aberta (lote principal, fora as sedes), uma vez cada; sem admin e sem conta suspensa
async function lojasAbertas() {
  const r = await sql<(Usuario & { chave: string; inauguradoEm: Date | null })[]>`SELECT ${CAMPOS_USUARIO()}, t.chave, t.inaugurado_em
    FROM terreno t JOIN usuario u ON u.id = t.usuario_id
    WHERE t.status = 'ativo' AND t.anexo_de IS NULL AND u.banido_em IS NULL AND u.id <> 'usr_contas_excluidas'
    ORDER BY t.reservado_em`;
  const vistos = new Set<string>();
  return r.filter((x) => !ehSede(x.chave) && !ehAdmin(x) && !vistos.has(x.id) && vistos.add(x.id));
}

async function jaSaiu(chave: string) { const [r] = await sql`SELECT 1 FROM email_gatilho WHERE chave = ${chave}`; return !!r; }
// grava o gatilho e só então envia: o mesmo gatilho nunca manda dois e-mails, nem com dois servidores ao mesmo tempo
async function umaVez(chave: string, u: Usuario, tipo: ChaveEmail, vars: Record<string, string | number>) {
  if (!(await recebeEmail(u.id, CICLO_DE_VIDA[tipo]!))) return "descadastrado";
  const [novo] = await sql`INSERT INTO email_gatilho (chave, usuario_id, tipo) VALUES (${chave}, ${u.id}, ${tipo}) ON CONFLICT (chave) DO NOTHING RETURNING chave`;
  if (!novo) return "ja";
  const r = await enviarEmail(tipo, u.email, vars, { usuarioId: u.id });
  await sql`UPDATE email_gatilho SET status = ${r.status}, email_id = ${r.id} WHERE chave = ${chave}`;
  return r.status;
}

// 2º e 5º dia: só o que o /app mostra como não feito em "Deixe a loja completa"
async function lojaIncompleta(u: Usuario, agora: Date) {
  const t = await terrenoDoUsuario(u.id);
  if (!t || t.status !== "ativo" || ehSede(t.chave) || !t.inauguradoEm) return;
  const dias = Math.floor((agora.getTime() - new Date(t.inauguradoEm).getTime()) / DIA);
  const tipo: ChaveEmail | null = dias >= 5 && dias < 9 ? "loja_dia5" : dias >= 2 && dias < 5 ? "loja_dia2" : null;
  if (!tipo) return;
  const chave = `${tipo === "loja_dia2" ? "loja2" : "loja5"}:${u.id}:${t.chave}`;
  if (await jaSaiu(chave)) return;
  const p = await painelDoDono(u, t);
  const faltam = p.passos.filter((x) => !x.feito);
  if (!faltam.length) return;
  await umaVez(chave, u, tipo, {
    nome: u.nome, empresa: t.empresaNome || u.empresaNome, dias, faltam: faltam.length,
    faltam_texto: faltam.length === 1 ? "falta 1 item" : `faltam ${faltam.length} itens`, itens: listaItens(faltam), link_painel: `${SITE}/app`,
  });
}

// resumo da semana: os números de resultadosDoDono(…, 7), os mesmos do aviso do sino e da página Resultados
async function resumoSemana(u: Usuario, agora: Date, ref: string) {
  const chave = `resumo:${u.id}:${ref}`;
  if (await jaSaiu(chave)) return;
  const t = await terrenoDoUsuario(u.id);
  if (!t || t.status !== "ativo" || ehSede(t.chave) || !t.inauguradoEm || agora.getTime() - new Date(t.inauguradoEm).getTime() < 6 * DIA) return;
  const r = await resultadosDoDono(u, t, 7);
  const v = r.visitas.total, c = r.conversas.total, num = numeroDaLoja(t);
  const ate = new Date(new Date(`${r.desde}T12:00:00Z`).getTime() + (r.dias - 1) * DIA);
  const dica = v === 0 && temNumero(num) ? `<p style="margin:12px 0 0">Ninguém visitou a loja nestes 7 dias. Mande o endereço <b>workend.online/loja/${num}</b> para os seus clientes no WhatsApp e nas redes.</p>` : "";
  await umaVez(chave, u, "resumo", {
    nome: u.nome, empresa: t.empresaNome || u.empresaNome,
    visitas: fmt(v), visitas_antes: fmt(r.visitas.anterior), visitas_texto: plural(v, "visita", "visitas"),
    conversas: fmt(c), conversas_antes: fmt(r.conversas.anterior), conversas_texto: plural(c, "conversa", "conversas"),
    de: diaMes(new Date(`${r.desde}T12:00:00Z`)), ate: diaMes(ate), dica, link_resultados: `${SITE}/app/resultados?dias=7`,
  });
}

// unidades de IA: 80% e 100% do mês, pela carteira do mês corrente (a que o medidor do dono mostra)
async function unidadesAcabando() {
  const mes = mesAtual();
  const r = await sql<{ empresaId: string; resta: string; base: string; nome: string | null; usuarioId: string }[]>`SELECT c.empresa_id, (c.inclusa + c.comprada) AS resta, c.base_mes AS base, e.nome, e.usuario_id
    FROM ia_carteira c JOIN empresa e ON e.id = c.empresa_id
    WHERE c.mes = ${mes} AND c.base_mes > 0 AND (c.inclusa + c.comprada) <= c.base_mes * ${AVISO_UNIDADES}::float8 AND e.usuario_id IS NOT NULL`;
  for (const x of r) {
    try {
      if (EMPRESAS_SEM_COBRANCA.has(x.empresaId)) continue;
      const resta = Math.max(0, Number(x.resta)), base = Number(x.base), acabou = resta <= 0;
      const chave = `${acabou ? "ia100" : "ia80"}:${x.empresaId}:${mes}`;
      if (await jaSaiu(chave)) continue;
      const u = await usuarioPorId(x.usuarioId);
      if (!u || u.banidoEm || ehAdmin(u)) continue;
      const [loja] = await sql`SELECT 1 FROM terreno WHERE usuario_id = ${u.id} AND status = 'ativo' AND anexo_de IS NULL LIMIT 1`;
      if (!loja) continue; // sem loja aberta a equipe nem atende
      const st = await umaVez(chave, u, acabou ? "ia_100" : "ia_80", {
        nome: u.nome, empresa: x.nome || u.empresaNome, usado_pct: Math.min(100, Math.floor(((base - resta) * 100) / base)),
        restam: fmt(resta), base: fmt(base), mes: nomeMes(mes), link_unidades: `${SITE}/app/creditos#unidades`,
      });
      // acabou de uma vez: o de 80% não sai depois, no mesmo mês
      if (acabou && st !== "descadastrado" && st !== "ja") await sql`INSERT INTO email_gatilho (chave, usuario_id, tipo, status) VALUES (${`ia80:${x.empresaId}:${mes}`}, ${u.id}, 'ia_80', 'pulado') ON CONFLICT (chave) DO NOTHING`;
    } catch (e) { console.error("[emails] unidades", x.empresaId, erroDe(e)); }
  }
}

export async function cicloEmails() {
  if (globalThis.__workendEmailsRodando) return;
  globalThis.__workendEmailsRodando = true;
  try {
    await migrar();
    const agora = agoraCiclo();
    await avisarVencimentos();
    const s = semanaBR(agora);
    const semana = !s.antesDas6DeSegunda && diaDaSemanaBR(agora) <= 1 ? s.ref : null;
    for (const l of await lojasAbertas()) {
      const idade = l.inauguradoEm ? agora.getTime() - new Date(l.inauguradoEm).getTime() : -1;
      if (idade >= 2 * DIA && idade < 9 * DIA) await lojaIncompleta(l, agora).catch((e) => console.error("[emails] loja", l.id, erroDe(e)));
      if (semana && idade >= 6 * DIA) await resumoSemana(l, agora, semana).catch((e) => console.error("[emails] resumo", l.id, erroDe(e)));
    }
    await unidadesAcabando();
  } finally { globalThis.__workendEmailsRodando = false; }
}

// Chamado uma vez quando o servidor liga (src/instrumentation.ts)
export function agendarEmails() {
  if (globalThis.__workendEmailsTimer || !temBanco() || process.env.NEXT_PHASE === "phase-production-build") return;
  const tick = () => { void cicloEmails().catch((e) => console.error("[emails]", erroDe(e))); };
  globalThis.__workendEmailsTimer = setInterval(tick, Number(process.env.EMAILS_CICLO_MS) || 10 * 60_000);
  setTimeout(tick, Number(process.env.EMAILS_PRIMEIRO_CICLO_MS) || 2 * 60_000);
  console.log("[emails] agenda ligada");
}
