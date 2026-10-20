// Treino: avaliar uma resposta e, se houver correção, transformá-la numa regra permanente.
import { avaliarMensagem, salvarRegra } from "@/server/agentes";
import { destilarRegra } from "@/server/motor";
import { ok, erro, corpo } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  if (!(await ehAdmin())) return naoAutorizado();
  try {
    const { id } = await params;
    const b = await corpo<{ mensagemId: string; avaliacao: 1 | -1 | null; correcao?: string; virarRegra?: boolean }>(req);
    if (!b.mensagemId) return erro("mensagemId obrigatório", 400);
    const m = await avaliarMensagem(id, b.mensagemId, b.avaliacao, b.correcao);
    let regra = null;
    if (b.correcao?.trim() && b.virarRegra !== false) {
      const texto = await destilarRegra(id, b.correcao.trim(), m?.conteudo ?? "");
      regra = await salvarRegra(id, { texto, origemMensagemId: b.mensagemId });
    }
    return ok({ mensagem: m, regra });
  } catch (e) { return erro(e); }
}
