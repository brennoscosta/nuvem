"use client";
// Aba Tarefas do painel do agente: conexões (YouTube), "Publicar vídeo" (enviar → plano do agente → aprovar → publicado) e histórico.
import { useCallback, useEffect, useState } from "react";

interface Conexao { provedor: string; contaNome: string; contaId: string; criadoEm: string }
interface Plano { titulo: string; descricao: string; tags: string[]; resumo: string; plataformas: string[]; privacidade: "public" | "unlisted" | "private" }
interface Tarefa { id: string; tipo: string; status: string; titulo: string; dados: { arquivoNome?: string; legenda?: string; plataformas?: string[] }; plano: Plano | null; resultado: Record<string, { url?: string; canal?: string } | string[]> | null; erro: string | null; criadoEm: string }

const api = async (url: string, method = "GET", body?: unknown) => {
  const r = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`);
  return j;
};
const STATUS: Record<string, { nome: string; cor: string }> = {
  planejando: { nome: "Planejando", cor: "#8B6CF0" }, aguardando_aprovacao: { nome: "Aguardando seu ok", cor: "#D9A23A" }, executando: { nome: "Publicando…", cor: "#4F7DF3" },
  concluida: { nome: "Publicado", cor: "#22A86B" }, falhou: { nome: "Falhou", cor: "#E2575B" }, cancelada: { nome: "Cancelada", cor: "#9AA3AD" },
};
const PLATAFORMAS = [{ id: "youtube", nome: "YouTube", pronto: true }, { id: "instagram", nome: "Instagram", pronto: false }, { id: "tiktok", nome: "TikTok", pronto: false }];
const inp = "rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#4F7DF3]";

export function AbaTarefas({ agenteId, nomeAgente }: { agenteId: string; nomeAgente: string }) {
  const [conexoes, setConexoes] = useState<{ configurado: { youtube: boolean }; conexoes: Conexao[] } | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    try { setConexoes(await api("/api/conexoes")); setTarefas(await api(`/api/tarefas?agente=${agenteId}`)); setErro(null); } catch (e) { setErro((e as Error).message); }
  }, [agenteId]);
  useEffect(() => { carregar(); }, [carregar]);
  // volta do Google (?conexao=youtube&ok=... | &erro=...)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("conexao") === "youtube") { setAviso(p.get("ok") ? `YouTube conectado: ${p.get("ok")}` : `Falhou ao conectar: ${p.get("erro")}`); window.history.replaceState(null, "", "/"); }
  }, []);
  // enquanto houver tarefa em andamento, atualiza a cada 4 s
  useEffect(() => {
    if (!tarefas.some((t) => ["planejando", "executando"].includes(t.status))) return;
    const i = setInterval(carregar, 4000); return () => clearInterval(i);
  }, [tarefas, carregar]);

  const yt = conexoes?.conexoes.find((c) => c.provedor === "youtube");
  return (
    <div className="flex flex-col gap-4 text-sm">
      {aviso && <div className="rounded-xl bg-[#E8F3FF] px-3 py-2 text-xs text-[#1D4E89]">{aviso} <button onClick={() => setAviso(null)} className="ml-2 underline">ok</button></div>}
      {erro && <div className="rounded-xl bg-[#FDE8E8] px-3 py-2 text-xs text-[#8A2A2A]">{erro}</div>}

      {/* conexões */}
      <section className="rounded-2xl border border-black/10 p-3">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5B6472]">Contas conectadas</div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FF0000] text-xs font-black text-white">▶</span>
            <div><div className="font-semibold">YouTube</div><div className="text-[11px] text-[#5B6472]">{yt ? `canal: ${yt.contaNome || yt.contaId}` : conexoes && !conexoes.configurado.youtube ? "falta GOOGLE_CLIENT_ID / SECRET no CapRover" : "não conectado"}</div></div></div>
          {yt
            ? <button onClick={async () => { if (!confirm("Desconectar o YouTube?")) return; await api("/api/conexoes/youtube", "DELETE"); carregar(); }} className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-semibold">Desconectar</button>
            : <a href="/api/conexoes/youtube" className={`rounded-full px-3 py-1.5 text-xs font-bold text-white ${conexoes?.configurado.youtube ? "bg-[#4F7DF3]" : "pointer-events-none bg-black/20"}`}>Conectar YouTube</a>}
        </div>
        <div className="mt-2 text-[11px] text-[#5B6472]">Instagram e TikTok: em breve (Instagram precisa de conta Business + app Meta; TikTok publica só como privado até o app ser auditado).</div>
      </section>

      <NovaPublicacao agenteId={agenteId} nomeAgente={nomeAgente} aoCriar={carregar} ytConectado={!!yt} />

      {/* histórico */}
      <section>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[#5B6472]">Tarefas ({tarefas.length})</div>
        {tarefas.length === 0 && <div className="text-xs text-[#5B6472]">Nenhuma tarefa ainda. Envie o primeiro vídeo acima.</div>}
        <div className="flex flex-col gap-2">{tarefas.map((t) => <CartaoTarefa key={t.id} t={t} nomeAgente={nomeAgente} recarregar={carregar} />)}</div>
      </section>
    </div>
  );
}

function NovaPublicacao({ agenteId, nomeAgente, aoCriar, ytConectado }: { agenteId: string; nomeAgente: string; aoCriar: () => Promise<void>; ytConectado: boolean }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [legenda, setLegenda] = useState("");
  const [titulo, setTitulo] = useState("");
  const [plataformas, setPlataformas] = useState<string[]>(["youtube"]);
  const [privacidade, setPrivacidade] = useState<"public" | "unlisted" | "private">("public");
  const [fase, setFase] = useState<"idle" | "enviando" | "planejando">("idle");
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async () => {
    if (!arquivo || !legenda.trim()) return;
    setErro(null); setFase("enviando"); setProgresso(0);
    try {
      // upload com progresso (XMLHttpRequest)
      const arq = await new Promise<{ id: string }>((res, rej) => {
        const fd = new FormData(); fd.append("arquivo", arquivo);
        const x = new XMLHttpRequest(); x.open("POST", "/api/arquivos");
        x.upload.onprogress = (e) => { if (e.lengthComputable) setProgresso(Math.round((e.loaded / e.total) * 100)); };
        x.onload = () => { try { const j = JSON.parse(x.responseText); x.status < 300 ? res(j) : rej(new Error(j.erro ?? `Erro ${x.status}`)); } catch { rej(new Error(`Erro ${x.status}`)); } };
        x.onerror = () => rej(new Error("Falha de rede no upload")); x.send(fd);
      });
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
          {PLATAFORMAS.map((p) => { const on = plataformas.includes(p.id); return (
            <button key={p.id} disabled={!p.pronto} onClick={() => setPlataformas(on ? plataformas.filter((x) => x !== p.id) : [...plataformas, p.id])} title={p.pronto ? "" : "em breve"}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? "border-transparent bg-[#4F7DF3] text-white" : "border-black/10 text-[#5B6472]"} disabled:opacity-40`}>{p.nome}{!p.pronto && " · em breve"}</button>); })}
          <select value={privacidade} onChange={(e) => setPrivacidade(e.target.value as typeof privacidade)} className="ml-auto rounded-full border border-black/10 px-2 py-1 text-xs">
            <option value="public">Público</option><option value="unlisted">Não listado</option><option value="private">Privado</option>
          </select>
        </div>
        {erro && <div className="rounded-xl bg-[#FDE8E8] px-3 py-2 text-xs text-[#8A2A2A]">{erro}</div>}
        {fase === "enviando" && <div className="h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full bg-[#4F7DF3] transition-all" style={{ width: `${progresso}%` }} /></div>}
        <button onClick={enviar} disabled={fase !== "idle" || !arquivo || !legenda.trim() || !plataformas.length} className="rounded-xl bg-[#4F7DF3] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          {fase === "enviando" ? `Enviando vídeo… ${progresso}%` : fase === "planejando" ? `${nomeAgente} está preparando o post…` : `Entregar pro ${nomeAgente}`}
        </button>
        {!ytConectado && plataformas.includes("youtube") && <div className="text-[11px] text-[#7A5A00]">Conecte o YouTube acima antes de aprovar a publicação (dá pra enviar o vídeo agora e conectar depois).</div>}
        <div className="text-[11px] text-[#5B6472]">O {nomeAgente} lê a legenda, propõe título/descrição/tags e espera o seu ok antes de publicar.</div>
      </div>
    </section>
  );
}

