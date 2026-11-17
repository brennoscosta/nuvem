// Conectores da empresa (aba Conectores de Minha equipe, 17/11/2026). Só o dono do lote (ou o admin).
// GET ?lote= → chaves, conectores (sem segredos), histórico, tarefas da API, eventos e tipos; + destinos ativos.
// POST { lote, acao, ... }: criar_chave | revogar_chave | criar | editar | apagar | testar | enviar | destinos
import { usuarioAtual } from "@/server/usuarios";
import { empresaDoDono, statusDe, ErroHttp } from "@/server/equipeCliente";
import { listarConectores, criarChave, revogarChave, criarConector, editarConector, apagarConector, testarConector, enviarParaDestino, destinosDaEmpresa, ErroConector, type DadosConector } from "@/server/conectores";
import { bloqueio, contar } from "@/server/limite";
import { sql } from "@/server/db";
import { base } from "@/server/conexoes";
import { ok, erro, corpo } from "@/server/http";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const st = (e: unknown) => (e instanceof ErroConector ? e.status : statusDe(e));

export async function GET(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const p = new URL(req.url).searchParams;
    const { empId } = await empresaDoDono(u, p.get("lote"));
    if (p.get("so") === "destinos") return ok({ destinos: await destinosDaEmpresa(empId) });
    return ok({ ...(await listarConectores(empId)), destinos: await destinosDaEmpresa(empId), base: base(req) });
  } catch (e) { return erro(e, st(e)); }
}

type Pedido = DadosConector & { lote?: string; acao?: string; id?: string; destino?: string; tipoConteudo?: string; titulo?: string; texto?: string; membro?: string; mensagem?: string };
export async function POST(req: Request) {
  try {
    const u = await usuarioAtual(); if (!u) return erro("Entre na sua conta do WorkEnd.", 401);
    const d = await corpo<Pedido>(req);
    const { t, empId } = await empresaDoDono(u, d.lote ?? null);
    // testes e envios saem para a internet: limite por conta
    if (d.acao === "testar" || d.acao === "enviar") {
      const k = `conectores:${u.id}`;
      if (bloqueio(k, 60)) throw new ErroHttp("Muitos testes e envios em pouco tempo. Espere alguns minutos.", 429);
      contar(k, 60);
    }
    switch (d.acao) {
      case "criar_chave": return ok(await criarChave(empId, u.id, t.chave, d.nome));
      case "revogar_chave": return ok(await revogarChave(empId, d.id));
      case "criar": return ok(await criarConector(empId, d));
      case "editar": return ok(await editarConector(empId, d.id, d));
      case "apagar": return ok(await apagarConector(empId, d.id));
      case "testar": return ok(await testarConector(empId, d.id));
      case "enviar": {
        // autor da entrega: a pessoa da equipe que escreveu (nome, cargo e departamento do escritório)
        const membro = t.escritorio?.equipe.find((m) => m.id === d.membro);
        const setor = t.escritorio?.setores.find((s) => s.id === membro?.setorId);
        if (d.mensagem) {
          const [m] = await sql<{ id: string }[]>`SELECT m.id FROM mensagem m JOIN agente a ON a.id = m.agente_id WHERE m.id = ${String(d.mensagem)} AND a.empresa_id = ${empId}`;
          if (!m) throw new ErroHttp("Essa mensagem não é desta empresa.", 403);
        }
        return ok(await enviarParaDestino(empId, d.destino, {
          tipo: String(d.tipoConteudo ?? ""), titulo: String(d.titulo ?? ""), texto: String(d.texto ?? ""),
          autor: membro ? { nome: membro.nome, cargo: membro.cargo, departamento: setor?.nome ?? (membro.papel === "ceo" ? "Diretoria" : "Recepção") } : null,
          empresa: { nome: t.empresaNome, lote: t.chave }, origem: { mensagemId: d.mensagem ? String(d.mensagem) : null, conversa: membro?.id ?? null },
        }));
      }
      default: throw new ErroHttp("Ação desconhecida.");
    }
  } catch (e) { return erro(e, st(e)); }
}
