"use client";
// Aba Tarefas do painel do agente. O que aparece depende do cargo/setor:
// - CEO: contas conectadas + "Publicar vídeo" (YouTube/Instagram/TikTok).
// - Gerente de Design gráfico: "Criar arte" (briefing + referências → prompt → aprovação → gpt-image-2) e a ação "ao concluir".
// - Outros: só a lista (tarefas recebidas de outros setores etc.). As tarefas de um setor chegam sempre pelo gerente.
import { useCallback, useEffect, useState } from "react";
import { AREAS, AREAS_OPERACIONAIS, type AreaId, type Nivel } from "../data/org";

interface Conexao { provedor: string; contaNome: string; contaId: string; criadoEm: string }
interface Plano { titulo: string; descricao: string; tags: string[]; resumo: string; plataformas: string[]; privacidade: "public" | "unlisted" | "private"; prompt?: string; formato?: string }
interface Tarefa {
  id: string; tipo: string; status: string; titulo: string;
  dados: { arquivoNome?: string; legenda?: string; plataformas?: string[]; briefing?: string; formato?: string; referenciaNomes?: string[]; url?: string; deNome?: string; deArea?: string; mensagem?: string };
  plano: Plano | null;
  resultado: (Record<string, unknown> & { url?: string; arquivoNome?: string; custoBrl?: number; pendentes?: string[]; encaminhadoPara?: { area: string; nome: string; em: string }[] }) | null;
  erro: string | null; criadoEm: string;
}
interface Props { agenteId: string; nomeAgente: string; area: AreaId; nivel: Nivel; config?: { aoConcluir?: { encaminharPara?: string | null } }; recarregarFicha?: () => Promise<void> }