function CartaoTarefa({ t, nomeAgente, recarregar }: { t: Tarefa; nomeAgente: string; recarregar: () => Promise<void> }) {
  const st = STATUS[t.status] ?? { nome: t.status, cor: "#9AA3AD" };
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(t.plano?.titulo ?? t.titulo);
  const [descricao, setDescricao] = useState(t.plano?.descricao ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const aprovar = async () => {
    setOcupado(true); setErro(null);
    try { await api(`/api/tarefas/${t.id}/executar`, "POST", editando ? { titulo, descricao } : {}); await recarregar(); } catch (e) { setErro((e as Error).message); await recarregar(); } finally { setOcupado(false); }
  };
  const yt = t.resultado?.youtube as { url?: string; canal?: string } | undefined;
  return (
    <div className="rounded-2xl border border-black/10 p-3">
      <div className="flex items-start justify-between gap-2">
        <div><div className="font-semibold">{t.plano?.titulo ?? t.titulo}</div><div className="text-[11px] text-[#5B6472]">{t.dados.arquivoNome} · {(t.dados.plataformas ?? []).join(", ")} · {new Date(t.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div></div>
        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: st.cor }}>{st.nome}</span>
      </div>
      {t.status === "aguardando_aprovacao" && t.plano && (
        <div className="mt-2 rounded-xl bg-[#FFF8E6] p-3 text-xs">
          <div className="mb-1 font-semibold text-[#7A5A00]">{nomeAgente}: “{t.plano.resumo}”</div>
          {editando ? (
            <div className="flex flex-col gap-1.5">
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inp} />
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={5} className={inp} />
            </div>
          ) : (
            <>
              <div><b>Título:</b> {t.plano.titulo}</div>
              <div className="mt-1 whitespace-pre-wrap"><b>Descrição:</b> {t.plano.descricao}</div>
              {t.plano.tags?.length ? <div className="mt-1 text-[#5B6472]">tags: {t.plano.tags.join(", ")}</div> : null}
            </>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button onClick={aprovar} disabled={ocupado} className="rounded-full bg-[#22A86B] px-3 py-1.5 font-bold text-white disabled:opacity-50">{ocupado ? "Publicando…" : "Aprovar e publicar"}</button>
            <button onClick={() => setEditando(!editando)} className="rounded-full bg-black/5 px-3 py-1.5 font-semibold">{editando ? "Ver como o CEO propôs" : "Ajustar texto"}</button>
            <button onClick={async () => { await api(`/api/tarefas/${t.id}`, "DELETE"); recarregar(); }} className="rounded-full px-3 py-1.5 text-[#8A2A2A]">Cancelar</button>
          </div>
        </div>
      )}
      {t.status === "concluida" && yt?.url && <div className="mt-2 text-xs">✅ No YouTube{yt.canal ? ` (${yt.canal})` : ""}: <a href={yt.url} target="_blank" rel="noreferrer" className="font-semibold text-[#4F7DF3] underline">{yt.url}</a></div>}
      {Array.isArray(t.resultado?.pendentes) && (t.resultado!.pendentes as string[]).length > 0 && <div className="mt-1 text-[11px] text-[#7A5A00]">Pendente: {(t.resultado!.pendentes as string[]).join("; ")}</div>}
      {(t.status === "falhou" || erro) && (
        <div className="mt-2 rounded-xl bg-[#FDE8E8] p-2 text-xs text-[#8A2A2A]">{erro ?? t.erro}
          {t.status === "falhou" && t.plano && <button onClick={aprovar} disabled={ocupado} className="ml-2 rounded-full bg-white px-2 py-0.5 font-semibold">Tentar de novo</button>}
        </div>
      )}
    </div>
  );
}
