// Painel "Meu escritório" (16/11/2026, pedido do dono: "melhore totalmente essa página"): junta numa ida ao banco o que
// o dono precisa ver ao entrar — a loja, a semana em números, os próximos horários, o que falta para a loja ficar
// completa, as ferramentas com prévia de verdade, a equipe de IA e a indicação. Cada parte tem um valor padrão: se uma
// consulta falhar, o painel abre do mesmo jeito (só aquela parte fica vazia).
import { sql, migrar } from "./db";
import type { Usuario } from "./usuarios";
import { ehAdmin, type Terreno } from "./terrenos";
import { resultadosDoDono, vendasDoMes, type Serie } from "./resultados";
import { vitrineResumo } from "./vitrine";
import { cuponsDoDono } from "./cupons";
import { seguidoresDe } from "./seguir";
import { meuCodigo, minhasIndicacoes, vagasFundador, primeiraVez, cotacaoLote, FUNDADOR, CREDITO_INDICACAO, INDICADO } from "./ofertas";
import { empresaIdDe, gastoDoMes, especialistaDe, fotoDoEspecialista, TETO_IA_MES, type Contatos } from "./equipeCliente";
import { medidorIA } from "./unidadesIA";
import { diaDe, horaDe, rotuloDia } from "./agenda";
import { LOTE_POR_CHAVE, bairroDoLote, nomeNicho } from "@/office/data/mundo";
import { sedeDe } from "@/office/data/sedes";

const TZ = "America/Sao_Paulo";
const seguro = <T,>(p: Promise<T>, padrao: T, onde: string): Promise<T> => p.catch((e) => { console.error("[painel]", onde, (e as Error).message); return padrao; });
const fmtDiaMes = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });

