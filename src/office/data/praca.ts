// Praça de eventos e feira de sábado (12/11/2026). A praça ocupa o lote 0,1,1 (ao sul da Nuvem, do outro lado da rua),
// que saiu da venda (a numeração dos lotes não muda). Palco no fundo, plateia no meio e, aos sábados, 6 barracas.
export const PRACA_CHAVE = "0,1,1";
export const PRECO_BARRACA = 9.9; // R$ por sábado
export const VAGAS_FEIRA = 6;
export const FEIRA_ABRE = 8, FEIRA_FECHA = 18; // horário de Brasília, aos sábados
export const MAX_EVENTOS_FUTUROS = 2; // por empresa
export const DURACOES_EVENTO = [30, 60, 90, 120];
export const TIPOS_BARRACA = [
  { id: "comida", nome: "Comida e doces", icone: "🍰" }, { id: "roupas", nome: "Roupas e acessórios", icone: "👕" },
  { id: "artesanato", nome: "Artesanato", icone: "🧶" }, { id: "servicos", nome: "Serviços", icone: "🛠️" },
  { id: "plantas", nome: "Plantas e flores", icone: "🌿" }, { id: "livros", nome: "Livros e cursos", icone: "📚" },
];
export const CORES_BARRACA = ["#E2575B", "#F59E0B", "#16A34A", "#1D4ED8", "#7C3AED", "#DB2777"];

// data (AAAA-MM-DD) e dia da semana em Brasília
export function hojeBrasilia(agora = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(agora);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { data: `${v("year")}-${v("month")}-${v("day")}`, semana: v("weekday"), hora: Number(v("hour")) };
}
// o próximo sábado de feira: hoje se for sábado antes do fechamento, senão o próximo
export function proximaFeira(agora = new Date()): string {
  const h = hojeBrasilia(agora);
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(h.semana);
  let falta = (6 - dias + 7) % 7; if (falta === 0 && h.hora >= FEIRA_FECHA) falta = 7;
  const d = new Date(`${h.data}T12:00:00-03:00`); d.setUTCDate(d.getUTCDate() + falta);
  return d.toISOString().slice(0, 10);
}
export const feiraAberta = (agora = new Date()) => { const h = hojeBrasilia(agora); return h.semana === "Sat" && h.hora >= FEIRA_ABRE && h.hora < FEIRA_FECHA; };
export const dataCurta = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
