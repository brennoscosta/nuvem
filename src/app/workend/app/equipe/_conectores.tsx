"use client";
// Aba Conectores de Minha equipe (17/11/2026, pedido do dono: "essa opção de conectar a empresa tem que ter, pode ser por
// api ou algum outro jeito, pois queremos automatizar muitas tarefas"). Quatro blocos: chaves da API v1, avisos
// automáticos (webhooks), fontes de dados que os agentes leem e destinos para enviar entregas. Segredos aparecem uma vez
// só (na criação). O botão "Enviar para…" das respostas da equipe também mora aqui (EnviarPara). Servidor:
// src/server/conectores.ts, src/server/apiV1.ts e /api/workend/conectores.
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icone, type NomeIcone } from "@/office/ui/Icone";
import { apiEquipe, quando, type MembroEquipe, type MsgEquipe, type PainelEquipe } from "@/office/ui/equipeComum";

type TipoConector = "aviso" | "fonte" | "destino";
type Conector = { id: string; tipo: TipoConector; nome: string; url: string; config: { eventos?: string[]; tipos?: string[]; setores?: string[]; cabecalho?: string }; ativo: boolean; criadoEm: string; ultimoUso: string | null; ultimoErro: string | null; temSegredo: boolean };
type Chave = { id: string; nome: string; prefixo: string; criadoEm: string; ultimoUso: string | null };
type Registro = { id: string; conectorId: string | null; tipo: string; evento: string | null; status: string; codigo: number | null; tentativas: number; resumo: string | null; resposta: string | null; criadoEm: string };
type TarefaApi = { id: string; membroId: string; status: string; texto: string; criadoEm: string; entregueEm: string | null };
type Destino = { id: string; nome: string; tipos: string[] };
type Dados = { chaves: Chave[]; conectores: Conector[]; registros: Registro[]; tarefas: TarefaApi[]; eventos: { id: string; nome: string; texto: string }[]; tiposDestino: { id: string; nome: string }[]; destinos: Destino[]; base: string };
type Segredo = { titulo: string; valor: string; texto: string };

const TIPO_NOME: Record<string, string> = { noticia: "Notícia", guia: "Guia", missao: "Missão", evento: "Evento", outro: "Outro", teste: "Teste" };
const post = <T,>(lote: string, corpo: Record<string, unknown>) => apiEquipe<T>(`/api/workend/conectores`, { method: "POST", body: JSON.stringify({ lote, ...corpo }) });

// destinos ativos (para o botão Enviar para… das respostas): uma busca por lote, refeita quando a aba muda algo
const destinosCache = new Map<string, Promise<Destino[]>>();
export function esquecerDestinos(lote: string) { destinosCache.delete(lote); }
function useDestinos(lote: string) {
  const [lista, setLista] = useState<Destino[] | null>(null);
  useEffect(() => {
    let vivo = true;
    let p = destinosCache.get(lote);
    if (!p) { p = apiEquipe<{ destinos: Destino[] }>(`/api/workend/conectores?lote=${encodeURIComponent(lote)}&so=destinos`).then((r) => r.destinos).catch(() => []); destinosCache.set(lote, p); }
    void p.then((d) => { if (vivo) setLista(d); });
    return () => { vivo = false; };
  }, [lote]);
  return lista;
}

// ---------- aba ----------
export function Conectores({ p }: { p: PainelEquipe }) {
  const lote = p.lote.chave;
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [segredo, setSegredo] = useState<Segredo | null>(null);
  useEffect(() => {
    let vivo = true;
    apiEquipe<Dados>(`/api/workend/conectores?lote=${encodeURIComponent(lote)}`).then((r) => { if (vivo) { setD(r); setErro(null); } }).catch((e) => { if (vivo) setErro((e as Error).message); });
    return () => { vivo = false; };
  }, [lote, versao]);
  const mudou = useCallback(() => { esquecerDestinos(lote); setVersao((v) => v + 1); }, [lote]);
  const departamentos = p.departamentos.filter((x) => !x.id.startsWith("_"));
  const de = (t: TipoConector) => d?.conectores.filter((c) => c.tipo === t) ?? [];
  return (
    <section className="mt-5">
      <Intro p={p} d={d} />
      {erro && <p className="mt-3 rounded-lg bg-[#FDECEC] px-3 py-2 text-sm text-[#9B1C1C]">{erro}</p>}
      {!d && !erro && <p className="mt-4 text-[var(--muted)]">Carregando os conectores…</p>}
      {d && (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <BlocoApi d={d} p={p} mudou={mudou} mostrar={setSegredo} />
          <BlocoAvisos d={d} lote={lote} itens={de("aviso")} mudou={mudou} mostrar={setSegredo} />
          <BlocoFontes lote={lote} itens={de("fonte")} departamentos={departamentos} mudou={mudou} />
          <BlocoDestinos d={d} lote={lote} itens={de("destino")} mudou={mudou} mostrar={setSegredo} />
        </div>
      )}
      {d && <Historico d={d} />}
      {segredo && <SegredoUmaVez s={segredo} fechar={() => setSegredo(null)} />}
    </section>
  );
}

