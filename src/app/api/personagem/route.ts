// Meu personagem: ver (com preço e tipos) e montar/editar
import { usuarioAtual } from "@/server/usuarios";
import { meuPersonagem, salvarPersonagem, personagemAtivo, PRECO_PERSONAGEM, PRECO_PERSONAGEM_CHEIO } from "@/server/personagens";
import { pagamentoLigado } from "@/server/mercadopago";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const u = await usuarioAtual();
    const p = u ? await meuPersonagem(u.id) : null;
    return ok({ personagem: p, ativo: personagemAtivo(p, u), preco: PRECO_PERSONAGEM, precoCheio: PRECO_PERSONAGEM_CHEIO, pagamento: pagamentoLigado(), agora: new Date().toISOString() });
  } catch (e) { return erro(e); }
}
export async function PUT(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const p = await salvarPersonagem(u, await corpo(req));
    return ok({ personagem: p, ativo: personagemAtivo(p, u) });
  } catch (e) { return erro(e); }
}
