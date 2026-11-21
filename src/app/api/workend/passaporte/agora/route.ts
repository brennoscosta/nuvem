// "Acontecendo agora" na cidade (20/11/2026, frente "visitante"): evento na praça, lojas com cupom do passaporte, loja
// nova e a caça de Natal. Guardado por 30 s no servidor (mais gente olhando não pesa).
import { acontecendoAgora } from "@/server/passaporte";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return ok({ itens: await acontecendoAgora() }); } catch (e) { return erro(e); }
}
