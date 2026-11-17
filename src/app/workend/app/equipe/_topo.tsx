"use client";
// Topo da página Minha equipe (17/11/2026, pedido do dono: "essa área precisa ser totalmente atualizada e melhorada"):
//  - a "sala de comando": nome da empresa, os números da equipe e a caixa de NOVA TAREFA logo de cara (escolher para quem
//    pedir tocando no rosto, escrever, enviar; a resposta e a equipe trabalhando aparecem na conversa logo abaixo);
//  - o ORGANOGRAMA VIVO: o CEO em cima e quem responde a ele; a linha pulsa quando aquele departamento está trabalhando
//    num pedido interno; tocar em alguém abre a conversa;
//  - a faixa "Agora na empresa" (as últimas conversas internas), a IA do mês num anel e os visitantes;
//  - "Como funciona", que abre por cima da página.
import { useEffect, useMemo, useRef, useState } from "react";
import { Icone } from "@/office/ui/Icone";
import { apiEquipe, brl, quando, sugestoesTarefa, type MembroEquipe, type PainelEquipe, type RespostaEnvio, type TrocaInterna } from "@/office/ui/equipeComum";
import { Rosto } from "./_rosto";

type Membro = MembroEquipe;
const ehChefe = (m: Membro) => m.nivel === "ceo" || m.nivel === "diretor" || m.nivel === "gerente";
const raizDe = (p: PainelEquipe) => p.equipe.find((m) => m.nivel === "ceo") ?? p.equipe[0];
// chefes de exemplo: gerentes com equipe primeiro (o assistente que cuida da recepção não é um bom exemplo)
const chefesDe = (p: PainelEquipe, raiz: Membro | undefined) => {
  const com = p.equipe.filter((m) => m.temEquipe && m !== raiz);
  return [...com.filter((m) => m.nivel === "gerente"), ...com.filter((m) => m.nivel !== "gerente")];
};

// ---------- topo ----------
export function TopoEquipe({ p, internas, abrir, enviado, comoFunciona, empresas = [] }: {
  p: PainelEquipe; internas: TrocaInterna[] | null; abrir: (id: string) => void; enviado: (id: string) => void; comoFunciona: () => void;
  empresas?: { chave: string; nome: string; socio: boolean }[];
}) {
  const [semLogo, setSemLogo] = useState(false);
  const deps = new Set(p.equipe.map((m) => m.setorId).filter((s) => s && s !== "recepcao")).size;
  const chefes = p.equipe.filter((m) => m.nivel === "gerente" || m.nivel === "diretor").length;
  const abertos = (internas ?? []).filter((t) => t.status === "pedido").length;
  return (
    <section className="eq-topo" style={{ "--marca": p.lote.cor } as React.CSSProperties} aria-label={`Equipe da ${p.lote.empresaNome}`}>
      <div className="eq-topo-texto">
        <div className="eq-marca">
          {semLogo
            ? <span className="eq-logo eq-logo-letra" aria-hidden>{p.lote.empresaNome.slice(0, 1).toUpperCase()}</span>
            : <img className="eq-logo" src={`/api/terrenos/${encodeURIComponent(p.lote.chave)}/logo`} alt="" onError={() => setSemLogo(true)} />}
          <div className="eq-selos">
            <span className="eq-selo"><Icone nome="etiqueta" tamanho={13} />{p.lote.nicho}</span>
            {p.lote.numero && <span className="eq-selo">Lote {p.lote.numero}</span>}
            <span className={`eq-selo eq-vivo ${abertos ? "eq-vivo-ocupado" : ""}`}><i />{abertos ? `trabalhando em ${abertos} ${abertos === 1 ? "pedido" : "pedidos"}` : "equipe disponível"}</span>
          </div>
          <button type="button" onClick={comoFunciona} className="eq-ajuda"><Icone nome="ajuda" tamanho={15} />Como funciona</button>
        </div>
        {/* mais de uma empresa (própria e como sócio, 17/11/2026): troca entre as equipes */}
        {empresas.length > 1 && (
          <nav className="eq-empresas" aria-label="Suas empresas">
            {empresas.map((e) => (
              <a key={e.chave} href={`/app/equipe?lote=${encodeURIComponent(e.chave)}`} aria-current={e.chave === p.lote.chave ? "page" : undefined} className="eq-empresa">
                {e.nome}{e.socio && <small>sócio</small>}
              </a>
            ))}
          </nav>
        )}
        <h1><small>Equipe da</small>{p.lote.empresaNome}</h1>
        <div className="eq-numeros">
          <span className="eq-numero"><b>{p.equipe.length}</b>agentes de IA</span>
          {deps > 1 && <span className="eq-numero"><b>{deps}</b>departamentos</span>}
          {chefes > 0 && <span className="eq-numero"><b>{chefes}</b>{chefes === 1 ? "chefe de área" : "chefes de área"}</span>}
        </div>
        <NovaTarefa p={p} enviado={enviado} />
      </div>
      <Organograma p={p} internas={internas} abrir={abrir} />
    </section>
  );
}