function Intro({ p, d }: { p: PainelEquipe; d: Dados | null }) {
  const n = (t: TipoConector) => d?.conectores.filter((c) => c.tipo === t && c.ativo).length ?? 0;
  const atalhos: [string, NomeIcone, string, string, number][] = [
    ["cx-api", "chave", "API do WorkEnd", "Seus sistemas dão tarefas e leem as entregas", d?.chaves.length ?? 0],
    ["cx-avisos", "sino", "Avisos automáticos", "O WorkEnd avisa seus sistemas quando algo acontece", n("aviso")],
    ["cx-fontes", "banco", "Fontes de dados", "Os agentes leem números reais antes de responder", n("fonte")],
    ["cx-destinos", "enviar", "Destinos", "Você envia uma entrega para o seu site com um clique", n("destino")],
  ];
  return (
    <div className="eq-cx-intro">
      <div className="min-w-0">
        <span className="eq-selo"><Icone nome="plugue" tamanho={13} />Conectores</span>
        <h2>Conecte a {p.lote.empresaNome} aos seus sistemas</h2>
        <p>Automatize o trabalho da equipe: outros sistemas dão tarefas pela API, recebem avisos quando algo acontece, os agentes leem dados reais e as entregas vão para o seu site. Nada é publicado sem o seu clique.</p>
      </div>
      <div className="eq-cx-atalhos">
        {atalhos.map(([alvo, ic, t, s, k]) => (
          <button key={alvo} type="button" className="eq-cx-atalho" onClick={() => document.getElementById(alvo)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            <Icone nome={ic} tamanho={19} />
            <span className="min-w-0 flex-1"><b>{t}</b><small>{s}</small></span>
            <em>{k}</em>
          </button>
        ))}
      </div>
    </div>
  );
}

function Bloco({ id, icone, cor, titulo, texto, children }: { id: string; icone: NomeIcone; cor: string; titulo: string; texto: string; children: React.ReactNode }) {
  return (
    <article id={id} className="eq-cx-bloco">
      <header className="flex items-start gap-3">
        <span className="eq-cx-icone" style={{ background: `${cor}1F`, color: cor }}><Icone nome={icone} tamanho={21} /></span>
        <div className="min-w-0"><h3>{titulo}</h3><p className="mt-0.5 text-[13.5px] leading-snug text-[var(--muted)]">{texto}</p></div>
      </header>
      {children}
    </article>
  );
}
const Erro = ({ t }: { t: string | null }) => (t ? <p className="mt-2 rounded-lg bg-[#FDECEC] px-3 py-1.5 text-[13px] text-[#9B1C1C]">{t}</p> : null);
const Codigo = ({ t }: { t: string }) => <pre className="eq-cx-codigo">{t}</pre>;
// janelas por cima da página toda: fora da bolha da conversa (a animação dela prende o "position: fixed"), mas dentro
// do .we, onde vale o estilo da página
const PorCima = ({ children }: { children: React.ReactNode }) => createPortal(children, document.querySelector(".we") ?? document.body);

// ---------- a) API ----------
function BlocoApi({ d, p, mudou, mostrar }: { d: Dados; p: PainelEquipe; mudou: () => void; mostrar: (s: Segredo) => void }) {
  const [nome, setNome] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const criar = async () => {
    setOcupado(true); setErro(null);
    try {
      const r = await post<{ chave: string }>(p.lote.chave, { acao: "criar_chave", nome: nome || "Minha automação" });
      setNome(""); mudou();
      mostrar({ titulo: "Sua chave da API", valor: r.chave, texto: "Use no cabeçalho Authorization: Bearer <chave>. Guarde num lugar seguro: ela dá tarefas em nome da empresa." });
    } catch (e) { setErro((e as Error).message); }
    setOcupado(false);
  };
  const revogar = async (c: Chave) => {
    if (!confirm(`Revogar a chave "${c.nome}"? Os sistemas que usam essa chave param de funcionar na hora.`)) return;
    try { await post(p.lote.chave, { acao: "revogar_chave", id: c.id }); mudou(); } catch (e) { setErro((e as Error).message); }
  };
  const ceo = p.equipe.find((m) => m.nivel === "ceo")?.membroId ?? "ceo";
  const b = d.base;
  return (
    <Bloco id="cx-api" icone="chave" cor="#0A6CFF" titulo="API do WorkEnd" texto="Outros sistemas (o seu site, uma planilha, ferramentas de automação) dão tarefas para a equipe e leem as entregas.">
      <form className="eq-cx-form sm:grid-cols-[1fr_auto]" onSubmit={(e) => { e.preventDefault(); void criar(); }}>
        <input className="eq-cx-campo" value={nome} onChange={(e) => setNome(e.target.value.slice(0, 60))} placeholder="Nome da chave (ex.: Automação do site)" aria-label="Nome da chave" />
        <button type="submit" className="btn btn-azul !py-2.5 text-sm" disabled={ocupado}><Icone nome="mais" tamanho={16} />{ocupado ? "Criando…" : "Criar chave"}</button>
      </form>
      <Erro t={erro} />
      <div className="mt-2">
        {d.chaves.length === 0 && <p className="py-2 text-[13.5px] text-[var(--muted)]">Nenhuma chave ainda.</p>}
        {d.chaves.map((c) => (
          <div key={c.id} className="eq-cx-item flex flex-wrap items-center gap-x-3 gap-y-1">
            <Icone nome="chave" tamanho={17} className="text-[var(--blue)]" />
            <span className="min-w-0 flex-1"><b className="text-[14px]">{c.nome}</b> <code className="text-[12.5px] text-[var(--muted)]">{c.prefixo}…</code>
              <span className="block text-[12px] text-[var(--muted)]">criada {quando(c.criadoEm)} · {c.ultimoUso ? `último uso ${quando(c.ultimoUso)}` : "nunca usada"}</span></span>
            <button type="button" className="eq-cx-mini eq-cx-mini-perigo" onClick={() => void revogar(c)}>Revogar</button>
          </div>
        ))}
      </div>
      {d.tarefas.length > 0 && (
        <div className="mt-2">
          <b className="text-[13px]">Últimas tarefas pela API</b>
          {d.tarefas.map((t) => (
            <div key={t.id} className="eq-cx-item flex items-center gap-2 text-[13px]">
              <Estado s={t.status === "entregue" ? "ok" : t.status === "erro" ? "erro" : "tentando"} rotulo={t.status} />
              <span className="min-w-0 flex-1 truncate">{t.texto}</span>
              <span className="text-[11.5px] text-[var(--muted)]">{quando(t.criadoEm)}</span>
            </div>
          ))}
        </div>
      )}
      <details className="eq-cx-docs">
        <summary><Icone nome="codigo" tamanho={15} />Como usar a API</summary>
        <p>Endereço: <code>{b}/api/v1</code>. Envie a chave em todo pedido. Limite de 60 pedidos por hora por chave; as tarefas usam o teto de IA do mês da empresa.</p>
        <p className="mt-2 font-semibold">Ver a equipe (os ids de cada pessoa):</p>
        <Codigo t={`curl ${b}/api/v1/equipe \\\n  -H "Authorization: Bearer SUA_CHAVE"`} />
        <p className="mt-2 font-semibold">Dar uma tarefa (sem o campo “para”, ela vai para o CEO):</p>
        <Codigo t={`curl -X POST ${b}/api/v1/tarefas \\\n  -H "Authorization: Bearer SUA_CHAVE" \\\n  -H "Content-Type: application/json" \\\n  -d '{"para":"${ceo}","texto":"Monte o plano da semana","avisar":"https://seusistema.com/workend"}'`} />
        <p className="mt-2 font-semibold">Acompanhar até a entrega (status: trabalhando, entregue ou erro):</p>
        <Codigo t={`curl ${b}/api/v1/tarefas/ID_DA_TAREFA \\\n  -H "Authorization: Bearer SUA_CHAVE"`} />
        <p className="mt-2">O campo <code>avisar</code> é opcional: quando a tarefa termina, essa URL recebe um POST com a tarefa, assinado no cabeçalho <code>X-WorkEnd-Assinatura</code> com o sha256 da sua chave (em hexadecimal) como segredo.</p>
      </details>
    </Bloco>
  );
}

// ---------- item comum (avisos, fontes, destinos) ----------
function ItemConector({ c, lote, mudou, children, rotuloTeste }: { c: Conector; lote: string; mudou: () => void; children?: React.ReactNode; rotuloTeste: string }) {
  const [ocupado, setOcupado] = useState("");
  const [res, setRes] = useState<{ ok: boolean; texto: string } | null>(null);
  const fazer = async (acao: "testar" | "editar" | "apagar") => {
    if (acao === "apagar" && !confirm(`Apagar "${c.nome}"?`)) return;
    setOcupado(acao); setRes(null);
    try {
      if (acao === "testar") {
        const r = await post<{ ok: boolean; status?: number | null; resposta?: string; amostra?: string; tamanho?: number; id?: string; url?: string }>(lote, { acao, id: c.id });
        setRes(r.ok
          ? { ok: true, texto: r.amostra !== undefined ? `Leu ${r.tamanho} caracteres. Começo: ${r.amostra}` : `Recebido (código ${r.status ?? "?"})${r.id ? `, id ${r.id}` : ""}.` }
          : { ok: false, texto: r.resposta ?? "Não deu certo." });
      } else await post(lote, { acao, id: c.id, ...(acao === "editar" ? { ativo: !c.ativo } : {}) });
      if (acao !== "testar") mudou();
    } catch (e) { setRes({ ok: false, texto: (e as Error).message }); }
    setOcupado("");
  };
  return (
    <div className="eq-cx-item">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`h-2 w-2 shrink-0 rounded-full ${!c.ativo ? "bg-[var(--line-strong)]" : c.ultimoErro ? "bg-[#E2575B]" : "bg-[#22A86B]"}`} aria-hidden />
        <b className="text-[14px]">{c.nome}</b>
        {!c.ativo && <span className="eq-cx-chip">pausado</span>}
        <span className="min-w-0 basis-full truncate text-[12px] text-[var(--muted)] sm:basis-auto sm:flex-1">{c.url}</span>
      </div>
      {children}
      {c.ultimoErro && c.ativo && <p className="mt-1 text-[12px] text-[#9B1C1C]">Último erro: {c.ultimoErro}</p>}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button type="button" className="eq-cx-mini" disabled={!!ocupado} onClick={() => void fazer("testar")}>{ocupado === "testar" ? "Testando…" : rotuloTeste}</button>
        <button type="button" className="eq-cx-mini" disabled={!!ocupado} onClick={() => void fazer("editar")}>{c.ativo ? "Pausar" : "Ativar"}</button>
        <button type="button" className="eq-cx-mini eq-cx-mini-perigo" disabled={!!ocupado} onClick={() => void fazer("apagar")}>Apagar</button>
      </div>
      {res && <p className={`mt-1.5 break-words rounded-lg px-2.5 py-1.5 text-[12.5px] ${res.ok ? "bg-[#E3F6EA] text-[#166534]" : "bg-[#FDECEC] text-[#9B1C1C]"}`}>{res.texto}</p>}
    </div>
  );
}
const marcar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
function Caixas({ opcoes, marcados, mudar }: { opcoes: { id: string; nome: string; texto?: string }[]; marcados: string[]; mudar: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => (
        <label key={o.id} title={o.texto} className={`eq-cx-opcao ${marcados.includes(o.id) ? "eq-cx-opcao-sim" : ""}`}>
          <input type="checkbox" className="sr-only" checked={marcados.includes(o.id)} onChange={() => mudar(marcar(marcados, o.id))} />
          {marcados.includes(o.id) && <Icone nome="check" tamanho={13} />}{o.nome}
        </label>
      ))}
    </div>
  );
}

