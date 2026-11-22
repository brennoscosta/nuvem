"use client";
// Aba WhatsApp de Minha equipe (WE-18, 22/11/2026): o dono conecta o número da loja na WhatsApp Business Platform (pelo
// cadastro da Meta ou com os dados colados à mão), escolhe o modelo aprovado para depois de 24 horas e vê quanto o WhatsApp
// gasta de unidades. As conversas ficam na aba Visitantes, com o selo "WhatsApp"; ConversaWhatsApp (abaixo) é a barra
// dessas conversas: assumir, devolver, responder pelo painel e apagar a pedido do cliente. Só aparece com o WhatsApp
// ligado no servidor. Servidor: src/server/whatsapp.ts e /api/workend/whatsapp. Estilos: .eq-cx- (Conectores) e .eq-wa-.
import { useCallback, useEffect, useRef, useState } from "react";
import { Icone, type NomeIcone } from "@/office/ui/Icone";
import { apiEquipe, quando, type PainelEquipe } from "@/office/ui/equipeComum";

type Modelo = { nome: string; idioma: string; categoria: string };
type Conexao = { via: "manual" | "cadastro"; numero: string; nome: string; phoneNumberId: string; wabaId: string; inscrito: boolean; criadoEm: string; proprioAplicativo: boolean; tokenVerificacao: string | null; modelo: Modelo | null };
type Custo = { servicoBrl: number; unidadesServico: number; marketingBrl: number; unidadesMarketing: number; horasHumano: number };
type Cadastro = { appId: string; configId: string; versao: string };
type Estado = { ligado: false } | { ligado: true; empresa: string; lote: string; cadastro: Cadastro | null; webhook: string; custo: Custo; conversas: number; enviadasMes: number; unidadesMes: number; conexao: Conexao | null };
type Ligado = Extract<Estado, { ligado: true }>;
export type SituacaoWhatsApp = { id: string; numero: string; conectado: boolean; modelo: string | null; humanoAte: string | null; humanoPor: string | null; janelaAberta: boolean; janelaAte: string | null };

const URL_API = "/api/workend/whatsapp";
const post = <T,>(lote: string, corpo: Record<string, unknown>) => apiEquipe<T>(URL_API, { method: "POST", body: JSON.stringify({ lote, ...corpo }) });
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const hora = (s: string) => new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const Erro = ({ t }: { t: string | null }) => (t ? <p className="mt-2 rounded-lg bg-[#FDECEC] px-3 py-1.5 text-[13px] text-[#9B1C1C]">{t}</p> : null);
function Bloco({ icone, cor, titulo, texto, children }: { icone: NomeIcone; cor: string; titulo: string; texto: string; children: React.ReactNode }) {
  return (
    <article className="eq-cx-bloco">
      <header className="flex items-start gap-3">
        <span className="eq-cx-icone" style={{ background: `${cor}1F`, color: cor }}><Icone nome={icone} tamanho={21} /></span>
        <div className="min-w-0"><h3>{titulo}</h3><p className="mt-0.5 text-[13.5px] leading-snug text-[var(--muted)]">{texto}</p></div>
      </header>
      {children}
    </article>
  );
}
function Copiar({ rotulo, valor }: { rotulo: string; valor: string }) {
  const [feito, setFeito] = useState(false);
  return (
    <div className="eq-cx-item">
      <span className="block text-[12px] font-semibold text-[var(--muted)]">{rotulo}</span>
      <span className="mt-1 flex min-w-0 items-center gap-2">
        <code className="eq-wa-codigo">{valor}</code>
        <button type="button" className="eq-cx-mini" onClick={() => { void navigator.clipboard?.writeText(valor).then(() => { setFeito(true); setTimeout(() => setFeito(false), 1800); }); }}>
          <Icone nome={feito ? "check" : "copiar"} tamanho={14} />{feito ? "Copiado" : "Copiar"}
        </button>
      </span>
    </div>
  );
}

