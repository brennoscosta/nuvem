import { garantirEmpresa, listarAgentes, criarAgente, gravarEvento, resumoPublico, type NovoAgente } from "@/server/agentes";
import { arrumarMesas, areaCorreta } from "@/server/mesas";
import { ok, erro, corpo } from "@/server/http";
import { ehAdmin, naoAutorizado } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  // antes de responder, confere que cada agente está na mesa da própria sala (e corrige no banco se não estiver)
  try { const emp = await garantirEmpresa(); const lista = await arrumarMesas(emp); return ok((await ehAdmin()) ? lista : lista.map(resumoPublico)); } catch (e) { return erro(e); }
}
export async function POST(req: Request) {
  if (!(await ehAdmin())) return naoAutorizado();
  try {
    const emp = await garantirEmpresa();
    const b = await corpo<NovoAgente>(req);
    if (!b.nome || !b.area || !b.nivel) return erro("nome, area e nivel são obrigatórios", 400);
    if (b.nivel === "ceo") { const todos = await listarAgentes(emp); if (todos.some((a) => a.nivel === "ceo")) return erro("Já existe um CEO.", 400); }
    const criado = await criarAgente(emp, { ...b, area: areaCorreta(b) });
    // a mesa definitiva é a que o servidor escolher (sala certa, livre)
    const a = (await arrumarMesas(emp)).find((x) => x.id === criado.id) ?? criado;
    await gravarEvento(emp, a.id, "contratado", `${a.nome} entrou como ${a.nivel} de ${a.area}`);
    return ok(a, 201);
  } catch (e) { return erro(e); }
}
