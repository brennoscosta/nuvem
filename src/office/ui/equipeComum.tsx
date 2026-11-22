// Partes comuns da conversa com a equipe de IA (16/11/2026): tipos das rotas /api/workend/equipe*, agrupamento por
// departamento (chefe primeiro), a linha do tempo que mistura a conversa com os pedidos internos (quem pediu o quê a quem)
// e o texto da IA. Usado pela página Minha equipe (src/app/workend/app/equipe/_equipe.tsx) e pelo painel do mapa
// (src/office/ui/ChatEquipe.tsx). O servidor está em src/server/equipeCliente.ts e src/server/delegacao.ts.
// Imagens (21/11/2026): a mensagem pode trazer o cartão da imagem pedida à equipe (src/office/ui/ImagemEquipe.tsx).
import type { CartaoImagem } from "./ImagemEquipe";

export type NivelMembro = "ceo" | "diretor" | "gerente" | "analista" | "assistente";
export type RegraEquipe = { id: string; texto: string };
export type MembroEquipe = {
  membroId: string; nome: string; cargo: string; papel: "atendente" | "ceo" | "profissional"; setor: string; setorId: string; setorCor: string;
  nivel: NivelMembro; chefeId: string | null; temEquipe: boolean; boneco: string; camisa: string;
  foto: string | null; especialista: { cargo: string; habilidades: string[] } | null; imagem?: boolean; saudacao: string; treino: string; atendeVisitantes: boolean;
  ultima: { texto: string; deQuem: "voce" | "equipe"; em: string } | null; regras: RegraEquipe[];
};
export type Departamento = { id: string; nome: string; cor: string };
export type ContatosEquipe = { whatsapp?: string; instagram?: string; site?: string; email?: string };
export type PainelEquipe = {
  lote: { chave: string; numero: number | null; empresaNome: string; cor: string; nicho: string; pagoAte: string | null };
  sobre: string; contatos: ContatosEquipe; equipe: MembroEquipe[]; departamentos: Departamento[];
  gasto: { mes: number; teto: number; aviso: boolean; esgotado: boolean };
  visitantes: { total: number; ultimas24h: number }; ia: boolean;
  whatsapp?: boolean; // WE-18: o WhatsApp da loja está ligado no servidor (aba WhatsApp)
};
// autor: "dono" (você), "agente" (a própria pessoa), "chefe" (pedido interno do chefe), "equipe" (respostas da equipe juntadas)
export type MsgEquipe = { id: string; papel: string; autor: "dono" | "agente" | "chefe" | "equipe"; deNome: string | null; conteudo: string; avaliacao: number | null; correcao: string | null; em: string; imagem?: CartaoImagem | null };
export type TrocaInterna = {
  id: string; de: string; deNome: string; deCargo: string; para: string; paraNome: string; paraCargo: string;
  pedido: string; resposta: string | null; status: "pedido" | "respondido" | "erro"; em: string; respondidoEm: string | null; origemAgente: string | null;
  origemMensagem: string | null; tarefa: string | null; // a mensagem do dono que começou a cadeia
};
export type ConversaEquipe = { mensagens: MsgEquipe[]; internas: TrocaInterna[]; trabalhando: boolean; gerandoImagem?: boolean };
export type RespostaEnvio = { mensagem: MsgEquipe; delegados: { membroId: string; nome: string; cargo: string; tarefa: string }[]; gasto: { mes: number; teto: number } };

