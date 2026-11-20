// Busca pública de perfis (20/11/2026, frente "cadastro"): GET ?q=&nicho= devolve os perfis públicos; com ?combina=1 (logado)
// devolve também "Quem procura o que você oferece" e "Quem oferece o que você procura".
import { usuarioAtual } from "@/server/usuarios";
import { buscarPerfis, combinar } from "@/server/perfis";
import { ok, erro } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    if (p.get("combina") === "1") {
      const u = await usuarioAtual().catch(() => null);
      if (!u) return ok({ temPerfil: false, ofereco: false, procuro: false, procuramOQueOfereco: [], oferecemOQueProcuro: [], logado: false });
      return ok({ ...(await combinar(u.id)), logado: true });
    }
    return ok(await buscarPerfis({ q: p.get("q"), nicho: p.get("nicho") }));
  } catch (e) { return erro(e); }
}