// ---------- caixa de nova tarefa ----------
function NovaTarefa({ p, enviado }: { p: PainelEquipe; enviado: (id: string) => void }) {
  // quem aparece como atalho: o CEO e quem comanda uma área (nas lojas sem chefes, todo mundo)
  const atalhos = useMemo(() => {
    const raiz = raizDe(p);
    const chefes = p.equipe.filter((m) => m !== raiz && (m.temEquipe || m.nivel === "diretor"));
    const lista = chefes.length ? chefes : p.equipe.filter((m) => m !== raiz && m.papel !== "atendente");
    return [raiz, ...lista].filter(Boolean).slice(0, 14);
  }, [p]);
  const [para, setPara] = useState<string | null>(null);
  const membro = p.equipe.find((m) => m.membroId === para) ?? atalhos[0];
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const bloqueado = p.gasto.esgotado || !p.ia;
  const outros = useMemo(() => p.equipe.filter((m) => !atalhos.includes(m)), [p.equipe, atalhos]);
  if (!membro) return null;
  const enviar = async () => {
    const pedido = texto.trim(); if (!pedido || enviando || bloqueado) return;
    setEnviando(true); setErro(null);
    try {
      await apiEquipe<RespostaEnvio>(`/api/workend/equipe/chat`, { method: "POST", body: JSON.stringify({ lote: p.lote.chave, membro: membro.membroId, texto: pedido }) });
      setTexto(""); enviado(membro.membroId);
    } catch (e) { setErro((e as Error).message); }
    setEnviando(false);
  };
  const comEquipe = p.equipe.filter((m) => m.chefeId === membro.membroId).length;
  return (
    <form className="eq-tarefa" onSubmit={(e) => { e.preventDefault(); void enviar(); }} aria-label="Nova tarefa">
      <div className="eq-tarefa-rotulo"><span>Nova tarefa para</span>{membro && <span className="font-normal text-white/50">{membro.cargo}</span>}</div>
      <div className="eq-para" role="group" aria-label="Para quem pedir">
        {atalhos.map((m) => (
          <button key={m.membroId} type="button" aria-pressed={m === membro} onClick={() => setPara(m.membroId)} className="eq-para-item">
            <Rosto m={m} tamanho={30} anel={null} selo={false} />
            <span className="text-left leading-tight"><span className="block font-semibold">{m.nome}</span><small>{m.nivel === "ceo" ? "CEO" : m.setor}</small></span>
          </button>
        ))}
        {outros.length > 0 && (
          <select className="eq-para-outro" aria-label="Outra pessoa da equipe" value={outros.includes(membro) ? membro.membroId : ""} onChange={(e) => e.target.value && setPara(e.target.value)}>
            <option value="">Outra pessoa…</option>
            {[...new Set(outros.map((m) => m.setor))].map((s) => (
              <optgroup key={s} label={s}>{outros.filter((m) => m.setor === s).map((m) => <option key={m.membroId} value={m.membroId}>{m.nome} · {m.cargo}</option>)}</optgroup>
            ))}
          </select>
        )}
      </div>
      <textarea id="eq-tarefa-texto" value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 4000))} disabled={bloqueado}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void enviar(); } }}
        placeholder={p.gasto.esgotado ? `Os ${brl(p.gasto.teto)} de IA deste mês acabaram. A equipe volta no dia 1º.` : !p.ia ? "A IA está desligada no servidor agora." : `Escreva como falaria com ${membro.nome}: o que precisa, para quando e os detalhes que importam.`} />
      {!texto && !bloqueado && (
        <div className="eq-sugestoes">{sugestoesTarefa(membro, p.lote.empresaNome).slice(0, 3).map((s) => <button key={s} type="button" className="eq-sugestao" onClick={() => setTexto(s)}>{s}</button>)}</div>
      )}
      {erro && <p className="eq-erro">{erro}</p>}
      <div className="eq-tarefa-pe">
        <p>{comEquipe ? `${membro.nome} divide o trabalho com ${comEquipe} ${comEquipe === 1 ? "pessoa" : "pessoas"} e entrega tudo junto na conversa.` : `${membro.nome} responde com o material pronto na conversa.`}</p>
        <button type="submit" className="eq-enviar" disabled={!texto.trim() || enviando || bloqueado}>
          {enviando ? `${membro.nome} está lendo…` : <>Enviar tarefa<Icone nome="seta" tamanho={17} /></>}
        </button>
      </div>
    </form>
  );
}