// saudação e data de hoje no horário de Brasília
export function saudacaoBR(agora = new Date()) {
  const h = +new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(agora);
  const data = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(agora);
  return { oi: h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite", data };
}

// quem ainda não tem lote: o preço de entrada que vale para esta conta
export async function ofertaDeEntrada(u: Usuario) {
  const [restam, primeira] = await Promise.all([seguro(vagasFundador(u.id), 0, "fundador"), seguro(primeiraVez(u.id), false, "primeira")]);
  return { fundador: primeira && restam > 0 ? { valor: FUNDADOR.valor, vagas: FUNDADOR.vagas, restam } : null };
}

// lote reservado: quanto sai o 1º mês e quanto tempo falta para a reserva cair
export async function painelReserva(u: Usuario, t: Terreno) {
  const c = await seguro(cotacaoLote(u, t.chave, 1), null, "cotacao");
  const ate = t.reservadoAte ? new Date(t.reservadoAte).getTime() : 0;
  return { valor: c?.valor ?? null, base: c?.base ?? 99, oferta: c?.oferta ? { nome: c.oferta.nome, detalhe: c.oferta.detalhe } : null, creditoUsado: c?.creditoUsado ?? 0, restaMs: ate ? Math.max(0, ate - Date.now()) : null };
}

export type Numero = { total: number; anterior: number; serie: { rotulo: string; n: number }[] };
const numero = (x: { total: number; anterior: number; serie: Serie } | null | undefined): Numero => ({
  total: x?.total ?? 0, anterior: x?.anterior ?? 0,
  serie: (x?.serie ?? []).map((s) => ({ rotulo: rotuloDia(s.dia), n: s.n })),
});

export async function painelDoDono(u: Usuario, t: Terreno) {
  await migrar();
  const uid = u.id;
  const empId = empresaIdDe(uid, t.chave, ehAdmin(u));
  const [res, proximos, vitrine, cupons, seguidores, codigo, indicacoes, avisos, gasto, empresa, visitantes, vendasMes] = await Promise.all([
    seguro(resultadosDoDono(u, t, 7), null, "resultados"),
    seguro(sql<{ id: string; servico: string; inicio: Date; fim: Date; nome: string }[]>`SELECT id, servico, inicio, fim, nome FROM agendamento WHERE dono_id = ${uid} AND status = 'marcado' AND fim > now() ORDER BY inicio LIMIT 3`.then((r) => [...r]), [], "agenda"),
    seguro(vitrineResumo(uid, 4), { ativos: 0, max: 12, primeiros: [] }, "vitrine"),
    seguro(cuponsDoDono(u), [], "cupons"),
    seguro(seguidoresDe(uid, 30), { total: 0, novos: 0 }, "seguidores"),
    seguro(meuCodigo(u), null, "codigo"),
    seguro(minhasIndicacoes(u), { lista: [], credito: 0 }, "indicacoes"),
    seguro(sql<{ n: number }[]>`SELECT count(*)::int AS n FROM aviso WHERE usuario_id = ${uid} AND lido_em IS NULL`, [{ n: 0 }], "avisos"),
    seguro(gastoDoMes(empId), 0, "gasto"),
    seguro(sql<{ sobre: string; contatos: Contatos }[]>`SELECT sobre, contatos FROM empresa WHERE id = ${empId}`.then((r) => [...r]), [], "empresa"),
    seguro(sql<{ n: number }[]>`SELECT count(DISTINCT COALESCE(m.visitante_anonimo, m.visitante_id))::int AS n FROM mensagem m JOIN agente a ON a.id = m.agente_id
      WHERE a.empresa_id = ${empId} AND m.visitante_id IS NOT NULL AND m.papel = 'user' AND m.criado_em >= now() - interval '24 hours'`, [{ n: 0 }], "visitantes"),
    // vendas do mês (17/11/2026): o cartão "Este mês: R$ X em vendas" que leva aos Resultados
    seguro(vendasDoMes(uid), null, "vendas"),
  ]);

  // medidor "Unidades de IA" (20/11/2026): saldo, consumo do mês e estimativa em respostas (nunca em tokens)
  const unidades = await seguro<{ saldo: number; inclusa: number; comprada: number; mes: number; usadas: number; respostas: number; aviso: boolean; esgotado: boolean; cobrada: boolean } | null>(medidorIA(empId).then((m) => ({ saldo: m.saldo.total, inclusa: m.saldo.inclusa, comprada: m.saldo.comprada, mes: m.saldo.baseMes, usadas: m.usadasMes, respostas: m.respostas, aviso: m.aviso, esgotado: m.esgotado, cobrada: m.saldo.cobrada })), null, "unidades");
  const info = LOTE_POR_CHAVE[t.chave];
  const bairro = bairroDoLote(t.chave);
  const agora = Date.now();
  const pagoAte = t.pagoAte ? new Date(t.pagoAte) : null;
  const sd = sedeDe(t.chave), sede = !!sd; // sedes (src/office/data/sedes.ts): sem número de loja nem mensalidade
  const diasRestam = pagoAte && !sede ? Math.ceil((pagoAte.getTime() - agora) / 86400_000) : null;

  const equipe = (t.escritorio?.equipe ?? []).map((m) => {
    const esp = especialistaDe(m);
    return { id: m.id, nome: m.nome, cargo: esp?.cargo ?? m.cargo, papel: m.papel, camisa: m.camisa, foto: fotoDoEspecialista(esp), catalogoId: esp?.id ?? null };
  });
  const especialistas = equipe.filter((m) => m.papel === "profissional").length;

  const ativos = cupons.filter((c) => c.ativo && !c.vencido);
  const contatos = empresa[0]?.contatos ?? {};
  const promo = t.promocao ? { texto: t.promocao.texto, ate: t.promocao.ate } : null;
  const fmtAte = (iso: string) => { const d = new Date(iso); return diaDe(d) === diaDe(new Date()) ? `hoje, até ${horaDe(d)}` : `até ${fmtDiaMes.format(d)}`; };

  // o que falta para a loja ficar completa (cada item leva direto para onde se faz)
  const lote = sd ? `/mundo?sede=${sd.id}` : `/mundo?lote=${encodeURIComponent(t.chave)}`;
  const passos = [
    { id: "logo", feito: t.temLogo, titulo: "Logomarca na placa", texto: "Aparece na fachada, no balão do mapa e na página da loja.", link: lote, acao: "Pôr a logo" },
    { id: "contatos", feito: !!(contatos.whatsapp || contatos.instagram || contatos.site), titulo: "WhatsApp e redes da loja", texto: "Os botões que levam o cliente até você.", link: "/app/equipe?aba=sobre", acao: "Preencher" },
    { id: "vitrine", feito: vitrine.ativos > 0, titulo: "Um produto na vitrine", texto: "Foto, nome e preço, com pedido pelo WhatsApp.", link: "/app/vitrine", acao: "Montar" },
    { id: "especialista", feito: especialistas > 0, titulo: "Um especialista na equipe", texto: "Além do CEO e da atendente, alguém para executar.", link: lote, acao: "Contratar" },
    { id: "cupom", feito: cupons.length > 0, titulo: "O primeiro cupom", texto: "Um motivo para o visitante voltar e comprar.", link: "/app/cupons", acao: "Criar" },
    { id: "agenda", feito: !!res?.agendaLigada, titulo: "Agenda ligada", texto: "Se você atende com hora marcada: o cliente marca pelo mapa.", link: "/app/agenda", acao: "Ligar" },
  ];

  const ind = indicacoes.lista;
  return {
    sede, sedeLogo: sd?.logo ?? null, numero: info?.numero ?? null, bairro: bairro ? { nome: bairro.nome, cor: bairro.cor } : null, nicho: nomeNicho(t.nicho),
    layout: t.escritorio?.layout ?? "moderno", logo: t.temLogo ? `/api/terrenos/${encodeURIComponent(t.chave)}/logo` : null,
    pagoAte: pagoAte ? (sede ? pagoAte.toLocaleDateString("pt-BR", { timeZone: TZ }) : fmtDiaMes.format(pagoAte)) : null, diasRestam,
    inaugurouHoje: !!t.inauguradoEm && agora - new Date(t.inauguradoEm).getTime() < 86400_000,
    promo: promo ? { texto: promo.texto, quando: fmtAte(promo.ate) } : null,
    semana: res ? {
      visitas: numero(res.visitas), conversas: numero(res.conversas), cliques: numero(res.cliques), horarios: res.agendamentos ? numero(res.agendamentos) : null,
      topDia: res.topDias && res.topDias.n > 0 ? rotuloDia(res.topDias.dia) : null,
      candidaturas: res.candidaturas.total, vagasAbertas: res.candidaturas.vagasAbertas, agendaLigada: res.agendaLigada,
    } : null,
    seguidores,
    proximos: proximos.map((a) => ({ id: a.id, servico: a.servico, nome: a.nome.split(" ")[0], dia: rotuloDia(diaDe(new Date(a.inicio))), hora: horaDe(new Date(a.inicio)), diaNum: diaDe(new Date(a.inicio)).slice(8, 10), hoje: diaDe(new Date(a.inicio)) === diaDe(new Date()) })),
    vitrine,
    cupons: { ativos: ativos.length, primeiro: ativos[0]?.titulo ?? null, regra: ativos[0]?.regra ?? null, pegos: cupons.reduce((s, c) => s + c.pegos, 0), usados: cupons.reduce((s, c) => s + c.usados, 0) },
    indicacao: { codigo, link: codigo && info?.numero ? `workend.online/loja/${info.numero}?ind=${codigo}` : codigo ? `workend.online/?ind=${codigo}` : null, credito: indicacoes.credito, pagas: ind.filter((x) => x.status === "liberada").length, esperando: ind.filter((x) => x.status === "pendente").length, porEmpresa: CREDITO_INDICACAO, descontoIndicado: Math.round(INDICADO.desconto * 100) },
    avisosNaoLidos: avisos[0]?.n ?? 0,
    ia: { gasto, teto: TETO_IA_MES, unidades },
    vendasMes,
    visitantes24h: visitantes[0]?.n ?? 0,
    equipe, especialistas, contratados: equipe.map((m) => m.catalogoId).filter((x): x is string => !!x),
    passos,
    hoje: { semana: rotuloDia(diaDe(new Date())).split(" ")[0], num: diaDe(new Date()).slice(8, 10) },
  };
}
export type Painel = Awaited<ReturnType<typeof painelDoDono>>;