// ---------- b) avisos ----------
function BlocoAvisos({ d, lote, itens, mudou, mostrar }: { d: Dados; lote: string; itens: Conector[]; mudou: () => void; mostrar: (s: Segredo) => void }) {
  const [nome, setNome] = useState(""), [url, setUrl] = useState("");
  const [eventos, setEventos] = useState<string[]>(["tarefa.entregue"]);
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState<string | null>(null);
  const criar = async () => {
    setOcupado(true); setErro(null);
    try {
      const r = await post<{ segredo: string }>(lote, { acao: "criar", tipo: "aviso", nome, url, eventos });
      setNome(""); setUrl(""); mudou();
      mostrar({ titulo: "Segredo de assinatura do aviso", valor: r.segredo, texto: "Use para conferir o cabeçalho X-WorkEnd-Assinatura de cada aviso e ignorar o que não veio do WorkEnd." });
    } catch (e) { setErro((e as Error).message); }
    setOcupado(false);
  };
  const nomeEvento = (id: string) => d.eventos.find((e) => e.id === id)?.nome ?? id;
  return (
    <Bloco id="cx-avisos" icone="sino" cor="#E8A317" titulo="Avisos automáticos" texto="Quando algo acontece na equipe, o WorkEnd manda um POST assinado para o endereço do seu sistema (3 tentativas).">
      <form className="eq-cx-form" onSubmit={(e) => { e.preventDefault(); void criar(); }}>
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
          <input className="eq-cx-campo" value={nome} onChange={(e) => setNome(e.target.value.slice(0, 60))} placeholder="Nome (ex.: Painel do site)" aria-label="Nome do aviso" />
          <input className="eq-cx-campo" value={url} onChange={(e) => setUrl(e.target.value.slice(0, 500))} placeholder="https://seusistema.com/workend/avisos" aria-label="Endereço do aviso" inputMode="url" />
        </div>
        <Caixas opcoes={d.eventos} marcados={eventos} mudar={setEventos} />
        <button type="submit" className="btn btn-tinta w-fit !py-2.5 text-sm" disabled={ocupado || !nome.trim() || !url.trim() || !eventos.length}>{ocupado ? "Criando…" : "Criar aviso"}</button>
      </form>
      <Erro t={erro} />
      <div className="mt-2">
        {itens.length === 0 && <p className="py-2 text-[13.5px] text-[var(--muted)]">Nenhum aviso ainda.</p>}
        {itens.map((c) => (
          <ItemConector key={c.id} c={c} lote={lote} mudou={mudou} rotuloTeste="Enviar teste">
            <div className="mt-1 flex flex-wrap gap-1">{(c.config.eventos ?? []).map((e) => <span key={e} className="eq-cx-chip">{nomeEvento(e)}</span>)}</div>
          </ItemConector>
        ))}
      </div>
      <details className="eq-cx-docs">
        <summary><Icone nome="codigo" tamanho={15} />O que chega e como conferir a assinatura</summary>
        <Codigo t={`POST (JSON)\nX-WorkEnd-Evento: tarefa.entregue\nX-WorkEnd-Assinatura: t=1763400000,v1=<hex>\n\n{ "id": "...", "evento": "tarefa.entregue", "criado_em": "...", "dados": { ... } }`} />
        <Codigo t={`// Node.js: confira antes de usar\nconst [t, v1] = cabecalho.split(",").map((p) => p.split("=")[1]);\nconst esperado = crypto.createHmac("sha256", SEGREDO)\n  .update(\`\${t}.\${corpoBruto}\`).digest("hex");\nconst valido = esperado === v1 && Date.now() / 1000 - Number(t) < 300;`} />
      </details>
    </Bloco>
  );
}