const api = async (url: string, method = "GET", body?: unknown) => {
  const r = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`);
  return j;
};
// upload com progresso (XMLHttpRequest)
const upload = (arquivo: File, onProgresso?: (p: number) => void) => new Promise<{ id: string; nome: string }>((res, rej) => {
  const fd = new FormData(); fd.append("arquivo", arquivo);
  const x = new XMLHttpRequest(); x.open("POST", "/api/arquivos");
  x.upload.onprogress = (e) => { if (e.lengthComputable) onProgresso?.(Math.round((e.loaded / e.total) * 100)); };
  x.onload = () => { try { const j = JSON.parse(x.responseText); x.status < 300 ? res(j) : rej(new Error(j.erro ?? `Erro ${x.status}`)); } catch { rej(new Error(`Erro ${x.status}`)); } };
  x.onerror = () => rej(new Error("Falha de rede no upload")); x.send(fd);
});
const STATUS: Record<string, { nome: string; cor: string }> = {
  planejando: { nome: "Planejando", cor: "#8B6CF0" }, aguardando_aprovacao: { nome: "Aguardando seu ok", cor: "#D9A23A" }, executando: { nome: "Executando…", cor: "#4F7DF3" },
  concluida: { nome: "Concluída", cor: "#22A86B" }, falhou: { nome: "Falhou", cor: "#E2575B" }, cancelada: { nome: "Cancelada", cor: "#9AA3AD" }, recebida: { nome: "Recebida", cor: "#00ACC1" },
};
const PLATAFORMAS = [
  { id: "youtube", nome: "YouTube", cor: "#FF0000", icone: "▶", variaveis: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET", nota: "" },
  { id: "instagram", nome: "Instagram", cor: "#E1306C", icone: "◎", variaveis: "INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET", nota: "conta profissional (Business ou Creator)" },
  { id: "tiktok", nome: "TikTok", cor: "#111111", icone: "♪", variaveis: "TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET", nota: "até o app ser auditado, publica como 'somente eu'" },
];
const FORMATOS = [
  { id: "quadrado", nome: "Quadrado", sub: "1:1 · feed", w: 18, h: 18 },
  { id: "vertical", nome: "Vertical", sub: "2:3 · story / reels", w: 14, h: 21 },
  { id: "horizontal", nome: "Horizontal", sub: "3:2 · capa / banner", w: 21, h: 14 },
];
const inp = "rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#4F7DF3]";
const fmtData = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function AbaTarefas({ agenteId, nomeAgente, area, nivel, config, recarregarFicha }: Props) {
  const [conexoes, setConexoes] = useState<{ configurado: Record<string, boolean>; conexoes: Conexao[] } | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const ehCEO = nivel === "ceo";
  const ehGerenteDesign = area === "designgrafico" && nivel === "gerente";
  const carregar = useCallback(async () => {
    try { if (ehCEO) setConexoes(await api("/api/conexoes")); setTarefas(await api(`/api/tarefas?agente=${agenteId}`)); setErro(null); } catch (e) { setErro((e as Error).message); }
  }, [agenteId, ehCEO]);
  useEffect(() => { carregar(); }, [carregar]);
  // volta do Google/Meta/TikTok (?conexao=youtube&ok=... | &erro=...)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const cx = p.get("conexao");
    if (cx) { const nome = PLATAFORMAS.find((x) => x.id === cx)?.nome ?? cx; setAviso(p.get("ok") ? `${nome} conectado: ${p.get("ok")}` : `Falhou ao conectar ${nome}: ${p.get("erro")}`); window.history.replaceState(null, "", window.location.pathname); }
  }, []);
  // enquanto houver tarefa em andamento, atualiza a cada 4 s
  useEffect(() => {
    if (!tarefas.some((t) => ["planejando", "executando"].includes(t.status))) return;
    const i = setInterval(carregar, 4000); return () => clearInterval(i);
  }, [tarefas, carregar]);

  return (
    <div className="flex flex-col gap-4 text-sm">
      {aviso && <div className="rounded-xl bg-[#E8F3FF] px-3 py-2 text-xs text-[#1D4E89]">{aviso} <button onClick={() => setAviso(null)} className="ml-2 underline">ok</button></div>}
      {erro && <div className="rounded-xl bg-[#FDE8E8] px-3 py-2 text-xs text-[#8A2A2A]">{erro}</div>}

      {ehCEO && (
        <>
          <section className="rounded-2xl border border-black/10 p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5B6472]">Contas conectadas</div>
            <div className="flex flex-col gap-2">
              {PLATAFORMAS.map((p) => { const c = conexoes?.conexoes.find((x) => x.provedor === p.id); const cfg = conexoes?.configurado[p.id]; return (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg text-sm font-black text-white" style={{ background: p.cor }}>{p.icone}</span>
                    <div><div className="font-semibold">{p.nome}</div><div className="text-[11px] text-[#5B6472]">{c ? `conta: ${c.contaNome || c.contaId}` : conexoes && !cfg ? `falta ${p.variaveis} no CapRover` : p.nota || "não conectado"}</div></div></div>
                  {c
                    ? <button onClick={async () => { if (!confirm(`Desconectar o ${p.nome}?`)) return; await api(`/api/conexoes/${p.id}`, "DELETE"); carregar(); }} className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold">Desconectar</button>
                    : <a href={`/api/conexoes/${p.id}`} className={`rounded-full px-3 py-1.5 text-xs font-bold text-white ${cfg ? "bg-[#4F7DF3]" : "pointer-events-none bg-black/20"}`}>Conectar</a>}
                </div>); })}
            </div>
          </section>
          <NovaPublicacao agenteId={agenteId} nomeAgente={nomeAgente} aoCriar={carregar} conectadas={(conexoes?.conexoes ?? []).map((c) => c.provedor)} />
        </>
      )}

      {ehGerenteDesign && (
        <>
          <NovaArte agenteId={agenteId} nomeAgente={nomeAgente} aoCriar={carregar} />
          <AcaoAoConcluir agenteId={agenteId} nomeAgente={nomeAgente} area={area} atual={config?.aoConcluir?.encaminharPara ?? null} aoSalvar={recarregarFicha} />
        </>
      )}
      {area === "designgrafico" && nivel !== "gerente" && (
        <div className="rounded-2xl bg-[#FFF8E6] px-3 py-2 text-xs text-[#7A5A00]">As tarefas de arte chegam pelo <b>gerente de Design gráfico</b>, que é o especialista do setor. {nivel === "senior" || nivel === "pleno" || nivel === "junior" || nivel === "estagiario" ? "Contrate um gerente de Design gráfico (botão “Contratar agente”) pra entregar briefings." : ""}</div>
      )}
      {!ehCEO && area !== "designgrafico" && (
        <div className="rounded-2xl bg-black/[0.04] px-3 py-2 text-xs text-[#5B6472]">O setor <b>{AREAS[area].nome}</b> ainda não tem uma função real própria. Aqui aparecem as tarefas que chegam de outros setores (artes encaminhadas, por exemplo).</div>
      )}

      {/* histórico */}
      <section>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5B6472]">Tarefas ({tarefas.length})</div>
        {tarefas.length === 0 && <div className="text-xs text-[#5B6472]">Nenhuma tarefa ainda.</div>}
        <div className="flex flex-col gap-2">{tarefas.map((t) => <CartaoTarefa key={t.id} t={t} nomeAgente={nomeAgente} recarregar={carregar} />)}</div>
      </section>
    </div>
  );
}

// ---------------- CEO: publicar vídeo ----------------
function NovaPublicacao({ agenteId, nomeAgente, aoCriar, conectadas }: { agenteId: string; nomeAgente: string; aoCriar: () => Promise<void>; conectadas: string[] }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [legenda, setLegenda] = useState("");
  const [titulo, setTitulo] = useState("");
  const [plataformas, setPlataformas] = useState<string[]>(["youtube", "instagram", "tiktok"]);
  const [privacidade, setPrivacidade] = useState<"public" | "unlisted" | "private">("public");
  const [fase, setFase] = useState<"idle" | "enviando" | "planejando">("idle");
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async () => {
    if (!arquivo || !legenda.trim()) return;
    setErro(null); setFase("enviando"); setProgresso(0);
    try {
      const arq = await upload(arquivo, setProgresso);
      setFase("planejando");
      await api("/api/tarefas", "POST", { agenteId, arquivoId: arq.id, legenda: legenda.trim(), titulo: titulo.trim() || undefined, plataformas, privacidade });
      setArquivo(null); setLegenda(""); setTitulo("");
      await aoCriar();
    } catch (e) { setErro((e as Error).message); } finally { setFase("idle"); }
  };

  return (
    <section className="rounded-2xl border border-black/10 p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5B6472]">Nova tarefa · Publicar vídeo</div>
      <div className="flex flex-col gap-2">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-black/15 px-3 py-4 text-center text-xs text-[#5B6472] hover:border-[#4F7DF3]">
          <input type="file" accept="video/*" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          {arquivo ? <span className="font-semibold text-[#1D2128]">{arquivo.name} · {(arquivo.size / 1048576).toFixed(1)} MB</span> : <><span className="text-lg">🎬</span><span>Clique pra escolher o vídeo (mp4, mov, webm)</span></>}
        </label>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional — o CEO cria se ficar vazio)" className={inp} />
        <textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} placeholder="Legenda / descrição do post" rows={4} className={inp} />
        <div className="flex flex-wrap items-center gap-1.5">
          {PLATAFORMAS.map((p) => { const on = plataformas.includes(p.id); const ok = conectadas.includes(p.id); return (
            <button key={p.id} onClick={() => setPlataformas(on ? plataformas.filter((x) => x !== p.id) : [...plataformas, p.id])} title={ok ? "" : "conta não conectada"}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? "border-transparent text-white" : "border-black/10 text-[#5B6472]"}`} style={on ? { background: ok ? "#4F7DF3" : "#9AA3AD" } : {}}>{p.nome}{!ok && " ·⚠"}</button>); })}
          <select value={privacidade} onChange={(e) => setPrivacidade(e.target.value as typeof privacidade)} className="ml-auto rounded-full border border-black/10 px-2 py-1 text-xs">
            <option value="public">Público</option><option value="unlisted">Não listado</option><option value="private">Privado</option>
          </select>
        </div>
        {erro && <div className="rounded-xl bg-[#FDE8E8] px-3 py-2 text-xs text-[#8A2A2A]">{erro}</div>}
        {fase === "enviando" && <div className="h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full bg-[#4F7DF3] transition-all" style={{ width: `${progresso}%` }} /></div>}
        <button onClick={enviar} disabled={fase !== "idle" || !arquivo || !legenda.trim() || !plataformas.length} className="rounded-xl bg-[#4F7DF3] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          {fase === "enviando" ? `Enviando vídeo… ${progresso}%` : fase === "planejando" ? `${nomeAgente} está preparando o post…` : `Entregar pro ${nomeAgente}`}
        </button>
        {plataformas.some((p) => !conectadas.includes(p)) && <div className="text-[11px] text-[#7A5A00]">Rede marcada com ⚠ ainda não está conectada: conecte acima antes de aprovar (dá pra enviar o vídeo agora e conectar depois).</div>}
        <div className="text-[11px] text-[#5B6472]">O {nomeAgente} lê a legenda, propõe título/descrição/tags e espera o seu ok antes de publicar.</div>
      </div>
    </section>
  );
}

