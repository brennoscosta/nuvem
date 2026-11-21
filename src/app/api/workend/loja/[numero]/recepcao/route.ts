// Recepção que encaminha (20/11/2026, pedido do dono: o visitante só fala com a recepcionista, que o direciona para outro
// setor). POST { destino } (o botão do assunto) ou { texto, insistiu? } → { destino, fala, como }. A recepcionista
// responde, a conversa passa para o responsável do setor (src/server/equipeCliente.ts › recepcaoNaLoja) e o sino do dono
// diz para qual setor o visitante foi.
// WE-14 (21/11/2026): sem conta também é atendido (cookie de visitante sem conta, src/server/visitanteAnonimo.ts), sem carimbo.
import { usuarioAtual } from "@/server/usuarios";
import { visitanteAnonimo } from "@/server/visitanteAnonimo";
import { ipDe } from "@/server/limite";
import { recepcaoNaLoja, statusDe } from "@/server/equipeCliente";
import { avisar } from "@/server/avisos";
import { aoSerAtendido } from "@/server/passaporte";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
type Ctx = { params: Promise<{ numero: string }> };
export async function POST(req: Request, { params }: Ctx) {
  try {
    const conta = await usuarioAtual();
    if (conta?.banidoEm) return erro("Conta suspensa.", 403);
    const u = conta ?? (await visitanteAnonimo(true)); // sem conta: cria o cookie do visitante na primeira fala
    if (!u) return erro("Não deu para falar com a recepção agora. Recarregue a página.", 500);
    const { numero } = await params;
    const d = await corpo<{ destino?: unknown; texto?: unknown; insistiu?: unknown }>(req);
    const r = await recepcaoNaLoja(u, Number(numero) | 0, d, ipDe(req));
    if (r.destino && r.dono !== u.id) {
      const pedido = typeof d.texto === "string" ? d.texto.trim() : "";
      void avisar(r.dono, { tipo: "loja", ref: `loja:${u.id}`, renovar: true, titulo: `${(conta ? r.nomeVisitante.split(" ")[0] : r.nomeVisitante) || "Um visitante"} foi encaminhado para ${r.destino.setorNome}`, texto: `${r.destino.nome} (${r.destino.cargo}) vai atender${pedido ? `: ${pedido.slice(0, 120)}` : "."}`, link: "/app/equipe" });
    }
    // passaporte da cidade (frente "visitante"): encaminhado = atendido; carimba se o personagem está mesmo no balcão (só com conta)
    const passaporte = r.destino && conta ? await aoSerAtendido(conta, Number(numero) | 0).catch((e: Error) => { console.error("[passaporte]", e.message); return null; }) : null;
    return ok({ destino: r.destino, fala: r.fala, como: r.como, passaporte });
  } catch (e) { return erro(e, statusDe(e)); }
}
