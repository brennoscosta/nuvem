"use client";
// Cartão do quiosque (20/11/2026, data/quiosques.ts): livre (o que é, o preço e "Abrir meu quiosque"), do dono (Pix,
// renovação, falar com a atendente, marca) e de outra empresa (a loja e a conversa com a atendente no balcão: a mesma
// conversa da loja, ui/ChatLoja.tsx). A reserva usa o mesmo painel "Montar minha empresa" e o mesmo Pix dos lotes.
// Também aqui: o quiosque no mapa simples (Quiosques2D) e o realce do vizinho no 2D enquanto o dono expande o terreno.
import { useEffect, useState } from "react";
import { useMundo, linkCadastro, modoMundo } from "../mundoStore";
import { useEscritorio } from "../store";
import { usePersonagem } from "../personagemStore";
import { QUIOSQUES, QUIOSQUE_POR_CHAVE, NOME_AREA_QUIOSQUE, NOME_MODELO_QUIOSQUE, PRECO_QUIOSQUE, QUIOSQUE_LARGURA, QUIOSQUE_FUNDO, balcaoDoQuiosque, ehQuiosque, type QuiosqueInfo } from "../data/quiosques";
import { nomeNicho, LOTE } from "../data/mundo";
import { PRECO_LOTE_EXTRA } from "../data/precosTerreno";
import { Icone } from "./Icone";
import { FLUTUANTE, ESTREITO } from "./estilo";
import { PixAberto, LojaNoMapa, AcoesAdminLote } from "./Lote";
import { abrirChatEquipe } from "./ChatEquipe";
import { useExpandir, vizinhoParaExpandir } from "./ExpandirTerreno";
import { BotaoCobrar } from "./Cobrar";
import { BotaoEditarPosicao } from "./EditorPosicao";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
const COR_AREA: Record<string, string> = { orlaNorte: "#0E7490", orlaCentro: "#0F8A7E", orlaSul: "#C2410C" };

// valor do quiosque para esta conta (crédito de indicação e conta admin), vindo do servidor; vale para créditos e Pix
function useValorPix(chave: string | null, ligado: boolean, versao: string) {
  const [v, setV] = useState<{ k: string; valor: number } | null>(null);
  const k = `${chave}|${versao}`;
  useEffect(() => {
    if (!ligado || !chave) return; let vivo = true;
    fetch(`/api/terrenos/${encodeURIComponent(chave)}/pagar`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (vivo && j && typeof j.valor === "number") setV({ k, valor: j.valor }); }).catch(() => {});
    return () => { vivo = false; };
  }, [chave, ligado, k]);
  return ligado && v?.k === k ? v.valor : null;
}
function useRelogio(ate: string | null | undefined) {
  const desvio = useMundo((s) => s.desvioRelogio);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { if (!ate) return; const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, [ate]);
  return ate ? Math.max(0, new Date(ate).getTime() - (agora + desvio)) : null;
}

// leva o meu personagem até o balcão (a atendente cumprimenta ao chegar, scene/Quiosques.tsx)
function irAoBalcao(k: QuiosqueInfo) {
  const [x, z] = balcaoDoQuiosque(k);
  usePersonagem.getState().irPara(x, z);
  useMundo.setState({ alvoCamera: [x, 0.5, z] });
}

