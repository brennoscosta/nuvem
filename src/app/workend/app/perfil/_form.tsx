"use client";
// Formulário do perfil (20/11/2026, frente "cadastro"). Duas formas com os mesmos campos:
//  - Etapas: logo depois de criar a conta (/app/perfil/comecar), uma pergunta curta por vez, barra de progresso, dá para
//    pular a etapa ou terminar depois (o painel lembra o que falta);
//  - EditorPerfil: tudo numa página, em Meu perfil (/app/perfil).
// Ao lado, a prévia de como o perfil público aparece. Regras e validação no servidor (src/server/perfis.ts).
import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import { NICHOS } from "@/office/data/mundo";
import { Icone } from "@/office/ui/Icone";
import { Logotipo } from "../../_marca";
import {
  ETAPAS, OBJETIVOS, TIPOS, ATENDIMENTOS, UFS, SUGESTOES_OFERECE, SUGESTOES_PROCURA, MAX_ETIQUETAS, MAX_ETIQUETA, MAX_TEXTO, MAX_NICHOS,
  ordemEtapas, normalizar, paraApelido, nomeTipo, nomeAtendimento, siteCurto,
  type EtapaId, type PerfilCadastro, type Mostrar, type Objetivo,
} from "@/office/data/cadastro";

export type Rascunho = PerfilCadastro & { fotoNova?: string | null; removerFoto?: boolean };
type Mudar = (x: Partial<Rascunho>) => void;
type Resumo = { faltam: { id: EtapaId; curto: string }[]; completo: boolean; apelido: string | null };

const LIMITE_FOTO = 200 * 1024;
const nomeNicho = (id: string) => NICHOS.find((n) => n.id === id)?.nome ?? id;

async function salvar(etapa: EtapaId | "tudo", p: Rascunho): Promise<{ perfil: PerfilCadastro; resumo: Resumo }> {
  const dados: Record<string, unknown> = {
    objetivo: p.objetivo, tipo: p.tipo, nome: p.nome, nichos: p.nichos, cidade: p.cidade, uf: p.uf, atendimento: p.atendimento,
    oferece: p.oferece, ofereceTexto: p.ofereceTexto, procura: p.procura, procuraTexto: p.procuraTexto,
    site: p.site, instagram: p.instagram, whatsapp: p.whatsapp, apelido: (p.apelido ?? "").replace(/-+$/, ""), publico: p.publico, mostrar: p.mostrar,
  };
  if (p.fotoNova) dados.foto = p.fotoNova;
  if (p.removerFoto) dados.removerFoto = true;
  const r = await fetch("/api/workend/perfil", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ etapa, dados }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { erro?: string }).erro || "Não deu para salvar agora. Tente de novo.");
  return j as { perfil: PerfilCadastro; resumo: Resumo };
}

// reduz a foto para no máximo 800 px e tenta WebP e depois JPEG até ficar abaixo de 200 KB (igual à vitrine)
async function reduzirFoto(arquivo: File): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error("Não consegui abrir essa imagem. Use JPG, PNG ou WebP.")); i.src = url; });
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d"); if (!ctx) throw new Error("Seu navegador não conseguiu preparar a foto.");
    for (const lado of [800, 640, 480]) {
      const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
      c.width = Math.max(1, Math.round(img.naturalWidth * escala)); c.height = Math.max(1, Math.round(img.naturalHeight * escala));
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      for (const [tipo, q] of [["image/webp", 0.85], ["image/webp", 0.7], ["image/jpeg", 0.8], ["image/jpeg", 0.6]] as const) {
        const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, tipo, q));
        if (blob && blob.type === tipo && blob.size <= LIMITE_FOTO) return await new Promise<string>((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => falha(new Error("Não consegui ler a foto.")); r.readAsDataURL(blob); });
      }
    }
    throw new Error("Não consegui deixar a foto com menos de 200 KB. Tente outra.");
  } finally { URL.revokeObjectURL(url); }
}

// ---------------- peças dos campos ----------------