// ---------------- Design gráfico: criar arte ----------------
function NovaArte({ agenteId, nomeAgente, aoCriar }: { agenteId: string; nomeAgente: string; aoCriar: () => Promise<void> }) {
  const [briefing, setBriefing] = useState("");
  const [titulo, setTitulo] = useState("");
  const [formato, setFormato] = useState("quadrado");
  const [refs, setRefs] = useState<File[]>([]);
  const [fase, setFase] = useState<"idle" | "enviando" | "planejando">("idle");
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async () => {
    if (!briefing.trim()) return;
    setErro(null); setFase("enviando");
    try {
      const ids: string[] = [];
      for (const f of refs) ids.push((await upload(f)).id);
      setFase("planejando");
      await api("/api/tarefas", "POST", { agenteId, tipo: "criar_arte", briefing: briefing.trim(), titulo: titulo.trim() || undefined, formato, referenciaIds: ids });
      setBriefing(""); setTitulo(""); setRefs([]);
      await aoCriar();
    } catch (e) { setErro((e as Error).message); } finally { setFase("idle"); }
  };

  return (
    <section className="rounded-2xl border border-black/10 p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5B6472]">Nova tarefa · Criar arte <span className="ml-1 rounded-full bg-black/5 px-2 py-0.5 text-[10px] normal-case tracking-normal">gpt-image-2 · alta qualidade · ~R$ 1 por arte</span></div>
      <div className="flex flex-col gap-2">
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nome da peça (opcional)" className={inp} />
        <textarea value={briefing} onChange={(e) => setBriefing(e.target.value)} rows={5} className={inp}
          placeholder={"Briefing: o que é a peça, pra quem, texto que deve aparecer (entre aspas), cores/estilo, o que evitar.\nEx.: post pro Instagram anunciando 20% off na hospedagem, texto \"20% OFF\" grande, azul da Nuvem, estilo clean e moderno."} />
        <div className="flex flex-wrap gap-1.5">
          {FORMATOS.map((f) => (
            <button key={f.id} onClick={() => setFormato(f.id)} className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-xs ${formato === f.id ? "border-[#4F7DF3] bg-[#4F7DF3]/10" : "border-black/10"}`}>
              <span className="block rounded-sm border border-[#1D2128]/60" style={{ width: f.w, height: f.h }} />
              <span><span className="block font-semibold">{f.nome}</span><span className="block text-[10px] text-[#5B6472]">{f.sub}</span></span>
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border-2 border-dashed border-black/15 px-3 py-2 text-xs text-[#5B6472] hover:border-[#4F7DF3]">
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setRefs(Array.from(e.target.files ?? []).slice(0, 4))} />
          <span>🖼 Referências (opcional): logo, produto, foto — até 4. {refs.length ? <b className="text-[#1D2128]">{refs.map((r) => r.name).join(", ")}</b> : null}</span>
          {refs.length > 0 && <button onClick={(e) => { e.preventDefault(); setRefs([]); }} className="rounded-full bg-black/5 px-2 py-0.5">limpar</button>}
        </label>
        {erro && <div className="rounded-xl bg-[#FDE8E8] px-3 py-2 text-xs text-[#8A2A2A]">{erro}</div>}
        <button onClick={enviar} disabled={fase !== "idle" || !briefing.trim()} className="rounded-xl bg-[#4F7DF3] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          {fase === "enviando" ? "Enviando referências…" : fase === "planejando" ? `${nomeAgente} está escrevendo o prompt…` : `Entregar pro ${nomeAgente}`}
        </button>
        <div className="text-[11px] text-[#5B6472]">{nomeAgente} lê o briefing, escreve o prompt da imagem e espera o seu ok antes de gerar (só aí gasta).</div>
      </div>
    </section>
  );
}

// "Treino": o que o agente faz sozinho quando termina uma arte.
function AcaoAoConcluir({ agenteId, nomeAgente, area, atual, aoSalvar }: { agenteId: string; nomeAgente: string; area: AreaId; atual: string | null; aoSalvar?: () => Promise<void> }) {
  const [valor, setValor] = useState<string>(atual ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { setValor(atual ?? ""); }, [atual]);
  const salvar = async () => {
    try { await api(`/api/agentes/${agenteId}`, "PATCH", { config: { aoConcluir: { encaminharPara: valor || null } } }); setMsg("Salvo."); await aoSalvar?.(); } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <section className="rounded-2xl border border-black/10 p-3">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[#5B6472]">Ao concluir uma arte</div>
      <div className="mb-2 text-[11px] text-[#5B6472]">O que {nomeAgente} faz sozinho quando termina (você também pode encaminhar à mão em cada tarefa).</div>
      <div className="flex items-center gap-2">
        <select value={valor} onChange={(e) => setValor(e.target.value)} className={inp + " min-w-0 flex-1"}>
          <option value="">Só me avisar (nada automático)</option>
          {AREAS_OPERACIONAIS.filter((a) => a !== area).map((a) => <option key={a} value={a}>Encaminhar pro gerente de {AREAS[a].nome}</option>)}
        </select>
        <button onClick={salvar} className="shrink-0 rounded-xl bg-[#1D2128] px-3 py-2 text-xs font-bold text-white">Salvar</button>
      </div>
      {msg && <div className="mt-1 text-[11px] text-[#5B6472]">{msg}</div>}
    </section>
  );
}

// ---------------- cartão de tarefa (todos os tipos) ----------------
function CartaoTarefa({ t, nomeAgente, recarregar }: { t: Tarefa; nomeAgente: string; recarregar: () => Promise<void> }) {
  const st = STATUS[t.status] ?? { nome: t.status, cor: "#9AA3AD" };
  const arte = t.tipo === "criar_arte";
  const recebido = t.tipo === "arquivo_recebido";
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(t.plano?.titulo ?? t.titulo);
  const [descricao, setDescricao] = useState(t.plano?.descricao ?? "");
  const [prompt, setPrompt] = useState(t.plano?.prompt ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [destino, setDestino] = useState("");
  useEffect(() => { setErro(null); }, [t.status]); // mudou de status no servidor: limpa erro antigo (ex.: 504 do proxy enquanto gerava)
  const aprovar = async () => {
    setOcupado(true); setErro(null);
    try { await api(`/api/tarefas/${t.id}/executar`, "POST", editando ? (arte ? { titulo, prompt } : { titulo, descricao }) : {}); await recarregar(); } catch (e) { setErro((e as Error).message); await recarregar(); } finally { setOcupado(false); }
  };
  const encaminhar = async () => {
    if (!destino) return; setOcupado(true); setErro(null);
    try { await api(`/api/tarefas/${t.id}/encaminhar`, "POST", { area: destino }); setDestino(""); await recarregar(); } catch (e) { setErro((e as Error).message); } finally { setOcupado(false); }
  };
  const imagemUrl = recebido ? t.dados.url : t.resultado?.url;
  const sub = recebido
    ? `de ${t.dados.deNome} (${AREAS[t.dados.deArea as AreaId]?.nome ?? t.dados.deArea}) · ${fmtData(t.criadoEm)}`
    : arte ? `${FORMATOS.find((f) => f.id === (t.plano?.formato ?? t.dados.formato))?.nome ?? ""}${t.dados.referenciaNomes?.length ? ` · ${t.dados.referenciaNomes.length} ref.` : ""} · ${fmtData(t.criadoEm)}`
    : `${t.dados.arquivoNome} · ${(t.dados.plataformas ?? []).join(", ")} · ${fmtData(t.criadoEm)}`;
  return (
    <div className="rounded-2xl border border-black/10 p-3">
      <div className="flex items-start justify-between gap-2">
        <div><div className="font-semibold">{t.plano?.titulo ?? t.titulo}</div><div className="text-[11px] text-[#5B6472]">{sub}</div></div>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: st.cor }}>{st.nome}</span>
      </div>

      {t.status === "aguardando_aprovacao" && t.plano && (
        <div className="mt-2 rounded-xl bg-[#FFF8E6] p-3 text-xs">
          <div className="mb-1 font-semibold text-[#7A5A00]">{nomeAgente}: “{t.plano.resumo}”</div>
          {editando ? (
            <div className="flex flex-col gap-1.5">
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inp} />
              {arte ? <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={7} className={inp} /> : <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={5} className={inp} />}
            </div>
          ) : arte ? (
            <div className="whitespace-pre-wrap"><b>Prompt:</b> {t.plano.prompt}</div>
          ) : (
            <>
              <div><b>Título:</b> {t.plano.titulo}</div>
              <div className="mt-1 whitespace-pre-wrap"><b>Descrição:</b> {t.plano.descricao}</div>
              {t.plano.tags?.length ? <div className="mt-1 text-[#5B6472]">tags: {t.plano.tags.join(", ")}</div> : null}
            </>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button onClick={aprovar} disabled={ocupado} className="rounded-full bg-[#22A86B] px-3 py-1.5 font-bold text-white disabled:opacity-50">{ocupado ? (arte ? "Gerando…" : "Publicando…") : arte ? "Aprovar e gerar" : "Aprovar e publicar"}</button>
            <button onClick={() => setEditando(!editando)} className="rounded-full bg-black/5 px-3 py-1.5 font-semibold">{editando ? `Ver como ${nomeAgente} propôs` : arte ? "Ajustar prompt" : "Ajustar texto"}</button>
            <button onClick={async () => { await api(`/api/tarefas/${t.id}`, "DELETE"); recarregar(); }} className="rounded-full px-3 py-1.5 text-[#8A2A2A]">Cancelar</button>
          </div>
        </div>
      )}
      {t.status === "executando" && arte && <div className="mt-2 text-xs text-[#4F7DF3]">🎨 {nomeAgente} está gerando a imagem (até ~1 min)…</div>}

      {/* resultado: arte gerada ou arquivo recebido */}
      {imagemUrl && (t.status === "concluida" || recebido) && (
        <div className="mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <a href={imagemUrl} target="_blank" rel="noreferrer"><img src={imagemUrl} alt={t.titulo} className="max-h-72 w-full rounded-xl border border-black/10 object-contain bg-[#F4F5F7]" /></a>
          {recebido && t.dados.mensagem && <div className="mt-1 text-[11px] text-[#5B6472]">{t.dados.mensagem}</div>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <a href={imagemUrl} download={(recebido ? t.dados.arquivoNome : t.resultado?.arquivoNome) ?? "arte.png"} className="rounded-full bg-[#1D2128] px-3 py-1.5 font-bold text-white">⬇ Baixar</a>
            {typeof t.resultado?.custoBrl === "number" && <span className="text-[#5B6472]">R$ {t.resultado.custoBrl.toFixed(2)}</span>}
            {!recebido && (
              <span className="ml-auto flex items-center gap-1">
                <select value={destino} onChange={(e) => setDestino(e.target.value)} className="rounded-full border border-black/10 px-2 py-1 text-xs">
                  <option value="">Enviar para setor…</option>
                  {AREAS_OPERACIONAIS.map((a) => <option key={a} value={a}>{AREAS[a].nome}</option>)}
                </select>
                <button onClick={encaminhar} disabled={!destino || ocupado} className="rounded-full bg-[#4F7DF3] px-3 py-1.5 font-bold text-white disabled:opacity-40">Enviar</button>
              </span>
            )}
          </div>
          {Array.isArray(t.resultado?.encaminhadoPara) && t.resultado.encaminhadoPara.length > 0 && (
            <div className="mt-1 text-[11px] text-[#5B6472]">Encaminhada pra {t.resultado.encaminhadoPara.map((e) => `${e.nome} (${AREAS[e.area as AreaId]?.nome ?? e.area})`).join(", ")}.</div>
          )}
        </div>
      )}

      {t.status === "concluida" && !arte && PLATAFORMAS.map((p) => { const r = t.resultado?.[p.id] as { url?: string; canal?: string; conta?: string } | undefined; return r?.url ? (
        <div key={p.id} className="mt-1 text-xs">✅ {p.nome}{(r.canal ?? r.conta) ? ` (${r.canal ?? r.conta})` : ""}: <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold text-[#4F7DF3] underline">{r.url}</a></div>) : null; })}
      {Array.isArray(t.resultado?.pendentes) && t.resultado.pendentes.length > 0 && <div className="mt-1 text-[11px] text-[#7A5A00]">Pendente: {t.resultado.pendentes.join("; ")}</div>}
      {(t.status === "falhou" || erro) && (
        <div className="mt-2 rounded-xl bg-[#FDE8E8] p-2 text-xs text-[#8A2A2A]">{erro ?? t.erro}
          {t.status === "falhou" && t.plano && <button onClick={aprovar} disabled={ocupado} className="ml-2 rounded-full bg-white px-2 py-0.5 font-semibold">Tentar de novo</button>}
        </div>
      )}
    </div>
  );
}
