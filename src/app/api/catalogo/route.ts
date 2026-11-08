// Agentes que o WorkEnd vende (público: o painel da loja lê daqui pra "Contratar agentes")
import { catalogoAVenda, APIS_DISPONIVEIS } from "@/server/catalogo";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() { try { return ok({ agentes: await catalogoAVenda(), apis: APIS_DISPONIVEIS }); } catch (e) { return erro(e); } }