// etiquetas: digite e aperte Enter (ou vírgula); as sugestões entram com um toque
function CampoEtiquetas({ rotulo, valor, mudar, sugestoes, exemplo }: { rotulo: string; valor: string[]; mudar: (v: string[]) => void; sugestoes: string[]; exemplo: string }) {
  const [txt, setTxt] = useState("");
  const id = useId();
  const cheio = valor.length >= MAX_ETIQUETAS;
  const por = (t: string) => {
    const limpo = t.replace(/[,;]+/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_ETIQUETA);
    if (!limpo || cheio || valor.some((v) => normalizar(v) === normalizar(limpo))) return;
    mudar([...valor, limpo]);
  };
  const livres = sugestoes.filter((s) => !valor.some((v) => normalizar(v) === normalizar(s))).slice(0, 8);
  return (
    <div className="cd-campo">
      <label htmlFor={id} className="cd-rotulo">{rotulo}<span>{valor.length}/{MAX_ETIQUETAS}</span></label>
      <div className="cd-etiquetas">
        {valor.map((v) => (
          <span key={v} className="cd-etiqueta">{v}<button type="button" onClick={() => mudar(valor.filter((x) => x !== v))} aria-label={`Tirar ${v}`}><Icone nome="fechar" tamanho={13} traco={2.2} /></button></span>
        ))}
        <input id={id} value={txt} disabled={cheio} placeholder={valor.length ? "Mais uma…" : exemplo} enterKeyHint="enter"
          onChange={(e) => { const v = e.target.value; if (/[,;]$/.test(v)) { por(v); setTxt(""); } else setTxt(v.slice(0, MAX_ETIQUETA)); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); por(txt); setTxt(""); }
            else if (e.key === "Backspace" && !txt && valor.length) mudar(valor.slice(0, -1));
          }}
          onBlur={() => { if (txt.trim()) { por(txt); setTxt(""); } }} />
      </div>
      <p className="cd-dica">Escreva e aperte Enter. Palavras simples casam melhor na busca.</p>
      {livres.length > 0 && !cheio && (
        <div className="cd-sugestoes" aria-label="Sugestões">
          {livres.map((s) => <button key={s} type="button" onClick={() => por(s)}><Icone nome="mais" tamanho={13} traco={2.2} />{s}</button>)}
        </div>
      )}
    </div>
  );
}

function Descricao({ rotulo, valor, mudar, exemplo }: { rotulo: string; valor: string; mudar: (v: string) => void; exemplo: string }) {
  return (
    <label className="cd-campo">
      <span className="cd-rotulo">{rotulo}<span>{valor.length}/{MAX_TEXTO}</span></span>
      <textarea className="cd-entrada" rows={3} value={valor} maxLength={MAX_TEXTO} placeholder={exemplo} onChange={(e) => mudar(e.target.value)} />
    </label>
  );
}

// uma escolha entre opções com título e explicação (lista, não grade de cartões)
function Opcoes<T extends string>({ nome, opcoes, valor, mudar, fichas = false }: { nome: string; opcoes: readonly { id: T; nome: string; texto?: string }[]; valor: T | null; mudar: (v: T) => void; fichas?: boolean }) {
  return (
    <div className={fichas ? "cd-fichas" : "cd-opcoes"} role="radiogroup">
      {opcoes.map((o) => (
        <label key={o.id} className={fichas ? "cd-ficha" : "cd-opcao"} data-marcado={valor === o.id ? "" : undefined}>
          <input type="radio" name={nome} value={o.id} checked={valor === o.id} onChange={() => mudar(o.id)} />
          <span className="cd-marca" aria-hidden="true" />
          <span className="min-w-0"><b>{o.nome}</b>{o.texto && <small>{o.texto}</small>}</span>
        </label>
      ))}
    </div>
  );
}

function Chave({ marcado, mudar, titulo, texto }: { marcado: boolean; mudar: (v: boolean) => void; titulo: string; texto?: string }) {
  return (
    <label className="cd-chave">
      <input type="checkbox" checked={marcado} onChange={(e) => mudar(e.target.checked)} />
      <span className="cd-chave-trilho" aria-hidden="true"><i /></span>
      <span className="min-w-0"><b>{titulo}</b>{texto && <small>{texto}</small>}</span>
    </label>
  );
}

// ---------------- os campos de cada etapa ----------------

