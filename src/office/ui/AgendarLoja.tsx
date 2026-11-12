"use client";
// Agendar horário na loja (12/11/2026): serviço → dia → horário livre → nome e contato → confirmar. Usado no cartão da
// loja no mapa (compacto, começa fechado num botão) e na página /loja/N (aberto). Some quando a loja não usa agenda.
// Quem já marcou vê "Seus horários nesta loja" e pode cancelar. A atendente de IA também marca pela conversa.
import { useEffect, useState } from "react";

type Servico = { id: string; nome: string; duracao: number; duracaoTexto: string; preco: string };
type Meu = { id: string; servico: string; quando: string; status: string };
type Dia = { dia: string; rotulo: string; horarios: string[] };
type Info = { ligada: false } | { ligada: true; numero: number; empresa: string; servicos: Servico[]; antecedenciaMin: number; eu: { nome: string; ehDono: boolean } | null; meus: Meu[]; servico: string | null; dias?: Dia[] };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro || "Não deu certo agora. Tente de novo.");
  return j as T;
}
// texto legível sobre a cor da empresa
function textoSobre(cor: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(cor); if (!m) return "#fff";
  const n = parseInt(m[1], 16), l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.62 ? "#1D2128" : "#fff";
}

export function AgendarLoja({ numero, cor, compacto }: { numero: number; cor: string; compacto?: boolean }) {
  const corOk = /^#[0-9a-f]{6}$/i.test(cor) ? cor : "#1D4ED8", tinta = textoSobre(corOk);
  const [versao, setVersao] = useState(0);
  // estados guardados com a chave de quem pediu: trocar de loja/serviço mostra "carregando" sem limpar nada no efeito
  const [info, setInfo] = useState<{ k: string; v: Info | null } | null>(null);
  const [slots, setSlots] = useState<{ k: string; dias: Dia[] | null; erro: string | null } | null>(null);
  const [aberto, setAberto] = useState(!compacto);
  const [servico, setServico] = useState<string | null>(null);
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [hora, setHora] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const [contato, setContato] = useState("");
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  const kInfo = `${numero}:${versao}`;
  useEffect(() => {
    let vivo = true; const k = `${numero}:${versao}`;
    api<Info>(`/api/workend/agenda/loja/${numero}`).then((v) => vivo && setInfo({ k, v })).catch(() => vivo && setInfo({ k, v: null }));
    return () => { vivo = false; };
  }, [numero, versao]);
  const kSlots = servico ? `${numero}:${servico}:${versao}` : null;
  useEffect(() => {
    if (!servico) return;
    let vivo = true; const k = `${numero}:${servico}:${versao}`;
    api<Info>(`/api/workend/agenda/loja/${numero}?servico=${encodeURIComponent(servico)}`)
      .then((v) => vivo && setSlots({ k, dias: v.ligada ? v.dias ?? [] : [], erro: null }))
      .catch((e) => vivo && setSlots({ k, dias: null, erro: (e as Error).message }));
    return () => { vivo = false; };
  }, [numero, servico, versao]);

  const dados = info?.k === kInfo ? info.v : info?.v ?? null; // enquanto recarrega, mostra o que já tinha
  if (!dados || !dados.ligada) return null;
  const sl = slots && slots.k === kSlots ? slots : null;
  const dias = sl?.dias ?? null;
  const dia = dias?.find((d) => d.dia === diaSel) ?? dias?.[0] ?? null;
  const s = dados.servicos.find((x) => x.id === servico) ?? null;
  const logado = !!dados.eu, ehDono = !!dados.eu?.ehDono;
  const nomeCampo = nome ?? dados.eu?.nome ?? "";
  const linkEntrar = `/entrar?destino=${encodeURIComponent(`/loja/${numero}#agenda`)}`;
  const tam = compacto ? "text-xs" : "text-sm";

  const escolherServico = (id: string) => { setServico(id); setDiaSel(null); setHora(null); setErro(null); setFeito(null); };
  const confirmar = async () => {
    if (!s || !dia || !hora) return;
    setEnviando(true); setErro(null);
    try {
      const r = await api<{ servico: string; quando: string }>(`/api/workend/agenda/loja/${numero}`, { method: "POST", body: JSON.stringify({ servicoId: s.id, inicio: `${dia.dia}T${hora}`, nome: nomeCampo, contato, obs }) });
      setFeito(`Horário marcado: ${r.servico}, ${r.quando}.`); setServico(null); setHora(null); setObs(""); setVersao((x) => x + 1);
    } catch (e) { setErro((e as Error).message); setVersao((x) => x + 1); }
    setEnviando(false);
  };
  const cancelar = async (m: Meu) => {
    if (!window.confirm(`Cancelar ${m.servico} (${m.quando})?`)) return;
    setErro(null);
    try { await api(`/api/workend/agenda/${encodeURIComponent(m.id)}`, { method: "POST", body: JSON.stringify({ acao: "cancelar" }) }); setFeito("Horário cancelado. A loja foi avisada."); setVersao((x) => x + 1); }
    catch (e) { setErro((e as Error).message); }
  };

  if (compacto && !aberto) {
    return (
      <button onClick={() => setAberto(true)} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold hover:opacity-90" style={{ background: corOk, color: tinta }}>
        <span>📅 Agendar horário</span>
        <span className="text-[11px] font-semibold opacity-85">{dados.meus.length ? `${dados.meus.length} marcado${dados.meus.length > 1 ? "s" : ""}` : `${dados.servicos.length} ${dados.servicos.length === 1 ? "serviço" : "serviços"}`}</span>
      </button>
    );
  }

  return (
    <div id={compacto ? undefined : "agenda"} className={`scroll-mt-6 rounded-2xl border border-black/10 bg-white ${compacto ? "p-3" : "p-5"} text-[#1D2128]`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`${compacto ? "text-sm" : "text-[1.15rem]"} font-bold`}>📅 Agendar horário</div>
          <div className={`${compacto ? "text-[11px]" : "text-[13px]"} text-[#5B6472]`}>Escolha o serviço, o dia e o horário. A {dados.empresa} recebe na hora.</div>
        </div>
        {compacto && <button onClick={() => setAberto(false)} aria-label="Fechar a agenda" className="rounded-full px-2 text-[#5B6472] hover:bg-black/5">✕</button>}
      </div>

      {feito && <div className={`mt-2 rounded-xl bg-[#E8F7EE] px-3 py-2 ${tam} font-semibold text-[#14532D]`}>✅ {feito}{feito.startsWith("Horário marcado") && <span className="block font-normal">Você recebe um lembrete no sino 1 hora antes.</span>}</div>}
      {erro && <div className={`mt-2 rounded-xl bg-[#FDECEC] px-3 py-2 ${tam} text-[#8A1C1C]`}>{erro}</div>}

      {dados.meus.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#5B6472]">Seus horários nesta loja</div>
          <ul className="mt-1 space-y-1">
            {dados.meus.map((m) => (
              <li key={m.id} className={`flex items-center justify-between gap-2 rounded-xl bg-[#F1F3F6] px-3 py-1.5 ${tam}`}>
                <span className="min-w-0"><b className="block truncate">{m.servico}</b><span className="text-[#5B6472]">{m.quando}</span></span>
                <button onClick={() => void cancelar(m)} className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold text-[#B42318] hover:bg-[#FDECEC]">Cancelar</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ehDono ? (
        <p className={`mt-3 rounded-xl bg-[#EEF3FF] px-3 py-2 ${tam} text-[#1D4ED8]`}>Esta é a agenda da sua loja: os clientes marcam aqui. <a href="/app/agenda" className="font-bold underline">Ver os horários marcados</a></p>
      ) : (
        <>
          <div className="mt-3 text-[10px] font-bold uppercase tracking-wide text-[#5B6472]">1. Serviço</div>
          <div className={`mt-1 grid gap-1.5 ${compacto ? "" : "sm:grid-cols-2"}`}>
            {dados.servicos.map((x) => {
              const sel = x.id === servico;
              return (
                <button key={x.id} onClick={() => escolherServico(x.id)} aria-pressed={sel} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left ${tam} ${sel ? "border-transparent" : "border-black/10 hover:bg-[#F6F7F9]"}`} style={sel ? { background: corOk, color: tinta } : undefined}>
                  <span className="min-w-0 font-semibold"><span className="block truncate">{x.nome}</span></span>
                  <span className={`shrink-0 text-[11px] ${sel ? "opacity-90" : "text-[#5B6472]"}`}>{x.duracaoTexto}{x.preco ? ` · ${x.preco}` : ""}</span>
                </button>
              );
            })}
          </div>

          {s && (
            <>
              <div className="mt-3 text-[10px] font-bold uppercase tracking-wide text-[#5B6472]">2. Dia e horário</div>
              {!sl ? <p className={`mt-1 ${tam} text-[#5B6472]`}>Procurando horários livres…</p>
                : sl.erro ? <p className={`mt-1 ${tam} text-[#8A1C1C]`}>{sl.erro}</p>
                : !dias?.length ? <p className={`mt-1 ${tam} text-[#5B6472]`}>Sem horário livre para {s.nome} nos próximos dias. Fale com a atendente para ver outra opção.</p>
                : (
                  <>
                    <div className="sem-barra -mx-1 mt-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Dias com horário livre">
                      {dias.map((d) => {
                        const sel = d.dia === dia?.dia;
                        return <button key={d.dia} role="tab" aria-selected={sel} onClick={() => { setDiaSel(d.dia); setHora(null); }} className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold capitalize ${sel ? "border-transparent" : "border-black/10 hover:bg-[#F6F7F9]"}`} style={sel ? { background: corOk, color: tinta } : undefined}>{d.rotulo}</button>;
                      })}
                    </div>
                    {dia && (
                      <div className={`mt-1.5 grid gap-1.5 ${compacto ? "grid-cols-4" : "grid-cols-4 sm:grid-cols-6"}`}>
                        {dia.horarios.map((h) => {
                          const sel = h === hora;
                          return <button key={h} onClick={() => setHora(h)} aria-pressed={sel} className={`rounded-lg border py-1.5 text-[12px] font-semibold tabular-nums ${sel ? "border-transparent" : "border-black/10 hover:bg-[#F6F7F9]"}`} style={sel ? { background: corOk, color: tinta } : undefined}>{h}</button>;
                        })}
                      </div>
                    )}
                  </>
                )}
            </>
          )}

          {s && dia && hora && (
            !logado ? (
              <a href={linkEntrar} className={`mt-3 block rounded-xl bg-[#1D4ED8] px-3 py-2.5 text-center ${tam} font-bold text-white hover:bg-[#1e40af]`}>Entre na sua conta para marcar</a>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); void confirmar(); }} className="mt-3 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#5B6472]">3. Seus dados</div>
                <input value={nomeCampo} onChange={(e) => setNome(e.target.value.slice(0, 60))} placeholder="Seu nome" aria-label="Seu nome" required minLength={2} className="w-full rounded-lg border border-black/15 px-3 py-2 text-[16px] sm:text-sm" />
                <input value={contato} onChange={(e) => setContato(e.target.value.slice(0, 80))} placeholder="WhatsApp ou e-mail" aria-label="WhatsApp ou e-mail" required minLength={6} className="w-full rounded-lg border border-black/15 px-3 py-2 text-[16px] sm:text-sm" />
                <input value={obs} onChange={(e) => setObs(e.target.value.slice(0, 300))} placeholder="Observação (opcional)" aria-label="Observação" className="w-full rounded-lg border border-black/15 px-3 py-2 text-[16px] sm:text-sm" />
                <button type="submit" disabled={enviando} className={`w-full rounded-xl px-3 py-2.5 ${tam} font-bold disabled:opacity-50`} style={{ background: "#16A34A", color: "#fff" }}>{enviando ? "Marcando…" : `Confirmar · ${s.nome}, ${dia.rotulo} às ${hora}`}</button>
              </form>
            )
          )}
          {!logado && !(s && dia && hora) && <p className={`mt-2 ${compacto ? "text-[11px]" : "text-[13px]"} text-[#5B6472]`}>Para marcar é preciso <a href={linkEntrar} className="font-semibold text-[#1D4ED8] hover:underline">entrar na conta</a>.</p>}
        </>
      )}
    </div>
  );
}