// ---------- c) fontes ----------
function BlocoFontes({ lote, itens, departamentos, mudou }: { lote: string; itens: Conector[]; departamentos: { id: string; nome: string }[]; mudou: () => void }) {
  const [nome, setNome] = useState(""), [url, setUrl] = useState(""), [cabecalho, setCabecalho] = useState("Authorization"), [valor, setValor] = useState("");
  const [todos, setTodos] = useState(true), [setores, setSetores] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState<string | null>(null);
  const criar = async () => {
    setOcupado(true); setErro(null);
    try {
      await post(lote, { acao: "criar", tipo: "fonte", nome, url, cabecalho, valor, setores: todos ? [] : setores });
      setNome(""); setUrl(""); setValor(""); setSetores([]); setTodos(true); mudou();
    } catch (e) { setErro((e as Error).message); }
    setOcupado(false);
  };
  const nomeSetor = (id: string) => departamentos.find((x) => x.id === id)?.nome ?? id;
  return (
    <Bloco id="cx-fontes" icone="banco" cor="#16A34A" titulo="Fontes de dados" texto="Endereços que os agentes leem antes de responder (receita, chamados, uso do site…). Assim eles trabalham com números reais, lidos a cada 10 minutos.">
      <form className="eq-cx-form" onSubmit={(e) => { e.preventDefault(); void criar(); }}>
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
          <input className="eq-cx-campo" value={nome} onChange={(e) => setNome(e.target.value.slice(0, 60))} placeholder="Nome (ex.: Números do site)" aria-label="Nome da fonte" />
          <input className="eq-cx-campo" value={url} onChange={(e) => setUrl(e.target.value.slice(0, 500))} placeholder="https://seusistema.com/api/numeros" aria-label="Endereço da fonte" inputMode="url" />
        </div>
        <div className="grid gap-2 sm:grid-cols-[0.8fr_1.6fr]">
          <input className="eq-cx-campo" value={cabecalho} onChange={(e) => setCabecalho(e.target.value.slice(0, 40))} placeholder="Cabeçalho" aria-label="Nome do cabeçalho de autorização" />
          <input className="eq-cx-campo" type="password" autoComplete="off" value={valor} onChange={(e) => setValor(e.target.value.slice(0, 600))} placeholder="Valor (ex.: Bearer sua-chave), opcional" aria-label="Valor do cabeçalho de autorização" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span className="mr-1 font-semibold">Quem lê:</span>
          <button type="button" className={`eq-cx-opcao ${todos ? "eq-cx-opcao-sim" : ""}`} onClick={() => setTodos(true)}>Toda a equipe</button>
          <button type="button" className={`eq-cx-opcao ${!todos ? "eq-cx-opcao-sim" : ""}`} onClick={() => setTodos(false)}>Só alguns departamentos</button>
        </div>
        {!todos && <Caixas opcoes={departamentos} marcados={setores} mudar={setSetores} />}
        <button type="submit" className="btn btn-tinta w-fit !py-2.5 text-sm" disabled={ocupado || !nome.trim() || !url.trim() || (!todos && !setores.length)}>{ocupado ? "Criando…" : "Criar fonte"}</button>
      </form>
      <Erro t={erro} />
      <div className="mt-2">
        {itens.length === 0 && <p className="py-2 text-[13.5px] text-[var(--muted)]">Nenhuma fonte ainda. O CEO lê todas as fontes; os outros, as da equipe toda e as do próprio departamento.</p>}
        {itens.map((c) => (
          <ItemConector key={c.id} c={c} lote={lote} mudou={mudou} rotuloTeste="Testar leitura">
            <p className="mt-1 text-[12px] text-[var(--muted)]">{c.config.setores?.length ? `Lida por: ${c.config.setores.map(nomeSetor).join(", ")} (e o CEO)` : "Lida por toda a equipe"}{c.temSegredo ? ` · autorização (${c.config.cabecalho}) configurada` : ""}</p>
          </ItemConector>
        ))}
      </div>
    </Bloco>
  );
}

