// Telão da Praça de Eventos (20/11/2026): GET → a grade (público); POST multipart { tipo, formato, frase, inicio, dias,
// eventoId, arquivo } → monta um anúncio (telão, evento em destaque ou patrocínio) e reserva a vaga por 70 minutos.
import { usuarioAtual } from "@/server/usuarios";
import { gradeTelao, criarAnuncio } from "@/server/praca";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return ok(await gradeTelao()); } catch (e) { return erro(e); }
}
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const f = await req.formData();
    const arq = f.get("arquivo");
    const arquivo = arq instanceof File && arq.size > 0 ? { dados: Buffer.from(await arq.arrayBuffer()), tipo: arq.type } : null;
    const campo = (k: string) => { const v = f.get(k); return typeof v === "string" ? v : undefined; };
    return ok(await criarAnuncio(u, { tipo: campo("tipo"), formato: campo("formato"), frase: campo("frase"), inicio: campo("inicio"), dias: campo("dias"), eventoId: campo("eventoId"), arquivo }));
  } catch (e) { return erro(e, 400); }
}
