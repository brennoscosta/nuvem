"use client";
// Anunciar na cidade (20/11/2026, "que a praça gere lucro para nós"): o dono compra e agenda aqui o anúncio de 15 s no
// telão da Praça de Eventos, o evento em destaque e o patrocínio da praça, com a prévia de como fica. O conteúdo é um
// modelo pronto (logo, nome e frase) ou uma imagem/vídeo curto. Paga com créditos, Pix ou os dois (botão único da frente
// creditos, office/ui/Cobrar.tsx); entra na grade depois da aprovação do admin.
import { useCallback, useEffect, useRef, useState } from "react";
import { Icone } from "@/office/ui/Icone";
import { BotaoCobrar } from "@/office/ui/Cobrar";
import { useCreditos, novoIdem, fmtCreditos } from "@/office/creditosStore";
import {
  DIAS_PATROCINIO, DIAS_TELAO, MAX_FRASE_TELAO, MAX_IMAGEM_KB, MAX_VIDEO_KB, MAX_VIDEO_S, NOME_TIPO, PRECO_EVENTO_DESTAQUE, PRECO_PATROCINIO,
  PRECO_TELAO_DIA, SEGUNDOS_SLOT, TIPOS_IMAGEM, TIPOS_VIDEO, precoAnuncio, type FormatoAnuncio, type TipoAnuncio,
} from "@/office/data/telao";
import { PRECO_OUTDOOR, DIAS_OUTDOOR } from "@/office/data/outdoors";
import { desenharAnuncio, desenharEventoDestaque, desenharPatrocinio, desenharPlaca, imagemPronta } from "@/office/telaoDesenho";

