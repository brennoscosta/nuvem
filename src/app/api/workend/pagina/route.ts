// Página grátis da loja (Plano Vitrine, WE-13, 21/11/2026): POST cria, edita e publica a página da conta sem lote
// (src/server/planoVitrine.ts). O "Sobre" e os contatos ficam na empresa da conta, os mesmos da loja no lote depois.
import { usuarioAtual } from "@/server/usuarios";
import { salvarPagina, empresaDaConta, ErroPagina } from "@/server/planoVitrine";
import { limparContatos, type Contatos } from "@/server/equipeCliente";
import { reservarEndereco } from "@/server/enderecoLoja";
import { sql } from "@/server/db";
import { ok, erro, corpo } from "@/server/http";
import { ipDe, bloqueio, contar, demais } from "@/server/limite";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const u = await usuarioAtual();
    if (!u) return erro("Entre na sua conta do WorkEnd para publicar a página.", 401);
    const chave = `pagina:${u.id}:${ipDe(req)}`;
    const espera = bloqueio(chave, 30); if (espera) return demais(espera);
    contar(chave, 60);
    const d = await corpo<{ empresaNome?: string; cor?: string; nicho?: string; sobre?: string; whatsapp?: string; instagram?: string; logoBase64?: string; removerLogo?: boolean }>(req);
    const nome = String(d.empresaNome ?? "").replace(/\s+/g, " ").trim();
    if (nome.length < 2) return erro("Diga o nome da empresa.", 400);
    // o endereço antes de publicar: assim a página nasce no endereço do nome escolhido agora (depois de no ar, não muda mais)
    await reservarEndereco(u, nome);
    const p = await salvarPagina(u, d);
    const empId = empresaDaConta(u.id);
    if (typeof d.sobre === "string") await sql`UPDATE empresa SET sobre = ${d.sobre.trim().slice(0, 3000)} WHERE id = ${empId}`;
    if (d.whatsapp !== undefined || d.instagram !== undefined) {
      const [e] = await sql<{ contatos: Contatos | null }[]>`SELECT contatos FROM empresa WHERE id = ${empId}`;
      const c = limparContatos({ ...(e?.contatos ?? {}), ...(d.whatsapp !== undefined ? { whatsapp: d.whatsapp } : {}), ...(d.instagram !== undefined ? { instagram: d.instagram } : {}) });
      await sql`UPDATE empresa SET contatos = ${sql.json(c as never)} WHERE id = ${empId}`;
    }
    const [end] = await sql<{ slug: string }[]>`SELECT slug FROM loja_endereco WHERE empresa_id = ${empId} AND atual`;
    return ok({ numero: p.numero, endereco: end?.slug ?? null }, 201);
  } catch (e) { return erro(e, e instanceof ErroPagina ? e.status : 500); }
}