export const NIVEL_ROTULO: Record<NivelMembro, string> = { ceo: "CEO", diretor: "Diretoria", gerente: "Gerente", analista: "Analista", assistente: "Assistente" };
export const NIVEL_ORDEM: Record<NivelMembro, number> = { ceo: 0, diretor: 1, gerente: 2, analista: 3, assistente: 4 };
export const NIVEL_COR: Record<NivelMembro, string> = { ceo: "#B7791F", diretor: "#7C3AED", gerente: "#1D4ED8", analista: "#0F766E", assistente: "#6B7280" };

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const quando = (iso: string) => {
  const d = new Date(iso), dif = Date.now() - d.getTime();
  if (dif < 60_000) return "agora";
  if (dif < 3600_000) return `há ${Math.floor(dif / 60_000)} min`;
  if (dif < 86400_000) return `há ${Math.floor(dif / 3600_000)} h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};
const semAcento = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export async function apiEquipe<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro || (r.status === 401 ? "Entre na sua conta do WorkEnd." : "Não deu certo agora. Tente de novo."));
  return j as T;
}

// departamentos na ordem do escritório, cada um com o chefe primeiro (depois por nível e nome); a busca olha nome, cargo e área
export function agruparPorDepartamento(p: Pick<PainelEquipe, "equipe" | "departamentos">, busca = "") {
  const q = semAcento(busca.trim());
  const bate = (m: MembroEquipe) => !q || semAcento(`${m.nome} ${m.cargo} ${m.setor} ${NIVEL_ROTULO[m.nivel]}`).includes(q);
  const deps = p.departamentos?.length ? p.departamentos : [...new Map(p.equipe.map((m) => [m.setorId, { id: m.setorId, nome: m.setor, cor: m.setorCor }])).values()];
  return deps
    .map((d) => ({ dep: d, pessoas: p.equipe.filter((m) => m.setorId === d.id && bate(m)).sort((a, b) => NIVEL_ORDEM[a.nivel] - NIVEL_ORDEM[b.nivel] || a.nome.localeCompare(b.nome, "pt-BR")) }))
    .filter((g) => g.pessoas.length > 0);
}

// "1 CEO · 10 gerentes · 14 analistas…" para o topo
export function resumoNiveis(equipe: MembroEquipe[]) {
  const plural: Record<NivelMembro, [string, string]> = { ceo: ["CEO", "CEOs"], diretor: ["diretor", "diretores"], gerente: ["gerente", "gerentes"], analista: ["analista", "analistas"], assistente: ["assistente", "assistentes"] };
  return (Object.keys(NIVEL_ORDEM) as NivelMembro[])
    .map((n) => { const k = equipe.filter((m) => m.nivel === n).length; return k ? `${k} ${plural[n][k === 1 ? 0 : 1]}` : ""; })
    .filter(Boolean).join(" · ");
}

// conversa + pedidos internos numa linha só, por horário. Os pedidos feitos PARA esta pessoa já aparecem como mensagem
// "chefe" na conversa dela; aqui entram só os que ela (ou alguém abaixo dela, na mesma tarefa) fez para outras pessoas,
// num bloco por tarefa (a cadeia em ordem: quem pediu primeiro, e logo abaixo o que essa pessoa pediu à equipe dela).
export type GrupoTarefa = ReturnType<typeof agruparPorTarefa>[number];
export type ItemLinha = { tipo: "msg"; em: string; msg: MsgEquipe } | { tipo: "grupo"; em: string; grupo: GrupoTarefa };
export function linhaDoTempo(conv: ConversaEquipe | null, membroId: string): ItemLinha[] {
  if (!conv) return [];
  const itens: ItemLinha[] = [
    ...conv.mensagens.map((m) => ({ tipo: "msg" as const, em: m.em, msg: m })),
    ...agruparPorTarefa(conv.internas.filter((t) => t.para !== membroId)).map((g) => ({ tipo: "grupo" as const, em: g.em, grupo: g })),
  ];
  return itens.sort((a, b) => new Date(a.em).getTime() - new Date(b.em).getTime());
}
export function andamento(conv: ConversaEquipe | null, membroId: string) {
  const ts = (conv?.internas ?? []).filter((t) => t.para !== membroId);
  const abertas = ts.filter((t) => t.status === "pedido");
  // pedidos da tarefa em andamento: os criados até 15 min antes do pedido aberto mais antigo
  if (!abertas.length) return null;
  const inicio = Math.min(...abertas.map((t) => new Date(t.em).getTime())) - 60_000;
  const daTarefa = ts.filter((t) => new Date(t.em).getTime() >= inicio);
  return { total: daTarefa.length, prontos: daTarefa.filter((t) => t.status !== "pedido").length, abertas };
}

// conversas internas agrupadas pela tarefa do dono que as começou (tarefa mais nova primeiro); dentro de cada uma, a cadeia
// em ordem (quem pediu primeiro vem antes) e o nível de cada pedido (1 = pedido de quem recebeu a tarefa, 2 = um nível abaixo)
export function agruparPorTarefa(lista: TrocaInterna[]) {
  const grupos = new Map<string, TrocaInterna[]>();
  for (const t of lista) { const k = t.origemMensagem ?? t.id; grupos.set(k, [...(grupos.get(k) ?? []), t]); }
  return [...grupos.entries()].map(([chave, ts]) => {
    const trocas = [...ts].sort((a, b) => new Date(a.em).getTime() - new Date(b.em).getTime());
    const recebeu = new Set(trocas.map((t) => t.para));
    const nivel = (t: TrocaInterna) => (recebeu.has(t.de) ? 2 : 1);
    // pais antes dos filhos: cada pedido de 2º nível logo depois do pedido que a pessoa recebeu
    const ordem: TrocaInterna[] = [];
    for (const t of trocas.filter((x) => nivel(x) === 1)) { ordem.push(t); ordem.push(...trocas.filter((x) => nivel(x) === 2 && x.de === t.para)); }
    for (const t of trocas) if (!ordem.includes(t)) ordem.push(t);
    const primeiro = trocas[0];
    return { chave, tarefa: primeiro.tarefa, quem: { id: primeiro.de, nome: primeiro.deNome, cargo: primeiro.deCargo }, em: primeiro.em, itens: ordem.map((t) => ({ t, nivel: nivel(t) })), total: trocas.length, prontos: trocas.filter((t) => t.status !== "pedido").length };
  }).sort((a, b) => new Date(b.em).getTime() - new Date(a.em).getTime());
}

// sugestões de tarefa por nível: o dono não começa da página em branco
export function sugestoesTarefa(m: MembroEquipe, empresa: string): string[] {
  if (m.nivel === "ceo") return [`Monte o plano desta semana da ${empresa} com cada departamento`, "Quero um resumo de receitas, custos e riscos do mês", "Quais 3 coisas a empresa deve resolver primeiro?"];
  if (m.nivel === "diretor") return ["Como estão as metas de cada departamento?", "Monte a pauta da reunião de segunda"];
  if (m.temEquipe) return [`Peça para a sua equipe um plano de 30 dias da área ${m.setor}`, "Quais são os problemas da sua área agora?", "Me mande as prioridades da semana da sua equipe"];
  if (m.papel === "atendente") return ["Como você responderia quem pede preço?", "Escreva a mensagem de boas-vindas da loja", "Quais perguntas os clientes mais fazem?"];
  // quem faz imagem (designer, social media): um pedido de foto, que mostra o custo antes de gerar
  if (m.imagem) return [`Faça uma foto de um produto da ${empresa} para o Instagram`, ...(m.especialista?.habilidades.slice(0, 2).map((h) => `${h} para a ${empresa}`) ?? [])];
  if (m.especialista) return m.especialista.habilidades.slice(0, 3).map((h) => `${h} para a ${empresa}`);
  return [`O que você pode fazer pela ${empresa}?`, `Faça a primeira entrega do seu trabalho como ${m.cargo.toLowerCase()}`];
}

// texto da IA: títulos (#), listas (com número ou marcador, com recuo), quebras de linha e **negrito**, sem HTML vindo de fora.
// Linhas seguidas do mesmo tipo viram um parágrafo ou uma lista (a IA costuma escrever "Pedi para:" e a lista logo abaixo).
const ITEM = /^\s*([-*•]|\d+[.)])\s+/;
export function TextoIA({ t, className = "" }: { t: string; className?: string }) {
  const negrito = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, k) => (p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <b key={k}>{p.slice(2, -2)}</b> : <span key={k}>{p}</span>));
  return (
    <div className={`space-y-1.5 leading-relaxed ${className}`}>
      {t.split(/\n{2,}/).map((bloco, i) => {
        const partes: { tipo: "p" | "ul" | "h" | "hr"; linhas: string[] }[] = [];
        for (const l of bloco.split("\n")) {
          if (!l.trim()) continue;
          if (/^\s*([-*_])\1{2,}\s*$/.test(l)) { partes.push({ tipo: "hr", linhas: [] }); continue; } // "---" vira separador
          const tipo = /^#{1,4}\s+/.test(l) ? "h" : ITEM.test(l) ? "ul" : "p";
          const ult = partes[partes.length - 1];
          if (ult && ult.tipo === tipo && tipo !== "h") ult.linhas.push(l); else partes.push({ tipo, linhas: [l] });
        }
        return (
          <div key={i} className="space-y-1">
            {partes.map((pt, k) => pt.tipo === "hr" ? <hr key={k} className="my-2 border-current opacity-15" /> : pt.tipo === "h" ? <p key={k} className="font-bold">{negrito(pt.linhas[0].replace(/^#{1,4}\s+/, ""))}</p>
              : pt.tipo === "ul" ? (
                <ul key={k} className="space-y-0.5">
                  {pt.linhas.map((l, j) => {
                    const num = l.match(/^\s*(\d+)[.)]\s+/);
                    return (
                      <li key={j} className={`flex gap-1.5 ${/^\s{2,}/.test(l) ? "pl-5" : "pl-0.5"}`}>
                        {num ? <span className="shrink-0 font-semibold tabular-nums">{num[1]}.</span> : <span className="mt-[0.62em] h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />}
                        <span className="min-w-0">{negrito(l.replace(ITEM, ""))}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : <p key={k} className="whitespace-pre-wrap">{negrito(pt.linhas.join("\n"))}</p>)}
          </div>
        );
      })}
    </div>
  );
}