export type MarcaDivulgar = { empresa: string; cor: string; logo: string | null; numero: number | null };
interface Meu { id: string; tipo: TipoAnuncio; formato: FormatoAnuncio; frase: string; inicio: string; dias: number; valor: string; status: string; motivo: string; eventoTitulo: string | null; reservadoAte: string | null }
interface Painel { anuncios: Meu[]; eventos: { id: string; titulo: string; inicio: string; fim: string; destacado: boolean }[]; patrocinioLivreDesde: string; hoje: string; pagamento: boolean }
interface Pix { id: string; valor: number; codigo: string; qrBase64: string; expiraEm: string; anuncio: string; status: "pendente" | "aprovado" | "falhou"; creditos?: number }
type Opcao = TipoAnuncio | "outdoor";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dm = (iso: string) => { const [, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}`; };
const somaDias = (iso: string, n: number) => { const x = new Date(`${iso}T12:00:00-03:00`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const quandoEvento = (s: string) => new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(".", "");
const OPCOES: { id: Opcao; nome: string; preco: string; texto: string }[] = [
  { id: "telao", nome: "Telão da praça", preco: `${brl(PRECO_TELAO_DIA)} por dia`, texto: `${SEGUNDOS_SLOT} segundos na rotação do telão da Praça de Eventos, o dia inteiro.` },
  { id: "destaque", nome: "Evento em destaque", preco: `${brl(PRECO_EVENTO_DESTAQUE)} por evento`, texto: "A sua live ou lançamento chamado no telão nas 48 h antes e o balão da praça dourado no mapa." },
  { id: "patrocinio", nome: "Patrocínio da praça", preco: `${brl(PRECO_PATROCINIO)} por ${DIAS_PATROCINIO} dias`, texto: "O nome da sua empresa na placa da praça e no telão (no Natal, o “Natal na Praça” leva o seu nome). Uma vaga só." },
  { id: "outdoor", nome: "Outdoor nas avenidas", preco: `${brl(PRECO_OUTDOOR)} a cada ${DIAS_OUTDOOR} dias`, texto: "6 outdoors de 14,4 × 7,2 m na borda da cidade, com a sua logo, o nome e uma frase." },
];

function PixBox({ pix, aoMudar, aoFechar }: { pix: Pix; aoMudar: (p: Pix) => void; aoFechar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const conferir = useCallback(async () => {
    const j = await fetch(`/api/pagamentos/${encodeURIComponent(pix.id)}`, { method: "POST" }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as { status?: string } | null;
    if (j?.status === "aprovado") aoMudar({ ...pix, status: "aprovado" });
    else if (j?.status && ["rejeitado", "cancelado", "estornado"].includes(j.status)) aoMudar({ ...pix, status: "falhou" });
  }, [pix, aoMudar]);
  useEffect(() => { if (pix.status !== "pendente") return; const t = setInterval(() => void conferir(), 4000); return () => clearInterval(t); }, [pix.status, conferir]);
  if (pix.status === "aprovado") return (
    <div data-pix-aprovado className="mt-4 rounded-2xl bg-[#E3F6EA] px-4 py-3 text-sm text-[#166534]">
      <div className="font-bold"><Icone nome="check" tamanho={16} className="mr-1 inline align-[-3px]" />{pix.valor > 0 ? "Pix recebido" : `Pago com ${fmtCreditos(pix.creditos ?? 0)} créditos`}</div>
      <p className="mt-1">O anúncio entra na grade assim que a equipe do WorkEnd aprovar. Você recebe o aviso no sino.</p>
      <button type="button" onClick={aoFechar} className="mt-2 rounded-xl bg-[#16A34A] px-3 py-1.5 text-xs font-bold text-white">Entendi</button>
    </div>
  );
  if (pix.status === "falhou") return <div className="mt-4 rounded-2xl bg-[#FDE8E8] px-4 py-3 text-sm text-[#8A2A2A]">O pagamento não foi aprovado. Gere outro Pix na lista “Meus anúncios”. <button type="button" onClick={aoFechar} className="ml-1 underline">Fechar</button></div>;
  const copiar = async () => { try { await navigator.clipboard.writeText(pix.codigo); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { window.prompt("Copie o código Pix:", pix.codigo); } };
  return (
    <div data-pix className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-[#16A34A]/30 bg-[#F3FBF5] p-4 text-sm">
      {pix.qrBase64 && <img src={`data:image/png;base64,${pix.qrBase64}`} alt="QR Code do Pix" className="h-36 w-36 rounded-xl bg-white p-1" />}
      <div className="min-w-0 flex-1 basis-56">
        <div className="font-bold text-[#166534]">Pague {brl(pix.valor)} no Pix</div>
        <p className="mt-1 text-xs text-[#5B6472]">No app do banco: Pix → ler QR Code, ou copie o código. O QR vale 1 hora e a sua vaga fica guardada enquanto isso.</p>
        {(pix.creditos ?? 0) > 0 && <p className="mt-1 text-xs text-[#166534]">{fmtCreditos(pix.creditos ?? 0)} créditos já estão reservados para este anúncio. Se o Pix não for pago, eles voltam para a sua carteira.</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={copiar} className="rounded-xl bg-[#16A34A] px-3 py-2 text-xs font-bold text-white">{copiado ? "Código copiado" : "Copiar código Pix"}</button>
          <button type="button" onClick={() => void conferir()} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#1D4ED8]">Já paguei</button>
        </div>
      </div>
    </div>
  );
}

function Telao({ children, rotulo }: { children: React.ReactNode; rotulo: string }) {
  // o telão de verdade: tela 16:9 na estrutura preta, em cima do palco de madeira
  return (
    <figure className="rounded-2xl bg-[#161C25] p-4 text-white">
      <div className="mx-auto max-w-[560px]">
        <div className="rounded-md bg-[#111418] p-1.5 shadow-lg">{children}</div>
        <div className="flex justify-between px-[7%]" aria-hidden><i className="block h-5 w-1.5 bg-[#2B2F36]" /><i className="block h-5 w-1.5 bg-[#2B2F36]" /></div>
        <div className="h-3 rounded-sm bg-[#3B2A1E]" aria-hidden />
      </div>
      <figcaption className="mt-2 text-center text-[12px] text-white/70">{rotulo}</figcaption>
    </figure>
  );
}

export function AnunciarNaPraca({ marca }: { marca: MarcaDivulgar }) {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [opcao, setOpcao] = useState<Opcao>("telao");
  const [formato, setFormato] = useState<FormatoAnuncio>("modelo");
  const [frase, setFrase] = useState("");
  const [inicio, setInicio] = useState("");
  const [dias, setDias] = useState(1);
  const [eventoId, setEventoId] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [urlArquivo, setUrlArquivo] = useState<string | null>(null);
  const [duracao, setDuracao] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pix, setPix] = useState<Pix | null>(null);
  const tela = useRef<HTMLCanvasElement>(null), placa = useRef<HTMLCanvasElement>(null);

  const carregar = useCallback(async () => {
    const j = await fetch("/api/workend/telao/meus", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as Painel | null;
    if (j) setPainel(j);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      void carregar();
      // ?destaque=<evento> (vindo do cartão da praça) já abre o destaque com o evento escolhido
      const q = new URLSearchParams(window.location.search); const ev = q.get("destaque"); if (ev) { setOpcao("destaque"); setEventoId(ev); }
      else if (q.get("anunciar") === "patrocinio") setOpcao("patrocinio");
    }, 0);
    return () => clearTimeout(t);
  }, [carregar]);
  const tipo: TipoAnuncio | null = opcao === "outdoor" ? null : opcao;
  const minimo = painel ? (tipo === "patrocinio" && painel.patrocinioLivreDesde > painel.hoje ? painel.patrocinioLivreDesde : painel.hoje) : "";
  const dataInicio = inicio && inicio >= minimo ? inicio : minimo;
  const eventos = painel?.eventos ?? [];
  const evento = eventos.find((e) => e.id === eventoId) ?? eventos.find((e) => !e.destacado) ?? null;
  const total = tipo ? precoAnuncio(tipo, dias) : 0;

  // arquivo escolhido: endereço local para a prévia (e a duração, se for vídeo)
  useEffect(() => {
    if (!arquivo) return;
    const u = URL.createObjectURL(arquivo); const t = setTimeout(() => setUrlArquivo(u), 0);
    return () => { clearTimeout(t); URL.revokeObjectURL(u); };
  }, [arquivo]);
  const escolher = (f: File | null) => {
    setErro(null); setDuracao(null); setUrlArquivo(null);
    if (!f) { setArquivo(null); return; }
    const img = formato === "imagem";
    if (!(img ? TIPOS_IMAGEM : TIPOS_VIDEO).includes(f.type)) { setErro(img ? "A imagem precisa ser PNG, JPG ou WEBP." : "O vídeo precisa ser MP4 ou WEBM."); return; }
    if (f.size > (img ? MAX_IMAGEM_KB : MAX_VIDEO_KB) * 1024) { setErro(`Arquivo grande demais: até ${((img ? MAX_IMAGEM_KB : MAX_VIDEO_KB) / 1024).toFixed(1).replace(".", ",")} MB.`); return; }
    setArquivo(f);
  };

  // prévia: o mesmo desenho do telão da cidade
  const nomeEvento = evento?.titulo ?? "O seu evento no palco";
  useEffect(() => {
    const c = tela.current; if (!c || !tipo) return;
    const g = c.getContext("2d")!; const W = c.width, H = c.height;
    const pintar = () => {
      g.clearRect(0, 0, W, H);
      const logo = imagemPronta(marca.logo, pintar);
      if (tipo === "patrocinio") desenharPatrocinio(g, W, H, { id: "previa", nome: marca.empresa, cor: marca.cor, logo: marca.logo, numero: marca.numero, chave: null, frase, ate: "" }, logo, false);
      else if (tipo === "destaque") { const ini = evento?.inicio ?? new Date(Date.now() + 86400_000).toISOString(); desenharEventoDestaque(g, W, H, { titulo: nomeEvento, nome: marca.empresa, cor: marca.cor, frase, inicio: ini, fim: evento?.fim ?? ini }, logo, 0); }
      else desenharAnuncio(g, W, H, { nome: marca.empresa, cor: marca.cor, frase, numero: marca.numero, formato: formato === "imagem" ? "imagem" : "modelo" }, logo, formato === "imagem" ? imagemPronta(urlArquivo, pintar) : null);
      const p = placa.current; if (p && tipo === "patrocinio") desenharPlaca(p.getContext("2d")!, p.width, p.height, { id: "previa", nome: marca.empresa, cor: marca.cor, logo: marca.logo, numero: marca.numero, chave: null, frase, ate: "" }, logo, brl(PRECO_PATROCINIO));
    };
    pintar();
  }, [tipo, formato, frase, urlArquivo, marca, nomeEvento, evento]);

  const saldoCreditos = useCreditos((s) => s.saldo?.total ?? 0);
  const comprar = async (creditos = false) => {
    if (!tipo) return;
    setErro(null);
    if (formato !== "modelo" && !arquivo) { setErro(formato === "imagem" ? "Escolha a imagem do anúncio." : "Escolha o vídeo do anúncio."); return; }
    if (formato === "video" && duracao != null && duracao > MAX_VIDEO_S + 0.5) { setErro(`O vídeo tem ${Math.round(duracao)} s: use até ${MAX_VIDEO_S} s.`); return; }
    if (tipo === "destaque" && !evento) { setErro("Marque um evento no palco primeiro."); return; }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.set("tipo", tipo); fd.set("formato", formato); fd.set("frase", frase); fd.set("inicio", dataInicio); fd.set("dias", String(dias));
      if (tipo === "destaque" && evento) fd.set("eventoId", evento.id);
      if (formato !== "modelo" && arquivo) fd.set("arquivo", arquivo);
      const r = await fetch("/api/workend/telao", { method: "POST", body: fd }); const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.erro ?? `Erro ${r.status}`); return; }
      await pagar(j.id, creditos);
    } finally { setEnviando(false); }
  };
  // cobrança única: { creditos } decide no servidor (tudo em créditos, créditos + Pix ou só Pix); idem segura o clique repetido
  const pagar = async (id: string, creditos = false) => {
    setErro(null);
    const r = await fetch(`/api/workend/telao/${encodeURIComponent(id)}/pagar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ creditos, idem: novoIdem() }) }); const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErro(j.erro ?? `Erro ${r.status}`); await carregar(); return; }
    setPix({ id: j.id, valor: j.valor, codigo: j.codigo, qrBase64: j.qrBase64, expiraEm: j.expiraEm, anuncio: id, status: j.status === "aprovado" ? "aprovado" : "pendente", creditos: j.creditos ?? 0 });
    void useCreditos.getState().carregar();
    await carregar();
  };
  const cancelar = async (id: string) => { if (!window.confirm("Cancelar este anúncio? A vaga volta a ficar livre.")) return; await fetch(`/api/workend/telao/${encodeURIComponent(id)}`, { method: "DELETE" }); if (pix?.anuncio === id) setPix(null); await carregar(); };
  const mudarPix = useCallback((p: Pix) => { setPix(p); if (p.status === "aprovado") void carregar(); }, [carregar]);

  const op = OPCOES.find((o) => o.id === opcao)!;
  const campo = "mt-1 w-full rounded-xl border border-[var(--linha)] bg-white px-3 py-2 text-[16px] font-normal text-[var(--tinta)] outline-none focus:border-[var(--azul)]";
  return (
    <section id="praca" data-anunciar className="faixa mt-14">
      <span className="pg-rotulo"><Icone nome="microfone" tamanho={15} />Anunciar na cidade</span>
      <h2 className="mt-2 !text-[1.6rem]">A sua marca na praça e nas avenidas</h2>
      <p className="mt-1 max-w-[70ch] text-[15px] text-[var(--tinta-2)]">O telão da Praça de Eventos roda o dia inteiro, em fatias de {SEGUNDOS_SLOT} segundos, para quem passa pela praça no mapa. Escolha o que quer, veja a prévia e pague com créditos ou Pix. Todo anúncio passa por uma conferência rápida da equipe do WorkEnd antes de entrar no ar.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div role="tablist" aria-label="O que anunciar" className="grid grid-cols-2 gap-2 lg:grid-cols-1 lg:content-start">
          {OPCOES.map((o) => (
            <button key={o.id} type="button" role="tab" aria-selected={opcao === o.id} data-opcao={o.id} onClick={() => { setOpcao(o.id); setErro(null); }}
              className={`rounded-xl border-l-4 px-3 py-2.5 text-left transition ${opcao === o.id ? "border-[var(--azul)] bg-[var(--cinza)]" : "border-transparent hover:bg-[var(--cinza)]"}`}>
              <b className="block text-[15px] leading-tight">{o.nome}</b><span className="text-[13px] text-[var(--tinta-2)]">{o.preco}</span>
            </button>
          ))}
        </div>

        <div className="min-w-0">
          <p className="text-[15px] text-[var(--tinta-2)]">{op.texto}</p>
          {opcao === "outdoor" ? (
            <div className="mt-4 rounded-2xl bg-[var(--cinza)] p-5">
              <video className="block aspect-video w-full max-w-[560px] rounded-xl bg-black" controls muted playsInline preload="metadata" poster="/workend/outdoor/anuncie-outdoor.jpg">
                <source src="/workend/outdoor/anuncie-outdoor.mp4" type="video/mp4" /><source src="/workend/outdoor/anuncie-outdoor.webm" type="video/webm" />
              </video>
              <p className="mt-3 text-[15px]">Os outdoors são escolhidos e pagos no mapa: clique num outdoor livre nas avenidas da borda da cidade.</p>
              <a href="/mundo" className="btn btn-azul mt-3 inline-block !px-4 !py-2.5">Escolher um outdoor no mapa</a>
            </div>
          ) : (
            <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div className="min-w-0">
                {tipo === "destaque" && (
                  eventos.length ? (
                    <label className="block text-[14px] font-semibold">Qual evento
                      <select value={evento?.id ?? ""} onChange={(e) => setEventoId(e.target.value)} className={campo}>
                        {eventos.map((e) => <option key={e.id} value={e.id} disabled={e.destacado}>{e.titulo} · {quandoEvento(e.inicio)}{e.destacado ? " (já em destaque)" : ""}</option>)}
                      </select>
                    </label>
                  ) : <p className="rounded-xl bg-[#FFF4DB] px-3 py-2 text-[14px] text-[#7A5200]">Marque primeiro o seu evento no palco, de graça: no mapa, clique na Praça de Eventos. <a href="/mundo?lote=0,1,1" className="font-semibold underline">Abrir a praça</a></p>
                )}
                {tipo !== "patrocinio" && (
                  <fieldset className="mt-3">
                    <legend className="text-[14px] font-semibold">Conteúdo</legend>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {([["modelo", "Modelo pronto"], ["imagem", "Enviar imagem"], ["video", "Enviar vídeo"]] as const).map(([f, n]) => (
                        <button key={f} type="button" data-formato={f} aria-pressed={formato === f} onClick={() => { setFormato(f); setArquivo(null); setUrlArquivo(null); setErro(null); }} className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${formato === f ? "border-[var(--azul)] bg-[var(--azul)] text-white" : "border-[var(--linha)] bg-white"}`}>{n}</button>
                      ))}
                    </div>
                    <p className="mt-1 text-[13px] text-[var(--tinta-2)]">{formato === "modelo" ? "Usa a logo, o nome e a cor da sua loja, com a frase abaixo." : formato === "imagem" ? `PNG, JPG ou WEBP de até ${(MAX_IMAGEM_KB / 1024).toFixed(1).replace(".", ",")} MB, de preferência 16:9 (1280 × 720).` : `MP4 ou WEBM de até ${MAX_VIDEO_S} s e ${(MAX_VIDEO_KB / 1024).toFixed(1).replace(".", ",")} MB, 16:9, sem som (o telão é mudo).`}</p>
                    {formato !== "modelo" && <input type="file" accept={(formato === "imagem" ? TIPOS_IMAGEM : TIPOS_VIDEO).join(",")} onChange={(e) => escolher(e.target.files?.[0] ?? null)} className="mt-2 block w-full text-[14px]" />}
                  </fieldset>
                )}
                <label className="mt-3 block text-[14px] font-semibold">{tipo === "patrocinio" ? "Frase (opcional)" : "Frase"} ({frase.length}/{MAX_FRASE_TELAO})
                  <input value={frase} onChange={(e) => setFrase(e.target.value.slice(0, MAX_FRASE_TELAO))} placeholder={tipo === "destaque" ? "Ex.: sorteio ao vivo para quem assistir" : "Ex.: pão quentinho todo dia às 6h"} className={campo} />
                </label>
                {tipo !== "destaque" && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="block text-[14px] font-semibold">Começa em<input type="date" min={minimo} value={dataInicio} onChange={(e) => setInicio(e.target.value)} className={campo} /></label>
                    {tipo === "telao" ? (
                      <label className="block text-[14px] font-semibold">Por quantos dias<select value={dias} onChange={(e) => setDias(Number(e.target.value))} className={campo}>{DIAS_TELAO.map((d) => <option key={d} value={d}>{d} dia{d > 1 ? "s" : ""} · {brl(precoAnuncio("telao", d))}</option>)}</select></label>
                    ) : <div className="text-[14px]"><b className="block">Até</b><span className="mt-2 block text-[var(--tinta-2)]">{dataInicio ? dm(somaDias(dataInicio, DIAS_PATROCINIO - 1)) : "—"} ({DIAS_PATROCINIO} dias)</span></div>}
                  </div>
                )}
                {tipo === "patrocinio" && painel && painel.patrocinioLivreDesde > painel.hoje && <p className="mt-2 text-[13px] text-[var(--tinta-2)]">A praça já tem patrocinador até {dm(painel.patrocinioLivreDesde)}: o seu período começa a partir desse dia.</p>}
                {erro && <div role="alert" className="mt-3 rounded-xl bg-[#FDE8E8] px-3 py-2 text-[14px] text-[#8A2A2A]">{erro}</div>}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {painel && <BotaoCobrar classe="w-full max-w-xs" valor={total} rotuloPix={`Pagar ${brl(total)} no Pix`} rotuloCreditos="Pagar com créditos" pagando={enviando} pixLigado={painel.pagamento !== false} dados={{ "data-comprar": "" }} onPagar={(c) => void comprar(c)} />}
                  <span className="text-[13px] text-[var(--tinta-2)]">{tipo === "telao" ? `${dias} dia${dias > 1 ? "s" : ""} a partir de ${dataInicio ? dm(dataInicio) : "hoje"}` : tipo === "destaque" ? (evento ? `chamada desde 48 h antes de ${quandoEvento(evento.inicio)}` : "") : `${DIAS_PATROCINIO} dias`}</span>
                </div>
                {pix && <PixBox pix={pix} aoMudar={mudarPix} aoFechar={() => setPix(null)} />}
              </div>
              <div className="min-w-0 space-y-3">
                <Telao rotulo={`Prévia do telão da Praça de Eventos · ${NOME_TIPO[tipo!]}${tipo === "telao" ? ` · ${SEGUNDOS_SLOT} s na rotação` : ""}`}>
                  {formato === "video" && tipo !== "patrocinio" && urlArquivo
                    ? <video src={urlArquivo} muted autoPlay loop playsInline onLoadedMetadata={(e) => setDuracao(e.currentTarget.duration)} className="block aspect-video w-full rounded bg-black object-cover" />
                    : <canvas ref={tela} width={1024} height={576} data-previa-telao className="block aspect-video w-full rounded" />}
                </Telao>
                {tipo === "patrocinio" && (
                  <figure className="rounded-2xl bg-[var(--cinza)] p-4">
                    <canvas ref={placa} width={768} height={320} data-previa-placa className="mx-auto block w-full max-w-[420px] rounded-md shadow" />
                    <figcaption className="mt-2 text-center text-[12px] text-[var(--tinta-2)]">Prévia da placa na entrada da praça</figcaption>
                  </figure>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-10">
        <h3 className="text-[1.15rem] font-semibold">Meus anúncios na praça</h3>
        {!painel ? <p className="mt-2 text-[14px] text-[var(--tinta-2)]">Carregando…</p> : painel.anuncios.length === 0 ? <p className="mt-2 text-[14px] text-[var(--tinta-2)]">Nenhum ainda.</p> : (
          <ul className="mt-3 divide-y divide-[var(--linha)] rounded-2xl border border-[var(--linha)]">
            {painel.anuncios.map((a) => {
              const ate = somaDias(a.inicio, a.dias - 1);
              const situacao = a.status === "aguardando_pagamento" ? "Falta o Pix" : a.status === "em_analise" ? "Pago · em análise" : a.status === "aprovado" ? (a.inicio > painel.hoje ? `Agendado para ${dm(a.inicio)}` : ate < painel.hoje ? "Terminou" : `No ar até ${dm(ate)}`) : a.status === "recusado" ? `Recusado: ${a.motivo}. O Pix será devolvido.` : a.status === "estornado" ? "Pagamento estornado" : a.status;
              const cor = a.status === "aprovado" ? "bg-[#E3F6EA] text-[#166534]" : a.status === "recusado" || a.status === "estornado" ? "bg-[#FDE8E8] text-[#8A2A2A]" : "bg-[#FFF4DB] text-[#7A5200]";
              return (
                <li key={a.id} data-meu-anuncio={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-[14px]">
                  <div className="min-w-0 flex-1 basis-56">
                    <b>{NOME_TIPO[a.tipo]}</b> <span className="text-[var(--tinta-2)]">· {a.tipo === "destaque" ? a.eventoTitulo ?? "evento" : a.tipo === "telao" ? `${dm(a.inicio)}, ${a.dias} dia${a.dias > 1 ? "s" : ""}` : `${dm(a.inicio)} a ${dm(ate)}`} · {brl(Number(a.valor))}</span>
                    {a.frase && <div className="truncate text-[13px] text-[var(--tinta-2)]">“{a.frase}”</div>}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${cor}`}>{situacao}</span>
                  {a.status === "aguardando_pagamento" && (painel.pagamento || saldoCreditos > 0) && <button type="button" onClick={() => void pagar(a.id, saldoCreditos > 0)} className="text-[13px] font-semibold text-[var(--azul)]">{saldoCreditos > 0 ? "Pagar (créditos primeiro)" : "Pagar"}</button>}
                  {a.status === "aguardando_pagamento" && <button type="button" onClick={() => void cancelar(a.id)} className="text-[13px] text-[#8A2A2A]">Cancelar</button>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
