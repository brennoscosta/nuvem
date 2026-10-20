import { garantirEmpresa, listarAgentes, criarAgente, gravarEvento, resumoPublico, type NovoAgente } from "@/server/agentes";
import { ok, erro, corpo } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try { const emp = await garantirEmpresa(); const lista = await listarAgentes(emp); return ok((await ehAdmin()) ? lista : lista.map(resumoPublico)); } catch (e) { return erro(e); }
}
export async function POST(req: Request) {
  if (!(await ehAdmin())) return naoAutorizado();
  try {
    const emp = await garantirEmpresa();
    const b = await corpo<NovoAgente>(req);
    if (!b.nome || !b.area || !b.nivel) return erro("nome, area e nivel são obrigatórios", 400);
    if (b.nivel === "ceo") { const todos = await listarAgentes(emp); if (todos.some((a) => a.nivel === "ceo")) return erro("Já existe um CEO.", 400); }
    const a = await criarAgente(emp, b);
    await gravarEvento(emp, a.id, "contratado", `${a.nome} entrou como ${a.nivel} de ${a.area}`);
    return ok(a, 201);
  } catch (e) { return erro(e); }
}
