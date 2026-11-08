// Resumo da minha rede (pro painel): personagem, amigos, pedidos, negociações, conversas
import { usuarioAtual } from "@/server/usuarios";
import { meuPersonagem, personagemAtivo, caixaDeEntrada, PRECO_PERSONAGEM, PRECO_PERSONAGEM_CHEIO } from "@/server/personagens";
import { listarAmigos, listarPedidos, listarNegociacoes } from "@/server/rede";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta.", 401);
    const p = await meuPersonagem(u.id); const ativo = personagemAtivo(p, u);
    if (!ativo) return ok({ personagem: p, ativo, preco: PRECO_PERSONAGEM, precoCheio: PRECO_PERSONAGEM_CHEIO, amigos: [], pedidos: [], negociacoes: [], conversas: [] });
    const [amigos, pedidos, negociacoes, conversas] = await Promise.all([listarAmigos(u.id), listarPedidos(u.id), listarNegociacoes(u.id), caixaDeEntrada(u.id)]);
    return ok({ personagem: p, ativo, preco: PRECO_PERSONAGEM, precoCheio: PRECO_PERSONAGEM_CHEIO, amigos, pedidos, negociacoes, conversas });
  } catch (e) { return erro(e); }
}
