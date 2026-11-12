// Conversa do visitante com a atendente da loja (precisa estar logado). GET → as minhas mensagens; POST { texto }.
import { usuarioAtual } from "@/server/usuarios";
import { conversaNaLoja, falarNaLoja, statusDe } from "@/server/equipeCliente";
import { lojaDoNumero } from "@/server/resultados";
import { avisar } from "@/server/avisos";
import { sql } from "@/server/db";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
type Ctx = { params: Promise<{ numero: string }> };
export async function GET(_: Request, { params }: Ctx) {
  try { const u = await usuarioAtual(); if (!u) return ok([]); const { numero } = await params; return ok(await conversaNaLoja(u, Number(numero) | 0)); }
  catch (e) { return erro(e, statusDe(e)); }
}
export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd para conversar com a loja.", 401);
    if (u.banidoEm) return erro("Conta suspensa.", 403);
    const { numero } = await params; const d = await corpo<{ texto?: string }>(req);
    const r = await falarNaLoja(u, Number(numero) | 0, d.texto ?? "");
    void avisarDono(Number(numero) | 0, u.id, u.nome, d.texto ?? "");
    return ok(r);
  } catch (e) { return erro(e, statusDe(e)); }
}
// sino do dono (12/11/2026): uma conversa por visitante, que volta para o topo a cada mensagem nova
async function avisarDono(numero: number, visitanteId: string, nomeConta: string, texto: string) {
  const loja = await lojaDoNumero(numero).catch(() => null); if (!loja || loja.donoId === visitanteId) return;
  const [p] = await sql<{ nome: string }[]>`SELECT nome FROM personagem WHERE usuario_id = ${visitanteId}`.catch(() => []);
  await avisar(loja.donoId, { tipo: "loja", ref: `loja:${visitanteId}`, renovar: true, titulo: `${p?.nome ?? nomeConta.split(" ")[0]} falou com a sua atendente`, texto: texto.slice(0, 140), link: "/app/equipe" });
}
