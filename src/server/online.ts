// Quantas pessoas estão na cidade agora (20/11/2026, pedido do dono: "quero que mostre quantas pessoas estão online na
// cidade e que possam ver"). Duas fontes:
//  - personagens: a batida de posição que já existe (personagem.visto_em, SEGUNDOS_ONLINE), com as mesmas regras de quem
//    aparece no mapa (server/personagens.ts › outrosOnline);
//  - visitantes sem personagem (sem conta ou com conta e sem personagem): uma batida leve a cada 30 s com um identificador
//    aleatório do navegador. Fica só na memória deste servidor (sem IP, sem cookie, sem banco, nenhum dado pessoal) e vence
//    em 90 s sem batida.
// Uma consulta agregada no banco, guardada por 5 s (e uma só em andamento): mais gente olhando não pesa o servidor.
import { sql, migrar } from "./db";
import { SEGUNDOS_ONLINE, filtroPersonagemAtivo } from "./personagens";

export interface PessoaOnline { usuarioId: string; nome: string; boneco: string; roupa: string; x: number; z: number }
export interface ResumoOnline { total: number; personagens: number; semConta: number; semPersonagem: number; lista: PessoaOnline[] }

const EXPIRA_MS = 90_000, GUARDA_MS = 5_000, MAX_VISITANTES = 20_000, LISTA_MAX = 30;
const visitantes = new Map<string, { t: number; conta: boolean }>();
// quem acabou de sair: a hora (do navegador) do aviso de saída. Uma batida que já estava a caminho e chega depois do aviso
// tem hora mais antiga e é ignorada (senão o visitante voltava a contar por 90 s); quem recarrega manda uma hora mais nova
const saidas = new Map<string, { tCliente: number; em: number }>();
let guardado: { em: number; personagens: number; lista: PessoaOnline[] } | null = null;
let buscando: Promise<{ em: number; personagens: number; lista: PessoaOnline[] }> | null = null;

const ID_OK = /^[a-z0-9]{16,40}$/;
function limpar() {
  const lim = Date.now() - EXPIRA_MS; for (const [k, v] of visitantes) if (v.t < lim) visitantes.delete(k);
  for (const [k, v] of saidas) if (v.em < Date.now() - 60_000) saidas.delete(k);
}
export function batidaVisitante(id: unknown, conta: boolean, tCliente?: unknown): boolean {
  if (typeof id !== "string" || !ID_OK.test(id)) return false;
  const saiu = saidas.get(id), t = Number(tCliente);
  if (saiu && (!Number.isFinite(t) || t <= saiu.tCliente)) return false;
  if (!visitantes.has(id) && visitantes.size >= MAX_VISITANTES) { limpar(); if (visitantes.size >= MAX_VISITANTES) return false; }
  visitantes.set(id, { t: Date.now(), conta: !!conta });
  return true;
}
export function saiuVisitante(id: unknown, tCliente?: unknown) {
  if (typeof id !== "string" || !ID_OK.test(id)) return;
  visitantes.delete(id);
  const t = Number(tCliente); if (Number.isFinite(t)) { if (saidas.size > MAX_VISITANTES) limpar(); saidas.set(id, { tCliente: t, em: Date.now() }); }
}
function contarVisitantes() {
  limpar(); let semConta = 0, semPersonagem = 0;
  for (const v of visitantes.values()) { if (v.conta) semPersonagem++; else semConta++; }
  return { semConta, semPersonagem };
}

async function personagensAgora() {
  if (guardado && Date.now() - guardado.em < GUARDA_MS) return guardado;
  buscando ??= (async () => {
    await migrar();
    const linhas = await sql<(PessoaOnline & { total: number })[]>`SELECT usuario_id, nome, boneco, roupa, x, z, COUNT(*) OVER ()::int AS total FROM personagem
      WHERE visto_em > now() - make_interval(secs => ${SEGUNDOS_ONLINE}) AND ${filtroPersonagemAtivo()}
      ORDER BY visto_em DESC LIMIT ${LISTA_MAX}`;
    guardado = { em: Date.now(), personagens: linhas[0]?.total ?? 0, lista: linhas.map((p) => ({ usuarioId: p.usuarioId, nome: p.nome, boneco: p.boneco, roupa: p.roupa, x: Number(p.x) || 0, z: Number(p.z) || 0 })) };
    return guardado;
  })().finally(() => { buscando = null; });
  return buscando;
}

export async function resumoOnline(): Promise<ResumoOnline> {
  const p = await personagensAgora(), v = contarVisitantes();
  return { total: p.personagens + v.semConta + v.semPersonagem, personagens: p.personagens, ...v, lista: p.lista };
}

// quem fecha o mapa com o personagem deixa de contar na hora (sem esperar a batida vencer); a próxima batida o traz de volta
export async function saiuPersonagem(usuarioId: string) {
  await sql`UPDATE personagem SET visto_em = now() - interval '1 hour' WHERE usuario_id = ${usuarioId} AND visto_em > now() - interval '1 minute'`;
  guardado = null;
}
