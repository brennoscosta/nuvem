// Uma chamada: GET ?desde=seq consulta (estado + sinais novos do outro lado); POST {acao: atender|encerrar} ou {tipo, dados} manda sinal
import { exigirPersonagem, statusDe } from "../../_personagem";
import { consultarChamada, atenderChamada, encerrarChamada, enviarSinal } from "@/server/rede";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };
export async function GET(req: Request, { params }: Ctx) { try { const u = await exigirPersonagem(); const { id } = await params; return ok(await consultarChamada(u, id, Number(new URL(req.url).searchParams.get("desde") ?? 0))); } catch (e) { return erro(e, statusDe(e)); } }
export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await exigirPersonagem(); const { id } = await params; const d = await corpo<{ acao?: string; tipo?: string; dados?: unknown }>(req);
    if (d.acao === "atender") return ok(await atenderChamada(u, id));
    if (d.acao === "encerrar") return ok(await encerrarChamada(u, id));
    await enviarSinal(u, id, d.tipo ?? "", d.dados); return ok({ feito: true });
  } catch (e) { return erro(e, statusDe(e)); }
}