const AJUDA: Record<EtapaId, string> = {
  objetivo: "Assim o WorkEnd mostra o que importa para você: clientes, fornecedores ou os dois.",
  quem: "Escolha o que mais combina com você hoje. Dá para mudar depois.",
  negocio: "É o nome que aparece no seu perfil público e na busca.",
  local: "Quem procura por perto acha você primeiro. Quem atende só online pode deixar a cidade em branco.",
  oferece: "Seus produtos e serviços, em etiquetas curtas. É por elas que quem procura chega até você.",
  procura: "Fornecedores, parceiros, serviços para o seu negócio. Mostramos quem oferece o que você procura.",
  links: "Os caminhos para falar com você. A foto pode ser o seu rosto ou o logo.",
  privacidade: "Você decide o que fica à mostra. WhatsApp e e-mail só aparecem se você ligar.",
};

function Campos({ etapa, p, mudar, nomeConta, emailConta }: { etapa: EtapaId; p: Rascunho; mudar: Mudar; nomeConta: string; emailConta: string }) {
  const arquivo = useRef<HTMLInputElement>(null);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const sugestoes = useMemo(() => [...new Set([...p.nichos.flatMap((n) => SUGESTOES_OFERECE[n] ?? []), ...(p.nichos.length ? [] : ["Consultoria", "Design", "Fotografia", "Aulas", "Doces", "Manutenção"])])], [p.nichos]);
  const mostrar = (k: keyof Mostrar) => (v: boolean) => mudar({ mostrar: { ...p.mostrar, [k]: v } });

  switch (etapa) {
    case "objetivo":
      return <Opcoes nome="objetivo" opcoes={OBJETIVOS} valor={p.objetivo} mudar={(v) => mudar({ objetivo: v as Objetivo })} />;
    case "quem":
      return <Opcoes nome="tipo" opcoes={TIPOS} valor={p.tipo} mudar={(v) => mudar({ tipo: v })} fichas />;
    case "negocio":
      return (
        <>
          <label className="cd-campo">
            <span className="cd-rotulo">{p.tipo === "empresa" || p.tipo === "loja_online" ? "Nome do negócio" : "Nome profissional ou do negócio"}</span>
            <input className="cd-entrada" name="nome" value={p.nome} maxLength={80} onChange={(e) => mudar({ nome: e.target.value })} placeholder={nomeConta ? `Ex.: ${nomeConta}` : "Ex.: Padaria do Bairro"} autoComplete="organization" />
          </label>
          <div className="cd-campo">
            <span className="cd-rotulo">Área de atuação<span>até {MAX_NICHOS}</span></span>
            <div className="cd-nichos">
              {NICHOS.map((n) => {
                const on = p.nichos.includes(n.id);
                return <button key={n.id} type="button" aria-pressed={on} disabled={!on && p.nichos.length >= MAX_NICHOS} onClick={() => mudar({ nichos: on ? p.nichos.filter((x) => x !== n.id) : [...p.nichos, n.id] })}>{on && <Icone nome="check" tamanho={14} traco={2.4} />}{n.nome}</button>;
              })}
            </div>
          </div>
        </>
      );
    case "local":
      return (
        <>
          <div className="cd-campo">
            <span className="cd-rotulo">Como você atende</span>
            <div className="cd-seg" role="radiogroup">
              {ATENDIMENTOS.map((a) => <label key={a.id} data-marcado={p.atendimento === a.id ? "" : undefined}><input type="radio" name="atendimento" value={a.id} checked={p.atendimento === a.id} onChange={() => mudar({ atendimento: a.id })} />{a.nome}</label>)}
            </div>
          </div>
          <div className="cd-linha">
            <label className="cd-campo cd-cresce"><span className="cd-rotulo">Cidade</span><input className="cd-entrada" name="cidade" value={p.cidade} maxLength={60} onChange={(e) => mudar({ cidade: e.target.value })} placeholder="Ex.: Aracaju" autoComplete="address-level2" /></label>
            <label className="cd-campo cd-uf"><span className="cd-rotulo">Estado</span>
              <select className="cd-entrada" name="uf" value={p.uf} onChange={(e) => mudar({ uf: e.target.value })}><option value="">—</option>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
            </label>
          </div>
        </>
      );
    case "oferece":
      return (
        <>
          <CampoEtiquetas rotulo="Produtos e serviços" valor={p.oferece} mudar={(v) => mudar({ oferece: v })} sugestoes={sugestoes} exemplo="Ex.: Bolos de festa" />
          <Descricao rotulo="Conte em poucas linhas o que você faz" valor={p.ofereceTexto} mudar={(v) => mudar({ ofereceTexto: v })} exemplo="Ex.: Pães e bolos sob encomenda, com entrega no bairro." />
        </>
      );
    case "procura":
      return (
        <>
          <CampoEtiquetas rotulo="O que você quer encontrar" valor={p.procura} mudar={(v) => mudar({ procura: v })} sugestoes={SUGESTOES_PROCURA} exemplo="Ex.: Fornecedor de embalagens" />
          <Descricao rotulo="Detalhe, se quiser" valor={p.procuraTexto} mudar={(v) => mudar({ procuraTexto: v })} exemplo="Ex.: Procuro quem faça as fotos dos produtos para o Instagram." />
        </>
      );
    case "links": {
      const fotoAtual = p.fotoNova ?? (p.removerFoto ? null : p.foto);
      return (
        <>
          <div className="cd-foto">
            <span className="cd-foto-img">{fotoAtual ? <img src={fotoAtual} alt="" /> : <Icone nome="foto" tamanho={28} />}</span>
            <div className="min-w-0">
              <b className="block text-[15px]">Foto ou logo</b>
              <small className="block text-[13px] text-[var(--muted)]">JPG, PNG ou WebP. O tamanho é reduzido sozinho.</small>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="btn btn-linha !py-2 text-sm" disabled={lendo} onClick={() => arquivo.current?.click()}>{lendo ? "Preparando…" : fotoAtual ? "Trocar" : "Escolher foto"}</button>
                {fotoAtual && <button type="button" className="btn btn-linha !py-2 text-sm" onClick={() => mudar({ fotoNova: null, removerFoto: true })}>Tirar</button>}
              </div>
              {erroFoto && <p className="mt-1 text-[13px] text-[#8A2A2A]">{erroFoto}</p>}
            </div>
            <input ref={arquivo} type="file" name="foto" accept="image/jpeg,image/png,image/webp" hidden onChange={async (e) => {
              const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
              setErroFoto(null); setLendo(true);
              try { mudar({ fotoNova: await reduzirFoto(f), removerFoto: false }); } catch (x) { setErroFoto((x as Error).message); } finally { setLendo(false); }
            }} />
          </div>
          <label className="cd-campo"><span className="cd-rotulo">Site</span><input className="cd-entrada" name="site" value={p.site} maxLength={200} inputMode="url" onChange={(e) => mudar({ site: e.target.value })} placeholder="www.seusite.com.br" autoComplete="url" /></label>
          <div className="cd-linha">
            <label className="cd-campo cd-cresce"><span className="cd-rotulo">Instagram</span><span className="cd-prefixo"><i>@</i><input className="cd-entrada" name="instagram" value={p.instagram} maxLength={60} onChange={(e) => mudar({ instagram: e.target.value.replace(/^@/, "") })} placeholder="seuperfil" autoCapitalize="none" /></span></label>
            <label className="cd-campo cd-cresce"><span className="cd-rotulo">WhatsApp</span><input className="cd-entrada" name="whatsapp" value={p.whatsapp} maxLength={20} inputMode="tel" onChange={(e) => mudar({ whatsapp: e.target.value })} placeholder="79 99999-0000" autoComplete="tel-national" /></label>
          </div>
          <p className="cd-dica">O WhatsApp fica escondido no perfil público, a não ser que você ligue na etapa de privacidade.</p>
        </>
      );
    }
    case "privacidade":
      return (
        <>
          <label className="cd-campo">
            <span className="cd-rotulo">Endereço do seu perfil</span>
            <span className="cd-prefixo cd-prefixo-largo"><i>workend.online/perfil/</i><input className="cd-entrada" name="apelido" value={p.apelido ?? ""} maxLength={40} autoCapitalize="none" onChange={(e) => { const v = e.target.value; mudar({ apelido: paraApelido(v) + (v.endsWith("-") || v.endsWith(" ") ? "-" : "") }); }} placeholder={paraApelido(p.nome || nomeConta) || "seu-nome"} /></span>
          </label>
          <div className="cd-chaves">
            <Chave marcado={p.publico} mudar={(v) => mudar({ publico: v })} titulo="Perfil público" texto="Aparece na busca e tem endereço próprio. Desligado, só você vê." />
            <div className={p.publico ? "cd-chaves" : "cd-chaves cd-apagado"}>
              <Chave marcado={p.mostrar.procura} mudar={mostrar("procura")} titulo="Mostrar o que eu procuro" texto="Quem oferece o que você procura acha você." />
              <Chave marcado={p.mostrar.cidade} mudar={mostrar("cidade")} titulo="Mostrar cidade e estado" />
              <Chave marcado={p.mostrar.links} mudar={mostrar("links")} titulo="Mostrar site e Instagram" />
              <Chave marcado={p.mostrar.cidade3d} mudar={mostrar("cidade3d")} titulo="Mostrar minha loja e meu personagem do mapa" texto="Se você tiver." />
              <Chave marcado={p.mostrar.whatsapp} mudar={mostrar("whatsapp")} titulo="Mostrar meu WhatsApp" texto={p.whatsapp ? undefined : "Você ainda não pôs o WhatsApp."} />
              <Chave marcado={p.mostrar.email} mudar={mostrar("email")} titulo="Mostrar meu e-mail" texto={emailConta} />
            </div>
          </div>
        </>
      );
  }
}