// ---------- aba ----------
export function WhatsAppLoja({ p, irParaConversas }: { p: PainelEquipe; irParaConversas: () => void }) {
  const lote = p.lote.chave;
  const [e, setE] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let vivo = true;
    apiEquipe<Estado>(`${URL_API}?lote=${encodeURIComponent(lote)}`).then((r) => { if (vivo) { setE(r); setErro(null); } }).catch((x) => { if (vivo) setErro((x as Error).message); });
    return () => { vivo = false; };
  }, [lote, versao]);
  const mudou = useCallback(() => setVersao((v) => v + 1), []);
  if (erro && !e) return <p className="mt-5 rounded-lg bg-[#FDECEC] px-3 py-2 text-sm text-[#9B1C1C]">{erro}</p>;
  if (!e) return <p className="mt-5 text-[var(--muted)]">Carregando o WhatsApp da loja…</p>;
  if (!e.ligado) return <div className="mt-5 rounded-2xl bg-[var(--cinza)] p-7"><b>O WhatsApp ainda não está ligado no WorkEnd.</b><p className="mt-1 text-[var(--tinta-2)]">Quando estiver, a sua atendente responde os clientes no WhatsApp da loja.</p></div>;
  const c = e.conexao;
  return (
    <section className="mt-5" data-guia="whatsapp">
      <div className="eq-cx-intro">
        <div className="min-w-0">
          <span className="eq-selo"><Icone nome="telefone" tamanho={13} />WhatsApp da loja</span>
          <h2>A atendente da {p.lote.empresaNome} também no WhatsApp</h2>
          <p>Quem escreve para o número da loja é respondido pela atendente, com a vitrine, os preços, a agenda e os cupons. O cliente pode pedir uma pessoa a qualquer momento, e você assume a conversa quando quiser.</p>
        </div>
        <div className="eq-wa-resumo">
          {c ? (
            <>
              <span className="eq-wa-resumo-linha"><span className="eq-wa-ponto" />Conectado{c.numero ? <> · <b className="eq-wa-numero">{c.numero}</b></> : null}</span>
              <span className="eq-wa-resumo-linha"><b>{e.conversas}</b>{e.conversas === 1 ? " conversa" : " conversas"} · <b>{e.enviadasMes}</b> mensagens enviadas este mês · <b>{e.unidadesMes.toLocaleString("pt-BR")}</b> unidades da Meta</span>
              <button type="button" className="eq-wa-link" onClick={irParaConversas}>Ver as conversas em Visitantes</button>
            </>
          ) : (
            <ol className="eq-wa-passos">
              <li><b>Conecte o número</b> da loja na Meta, pelo cadastro ou com os dados do seu aplicativo.</li>
              <li><b>A atendente responde</b> na hora, gastando as unidades de IA da empresa.</li>
              <li><b>Você assume</b> qualquer conversa pela aba Visitantes, e a resposta sai pelo WhatsApp.</li>
            </ol>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {c ? <Conectado e={e} c={c} lote={lote} mudou={mudou} /> : <>
          {e.cadastro && <CadastroMeta cfg={e.cadastro} lote={lote} conectado={mudou} />}
          <ConectarManual lote={lote} conectado={mudou} />
        </>}
        <BlocoCusto e={e} />
      </div>
    </section>
  );
}

function BlocoCusto({ e }: { e: Ligado }) {
  const k = e.custo;
  return (
    <Bloco icone="unidades" cor="#7C3AED" titulo="Quanto gasta" texto="O WhatsApp usa as mesmas unidades de IA da empresa. Não há cobrança à parte no WorkEnd.">
      <ul className="eq-wa-lista">
        <li>Cada mensagem que sai pelo WhatsApp gasta <b>{k.unidadesServico} unidades</b>: é o custo da Meta por mensagem entregue no Brasil ({reais(k.servicoBrl)}).</li>
        <li>Quando a atendente usa IA para escrever a resposta, as unidades da IA entram como sempre (cerca de 2 por resposta).</li>
        <li>O modelo aprovado de marketing, para depois de 24 horas, gasta <b>{k.unidadesMarketing} unidades</b> ({reais(k.marketingBrl)}); o de utilidade, {k.unidadesServico}.</li>
        <li>Sem unidades, a atendente responde com o recado fixo e o dono é avisado.</li>
      </ul>
      <a href="/app/creditos#unidades" className="eq-wa-link mt-2 inline-block">Ver as unidades da empresa</a>
    </Bloco>
  );
}

function ConectarManual({ lote, conectado }: { lote: string; conectado: () => void }) {
  const [f, setF] = useState({ phoneNumberId: "", wabaId: "", token: "", segredoApp: "" });
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campo = (k: keyof typeof f, rotulo: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="eq-wa-rotulo">{rotulo}<input className="eq-cx-campo" value={f[k]} onChange={(x) => setF({ ...f, [k]: x.target.value.trim() })} autoComplete="off" spellCheck={false} {...extra} /></label>
  );
  const enviar = async () => {
    setOcupado(true); setErro(null);
    try { await post(lote, { acao: "manual", ...f }); setF({ phoneNumberId: "", wabaId: "", token: "", segredoApp: "" }); conectado(); }
    catch (x) { setErro((x as Error).message); }
    setOcupado(false);
  };
  return (
    <Bloco icone="plugue" cor="#0A6CFF" titulo="Conectar com os dados da Meta" texto="Cole os dados do número que a loja já tem na WhatsApp Business Platform. O WorkEnd confere tudo na Meta antes de guardar, e o token fica cifrado.">
      <form className="eq-cx-form" onSubmit={(x) => { x.preventDefault(); void enviar(); }}>
        {campo("phoneNumberId", "Identificador do número (Phone Number ID)", { inputMode: "numeric", placeholder: "Ex.: 109876543210987" })}
        {campo("wabaId", "Identificador da conta do WhatsApp Business (WABA ID)", { inputMode: "numeric", placeholder: "Ex.: 209876543210987" })}
        {campo("token", "Token permanente do usuário do sistema", { type: "password", placeholder: "Começa com EAA…" })}
        {campo("segredoApp", "Chave secreta do seu aplicativo (App Secret), se o webhook for dele", { type: "password", placeholder: "Opcional" })}
        <button type="submit" className="btn btn-azul !py-2.5 text-sm" disabled={ocupado || !f.phoneNumberId || !f.wabaId || !f.token}><Icone nome="plugue" tamanho={16} />{ocupado ? "Conferindo na Meta…" : "Conectar"}</button>
      </form>
      <Erro t={erro} />
      <details className="eq-cx-docs">
        <summary><Icone nome="ajuda" tamanho={15} />Onde achar esses dados</summary>
        <ol className="eq-wa-lista mt-2">
          <li>No Gerenciador de Negócios da Meta, em Configurações do negócio › Contas › Contas do WhatsApp, copie o identificador da conta (WABA ID).</li>
          <li>No painel de aplicativos da Meta, no seu aplicativo › WhatsApp › Configuração da API, copie o identificador do número (Phone Number ID).</li>
          <li>Em Configurações do negócio › Usuários do sistema, crie um usuário administrador, dê a ele acesso à conta do WhatsApp e gere um token que não expira, com as permissões whatsapp_business_messaging e whatsapp_business_management.</li>
          <li>Se as mensagens chegam pelo seu próprio aplicativo, cole a chave secreta dele (Configurações do aplicativo › Básico). Depois de conectar, o WorkEnd mostra o endereço e o token de verificação para você colar em Webhooks.</li>
        </ol>
      </details>
    </Bloco>
  );
}

// ---------- cadastro incorporado da Meta (Embedded Signup) ----------
type FB = { init: (o: Record<string, unknown>) => void; login: (cb: (r: { authResponse?: { code?: string } | null }) => void, o: Record<string, unknown>) => void };
declare global { interface Window { FB?: FB; fbAsyncInit?: () => void } }
function carregarSdk(appId: string, versao: string): Promise<FB> {
  return new Promise((ok, falha) => {
    if (window.FB) { ok(window.FB); return; }
    window.fbAsyncInit = () => { window.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version: versao }); ok(window.FB!); };
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/pt_BR/sdk.js"; s.async = true; s.defer = true; s.crossOrigin = "anonymous";
    s.onerror = () => falha(new Error("Não deu para abrir a janela da Meta. Confira a internet ou se um bloqueador de anúncios está ligado."));
    document.body.appendChild(s);
  });
}
function CadastroMeta({ cfg, lote, conectado }: { cfg: Cadastro; lote: string; conectado: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ids = useRef<{ phoneNumberId?: string; wabaId?: string }>({});
  useEffect(() => {
    // a janela da Meta manda o número e a conta escolhidos por mensagem (WA_EMBEDDED_SIGNUP)
    const ouvir = (ev: MessageEvent) => {
      if (!/^https:\/\/([a-z0-9-]+\.)?facebook\.com$/.test(ev.origin)) return;
      try {
        const d = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        if (d?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (String(d.event).startsWith("FINISH")) ids.current = { phoneNumberId: d.data?.phone_number_id, wabaId: d.data?.waba_id };
        else if (d.event === "CANCEL") setErro("Você fechou a janela da Meta antes de terminar.");
      } catch { /* outra mensagem da página */ }
    };
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
  }, []);
  const abrir = async () => {
    setOcupado(true); setErro(null); ids.current = {};
    try {
      const fb = await carregarSdk(cfg.appId, cfg.versao);
      const code = await new Promise<string | null>((ok) => fb.login((r) => ok(r.authResponse?.code ?? null), { config_id: cfg.configId, response_type: "code", override_default_response_type: true, extras: { setup: {}, sessionInfoVersion: "3" } }));
      if (!code) throw new Error("A Meta não terminou o cadastro. Tente de novo.");
      for (let i = 0; i < 20 && !ids.current.wabaId; i++) await new Promise((r) => setTimeout(r, 250)); // os ids podem chegar logo depois do código
      if (!ids.current.wabaId || !ids.current.phoneNumberId) throw new Error("A Meta não informou qual número foi escolhido. Tente de novo ou use a conexão com os dados.");
      await post(lote, { acao: "cadastro", code, ...ids.current });
      conectado();
    } catch (x) { setErro((x as Error).message); }
    setOcupado(false);
  };
  return (
    <Bloco icone="link" cor="#16A34A" titulo="Conectar pela Meta" texto="O jeito mais simples: a janela da Meta abre aqui, você entra com a sua conta, escolhe ou cria o número da loja e volta conectado.">
      <button type="button" className="btn btn-azul mt-4 !py-2.5 text-sm" onClick={() => void abrir()} disabled={ocupado}><Icone nome="link" tamanho={16} />{ocupado ? "Esperando a Meta…" : "Conectar pela Meta"}</button>
      <Erro t={erro} />
    </Bloco>
  );
}

// ---------- conectado ----------
function Conectado({ e, c, lote, mudou }: { e: Ligado; c: Conexao; lote: string; mudou: () => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [modelo, setModelo] = useState({ nome: c.modelo?.nome ?? "", idioma: c.modelo?.idioma ?? "pt_BR" });
  const acao = async (corpo: Record<string, unknown>) => {
    setOcupado(true); setErro(null);
    try { await post(lote, corpo); mudou(); } catch (x) { setErro((x as Error).message); }
    setOcupado(false);
  };
  const sair = () => { if (confirm("Desconectar o WhatsApp da loja? A atendente para de responder por lá na hora. As conversas continuam em Visitantes.")) void acao({ acao: "desconectar" }); };
  return (
    <>
      <Bloco icone="telefone" cor="#16A34A" titulo="Número conectado" texto={c.via === "cadastro" ? "Conectado pelo cadastro da Meta." : "Conectado com os dados da Meta."}>
        <div className="mt-3">
          <div className="eq-cx-item"><b className="eq-wa-numero text-[1.15rem]">{c.numero || "Número sem nome na Meta"}</b>{c.nome && <span className="block text-[13px] text-[var(--muted)]">{c.nome} · desde {quando(c.criadoEm)}</span>}</div>
          {!c.inscrito && <p className="mt-2 rounded-lg bg-[#FFF4E5] px-3 py-1.5 text-[13px] text-[#8A4B00]">A Meta não confirmou a inscrição do aplicativo neste número: as mensagens podem não chegar. Desconecte e conecte de novo.</p>}
          {c.proprioAplicativo && c.tokenVerificacao && (
            <>
              <p className="mt-2 text-[13px] text-[var(--muted)]">No painel do seu aplicativo na Meta, em WhatsApp › Configuração › Webhook, cole o endereço e o token abaixo e assine o campo “messages”.</p>
              <Copiar rotulo="Endereço do webhook (URL de retorno)" valor={e.webhook} />
              <Copiar rotulo="Token de verificação" valor={c.tokenVerificacao} />
            </>
          )}
        </div>
        <button type="button" className="eq-cx-mini eq-cx-mini-perigo mt-3" onClick={sair} disabled={ocupado}>Desconectar</button>
      </Bloco>
      <Bloco icone="relogio" cor="#D97706" titulo="Depois de 24 horas" texto="O WhatsApp só deixa responder à vontade até 24 horas depois da última mensagem do cliente. Depois disso, só sai um modelo aprovado pela Meta.">
        <form className="eq-cx-form sm:grid-cols-[1fr_120px]" onSubmit={(x) => { x.preventDefault(); void acao({ acao: "modelo", ...modelo }); }}>
          <label className="eq-wa-rotulo">Nome do modelo aprovado<input className="eq-cx-campo" value={modelo.nome} onChange={(x) => setModelo({ ...modelo, nome: x.target.value.trim().toLowerCase() })} placeholder="Ex.: retomar_atendimento" spellCheck={false} /></label>
          <label className="eq-wa-rotulo">Idioma<input className="eq-cx-campo" value={modelo.idioma} onChange={(x) => setModelo({ ...modelo, idioma: x.target.value.trim() })} placeholder="pt_BR" spellCheck={false} /></label>
          <button type="submit" className="btn btn-tinta !py-2.5 text-sm sm:col-span-2" disabled={ocupado}>{modelo.nome ? "Conferir na Meta e salvar" : "Ficar sem modelo"}</button>
        </form>
        <p className="mt-2 text-[13px] text-[var(--muted)]">{c.modelo ? <>Em uso: <b>{c.modelo.nome}</b> ({c.modelo.idioma}, {c.modelo.categoria === "utilidade" ? "utilidade" : "marketing"}).</> : "Sem modelo: depois de 24 horas a atendente não responde e você recebe um aviso."} Os modelos são criados no Gerenciador do WhatsApp da Meta, sem campos variáveis.</p>
        <Erro t={erro} />
      </Bloco>
    </>
  );
}

// ---------- uma conversa do WhatsApp, na aba Visitantes ----------
export function ConversaWhatsApp({ lote, contato, versao, mudou, apagada, children }: { lote: string; contato: string; versao: number; mudou: () => void; apagada: () => void; children: React.ReactNode }) {
  const [s, setS] = useState<SituacaoWhatsApp | null>(null);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    apiEquipe<SituacaoWhatsApp>(`${URL_API}?lote=${encodeURIComponent(lote)}&contato=${encodeURIComponent(contato)}`).then((r) => { if (vivo) setS(r); }).catch((x) => { if (vivo) setErro((x as Error).message); });
    return () => { vivo = false; };
  }, [lote, contato, versao]);
  const acao = async (corpo: Record<string, unknown>) => {
    setOcupado(true); setErro(null);
    try {
      const r = await post<SituacaoWhatsApp | { situacao: SituacaoWhatsApp }>(lote, { contato, ...corpo });
      if (r && "situacao" in r) setS(r.situacao); else if (r && "id" in r) setS(r);
      mudou();
      return true;
    } catch (x) { setErro((x as Error).message); return false; }
    finally { setOcupado(false); }
  };
  const apagar = async () => {
    if (!confirm("Apagar esta conversa do WhatsApp? Some a conversa e o número da pessoa. Use quando ela pedir para apagar os dados dela.")) return;
    setOcupado(true);
    try { await post(lote, { acao: "apagar", contato }); apagada(); } catch (x) { setErro((x as Error).message); setOcupado(false); }
  };
  const comVoce = !!s?.humanoAte;
  return (
    <div>
      <div className="eq-wa-barra">
        <span className="eq-wa-selo"><Icone nome="telefone" tamanho={12} />WhatsApp</span>
        <b className="eq-wa-numero">{s?.numero ?? "…"}</b>
        {s && (
          <span className="eq-wa-estado">
            <span className={`eq-wa-ponto ${comVoce ? "eq-wa-ponto-dono" : ""}`} />
            {comVoce ? `${s.humanoPor === "cliente" ? "Pediu uma pessoa" : "Com você"} até ${hora(s.humanoAte!)}` : "A atendente está respondendo"}
          </span>
        )}
        <span className="ml-auto flex flex-wrap gap-2">
          {s && (comVoce
            ? <button type="button" className="eq-cx-mini" disabled={ocupado} onClick={() => void acao({ acao: "devolver" })}>Devolver para a atendente</button>
            : <button type="button" className="eq-cx-mini" disabled={ocupado} onClick={() => void acao({ acao: "assumir" })}>Assumir</button>)}
          <button type="button" className="eq-cx-mini eq-cx-mini-perigo" disabled={ocupado} onClick={() => void apagar()}>Apagar conversa</button>
        </span>
      </div>
      {children}
      {s && !s.conectado && <p className="mt-4 rounded-lg bg-[#FFF4E5] px-3 py-1.5 text-[13px] text-[#8A4B00]">O WhatsApp da loja está desconectado: dá para ler, mas não responder.</p>}
      {s?.conectado && (s.janelaAberta ? (
        <form className="eq-wa-resposta" onSubmit={(x) => { x.preventDefault(); void acao({ acao: "responder", texto }).then((ok) => { if (ok) setTexto(""); }); }}>
          <label className="eq-wa-rotulo">Responder pelo WhatsApp{!comVoce && <small> (a atendente para de responder nesta conversa)</small>}
            <textarea className="eq-cx-campo" rows={3} value={texto} onChange={(x) => setTexto(x.target.value.slice(0, 4000))} placeholder="Escreva a sua resposta para o cliente" />
          </label>
          <button type="submit" className="btn btn-azul !py-2.5 text-sm justify-self-end" disabled={ocupado || !texto.trim()}><Icone nome="enviar" tamanho={16} />{ocupado ? "Enviando…" : "Enviar pelo WhatsApp"}</button>
        </form>
      ) : (
        <div className="eq-wa-resposta">
          <p className="text-[13px] text-[var(--muted)]">Faz mais de 24 horas que o cliente escreveu{s.janelaAte ? ` (até ${hora(s.janelaAte)})` : ""}. Agora o WhatsApp só deixa mandar um modelo aprovado; a conversa recomeça quando ele responder.</p>
          {s.modelo
            ? <button type="button" className="btn btn-tinta !py-2.5 text-sm justify-self-start" disabled={ocupado} onClick={() => void acao({ acao: "enviar_modelo" })}>Mandar o modelo “{s.modelo}”</button>
            : <p className="text-[13px] text-[var(--muted)]">Configure um modelo aprovado na aba WhatsApp.</p>}
        </div>
      ))}
      <Erro t={erro} />
    </div>
  );
}
