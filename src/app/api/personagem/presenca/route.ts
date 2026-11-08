// Batida de presença: manda minha posição, recebe quem está online, quantas mensagens não li,
// pedidos de amizade pendentes e se tem uma chamada tocando/ativa pra mim
import { usuarioAtual } from "@/server/usuarios";
import { presenca, meuPersonagem, personagemAtivo, outrosOnline, naoLidas } from "@/server/personagens";
import { pedidosRecebidos, minhaChamada } from "@/server/rede";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual();
    if (!u) return ok({ outros: await outrosOnline(null), naoLidas: 0, pedidos: 0, chamada: null }); // visitante só vê
    const p = await meuPersonagem(u.id);
    if (!personagemAtivo(p, u)) return ok({ outros: await outrosOnline(u.id), naoLidas: await naoLidas(u.id), pedidos: 0, chamada: null });
    const d = await corpo<{ x: number; z: number; rot: number; destino?: [number, number] | null; vel?: number }>(req);
    const [outros, nl, pedidos, chamada] = await Promise.all([presenca(u.id, d), naoLidas(u.id), pedidosRecebidos(u.id), minhaChamada(u.id)]);
    return ok({ outros, naoLidas: nl, pedidos, chamada });
  } catch (e) { return erro(e); }
}