// ---------------- prévia do perfil público ----------------
export function Previa({ p, nomeConta }: { p: Rascunho; nomeConta: string }) {
  const foto = p.fotoNova ?? (p.removerFoto ? null : p.foto);
  const nome = p.nome.trim() || nomeConta || "Seu nome";
  const linha = [nomeTipo(p.tipo), ...p.nichos.map(nomeNicho)].filter(Boolean).join(" · ");
  const onde = [p.mostrar.cidade ? [p.cidade, p.uf].filter(Boolean).join(" / ") : "", nomeAtendimento(p.atendimento)].filter(Boolean).join(" · ");
  return (
    <div className="cd-previa" data-privado={p.publico ? undefined : ""}>
      <div className="cd-previa-topo">
        <span className="cd-previa-foto">{foto ? <img src={foto} alt="" /> : nome.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0">
          <b className="block truncate">{nome}</b>
          <small className="block truncate">{linha || "Tipo e área"}</small>
        </div>
      </div>
      {onde && <p className="cd-previa-onde"><Icone nome="pino" tamanho={14} />{onde}</p>}
      <div className="cd-previa-bloco">
        <span>Oferece</span>
        {p.oferece.length ? <div className="cd-previa-tags">{p.oferece.slice(0, 6).map((t) => <i key={t}>{t}</i>)}</div> : <em>{p.ofereceTexto ? p.ofereceTexto.slice(0, 90) : "O que você faz aparece aqui"}</em>}
      </div>
      {p.mostrar.procura && (p.procura.length > 0 || !!p.procuraTexto) && (
        <div className="cd-previa-bloco">
          <span>Procura</span>
          {p.procura.length ? <div className="cd-previa-tags cd-previa-tags-proc">{p.procura.slice(0, 6).map((t) => <i key={t}>{t}</i>)}</div> : <em>{p.procuraTexto.slice(0, 90)}</em>}
        </div>
      )}
      <div className="cd-previa-links">
        {p.mostrar.links && p.instagram && <span><Icone nome="instagram" tamanho={14} />@{p.instagram}</span>}
        {p.mostrar.links && p.site && <span><Icone nome="globo" tamanho={14} />{siteCurto(p.site)}</span>}
        {p.mostrar.whatsapp && p.whatsapp && <span><Icone nome="telefone" tamanho={14} />WhatsApp</span>}
      </div>
      <p className="cd-previa-end">{p.publico ? `workend.online/perfil/${p.apelido || paraApelido(nome) || "seu-nome"}` : "Perfil fechado: só você vê"}</p>
    </div>
  );
}

// ---------------- Etapas (logo depois de criar a conta) ----------------
export function Etapas({ inicial, comecarEm, depois, nomeConta, emailConta }: { inicial: Rascunho; comecarEm: EtapaId; depois: string; nomeConta: string; emailConta: string }) {
  const [p, setP] = useState<Rascunho>(inicial);
  const ordem = ordemEtapas(p.objetivo);
  const [atual, setAtual] = useState<EtapaId>(comecarEm);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<Resumo | null>(null);
  const idx = Math.max(0, ordem.indexOf(atual));
  const etapa = ETAPAS.find((e) => e.id === atual)!;
  const mudar: Mudar = (x) => setP((v) => ({ ...v, ...x }));
  const ultimo = idx === ordem.length - 1;
  const precisa = (atual === "objetivo" && !p.objetivo) || (atual === "quem" && !p.tipo) || (atual === "negocio" && !p.nome.trim()) || (atual === "local" && !p.atendimento);

  const ir = (id: EtapaId) => { setErro(null); setAtual(id); window.scrollTo({ top: 0 }); };
  const continuar = async (e?: React.FormEvent) => {
    e?.preventDefault(); if (ocupado || precisa) return;
    setOcupado(true); setErro(null);
    try {
      const r = await salvar(atual, p);
      setP((v) => ({ ...v, ...r.perfil, fotoNova: undefined, removerFoto: false }));
      const nova = ordemEtapas(r.perfil.objetivo);
      const i = nova.indexOf(atual);
      if (i >= nova.length - 1) setPronto(r.resumo); else ir(nova[i + 1]);
    } catch (x) { setErro((x as Error).message); } finally { setOcupado(false); }
  };
  const pular = () => {
    if (ultimo) setPronto({ faltam: ETAPAS.filter((x) => !p.etapas.includes(x.id)).map((x) => ({ id: x.id, curto: x.curto })), completo: false, apelido: p.apelido });
    else ir(ordem[idx + 1]);
  };
  const terminarDepois = async () => {
    setOcupado(true);
    await fetch("/api/workend/perfil", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pular: true }) }).catch(() => null);
    window.location.href = depois;
  };

  return (
    <div className="cd">
      <header className="faixa cd-cab">
        <Link href="/" aria-label="WorkEnd, início" className="cd-cab-logo"><Logotipo altura={20} /></Link>
        <span className="cd-cab-titulo"><Icone nome="perfil" tamanho={18} />Seu perfil</span>
        {!pronto && <button type="button" className="cd-depois" onClick={() => void terminarDepois()} disabled={ocupado}>Terminar depois</button>}
      </header>

      <main className="faixa cd-grade">
        {pronto ? (
          <section className="pg-cartao cd-passo cd-pronto" aria-live="polite">
            <span className="cd-pronto-selo"><Icone nome="check" tamanho={26} traco={2.4} /></span>
            <h1>{pronto.completo ? "Seu perfil está pronto." : "Guardamos o que você respondeu."}</h1>
            <p className="cd-sub">{pronto.completo
              ? "Ele já aparece na busca do WorkEnd. Quem procura o que você oferece chega até você."
              : `Faltam ${pronto.faltam.length} ${pronto.faltam.length === 1 ? "etapa" : "etapas"}: ${pronto.faltam.map((f) => f.curto.toLowerCase()).join(", ")}. O seu painel lembra.`}</p>
            <div className="cd-acoes-pronto">
              <a href={depois} className="btn btn-azul">{depois.startsWith("/mundo") ? "Voltar para o mapa" : "Ir para o meu escritório"}<Icone nome="seta" tamanho={17} /></a>
              {p.apelido && p.publico && <Link href={`/perfil/${p.apelido}`} className="btn btn-linha">Ver meu perfil público</Link>}
              <Link href="/encontrar?tipo=perfis" className="btn btn-linha">Ver quem combina comigo</Link>
            </div>
          </section>
        ) : (
          <section className="pg-cartao cd-passo">
            <div className="cd-progresso">
              <div className="cd-progresso-txt"><span>Etapa {idx + 1} de {ordem.length}</span><span>{p.etapas.length} de {ETAPAS.length} respondidas</span></div>
              <div className="cd-trilho" role="progressbar" aria-valuemin={0} aria-valuemax={ordem.length} aria-valuenow={idx + 1} aria-label="Progresso do perfil"><i style={{ width: `${((idx + 1) / ordem.length) * 100}%` }} /></div>
              <ol className="cd-pontos">
                {ordem.map((id) => {
                  const e = ETAPAS.find((x) => x.id === id)!;
                  return <li key={id}><button type="button" onClick={() => ir(id)} aria-current={id === atual ? "step" : undefined} data-feito={p.etapas.includes(id) ? "" : undefined} title={e.curto}><span className="sr-only">{e.curto}</span></button></li>;
                })}
              </ol>
            </div>
            <form onSubmit={continuar} key={atual} className="cd-form" data-etapa={atual}>
              <h1>{etapa.titulo}</h1>
              <p className="cd-sub">{AJUDA[atual]}</p>
              <div className="cd-campos"><Campos etapa={atual} p={p} mudar={mudar} nomeConta={nomeConta} emailConta={emailConta} /></div>
              {erro && <p className="cd-erro" role="alert">{erro}</p>}
              <div className="cd-acoes">
                {idx > 0 ? <button type="button" className="btn btn-linha" onClick={() => ir(ordem[idx - 1])} disabled={ocupado}>Voltar</button> : <span />}
                <span className="cd-acoes-dir">
                  <button type="button" className="cd-pular" onClick={pular} disabled={ocupado}>Pular esta etapa</button>
                  <button type="submit" className="btn btn-azul" disabled={ocupado || precisa}>{ocupado ? "Salvando…" : ultimo ? "Concluir" : "Continuar"}{!ocupado && !ultimo && <Icone nome="seta" tamanho={17} />}</button>
                </span>
              </div>
            </form>
          </section>
        )}
        <aside className="cd-lado">
          <details className="cd-dobra" open>
            <summary>Assim aparece o seu perfil</summary>
            <Previa p={p} nomeConta={nomeConta} />
          </details>
        </aside>
      </main>
    </div>
  );
}

