// Ações do admin num lote: liberar (tira a reserva/empresa), ativar (dá meses pagos à mão), banir (tira o imóvel e suspende o dono)
import { adminLiberar, adminAtivar, adminBanir } from "@/server/terrenos";
import { ok, erro, corpo } from "@/server/http";
import { exigirAdmin, statusDe } from "../../_guarda";
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ chave: string }> };
export async function POST(req: Request, { params }: Ctx) {
  try {
    await exigirAdmin();
    const { chave } = await params; const ch = decodeURIComponent(chave);
    const { acao, motivo, meses } = await corpo<{ acao: string; motivo?: string; meses?: number }>(req);
    if (acao === "liberar") await adminLiberar(ch);
    else if (acao === "ativar") await adminAtivar(ch, meses ?? 1);
    else if (acao === "banir") await adminBanir(ch, motivo ?? "");
    else return erro("Ação desconhecida.", 400);
    return ok({ feito: acao });
  } catch (e) { return erro(e, statusDe(e)); }
}