export function CartaoQuiosque() {
  const chave = useMundo((s) => s.loteSelecionado);
  const k = chave ? QUIOSQUE_POR_CHAVE[chave] ?? null : null;
  const terreno = useMundo((s) => (chave ? s.terrenos[chave] : undefined));
  const meu = useMundo((s) => s.meu);
  const usuario = useMundo((s) => s.usuario);
  const admin = useMundo((s) => s.admin);
  const painel = useMundo((s) => s.painelEmpresa);
  const painelEsc = useMundo((s) => s.painelEscritorio);
  const pagamentoLigado = useMundo((s) => s.pagamentoLigado);
  const pagando = useMundo((s) => s.pagando);
  const pixAberto = useMundo((s) => !!s.pix && s.pix.lote === s.loteSelecionado && s.pix.status === "pendente");
  const agenteSelecionado = useEscritorio((s) => s.selecionado);
  const personagemAtivo = usePersonagem((s) => s.ativo);
  const ehMeu = !!terreno && !!usuario && terreno.usuarioId === usuario.id;
  const valorPix = useValorPix(chave, !!k && ehMeu, `${terreno?.status}|${terreno?.pagoAte}`);
  const resta = useRelogio(terreno?.status === "reservado" ? terreno.reservadoAte : null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirma, setConfirma] = useState(false);
  if (!k || !chave || painel || painelEsc || agenteSelecionado) return null;
  const m = useMundo.getState();
  const livre = !terreno, ativo = terreno?.status === "ativo";
  const preco = admin ? Math.round(PRECO_QUIOSQUE) / 100 : PRECO_QUIOSQUE;
  // cobrança única (frente creditos): créditos, Pix ou os dois; no servidor vira o tipo "quiosque"
  const pagar = async (creditos = false) => { setErro(null); const e = await m.pagar(1, "lote", creditos); if (e) setErro(e); };
  const atendente = terreno?.escritorio?.equipe.find((x) => x.papel === "atendente") ?? null;
  return (
    <div data-tour="cartao-loja" className={`${FLUTUANTE} ${ESTREITO} painel-entra !z-10 overflow-y-auto p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1 text-[12px] font-semibold text-[#1D4ED8]"><Icone nome="quiosque" tamanho={14} />Quiosque {k.numero}</div>
          <div className="text-lg font-bold">{livre ? "Quiosque disponível" : ehMeu ? (ativo ? terreno.empresaNome : "Seu quiosque") : terreno.empresaNome}</div>
          <div className="text-xs text-[#5B6472]">{livre ? NOME_MODELO_QUIOSQUE[k.modelo] : ativo ? `${nomeNicho(terreno.nicho)} · aberto` : "Reservado · em montagem"}</div>
          <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: COR_AREA[k.area] }}>{NOME_AREA_QUIOSQUE[k.area]}</span>
        </div>
        <button onClick={() => m.selecionarLote(null)} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5"><Icone nome="fechar" tamanho={16} /><span className="sr-only">Fechar</span></button>
      </div>

      {livre && (
        <>
          <div className="mt-3 rounded-2xl border border-[#0F766E]/20 bg-gradient-to-br from-[#E9F7F4] to-[#F7FBFA] p-3">
            <div className="text-sm font-bold leading-snug text-[#1D2128]">Um balcão com a sua marca no caminho de quem passa</div>
            <p className="mt-1 text-xs leading-snug text-[#4B5563]">Fica {k.ponto}. Toldo e letreiro com a sua logo e as suas cores, três banquinhos e a atendente de IA no balcão, conversando com quem chega e anotando os contatos.</p>
          </div>
          <div className="mt-2 rounded-2xl bg-[#F1F3F6] px-3 py-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-[#5B6472]">Mensalidade</span><span className="font-semibold">{brl(preco)}/mês</span></div>
            <div className="mt-1 flex items-center justify-between text-xs"><span className="text-[#5B6472]">Equipe</span><span className="font-semibold text-[#1D2128]">só a atendente</span></div>
            <div className="mt-1.5 text-[11px] leading-snug text-[#5B6472]">Reserva de 1 hora para pagar com créditos ou Pix, aqui no mapa. Sem pagamento, o quiosque volta a ficar livre. Quer prédio com mais gente na equipe? O lote custa {brl(PRECO_LOTE_EXTRA)}/mês.</div>
          </div>
          {usuario?.banidoEm ? (
            <div className="mt-3 rounded-xl bg-[#FDE8E8] px-3 py-2 text-xs text-[#8A2A2A]">Sua conta está suspensa por descumprir as políticas de uso. Fale com contato@workend.online.</div>
          ) : usuario ? (
            <button onClick={() => m.abrirPainel()} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0F766E] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#0c625b]">{meu && !admin ? "Trocar meu ponto por este quiosque" : <>Abrir meu quiosque aqui<Icone nome="seta" tamanho={16} traco={2.2} /></>}</button>
          ) : (
            <a href={linkCadastro(chave)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0F766E] px-3 py-2.5 text-center text-sm font-bold text-white hover:bg-[#0c625b]">Abrir meu quiosque aqui<Icone nome="seta" tamanho={16} traco={2.2} /></a>
          )}
          {!usuario && <div className="mt-2 text-center text-[11px] text-[#5B6472]">Você cria sua conta no WorkEnd e volta direto para este quiosque.{!modoMundo() && " Abre em workend.online."}</div>}
          {usuario && meu && !admin && <div className="mt-2 text-center text-[11px] text-[#5B6472]">Nesta fase cada conta tem um ponto (lote ou quiosque). Uma reserva não paga fica livre; um ponto ativo continua seu.</div>}
        </>
      )}

      {!livre && (
        <>
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#F1F3F6] px-3 py-2">
            {terreno.temLogo ? <img src={`/api/terrenos/${encodeURIComponent(chave)}/logo`} alt="" className="h-10 w-10 rounded-lg bg-white object-contain" /> : <span className="h-10 w-10 rounded-lg" style={{ background: terreno.cor }} />}
            <div className="text-sm">
              <div className="font-semibold">{terreno.empresaNome}</div>
              <div className="text-xs text-[#5B6472]">{ativo ? `Aberto · até ${terreno.pagoAte ? dataBR(terreno.pagoAte) : "—"}` : resta != null ? `Reservado · expira em ${mmss(resta)}` : "Reservado"}</div>
            </div>
          </div>
          {ehMeu && <PixAberto chave={chave} />}
          {ehMeu && !ativo && !pixAberto && (
            <>
              <div className="mt-3 rounded-2xl bg-[#FFF4D6] px-3 py-2 text-xs text-[#7A5A00]">Garanta o quiosque pagando o 1º mês agora. Sem pagamento, a reserva some em {resta != null ? mmss(resta) : "1 hora"}.</div>
              <BotaoCobrar valor={valorPix ?? preco} rotuloPix={`Pagar ${brl(valorPix ?? preco)} no Pix · 1º mês`} rotuloCreditos="Pagar o 1º mês com créditos" pagando={pagando} pixLigado={pagamentoLigado} onPagar={(c) => void pagar(c)} />
              <div className="mt-2 flex gap-2">
                <button onClick={() => m.abrirPainel()} className="flex-1 rounded-xl bg-[#F1F3F6] px-3 py-2 text-sm font-semibold text-[#1D4ED8]">Editar o letreiro</button>
                {confirma
                  ? <button onClick={() => { void m.desistir().then((e) => { if (e) window.alert(e); }); setConfirma(false); }} className="rounded-xl bg-[#E2575B] px-3 py-2 text-sm font-bold text-white">Confirmar</button>
                  : <button onClick={() => setConfirma(true)} className="rounded-xl bg-[#F1F3F6] px-3 py-2 text-sm font-semibold text-[#5B6472]">Desistir</button>}
              </div>
            </>
          )}
          {ehMeu && ativo && (
            <>
              {pagamentoLigado && !pixAberto && <BotaoCobrar valor={valorPix ?? preco} rotuloPix={`Renovar +30 dias · ${brl(valorPix ?? preco)} no Pix`} rotuloCreditos="Renovar +30 dias" pagando={pagando} compacto onPagar={(c) => void pagar(c)} />}
              <button type="button" onClick={() => void abrirChatEquipe(chave)} className="mt-2 block w-full rounded-xl bg-[#1D2128] px-3 py-2.5 text-center text-sm font-bold text-white hover:bg-black"><Icone nome="conversar" tamanho={17} className="mr-1 inline align-[-3px]" />Falar com {atendente?.nome ?? "a atendente"}</button>
              {/* 21/11/2026: girar e ajustar o quiosque no terreninho (modo "Editar posição", ui/EditorPosicao.tsx) */}
              <BotaoEditarPosicao chave={chave} className="mt-2" />
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-center text-[12px] font-semibold">
                <button onClick={() => m.abrirPainel()} className="rounded-xl bg-[#EEF3FF] px-2 py-2 text-[#1D4ED8] hover:bg-[#dfe8ff]"><Icone nome="brilho" tamanho={15} className="mr-1 inline align-[-3px]" />Marca e logo</button>
                <a href={`/loja/${k.numero}`} target="_blank" rel="noreferrer" className="rounded-xl bg-[#EEF3FF] px-2 py-2 text-[#1D4ED8] hover:bg-[#dfe8ff]"><Icone nome="sacola" tamanho={15} className="mr-1 inline align-[-3px]" />Página da loja</a>
                <a href="/app/vitrine" className="rounded-xl bg-[#F1F3F6] px-2 py-2 text-[#1D2128] hover:bg-[#EEF3FF]">Vitrine</a>
                <a href="/app/resultados" className="rounded-xl bg-[#F1F3F6] px-2 py-2 text-[#1D2128] hover:bg-[#EEF3FF]">Resultados</a>
              </div>
              <div className="mt-2 text-[11px] leading-snug text-[#5B6472]">O quiosque vem só com a atendente{atendente ? ` (${atendente.nome})` : ""}, que atende no balcão.</div>
            </>
          )}
          {erro && <div className="mt-2 text-xs font-semibold text-[#E2575B]">{erro}</div>}
          {!ehMeu && ativo && (
            <>
              {personagemAtivo
                ? <button type="button" onClick={() => irAoBalcao(k)} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#EEF3FF] px-3 py-2 text-sm font-bold text-[#1D4ED8] hover:bg-[#dfe8ff]"><Icone nome="pessoa" tamanho={16} />Ir ao balcão</button>
                : <button type="button" onClick={() => usePersonagem.getState().abrir("montar")} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#EEF3FF] px-3 py-2 text-sm font-bold text-[#1D4ED8] hover:bg-[#dfe8ff]"><Icone nome="pessoa" tamanho={16} />Crie seu personagem para ir ao balcão</button>}
              <LojaNoMapa numero={k.numero} ativo chave={chave} />
            </>
          )}
          {!ehMeu && !ativo && <div className="mt-3 text-xs text-[#5B6472]">Esta empresa está montando o quiosque. O balcão abre quando o 1º mês for pago.</div>}
          {admin && <AcoesAdminLote chave={chave} />}
        </>
      )}
    </div>
  );
}

// ---------- mapa simples (2D) ----------
export function Quiosques2D() {
  const terrenos = useMundo((s) => s.terrenos);
  const sel = useMundo((s) => s.loteSelecionado);
  return (
    <g>
      {QUIOSQUES.map((k) => {
        const t = terrenos[k.chave], ativo = t?.status === "ativo";
        // 21/11/2026: no tamanho de verdade (4,2 × 3 m mais o deque) e com o terreninho de 6,4 × 6 m em volta
        const w = QUIOSQUE_LARGURA + 0.4, d = QUIOSQUE_FUNDO + 0.6, rot = (-k.rot * 180) / Math.PI, tr = k.terreno;
        const cor = ativo ? t.cor : t ? "#E0A91B" : "#FFFFFF";
        return (
          <g key={k.chave} className="cursor-pointer" onClick={() => useMundo.getState().selecionarLote(k.chave)} role="button" aria-label={t ? `${t.empresaNome}, quiosque ${k.numero}` : `Quiosque ${k.numero} disponível`}>
            <rect x={tr.x0} y={tr.z0} width={tr.x1 - tr.x0} height={tr.z1 - tr.z0} rx={0.4} fill="#E7E0D2" stroke="#B9AE98" strokeWidth={0.25} />
            <g transform={`translate(${k.pos[0]} ${k.pos[1]}) rotate(${rot})`}>
              <rect x={-w / 2 + 0.4} y={-d / 2 + 0.5} width={w} height={d} rx={0.6} fill="#000" opacity={0.18} />
              <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={0.6} fill={cor} stroke={t ? "#FFFFFF" : "#0F766E"} strokeWidth={0.35} strokeDasharray={t && !ativo ? "1 0.6" : undefined} />
              {/* toldo na frente, listrado */}
              {[0, 1, 2, 3].map((i) => <rect key={i} x={-w / 2 + (i * w) / 4} y={d / 2 - 0.2} width={w / 4} height={1.1} fill={i % 2 ? "#FFFFFF" : ativo ? t.cor : "#0F766E"} opacity={0.95} />)}
              {sel === k.chave && <rect x={-w / 2 - 0.6} y={-d / 2 - 0.6} width={w + 1.2} height={d + 2} rx={1} fill="none" stroke="#FFFFFF" strokeWidth={0.6} className="mapa2d-sel" />}
            </g>
            <text x={k.pos[0]} y={k.pos[1] + 0.7} textAnchor="middle" fontSize={1.6} fontWeight={900} fill={ativo ? "#FFFFFF" : "#0F3D38"} style={{ pointerEvents: "none" }}>{k.numero}</text>
            {t && <text x={k.pos[0]} y={k.pos[1] - d / 2 - 1.2} textAnchor="middle" fontSize={1.8} fontWeight={800} fill="#1D2128" stroke="#FFFFFF" strokeWidth={0.5} paintOrder="stroke" style={{ pointerEvents: "none" }}>{t.empresaNome.slice(0, 18)}</text>}
          </g>
        );
      })}
    </g>
  );
}
// realce do vizinho livre no 2D enquanto o dono expande o terreno (ui/ExpandirTerreno.tsx)
export function RealceExpansao2D() {
  const principal = useExpandir((s) => s.principal);
  const terrenos = useMundo((s) => s.terrenos);
  if (!principal || ehQuiosque(principal)) return null;
  const { lote: v, livre } = vizinhoParaExpandir(principal, terrenos);
  if (!v) return null;
  const s = LOTE - 1.2, [x, z] = v.centro;
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x={x - s / 2} y={z - s / 2} width={s} height={s} rx={2} fill={livre ? "#22C55E" : "#9AA3AE"} fillOpacity={0.22} stroke={livre ? "#16A34A" : "#5B6472"} strokeWidth={0.9} strokeDasharray="2.4 1.4" className={livre ? "mapa2d-pisca" : ""} />
      <text x={x} y={z + 1} textAnchor="middle" fontSize={2.6} fontWeight={900} fill={livre ? "#166534" : "#374151"}>{livre ? `Lote ${v.numero} livre` : `Lote ${v.numero} ocupado`}</text>
    </g>
  );
}