// ---------- organograma vivo ----------
function Organograma({ p, internas, abrir }: { p: PainelEquipe; internas: TrocaInterna[] | null; abrir: (id: string) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 520, h: 380 });
  useEffect(() => {
    const el = caixa.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setTam({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const raiz = raizDe(p);
  const filhos = useMemo(() => p.equipe.filter((m) => m !== raiz && (m.chefeId === raiz?.membroId || (!m.chefeId && m.papel !== "atendente"))).slice(0, 12), [p.equipe, raiz]);
  // departamento com pedido interno aberto: a linha até o chefe dele pulsa
  const vivos = useMemo(() => {
    const s = new Set<string>();
    for (const t of internas ?? []) if (t.status === "pedido") {
      const para = p.equipe.find((m) => m.membroId === t.para), de = p.equipe.find((m) => m.membroId === t.de);
      for (const f of filhos) if (f.membroId === t.para || f.membroId === t.de || (para && para.setorId === f.setorId && f.setorId !== raiz?.setorId) || (de && de.setorId === f.setorId && f.setorId !== raiz?.setorId)) s.add(f.membroId);
    }
    return s;
  }, [internas, p.equipe, filhos, raiz]);
  if (!raiz) return null;
  const { w, h } = tam, estreito = w < 460;
  const tamRaiz = estreito ? 52 : 64, tamFilho = estreito ? 34 : 44;
  const raizXY = { x: w / 2, y: 80 };
  // fileiras: até 6 por fileira no computador, 4 no celular; as fileiras se espalham entre 44% e 84% da altura
  const porFileira = estreito ? 4 : 6;
  const fileiras = Math.max(1, Math.ceil(filhos.length / porFileira));
  const naFileira = Math.ceil(filhos.length / fileiras);
  const pos = filhos.map((_, i) => {
    const f = Math.floor(i / naFileira), j = i % naFileira, k = Math.min(naFileira, filhos.length - f * naFileira);
    const margem = estreito ? 22 : 40, passo = (w - 2 * margem) / Math.max(1, k);
    const y = fileiras === 1 ? h * 0.6 : h * (0.44 + (0.4 * f) / (fileiras - 1));
    return { x: margem + passo * (j + 0.5), y };
  });
  const largura = Math.max(56, Math.min(110, (w - 40) / Math.max(1, naFileira) - 6));
  const altura = estreito ? 170 + fileiras * 100 : undefined;
  return (
    <div ref={caixa} className="eq-org" style={altura ? { minHeight: altura } : undefined} aria-label="Organograma da equipe">
      <span className="eq-org-titulo"><Icone nome="equipe" tamanho={14} />Quem responde a quem</span>
      <svg className="eq-org-linhas" viewBox={`0 0 ${w} ${h}`} aria-hidden>
        {pos.map((q, i) => {
          const y0 = raizXY.y + tamRaiz * 0.75, y1 = q.y - tamFilho * 0.35, meio = (y0 + y1) / 2;
          const viva = vivos.has(filhos[i].membroId);
          return <path key={filhos[i].membroId} d={`M ${raizXY.x} ${y0} C ${raizXY.x} ${meio}, ${q.x} ${meio}, ${q.x} ${y1}`} className={`eq-linha ${viva ? "eq-linha-viva" : ""}`} style={{ stroke: viva ? undefined : `color-mix(in srgb, ${filhos[i].setorCor} 45%, rgba(255,255,255,.12))` }} />;
        })}
      </svg>
      <button type="button" className="eq-no eq-no-raiz" style={{ left: raizXY.x, top: raizXY.y - tamRaiz * 0.2, width: 140 }} onClick={() => abrir(raiz.membroId)} aria-label={`Conversar com ${raiz.nome}, ${raiz.cargo}`}>
        <Rosto m={raiz} tamanho={tamRaiz} anel="#E9C46A" />
        <span className="eq-no-nome">{raiz.nome}</span>
        <span className="eq-no-setor">{raiz.nivel === "ceo" ? "CEO" : raiz.cargo}</span>
      </button>
      {filhos.map((f, i) => {
        const equipe = p.equipe.filter((m) => m.chefeId === f.membroId).length;
        return (
          <button key={f.membroId} type="button" className={`eq-no ${vivos.has(f.membroId) ? "eq-no-vivo" : ""}`} style={{ left: pos[i].x, top: pos[i].y - tamFilho * 0.2, width: largura, animationDelay: `${0.25 + i * 0.05}s` }}
            onClick={() => abrir(f.membroId)} aria-label={`Conversar com ${f.nome}, ${f.cargo}${equipe ? `, comanda ${equipe}` : ""}`} title={`${f.nome} · ${f.cargo}`}>
            <span className="relative"><Rosto m={f} tamanho={tamFilho} anel={f.setorCor} selo={false} /></span>
            {equipe > 0 && !estreito && <span className="eq-no-equipe">+{equipe}</span>}
            <span className="eq-no-nome">{f.nome}</span>
            {!estreito && <span className="eq-no-setor">{ehChefe(f) && f.setorId !== raiz.setorId ? f.setor : f.cargo}</span>}
          </button>
        );
      })}
      {!estreito && <span className="eq-org-legenda">{vivos.size ? "As linhas acesas são departamentos trabalhando agora." : "Toque em alguém para conversar ou dar uma tarefa."}</span>}
    </div>
  );
}

// ---------- faixa: agora na empresa, IA do mês, visitantes ----------
const ESTADO: Record<TrocaInterna["status"], { t: string; cor: string; fundo: string }> = {
  pedido: { t: "trabalhando", cor: "#8A6A12", fundo: "#FFF3CC" },
  respondido: { t: "respondeu", cor: "#166534", fundo: "#E3F6EA" },
  erro: { t: "não respondeu", cor: "#9B1C1C", fundo: "#FDECEC" },
};
export function FaixaEquipe({ p, internas, abrir, irPara }: { p: PainelEquipe; internas: TrocaInterna[] | null; abrir: (id: string) => void; irPara: (aba: "internas" | "visitantes") => void }) {
  const ultimas = useMemo(() => [...(internas ?? [])].sort((a, b) => (a.em < b.em ? 1 : -1)).slice(0, 4), [internas]);
  const pessoa = (id: string) => p.equipe.find((m) => m.membroId === id);
  const raiz = raizDe(p);
  const chefes = chefesDe(p, raiz).slice(0, 2);
  const pct = Math.min(100, (p.gasto.mes / Math.max(0.01, p.gasto.teto)) * 100);
  const R = 30, C = 2 * Math.PI * R;
  const corIA = p.gasto.esgotado ? "#E2575B" : p.gasto.aviso ? "#E8A317" : "var(--blue)";
  return (
    <section className="eq-faixa">
      <div className="eq-agora">
        <div className="eq-cab"><b><i />Agora na empresa</b>{(internas?.length ?? 0) > 0 && <button type="button" className="eq-link" onClick={() => irPara("internas")}>Ver todas as conversas internas</button>}</div>
        {internas === null && <p className="mt-2 text-sm text-[var(--muted)]">Carregando…</p>}
        {internas && ultimas.length === 0 && (
          <div className="eq-vazio-cena">
            <span className="eq-vazio-rostos">{[raiz, ...chefes].filter(Boolean).map((m) => <Rosto key={m.membroId} m={m} tamanho={40} />)}</span>
            <span className="text-[14px] text-[var(--muted)]">
              <b className="block text-[var(--ink)]">A equipe está esperando a primeira tarefa.</b>
              Quando você pedir algo a quem comanda uma área, você vê aqui quem pediu o quê a quem, ao vivo.
              <button type="button" className="eq-link ml-1" onClick={() => document.getElementById("eq-tarefa-texto")?.focus()}>Escrever a tarefa</button>
            </span>
          </div>
        )}
        {ultimas.map((t) => {
          const de = pessoa(t.de), para = pessoa(t.para), st = ESTADO[t.status] ?? ESTADO.pedido;
          return (
            <div key={t.id} className="eq-troca">
              <span className="eq-par">{de && <Rosto m={de} tamanho={30} anel={null} selo={false} />}{para && <Rosto m={para} tamanho={30} selo={false} />}</span>
              <span className="min-w-0 flex-1 text-[13.5px] leading-snug">
                <span className="block truncate"><button type="button" onClick={() => abrir(t.de)} className="font-semibold hover:underline">{t.deNome}</button> pediu a <button type="button" onClick={() => abrir(t.para)} className="font-semibold hover:underline">{t.paraNome}</button></span>
                <span className="block truncate text-[var(--muted)]">{t.pedido}</span>
              </span>
              <span className="eq-estado" style={{ color: st.cor, background: st.fundo }}>{st.t}</span>
              <span className="hidden w-14 text-right text-[11.5px] text-[var(--muted)] sm:block">{quando(t.em)}</span>
            </div>
          );
        })}
      </div>
      <div className="eq-ia">
        <svg className="eq-anel" width="78" height="78" viewBox="0 0 78 78" aria-hidden>
          <circle className="eq-anel-fundo" cx="39" cy="39" r={R} />
          <circle className="eq-anel-valor" cx="39" cy="39" r={R} stroke={corIA} strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(pct, 1.5) / 100)} style={{ "--c": C } as React.CSSProperties} />
        </svg>
        <div className="min-w-0">
          <span className="text-[13px] font-semibold text-[var(--muted)]">IA usada no mês</span>
          <div className="eq-ia-num">{brl(p.gasto.mes)} <span className="text-[14px] font-semibold text-[var(--muted)]">de {brl(p.gasto.teto)}</span></div>
          <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--muted)]">{p.gasto.esgotado ? "Acabou: a equipe volta no dia 1º." : p.gasto.aviso ? "Perto do limite: prefira pedidos completos." : "Incluído no aluguel. Uma tarefa dividida com a equipe custa poucos centavos."}</p>
        </div>
      </div>
      <button type="button" className="eq-visitas" onClick={() => irPara("visitantes")}>
        <span className="text-[13px] font-semibold text-white/75">Visitantes da loja</span>
        <b className="mt-1">{p.visitantes.total}</b>
        <span className="mt-1 block text-[12.5px] text-white/70">{p.visitantes.ultimas24h ? `${p.visitantes.ultimas24h} nas últimas 24 horas` : p.visitantes.total ? "conversaram com a atendente" : "ninguém conversou ainda"}</span>
        <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold">Ver conversas<Icone nome="seta" tamanho={14} /></span>
      </button>
    </section>
  );
}

