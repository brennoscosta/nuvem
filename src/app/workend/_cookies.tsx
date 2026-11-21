"use client";
// Aviso de cookies e carga das ferramentas de medição (WE-01 e WE-02, 21/11/2026, LGPD).
// - Antes da escolha, só o essencial: nenhum script do Google, do Meta ou do Clarity é pedido. O Consent Mode v2 do
//   Google começa negado (só na fila da página, sem rede) e vira concedido no aceite.
// - "Aceitar" e "Recusar" têm o mesmo peso; "Escolher por tipo" separa análise (GA4, Tag Manager, Clarity) e anúncios
//   (Meta Pixel). A escolha fica no cookie we_cookies (src/lib/medir.ts) e muda pelo link "Cookies" do rodapé.
// - Os IDs vêm do servidor a cada requisição (src/server/medicao.ts). Sem nenhum ID, o aviso não aparece.
// - Clarity só grava a página inicial, /cadastro e /mundo; ao sair delas sem recarregar, a gravação para.
import Script from "next/script";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { lerConsentimento, gravarConsentimento, medir, medirUmaVez, ehEvento, ligarEnvio, desligarEnvio, type Consentimento, type Evento, type Parametros } from "@/lib/medir";
import type { ConfigMedicao } from "@/server/medicao";
import "./cookies.css";

type Janela = Window & {
  dataLayer?: unknown[];
  gtag?: (...a: unknown[]) => void;
  fbq?: ((...a: unknown[]) => void) & { queue?: unknown[]; callMethod?: (...a: unknown[]) => void; loaded?: boolean; version?: string; push?: unknown };
  _fbq?: unknown;
  clarity?: ((...a: unknown[]) => void) & { q?: unknown[] };
};

// páginas que o Clarity grava (WE-02): a inicial, o cadastro e o mapa, onde fica o formulário de reserva
const CLARITY_CAMINHOS = ["/", "/cadastro", "/mundo"];
const coberto = (caminho: string) => CLARITY_CAMINHOS.includes(caminho.replace(/\/+$/, "") || "/");
const ABRIR = "we:cookies";

// a escolha guardada, lida sem erro de hidratação (no servidor não existe)
const ouvintes = new Set<() => void>();
const assinar = (cb: () => void) => { ouvintes.add(cb); return () => { ouvintes.delete(cb); }; };
const avisar = () => ouvintes.forEach((f) => f());
const fotografia = () => { const c = lerConsentimento(); return c ? `a${c.analise ? 1 : 0}m${c.anuncios ? 1 : 0}` : "nenhuma"; };
const decodificar = (s: string): Consentimento | null => (s.startsWith("a") ? { analise: s[1] === "1", anuncios: s[3] === "1" } : null);

// o que já foi ligado nesta carga da página (o componente monta de novo ao ir do site para o mapa)
const ligado = { ultimo: "", padrao: false, gtm: false, ga: false, meta: false, clarity: false, clarityParado: false, mascara: null as MutationObserver | null };

function gtag(...a: unknown[]) {
  const w = window as Janela;
  w.dataLayer ??= [];
  // eslint-disable-next-line prefer-rest-params -- o gtag.js só entende o objeto arguments
  if (!w.gtag) w.gtag = function () { (w.dataLayer as unknown[]).push(arguments); };
  w.gtag(...a);
}

// campos com dado pessoal escondidos na gravação do Clarity, inclusive os que aparecem depois (cartões do mapa)
function mascararCampos(raiz: ParentNode) {
  raiz.querySelectorAll?.("input, textarea, select, [contenteditable]").forEach((el) => { if (!el.hasAttribute("data-clarity-mask")) el.setAttribute("data-clarity-mask", "true"); });
}
function pararClarity() {
  const w = window as Janela;
  if (!ligado.clarity || ligado.clarityParado) return;
  w.clarity?.("stop"); ligado.clarityParado = true;
  ligado.mascara?.disconnect(); ligado.mascara = null;
}

