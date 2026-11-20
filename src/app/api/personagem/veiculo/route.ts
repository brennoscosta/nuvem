// Cor da bicicleta do meu personagem (19/11/2026): uma das cores de data/veiculos.ts, guardada junto do visual
import { usuarioAtual } from "@/server/usuarios";
import { meuPersonagem, personagemAtivo, escolherCorVeiculo } from "@/server/personagens";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function PUT(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const p = await meuPersonagem(u.id);
    if (!personagemAtivo(p, u)) return erro("Crie o seu personagem para ter a bicicleta.", 403);
    const d = await corpo<{ cor?: string }>(req);
    return ok({ cor: await escolherCorVeiculo(u.id, d.cor) });
  } catch (e) { return erro(e); }
}
