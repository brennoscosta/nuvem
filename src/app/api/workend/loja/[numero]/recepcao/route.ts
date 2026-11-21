// Recepção que encaminha (20/11/2026, pedido do dono: o visitante só fala com a recepcionista, que o direciona para outro
// setor). POST { destino } (o botão do assunto) ou { texto, insistiu? } → { destino, fala, como }. A recepcionista
// responde, a conversa passa para o responsável do setor (src/server/equipeCliente.ts › recepcaoNaLoja) e o sino do dono
// diz para qual setor o visitante foi.
import { usuarioAtual } from "@/server/usuarios";
import { recepcaoNaLoja, statusDe } from "@/server/equipeCliente";
import { avisar } from "@/server/avisos";
import { aoSerAtendido } from "@/server/passaporte";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
type Ctx = { params: Promise<{ numero: string }> };
export async function POST(req: Request, { params }: Ctx) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd para falar com a recepção.", 401);
    if (u.banidoEm) return erro("Conta suspensa.", 403);
    const { numero } = await params;
    const d = await corpo<{ destino?: unknown; texto?: unknown; insistiu?: unknown }>(req);
    const r = await recepcaoNaLoja(u, Number(numero) | 0, d);
    if (r.destino && r.dono !== u.id) {
      const pedido = typeof d.texto === "string" ? d.texto.trim() : "";
      void avisar(r.dono, { tipo: "loja", ref: `loja:${u.id}`, renovar: true, titulo: `${r.nomeVisitante.split(" ")[0] || "Um visitante"} foi encaminhado para ${r.destino.setorNome}`, texto: `${r.destino.nome} (${r.destino.cargo}) vai atender${pedido ? `: ${pedido.slice(0, 120)}` : "."}`, link: "/app/equipe" });
    }
    // passaporte da cidade (frente "visitante"): encaminhado = atendido; carimba se o personagem está mesmo no balcão
    const passaporte = r.destino ? await aoSerAtendido(u, Number(numero) | 0).catch((e: Error) => { console.error("[passaporte]", e.message); return null; }) : null;
    return ok({ destino: r.destino, fala: r.fala, como: r.como, passaporte });
  } catch (e) { return erro(e, statusDe(e)); }
}