// Liga o que a pessoa aceitou. Devolve quais scripts de fora a página deve pedir.
function ligar(cfg: ConfigMedicao, c: Consentimento) {
  const w = window as Janela;
  const google = !!(cfg.ga || cfg.gtm);
  const chave = `a${c.analise ? 1 : 0}m${c.anuncios ? 1 : 0}`;
  if (google && ligado.ultimo !== chave) {
    ligado.ultimo = chave;
    gtag("consent", "update", { analytics_storage: c.analise ? "granted" : "denied", ad_storage: c.anuncios ? "granted" : "denied", ad_user_data: c.anuncios ? "granted" : "denied", ad_personalization: c.anuncios ? "granted" : "denied" });
    if (!c.anuncios) gtag("set", "ads_data_redaction", true);
  }
  if (c.analise && cfg.gtm && !ligado.gtm) { (w.dataLayer ??= []).push({ "gtm.start": Date.now(), event: "gtm.js" }); ligado.gtm = true; }
  if (c.analise && cfg.ga && !ligado.ga) { gtag("js", new Date()); gtag("config", cfg.ga); ligado.ga = true; }
  if (c.anuncios && cfg.meta && !ligado.meta) {
    if (!w.fbq) {
      // eslint-disable-next-line prefer-rest-params -- igual ao trecho oficial do Meta (fila de arguments)
      const f = function () { if (f.callMethod) f.callMethod(...arguments); else f.queue.push(arguments); } as unknown as ((...a: unknown[]) => void) & { queue: unknown[]; callMethod?: (...a: unknown[]) => void; loaded: boolean; version: string; push: unknown };
      f.queue = []; f.loaded = true; f.version = "2.0"; f.push = f;
      w.fbq = f; if (!w._fbq) w._fbq = f;
    }
    w.fbq("init", cfg.meta); w.fbq("track", "PageView"); ligado.meta = true;
  }
  if (c.analise && cfg.clarity && !ligado.clarity && coberto(location.pathname)) {
    // eslint-disable-next-line prefer-rest-params -- igual ao trecho oficial do Clarity (fila de arguments)
    if (!w.clarity) { const q = function () { (q.q ??= []).push(arguments); } as unknown as ((...a: unknown[]) => void) & { q?: unknown[] }; w.clarity = q; }
    w.clarity("consentv2", { ad_Storage: c.anuncios ? "granted" : "denied", analytics_Storage: "granted" });
    mascararCampos(document);
    ligado.mascara = new MutationObserver((ms) => { for (const m of ms) m.addedNodes.forEach((n) => { if (n.nodeType === 1) { const el = n as Element; if (el.matches("input, textarea, select, [contenteditable]")) mascararCampos(el.parentNode ?? document); else mascararCampos(el); } }); });
    ligado.mascara.observe(document.body, { childList: true, subtree: true });
    ligado.clarity = true;
  }
  ligarEnvio();
}

// Recusou depois de ter aceitado: avisa as ferramentas, apaga os cookies delas e recarrega sem os scripts
function desligar(cfg: ConfigMedicao, c: Consentimento) {
  const w = window as Janela;
  desligarEnvio();
  if (cfg.ga || cfg.gtm) gtag("consent", "update", { analytics_storage: c.analise ? "granted" : "denied", ad_storage: c.anuncios ? "granted" : "denied", ad_user_data: c.anuncios ? "granted" : "denied", ad_personalization: c.anuncios ? "granted" : "denied" });
  if (!c.anuncios) w.fbq?.("consent", "revoke");
  if (!c.analise) { w.clarity?.("consent", false); pararClarity(); }
  const nomes = document.cookie.split(";").map((s) => s.split("=")[0].trim()).filter((n) => (!c.analise && /^(_ga|_gid|_gat|_clck|_clsk|CLID|MUID)/.test(n)) || (!c.anuncios && /^(_fbp|_fbc|_gcl)/.test(n)));
  const partes = location.hostname.split(".");
  const dominios = ["", ...partes.map((_, i) => "." + partes.slice(i).join(".")).filter((d) => d.split(".").length > 2)];
  for (const n of nomes) for (const d of dominios) document.cookie = `${n}=; Max-Age=0; Path=/${d ? `; Domain=${d}` : ""}`;
  location.reload();
}

