// Agendamento pela loja (12/11/2026): constantes e formato da configuração, usados no servidor (src/server/agenda.ts),
// na página do dono (/app/agenda) e no cartão da loja (ui/AgendarLoja.tsx).
export interface ServicoAgenda { id: string; nome: string; duracao: number; preco: string }
export interface DiaAgenda { aberto: boolean; ini: string; fim: string; pausaIni?: string; pausaFim?: string }
export interface ConfigAgenda { ligada: boolean; servicos: ServicoAgenda[]; horarios: Record<string, DiaAgenda>; passo: number; antecedenciaMin: number; diasFrente: number }

export const MAX_SERVICOS = 8;
export const MAX_FUTUROS_CLIENTE = 3; // horários futuros de um mesmo cliente numa loja
export const DURACOES = [15, 20, 30, 40, 45, 50, 60, 75, 90, 120, 150, 180, 240];
export const PASSOS = [15, 30, 60];
export const ANTECEDENCIAS: { min: number; nome: string }[] = [
  { min: 0, nome: "Sem antecedência" }, { min: 30, nome: "30 minutos" }, { min: 60, nome: "1 hora" }, { min: 120, nome: "2 horas" },
  { min: 240, nome: "4 horas" }, { min: 720, nome: "12 horas" }, { min: 1440, nome: "1 dia" },
];
export const DIAS_FRENTE = [7, 14, 30, 60];
export const NOMES_DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const NOMES_STATUS: Record<string, string> = { marcado: "Marcado", cancelado: "Cancelado", concluido: "Concluído", faltou: "Faltou" };

const semana = (ini: string, fim: string, pausa = true): DiaAgenda => ({ aberto: true, ini, fim, ...(pausa ? { pausaIni: "12:00", pausaFim: "13:00" } : {}) });
export const CONFIG_PADRAO: ConfigAgenda = {
  ligada: false,
  servicos: [],
  horarios: { "0": { aberto: false, ini: "09:00", fim: "13:00" }, "1": semana("09:00", "18:00"), "2": semana("09:00", "18:00"), "3": semana("09:00", "18:00"), "4": semana("09:00", "18:00"), "5": semana("09:00", "18:00"), "6": semana("09:00", "13:00", false) },
  passo: 30, antecedenciaMin: 60, diasFrente: 30,
};

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const paraMin = (h: string) => +h.slice(0, 2) * 60 + +h.slice(3, 5);
export const paraHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const duracaoTexto = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m / 60}h`);

// faixas abertas de um dia (em minutos desde 0h): sem pausa válida, uma faixa só
export function faixasDoDia(d: DiaAgenda | undefined): [number, number][] {
  if (!d?.aberto || !HHMM.test(d.ini) || !HHMM.test(d.fim)) return [];
  const a = paraMin(d.ini), b = paraMin(d.fim); if (b <= a) return [];
  if (d.pausaIni && d.pausaFim && HHMM.test(d.pausaIni) && HHMM.test(d.pausaFim)) {
    const p = paraMin(d.pausaIni), q = paraMin(d.pausaFim);
    if (a < p && p < q && q < b) return [[a, p], [q, b]];
  }
  return [[a, b]];
}

// Limpa o que veio da tela (ou do banco): nada fora das listas, nomes curtos, horários válidos
export function limparConfig(x: unknown): ConfigAgenda {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const txt = (v: unknown, max: number) => (typeof v === "string" ? v : "").replace(/<[^>]*>/g, "").replace(/[<>{}[\]\\"]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
  const vistos = new Set<string>();
  const servicos: ServicoAgenda[] = (Array.isArray(o.servicos) ? o.servicos : []).slice(0, MAX_SERVICOS).map((s, i) => {
    const r = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    let sid = txt(r.id, 16).replace(/[^a-zA-Z0-9_-]/g, "") || `s${i + 1}`;
    while (vistos.has(sid)) sid = `${sid}x`;
    vistos.add(sid);
    const dur = Number(r.duracao);
    return { id: sid, nome: txt(r.nome, 50), duracao: DURACOES.includes(dur) ? dur : 30, preco: txt(r.preco, 30) };
  }).filter((s) => s.nome.length >= 2);
  const h = (o.horarios && typeof o.horarios === "object" ? o.horarios : {}) as Record<string, unknown>;
  const horarios: Record<string, DiaAgenda> = {};
  for (let d = 0; d < 7; d++) {
    const r = (h[String(d)] && typeof h[String(d)] === "object" ? h[String(d)] : {}) as Record<string, unknown>;
    const base = CONFIG_PADRAO.horarios[String(d)];
    const hh = (v: unknown, def: string) => (typeof v === "string" && HHMM.test(v) ? v : def);
    const dia: DiaAgenda = { aberto: r.aberto === true, ini: hh(r.ini, base.ini), fim: hh(r.fim, base.fim) };
    if (typeof r.pausaIni === "string" && HHMM.test(r.pausaIni) && typeof r.pausaFim === "string" && HHMM.test(r.pausaFim)) { dia.pausaIni = r.pausaIni; dia.pausaFim = r.pausaFim; }
    horarios[String(d)] = dia;
  }
  const passo = PASSOS.includes(Number(o.passo)) ? Number(o.passo) : 30;
  const antecedenciaMin = ANTECEDENCIAS.some((a) => a.min === Number(o.antecedenciaMin)) ? Number(o.antecedenciaMin) : 60;
  const diasFrente = DIAS_FRENTE.includes(Number(o.diasFrente)) ? Number(o.diasFrente) : 30;
  return { ligada: o.ligada === true, servicos, horarios, passo, antecedenciaMin, diasFrente };
}
export const agendaUsavel = (c: ConfigAgenda) => c.ligada && c.servicos.length > 0 && Object.values(c.horarios).some((d) => faixasDoDia(d).length > 0);
