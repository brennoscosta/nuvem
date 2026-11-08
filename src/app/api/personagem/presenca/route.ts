// Batida de presença: manda minha posição, recebe quem está online e quantas mensagens não li
import { usuarioAtual } from "@/server/usuarios";
import { presenca, meuPersonagem, personagemAtivo, outrosOnline, naoLidas } from "@/server/personagens";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual();
    if (!u) return ok({ outros: await outrosOnline(null), naoLidas: 0 }); // visitante só vê
    const p = await meuPersonagem(u.id);
    if (!personagemAtivo(p, u)) return ok({ outros: await outrosOnline(u.id), naoLidas: await naoLidas(u.id) });
    const d = await corpo<{ x: number; z: number; rot: number }>(req);
    return ok({ outros: await presenca(u.id, d), naoLidas: await naoLidas(u.id) });
  } catch (e) { return erro(e); }
}