// ---------- d) destinos ----------
function BlocoDestinos({ d, lote, itens, mudou, mostrar }: { d: Dados; lote: string; itens: Conector[]; mudou: () => void; mostrar: (s: Segredo) => void }) {
  const [nome, setNome] = useState(""), [url, setUrl] = useState("");
  const [tipos, setTipos] = useState<string[]>(["noticia", "guia"]);
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState<string | null>(null);
  const criar = async () => {
    setOcupado(true); setErro(null);
    try {
      const r = await post<{ segredo: string }>(lote, { acao: "criar", tipo: "destino", nome, url, tipos });
      setNome(""); setUrl(""); mudou();
      mostrar({ titulo: "Segredo de assinatura do destino", valor: r.segredo, texto: "O seu sistema usa este segredo para conferir o cabeçalho X-WorkEnd-Assinatura de cada envio." });
    } catch (e) { setErro((e as Error).message); }
    setOcupado(false);
  };
  return (
    <Bloco id="cx-destinos" icone="enviar" cor="#7C3AED" titulo="Destinos" texto="Para onde você envia uma entrega da equipe: rascunho de notícia, guia, missão ou evento no seu site. Nas respostas aparece o botão Enviar para…, e nada sai sem o seu clique.">
      <form className="eq-cx-form" onSubmit={(e) => { e.preventDefault(); void criar(); }}>
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
          <input className="eq-cx-campo" value={nome} onChange={(e) => setNome(e.target.value.slice(0, 60))} placeholder="Nome (ex.: Rascunhos do site)" aria-label="Nome do destino" />
          <input className="eq-cx-campo" value={url} onChange={(e) => setUrl(e.target.value.slice(0, 500))} placeholder="https://seusite.com/api/rascunhos" aria-label="Endereço do destino" inputMode="url" />
        </div>
        <Caixas opcoes={d.tiposDestino} marcados={tipos} mudar={setTipos} />
        <button type="submit" className="btn btn-tinta w-fit !py-2.5 text-sm" disabled={ocupado || !nome.trim() || !url.trim() || !tipos.length}>{ocupado ? "Criando…" : "Criar destino"}</button>
      </form>
      <Erro t={erro} />
      <div className="mt-2">
        {itens.length === 0 && <p className="py-2 text-[13.5px] text-[var(--muted)]">Nenhum destino ainda.</p>}
        {itens.map((c) => (
          <ItemConector key={c.id} c={c} lote={lote} mudou={mudou} rotuloTeste="Enviar teste">
            <div className="mt-1 flex flex-wrap gap-1">{(c.config.tipos ?? []).map((t) => <span key={t} className="eq-cx-chip">{TIPO_NOME[t] ?? t}</span>)}</div>
          </ItemConector>
        ))}
      </div>
      <details className="eq-cx-docs">
        <summary><Icone nome="codigo" tamanho={15} />O que o seu sistema recebe</summary>
        <Codigo t={`POST (JSON), assinado em X-WorkEnd-Assinatura\n{\n  "id": "...", "tipo": "noticia",\n  "titulo": "...", "texto": "... (markdown)",\n  "autor": { "nome": "...", "cargo": "...", "departamento": "..." },\n  "empresa": { "nome": "...", "lote": "..." },\n  "origem": { "mensagemId": "...", "conversa": "..." },\n  "enviado_em": "..."\n}\nResposta esperada: 2xx com { "id": "...", "url": "..." } (opcional)`} />
      </details>
    </Bloco>
  );
}