// ---------- como funciona ----------
export function ComoFunciona({ p, fechar, abrir }: { p: PainelEquipe; fechar: () => void; abrir: (id: string) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    addEventListener("keydown", tecla); caixa.current?.focus();
    return () => removeEventListener("keydown", tecla);
  }, [fechar]);
  const raiz = raizDe(p);
  const chefe = chefesDe(p, raiz)[0];
  const equipe = chefe ? p.equipe.filter((m) => m.chefeId === chefe.membroId).slice(0, 3) : [];
  return (
    <div className="eq-modal-fundo" onClick={fechar}>
      <div ref={caixa} tabIndex={-1} className="eq-modal outline-none" role="dialog" aria-modal="true" aria-labelledby="eq-como-titulo" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={fechar} aria-label="Fechar" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-dim)]"><Icone nome="fechar" tamanho={18} /></button>
        <h2 id="eq-como-titulo" className="pr-10" style={{ fontSize: "1.65rem", lineHeight: 1.15 }}>Como a sua equipe trabalha</h2>
        <p className="mt-1 text-[15px] text-[var(--muted)]">Cada pessoa é um agente de IA com cargo, chefe e equipe, como numa empresa de verdade.</p>
        {raiz && (
          <div className="eq-arvore mt-4" aria-hidden>
            <Rosto m={raiz} tamanho={48} anel="#E9C46A" />
            {chefe && <><span className="eq-arvore-seta" /><Rosto m={chefe} tamanho={40} /></>}
            {equipe.length > 0 && <><span className="eq-arvore-seta" /><span className="eq-arvore-linha">{equipe.map((m) => <Rosto key={m.membroId} m={m} tamanho={32} selo={false} />)}</span></>}
          </div>
        )}
        <div className="mt-3">
          <div className="eq-passo"><span className="eq-passo-num">1</span><div><b>Escolha para quem pedir</b><p className="text-[14.5px] text-[var(--muted)]">Pedidos grandes vão para {raiz ? `${raiz.nome} (CEO)` : "o CEO"}. Algo de uma área só vai direto para quem comanda a área{chefe ? `, como ${chefe.nome} em ${chefe.setor}` : ""}.</p></div></div>
          <div className="eq-passo"><span className="eq-passo-num">2</span><div><b>Escreva como falaria com um funcionário</b><p className="text-[14.5px] text-[var(--muted)]">Diga o que precisa, para quando e os detalhes que importam. Exemplo: “Monte o plano da semana com o que cada departamento vai fazer”.</p></div></div>
          <div className="eq-passo"><span className="eq-passo-num">3</span><div><b>Acompanhe a equipe trabalhando</b><p className="text-[14.5px] text-[var(--muted)]">Quem comanda divide o trabalho: você vê cada pedido interno{chefe && equipe[0] ? ` (“${chefe.nome} pediu a ${equipe[0].nome}…”)` : ""} e a resposta de cada um, aqui e no mapa. A entrega final chega na mesma conversa, em 1 a 3 minutos.</p></div></div>
          <div className="eq-passo"><span className="eq-passo-num">4</span><div><b>Ensine quando precisar</b><p className="text-[14.5px] text-[var(--muted)]">Aprove o que ficou bom e corrija o que não ficou: a correção vira regra daquela pessoa para sempre.</p></div></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {raiz && <button type="button" className="btn btn-azul" onClick={() => { fechar(); abrir(raiz.membroId); }}>Conversar com {raiz.nome}</button>}
          <button type="button" className="btn btn-linha" onClick={fechar}>Entendi</button>
        </div>
      </div>
    </div>
  );
}