export function MedicaoCliente({ cfg, lugar = "site" }: { cfg: ConfigMedicao; lugar?: "site" | "mapa" }) {
  const estado = useSyncExternalStore(assinar, fotografia, () => "servidor");
  const escolha = decodificar(estado);
  const pathname = usePathname();
  const algum = !!(cfg.ga || cfg.gtm || cfg.meta || cfg.clarity);
  const [aberto, setAberto] = useState(false); // aberto pelo link "Cookies"
  const [escolhendo, setEscolhendo] = useState(false);
  const [marcas, setMarcas] = useState<Consentimento>({ analise: false, anuncios: false });
  const [scripts, setScripts] = useState({ gtm: false, ga: false, meta: false, clarity: false });
  const [guiaAberto, setGuiaAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  // Consent Mode v2: o padrão negado vai para a fila assim que a página abre (nada sai para a rede)
  useEffect(() => {
    if (!(cfg.ga || cfg.gtm) || ligado.padrao) return;
    gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied", wait_for_update: 500 });
    ligado.padrao = true;
  }, [cfg.ga, cfg.gtm]);

  // com a escolha feita (agora ou numa visita anterior), liga o que foi aceito
  useEffect(() => {
    if (!escolha || (!escolha.analise && !escolha.anuncios)) return;
    ligar(cfg, escolha);
    const t = setTimeout(() => setScripts({ gtm: ligado.gtm, ga: ligado.ga, meta: ligado.meta, clarity: ligado.clarity && !ligado.clarityParado }), 0);
    return () => clearTimeout(t);
  }, [estado, pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- a config não muda numa carga da página

  // link "Cookies" do rodapé e item 9 das políticas
  useEffect(() => {
    const abrir = () => { const c = lerConsentimento(); setMarcas(c ?? { analise: false, anuncios: false }); setEscolhendo(true); setAberto(true); };
    window.addEventListener(ABRIR, abrir);
    return () => window.removeEventListener(ABRIR, abrir);
  }, []);
  useEffect(() => { if (aberto) caixa.current?.focus(); }, [aberto]);

  // cliques nos botões principais (data-medir) e o Clarity parando antes de ir para uma página que ele não grava
  useEffect(() => {
    const clique = (e: MouseEvent) => {
      const alvo = e.target instanceof Element ? e.target : null;
      const el = alvo?.closest<HTMLElement>("[data-medir]");
      if (el && ehEvento(el.dataset.medir)) medir(el.dataset.medir, { local: el.dataset.medirLocal, texto: (el.textContent ?? "").replace(/[→↗]/g, "").trim().slice(0, 60) });
      const a = alvo?.closest<HTMLAnchorElement>("a[href]");
      if (a && ligado.clarity) { try { const u = new URL(a.href, location.href); if (u.origin === location.origin && !coberto(u.pathname)) pararClarity(); } catch { /* link estranho */ } }
    };
    document.addEventListener("click", clique, true);
    return () => document.removeEventListener("click", clique, true);
  }, []);

  // seção que entra na tela (data-medir-ver: a do preço) e a troca de página sem recarregar
  const primeira = useRef(true);
  useEffect(() => {
    if (!primeira.current) {
      if (ligado.meta) (window as Janela).fbq?.("track", "PageView");
      if (!coberto(location.pathname)) pararClarity();
    }
    primeira.current = false;
    const vistos = new WeakSet<Element>();
    const obs = new IntersectionObserver((es) => {
      for (const e of es) {
        if (!e.isIntersecting || vistos.has(e.target)) continue;
        if (e.intersectionRatio < 0.2 && e.intersectionRect.height < window.innerHeight * 0.35) continue;
        const nome = (e.target as HTMLElement).dataset.medirVer;
        if (ehEvento(nome) && medir(nome, { pagina: location.pathname })) { vistos.add(e.target); obs.unobserve(e.target); }
      }
    }, { threshold: [0, 0.2, 0.4] });
    const t = setTimeout(() => document.querySelectorAll("[data-medir-ver]").forEach((el) => obs.observe(el)), 300);
    return () => { clearTimeout(t); obs.disconnect(); };
  }, [pathname, estado]);

  // no mapa, o aviso espera o tutorial fechar para não tampar o balão nem o alvo dele
  const pendente = algum && estado === "nenhuma";
  useEffect(() => {
    if (lugar !== "mapa" || !pendente) return;
    const ver = () => setGuiaAberto(!!document.querySelector("[data-guia-raiz]"));
    const t = setInterval(ver, 700); const t0 = setTimeout(ver, 0);
    return () => { clearInterval(t); clearTimeout(t0); };
  }, [lugar, pendente]);

  const decidir = (c: Consentimento) => {
    const antes = lerConsentimento();
    gravarConsentimento(c);
    setAberto(false); setEscolhendo(false);
    const recuou = !!antes && ((antes.analise && !c.analise) || (antes.anuncios && !c.anuncios));
    if (recuou && (ligado.ga || ligado.gtm || ligado.meta || ligado.clarity)) { desligar(cfg, c); return; }
    avisar();
  };

  const scriptsDeFora = (
    <>
      {scripts.gtm && cfg.gtm && <Script id="we-gtm" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtm.js?id=${cfg.gtm}`} />}
      {scripts.ga && cfg.ga && <Script id="we-ga" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${cfg.ga}`} />}
      {scripts.meta && <Script id="we-meta" strategy="afterInteractive" src="https://connect.facebook.net/en_US/fbevents.js" />}
      {scripts.clarity && cfg.clarity && <Script id="we-clarity" strategy="afterInteractive" src={`https://www.clarity.ms/tag/${cfg.clarity}`} />}
    </>
  );

  const mostrar = aberto || (pendente && !(lugar === "mapa" && guiaAberto));
  if (!mostrar) return scriptsDeFora;

  const ferrAnalise = [cfg.ga && "Google Analytics", cfg.gtm && "Google Tag Manager", cfg.clarity && "Microsoft Clarity"].filter(Boolean) as string[];
  const lista = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}` : l[0] ?? "");
  return (
    <>
      {scriptsDeFora}
      <div ref={caixa} tabIndex={-1} className={`ck ck-${lugar}`} role="dialog" aria-modal="false" aria-labelledby="ck-titulo" aria-describedby="ck-texto" data-cookies="">
        <p id="ck-titulo" className="ck-titulo">Cookies</p>
        {algum ? (
          <p id="ck-texto" className="ck-texto">O WorkEnd usa cookies essenciais para funcionar. Se você aceitar, usamos também cookies de análise e de anúncios para entender o uso do site e medir as nossas campanhas. <Link href="/politicas#cookies">Saiba mais</Link></p>
        ) : (
          <p id="ck-texto" className="ck-texto">Hoje o WorkEnd usa só cookies essenciais: os que mantêm você na sua conta e guardam esta escolha. <Link href="/politicas#cookies">Saiba mais</Link></p>
        )}
        {algum && escolhendo && (
          <fieldset className="ck-opcoes">
            <legend className="ck-oculto">Escolha por tipo</legend>
            <label className="ck-opcao"><input type="checkbox" checked disabled /><span><b>Essenciais</b><small>Entrar na conta e lembrar esta escolha. Sempre ligados.</small></span></label>
            {ferrAnalise.length > 0 && <label className="ck-opcao"><input type="checkbox" name="analise" checked={marcas.analise} onChange={(e) => setMarcas({ ...marcas, analise: e.target.checked })} /><span><b>Análise</b><small>{lista(ferrAnalise)}: páginas visitadas e cliques{cfg.clarity ? ", e a gravação da visita na página inicial, no cadastro e no mapa, com os dados pessoais escondidos" : ""}.</small></span></label>}
            {cfg.meta && <label className="ck-opcao"><input type="checkbox" name="anuncios" checked={marcas.anuncios} onChange={(e) => setMarcas({ ...marcas, anuncios: e.target.checked })} /><span><b>Anúncios</b><small>Meta Pixel: mede se os anúncios no Facebook e no Instagram trazem visitas e cadastros.</small></span></label>}
          </fieldset>
        )}
        {algum ? (
          <>
            <div className="ck-acoes">
              <button type="button" className="ck-btn" data-cookies-recusar="" onClick={() => decidir({ analise: false, anuncios: false })}>Recusar</button>
              <button type="button" className="ck-btn" data-cookies-aceitar="" onClick={() => decidir({ analise: true, anuncios: true })}>Aceitar</button>
            </div>
            {escolhendo
              ? <button type="button" className="ck-link" data-cookies-salvar="" onClick={() => decidir(marcas)}>Salvar a minha escolha</button>
              : <button type="button" className="ck-link" data-cookies-escolher="" onClick={() => { setMarcas(escolha ?? { analise: false, anuncios: false }); setEscolhendo(true); }}>Escolher por tipo</button>}
          </>
        ) : (
          <div className="ck-acoes ck-acoes-1"><button type="button" className="ck-btn" onClick={() => setAberto(false)}>Fechar</button></div>
        )}
      </div>
    </>
  );
}

// Evento que a página do servidor decide (cadastro concluído, loja completa): sai uma vez só por navegador
export function MedirUmaVez({ evento, chave, params }: { evento: Evento; chave: string; params?: Parametros }) {
  useEffect(() => { medirUmaVez(chave, evento, params); }, [chave, evento]); // eslint-disable-line react-hooks/exhaustive-deps -- os parâmetros vêm do servidor e não mudam
  return null;
}

// Link "Cookies" do rodapé: abre o aviso de novo para mudar a escolha
export function BotaoCookies({ className }: { className?: string }) {
  return <button type="button" className={className} data-cookies-link="" onClick={() => window.dispatchEvent(new Event(ABRIR))}>Cookies</button>;
}