// ---------------- Editor (Meu perfil, no painel) ----------------
export function EditorPerfil({ inicial, nomeConta, emailConta }: { inicial: Rascunho; nomeConta: string; emailConta: string }) {
  const [p, setP] = useState<Rascunho>(inicial);
  const [salvo, setSalvo] = useState<Rascunho>(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const mudar: Mudar = (x) => { setP((v) => ({ ...v, ...x })); setAviso(null); };
  const mexeu = JSON.stringify(p) !== JSON.stringify(salvo);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setOcupado(true); setAviso(null);
    try {
      const r = await salvar("tudo", p);
      const novo: Rascunho = { ...p, ...r.perfil, fotoNova: undefined, removerFoto: false };
      setP(novo); setSalvo(novo);
      setAviso({ ok: true, texto: r.resumo.completo ? "Perfil salvo. A busca já mostra a versão nova." : `Perfil salvo. Ainda falta: ${r.resumo.faltam.map((f) => f.curto.toLowerCase()).join(", ")}.` });
    } catch (x) { setAviso({ ok: false, texto: (x as Error).message }); } finally { setOcupado(false); }
  };
  const ordem = ordemEtapas(p.objetivo);
  return (
    <form onSubmit={enviar} className="cd-editor">
      <div className="cd-editor-grade">
        <div className="cd-editor-secoes">
          {ordem.map((id) => {
            const e = ETAPAS.find((x) => x.id === id)!;
            const falta = !salvo.etapas.includes(id);
            return (
              <section key={id} id={`secao-${id}`} className="pg-cartao cd-secao" data-etapa={id}>
                <div className="cd-secao-topo"><h2>{e.titulo}</h2>{falta && <span className="cd-falta">falta responder</span>}</div>
                <p className="cd-sub">{AJUDA[id]}</p>
                <div className="cd-campos"><Campos etapa={id} p={p} mudar={mudar} nomeConta={nomeConta} emailConta={emailConta} /></div>
              </section>
            );
          })}
        </div>
        <aside className="cd-lado">
          <details className="cd-dobra" open>
            <summary>Prévia do perfil público</summary>
            <Previa p={p} nomeConta={nomeConta} />
          </details>
          {salvo.apelido && salvo.publico && <Link href={`/perfil/${salvo.apelido}`} className="btn btn-linha mt-3 w-full">Abrir o perfil público</Link>}
        </aside>
      </div>
      <div className="cd-barra-salvar" data-mexeu={mexeu ? "" : undefined}>
        <span className={aviso ? (aviso.ok ? "cd-ok" : "cd-erro-txt") : ""} role="status">{aviso?.texto ?? (mexeu ? "Você tem alterações sem salvar." : "Tudo salvo.")}</span>
        <button type="submit" className="btn btn-azul" disabled={ocupado || !mexeu}>{ocupado ? "Salvando…" : "Salvar alterações"}</button>
      </div>
    </form>
  );
}
