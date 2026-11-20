// Pessoas na cidade agora (server/online.ts). Aberto a todos, com ou sem conta: só o que já é público no mapa (o nome e a
// aparência do personagem e onde ele está) e o número de visitantes.
//  GET: o resumo (guardado por 5 s no servidor).
//  POST { id, conta, t }: batida do visitante sem personagem (id aleatório do navegador, a cada 30 s; t = hora do navegador);
//  devolve o resumo.
//  POST { id, sair: true, personagem?: true }: fechou o mapa (sendBeacon): o visitante sai na hora; com personagem, ele
//  também deixa de contar.
import { usuarioAtual } from "@/server/usuarios";
import { resumoOnline, batidaVisitante, saiuVisitante, saiuPersonagem } from "@/server/online";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return ok(await resumoOnline()); } catch (e) { return erro(e); }
}
export async function POST(req: Request) {
  try {
    const d = await corpo<{ id?: unknown; conta?: unknown; sair?: unknown; personagem?: unknown; t?: unknown }>(req);
    if (d.sair) {
      saiuVisitante(d.id, d.t);
      if (d.personagem) { const u = await usuarioAtual().catch(() => null); if (u) await saiuPersonagem(u.id); }
      return ok({ ok: true });
    }
    batidaVisitante(d.id, d.conta === true, d.t);
    return ok(await resumoOnline());
  } catch (e) { return erro(e); }
}