// ---------- histórico ----------
const Estado = ({ s, rotulo }: { s: string; rotulo?: string }) => (
  <span className="eq-estado" style={s === "ok" ? { color: "#166534", background: "#E3F6EA" } : s === "erro" ? { color: "#9B1C1C", background: "#FDECEC" } : { color: "#8A6A12", background: "#FFF3CC" }}>
    {rotulo ?? (s === "ok" ? "entregue" : s === "erro" ? "falhou" : "tentando")}
  </span>
);
function Historico({ d }: { d: Dados }) {
  if (!d.registros.length) return null;
  const nome = (id: string | null) => d.conectores.find((c) => c.id === id)?.nome ?? "conector apagado";
  const tipo: Record<string, string> = { aviso: "Aviso", envio: "Envio", teste: "Teste" };
  return (
    <div className="eq-cx-bloco mt-4">
      <h3>Histórico</h3>
      {d.registros.map((r) => (
        <div key={r.id} className="eq-cx-item flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]" title={r.resposta ?? undefined}>
          <Estado s={r.status} />
          <b>{tipo[r.tipo] ?? r.tipo}</b>
          <span className="text-[var(--muted)]">{r.evento ? (TIPO_NOME[r.evento] ?? d.eventos.find((e) => e.id === r.evento)?.nome ?? r.evento) : ""}</span>
          <span className="min-w-0 flex-1 truncate">{nome(r.conectorId)}{r.resumo ? ` · ${r.resumo}` : ""}</span>
          <span className="text-[11.5px] text-[var(--muted)]">{r.codigo ? `código ${r.codigo} · ` : ""}{r.tentativas > 1 ? `${r.tentativas} tentativas · ` : ""}{quando(r.criadoEm)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- segredo (aparece uma vez) ----------
function SegredoUmaVez({ s, fechar }: { s: Segredo; fechar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <PorCima>
    <div className="eq-modal-fundo">
      <div className="eq-modal" role="dialog" aria-modal="true" aria-labelledby="cx-segredo-titulo">
        <h2 id="cx-segredo-titulo" style={{ fontSize: "1.45rem", lineHeight: 1.2 }}>{s.titulo}</h2>
        <p className="mt-1 text-[14.5px] text-[var(--muted)]">{s.texto}</p>
        <div className="eq-cx-segredo"><code>{s.valor}</code></div>
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-[#FFF7E3] px-3 py-2 text-[13.5px] text-[#5B4300]"><Icone nome="admin" tamanho={17} className="mt-0.5 shrink-0" />Copie e guarde agora. Por segurança, este valor não aparece de novo; se perder, apague e crie outro.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn btn-azul" onClick={() => { void navigator.clipboard?.writeText(s.valor); setCopiado(true); }}>{copiado ? "Copiado" : "Copiar"}</button>
          <button type="button" className="btn btn-linha" onClick={fechar}>Já guardei</button>
        </div>
      </div>
    </div>
    </PorCima>
  );
}

// ---------- Enviar para… (nas respostas da equipe) ----------
const tituloDe = (t: string) => (t.split("\n").map((l) => l.replace(/^[#>*\-\s\d.)]+/, "").replace(/[*_`]/g, "").trim()).find((l) => l.length > 3) ?? "").slice(0, 120);
export function EnviarPara({ m, membro, lote }: { m: MsgEquipe; membro: MembroEquipe; lote: string }) {
  const destinos = useDestinos(lote);
  const [aberto, setAberto] = useState(false);
  if (!destinos?.length || m.id.startsWith("tmp")) return null;
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-[var(--tinta-2)] hover:bg-[var(--cinza)]"><Icone nome="enviar" tamanho={13} />Enviar para…</button>
      {aberto && <ModalEnviar m={m} membro={membro} lote={lote} destinos={destinos} fechar={() => setAberto(false)} />}
    </>
  );
}
function ModalEnviar({ m, membro, lote, destinos, fechar }: { m: MsgEquipe; membro: MembroEquipe; lote: string; destinos: Destino[]; fechar: () => void }) {
  const [destino, setDestino] = useState(destinos[0].id);
  const dest = destinos.find((x) => x.id === destino) ?? destinos[0];
  const [tipoEscolhido, setTipo] = useState(dest.tipos[0]);
  const tipo = dest.tipos.includes(tipoEscolhido) ? tipoEscolhido : dest.tipos[0];
  const [titulo, setTitulo] = useState(() => tituloDe(m.conteudo));
  const [texto, setTexto] = useState(m.conteudo);
  const [enviando, setEnviando] = useState(false);
  const [res, setRes] = useState<{ ok: boolean; id?: string; url?: string; resposta?: string } | null>(null);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    addEventListener("keydown", tecla); return () => removeEventListener("keydown", tecla);
  }, [fechar]);
  const enviar = async () => {
    setEnviando(true); setRes(null);
    try { setRes(await post<{ ok: boolean; id?: string; url?: string; resposta?: string }>(lote, { acao: "enviar", destino: dest.id, tipoConteudo: tipo, titulo, texto, membro: membro.membroId, mensagem: m.id })); }
    catch (e) { setRes({ ok: false, resposta: (e as Error).message }); }
    setEnviando(false);
  };
  return (
    <PorCima>
    <div className="eq-modal-fundo" onClick={fechar}>
      <div className="eq-modal" role="dialog" aria-modal="true" aria-labelledby="cx-enviar-titulo" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={fechar} aria-label="Fechar" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-dim)]"><Icone nome="fechar" tamanho={18} /></button>
        <h2 id="cx-enviar-titulo" className="pr-10" style={{ fontSize: "1.45rem", lineHeight: 1.2 }}>Enviar a entrega de {membro.nome}</h2>
        <p className="mt-1 text-[14px] text-[var(--muted)]">Confira e ajuste antes. O sistema de destino recebe o conteúdo assinado pelo WorkEnd.</p>
        {res?.ok ? (
          <div className="mt-4 rounded-2xl bg-[#E3F6EA] p-4 text-[#166534]">
            <b className="flex items-center gap-2"><Icone nome="check" tamanho={18} />Enviado para {dest.nome}.</b>
            <p className="mt-1 text-[14px]">{res.id ? `O sistema registrou com o id ${res.id}.` : "O sistema confirmou o recebimento."}</p>
            {res.url && <a href={res.url} target="_blank" rel="noopener" className="eq-link mt-1 inline-block">Abrir no sistema</a>}
            <div className="mt-3"><button type="button" className="btn btn-linha" onClick={fechar}>Fechar</button></div>
          </div>
        ) : (
          <form className="mt-3 grid gap-2.5" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[13px] font-semibold">Destino
                <select className="eq-cx-campo mt-1" value={dest.id} onChange={(e) => setDestino(e.target.value)}>{destinos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>
              </label>
              <label className="text-[13px] font-semibold">Tipo
                <select className="eq-cx-campo mt-1" value={tipo} onChange={(e) => setTipo(e.target.value)}>{dest.tipos.map((t) => <option key={t} value={t}>{TIPO_NOME[t] ?? t}</option>)}</select>
              </label>
            </div>
            <label className="text-[13px] font-semibold">Título
              <input className="eq-cx-campo mt-1" value={titulo} onChange={(e) => setTitulo(e.target.value.slice(0, 200))} />
            </label>
            <label className="text-[13px] font-semibold">Texto
              <textarea className="eq-cx-campo mt-1 min-h-[180px] resize-y font-normal" value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 20000))} />
            </label>
            {res && !res.ok && <Erro t={res.resposta ?? "Não deu certo."} />}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-azul" disabled={enviando || !titulo.trim() || !texto.trim()}><Icone nome="enviar" tamanho={16} />{enviando ? "Enviando…" : `Enviar para ${dest.nome}`}</button>
              <button type="button" className="btn btn-linha" onClick={fechar}>Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </div>
    </PorCima>
  );
}
