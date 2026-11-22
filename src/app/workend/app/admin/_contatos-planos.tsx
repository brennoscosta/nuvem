// Admin: contatos da página de planos (WE-19, 22/11/2026). "Fale com a gente" da Sede (sob consulta) e o interesse no
// Equipe, gravados em plano_contato (migração 0061); cada um também avisa o admin no sino. Componente do servidor: lê
// direto do banco ao abrir o /app/admin (que já confere se é admin).
import { listarContatosPlano } from "@/server/planos";
import { PLANOS_CONTATO } from "@/office/data/planos";

const dataBR = (d: Date) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export async function ContatosPlanosAdmin() {
  const lista = await listarContatosPlano().catch(() => null);
  return (
    <section className="faixa mt-12" id="contatos-planos" data-teste="admin-contatos-planos">
      <h2 className="text-[1.4rem]">Contatos dos planos</h2>
      <p className="mt-1 max-w-[72ch] text-sm text-[var(--tinta-2)]">Quem pediu contato pela página de planos: a Sede (sob consulta) e, quando o WhatsApp da atendente estiver ligado, o plano Equipe. Responda pelo WhatsApp ou e-mail que a pessoa deixou.</p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--linha)] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[var(--cinza)] text-left text-xs uppercase tracking-wide text-[var(--tinta-2)]">
            <tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Plano</th><th className="px-3 py-2">Nome e empresa</th><th className="px-3 py-2">Contato</th><th className="px-3 py-2">Mensagem</th><th className="px-3 py-2">Conta</th></tr>
          </thead>
          <tbody>
            {lista === null && <tr><td colSpan={6} className="px-3 py-6 text-center text-[#8A2A2A]">Não deu para ler os contatos agora.</td></tr>}
            {lista?.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-[var(--tinta-2)]">Nenhum contato ainda.</td></tr>}
            {lista?.map((c) => (
              <tr key={c.id} className="border-t border-[var(--linha)] align-top" data-contato={c.id}>
                <td className="whitespace-nowrap px-3 py-2.5 text-[var(--tinta-2)]">{dataBR(c.criadoEm)}</td>
                <td className="whitespace-nowrap px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.plano === "sede" ? "bg-[#FFF4D6] text-[#7A5A00]" : "bg-[#E3ECFA] text-[#0453CC]"}`}>{PLANOS_CONTATO[c.plano] ?? c.plano}</span></td>
                <td className="px-3 py-2.5"><b className="block max-w-[220px] truncate">{c.nome}</b>{c.empresa && <span className="block max-w-[220px] truncate text-xs text-[var(--tinta-2)]">{c.empresa}</span>}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{c.contato}</td>
                <td className="px-3 py-2.5"><p className="max-w-[360px] whitespace-pre-line text-[13px] text-[var(--tinta-2)]">{c.mensagem || "—"}</p></td>
                <td className="px-3 py-2.5 text-xs text-[var(--tinta-2)]">{c.email ?? "sem conta"}{c.origem && <span className="block">pela {c.origem === "inicio" || c.origem === "preco" ? "página inicial" : "página de planos"}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
