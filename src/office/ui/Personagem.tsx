"use client";
// UI do personagem: montar/pagar (nome, gênero, tipo, bio, redes), ficha de outro personagem com as opções
// (conversar, negociar, fazer uma call, amizade), chat (com propostas) e caixa de entrada. Desde 12/11/2026: roupas e
// acessórios do personagem (Pix por item) e os selos das missões de visitante na ficha. 20/11/2026: editor completo
// (corpo, rosto, cabelo, roupa, acessórios grátis e pagos, uniforme da empresa) no painel "Meu personagem".
import { useEffect, useRef, useState } from "react";
import { usePersonagem, type Redes, type Outro, type Mensagem, type Perfil } from "../personagemStore";
import { NICHOS } from "../data/mundo";
import { useMundo, type Terreno } from "../mundoStore";
import { TIPOS_AVATAR, bonecoDe, codificarVisual, visualCompleto, ESTILOS_CABELO, BARBAS, TRAJES_CIMA, BAIXOS, SAPATOS, ALTURAS, BIOTIPOS, OLHOS, SOBRANCELHAS, BOCAS, MARCAS, MODELOS_OCULOS, PELES, CORES_CABELO, CORES_OLHOS, CORES_ROUPA, CORES_CALCA, CORES_CALCADO, COR_JEANS, type Genero, type Visual, type Traje, type Baixo, type Sapato, type Altura, type Biotipo, type Boneco as BonecoDef } from "../data/bonecos";
import { PixAberto } from "./Lote";
import { BotaoCobrar } from "./Cobrar";
import { ACESSORIOS, ACESSORIO_POR_ID, ITEM_PAGO_POR_ID, ITEM_DO_TRAJE, ITEM_DO_SAPATO, ehGratis, itensPagosDoVisual, limparEquipados, type LugarAcessorio } from "../data/acessorios";
import { MISSAO_POR_ID, type Missao } from "../data/missoes";
import { FLUTUANTE, LARGO, ESTREITO } from "./estilo";
import { Icone, ICONE_ACESSORIO, ICONE_MISSAO, type NomeIcone } from "./Icone";
import { RetratoBoneco } from "./RetratoBoneco";
import { PreviaBoneco } from "./PreviaBoneco";
import { Cores, Opcoes, Interruptor, SeloPago, FiguraPeca, Silhueta } from "./EditorVisual";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (d: string) => new Date(d).toLocaleDateString("pt-BR");

// o mini avatar mora em ui/MiniAvatar.tsx (sem three.js); continua exportado daqui para quem já importava
import { MiniAvatar } from "./MiniAvatar";
import { EstrelaMedia } from "./NotaEstrelas";
export { MiniAvatar };

// ---------- painel "Meu personagem" (refeito em 16/11/2026; editor completo em 20/11/2026) ----------
// Prévia 3D girando em cima (arrastar gira), com Aleatório e Desfazer, e as abas Prontos, Corpo, Rosto, Cabelo, Roupa,
// Acessórios, Uniforme e Perfil. Tudo é rascunho até Salvar: o visual, os acessórios em uso e o perfil vão juntos.
// Itens pagos (acessórios e roupas premium) dá para experimentar; para salvar com eles, a compra passa pela função única
// comprarItem do personagemStore. No celular é uma gaveta que sobe de baixo (prévia no topo, abas roláveis); no computador
// a prévia fica à esquerda.
type Aba = "pronto" | "corpo" | "rosto" | "cabelo" | "roupa" | "acessorios" | "uniforme" | "perfil";
const ABAS: { id: Aba; nome: string; icone: NomeIcone }[] = [
  { id: "pronto", nome: "Prontos", icone: "brilho" },
  { id: "corpo", nome: "Corpo", icone: "pessoa" },
  { id: "rosto", nome: "Rosto", icone: "rosto" },
  { id: "cabelo", nome: "Cabelo", icone: "cabelo" },
  { id: "roupa", nome: "Roupa", icone: "camiseta" },
  { id: "acessorios", nome: "Acessórios", icone: "oculosSol" },
  { id: "uniforme", nome: "Uniforme", icone: "uniforme" },
  { id: "perfil", nome: "Perfil e redes", icone: "perfil" },
];
const NOME_PRAIA: Partial<Record<Traje, string>> = { semCamisa: "Sem camisa", biquini: "Biquíni", saida: "Saída de praia" };
const sortear = <T,>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)];
const clarear = (hex: string, k: number) => { const n = parseInt(hex.slice(1), 16) || 0; const c = (s: number) => Math.round(((n >> s) & 255) * (1 - k) + 255 * k); return `rgb(${c(16)},${c(8)},${c(0)})`; };
const BOTAO_PREVIA = "grid h-9 w-9 place-items-center rounded-full bg-white/85 text-[#3A414C] shadow-sm backdrop-blur transition-colors hover:bg-white disabled:opacity-40";
const LUGARES: [LugarAcessorio, string][] = [["cabeca", "Cabeça"], ["rosto", "Rosto"], ["pescoco", "Pescoço"], ["costas", "Costas"], ["pulso", "Relógio"], ["pulseira", "Pulseira"], ["orelha", "Brincos"]];
const PECAS_UNIFORME: Traje[] = ["polo", "camisa", "social", "jaqueta", "moletom"];
const COR_SAPATO: Partial<Record<Sapato, string>> = { social: "#2A1E19", sandalia: "#8B5E3C", tenisGrife: "#F4F4F4" };
const PECA_COMUM: Record<string, Traje | Sapato> = { ternoGrife: "terno", jaquetaCouro: "jaqueta", tenisGrife: "tenis" };
const ALTURA_FIGURA: Record<Altura, number> = { baixa: 0.84, media: 1, alta: 1.16 };
const LARGURA_FIGURA: Record<Biotipo, number> = { magro: 0.8, medio: 1, forte: 1.26 };
type Rascunho = { tipo: string; visual: Visual; usando: string[] };
const semVazios = (v: Visual) => { const r = { ...v } as Record<string, unknown>; for (const k of Object.keys(r)) if (r[k] === undefined) delete r[k]; return r as Visual; };
const agoraMs = () => Date.now(); // só nos cliques (Desfazer junta mudanças seguidas no mesmo campo)
// Aleatório: só o que é grátis (nada de item pago nem uniforme); alguns acessórios grátis de vez em quando
function visualAleatorio(): { visual: Visual; usando: string[] } {
  const sapato = sortear(["tenis", "social", "sandalia"] as const), baixo = sortear(["calca", "jeans", "bermuda", "saia"] as const);
  const visual: Visual = { pele: sortear(PELES), cabelo: sortear(CORES_CABELO.slice(0, 9)), estiloCabelo: sortear(ESTILOS_CABELO).id, barba: Math.random() < 0.65 ? "nenhuma" : sortear(BARBAS).id,
    traje: sortear([...TRAJES_CIMA.filter((t) => !ITEM_DO_TRAJE[t.id]).map((t) => t.id), "vestido" as Traje]), roupa: sortear(CORES_ROUPA),
    calca: baixo === "jeans" ? sortear([COR_JEANS, "#5B7DB1", "#2C3E50"]) : sortear(CORES_CALCA), calcado: COR_SAPATO[sapato] && Math.random() < 0.6 ? COR_SAPATO[sapato] : sortear(CORES_CALCADO), tenis: Math.random() < 0.5 ? "" : sortear(CORES_CALCADO),
    oculos: Math.random() < 0.22, oculosModelo: sortear(MODELOS_OCULOS).id, altura: sortear(ALTURAS).id, biotipo: sortear(BIOTIPOS).id, olhos: sortear(OLHOS).id, corOlhos: sortear(CORES_OLHOS),
    sobrancelha: sortear(SOBRANCELHAS).id, boca: sortear(BOCAS).id, marcas: Math.random() < 0.35 ? sortear(MARCAS).id : "nenhuma", baixo, sapato };
  return { visual, usando: limparEquipados(ACESSORIOS.filter((a) => a.preco === 0 && Math.random() < 0.3).map((a) => a.id)) };
}

export function PainelPersonagem() {
  const painel = usePersonagem((s) => s.painel);
  const meu = usePersonagem((s) => s.meu);
  const ativo = usePersonagem((s) => s.ativo);
  const preco = usePersonagem((s) => s.preco);
  const precoCheio = usePersonagem((s) => s.precoCheio);
  const pagamentoLigado = usePersonagem((s) => s.pagamentoLigado);
  const itens = usePersonagem((s) => s.itens);
  const salvar = usePersonagem((s) => s.salvar);
  const pagar = usePersonagem((s) => s.pagar);
  const fechar = usePersonagem((s) => s.fechar);
  const comprarItem = usePersonagem((s) => s.comprarItem);
  const carregarItens = usePersonagem((s) => s.carregarItens);
  const pix = useMundo((s) => s.pix);
  const usuario = useMundo((s) => s.usuario);
  const admin = useMundo((s) => s.admin);
  const meus = useMundo((s) => s.meus);
  const terrenos = useMundo((s) => s.terrenos);
  const [genero, setGenero] = useState<Genero | "todos">("todos");
  const [f, setF] = useState({ nome: "", tipo: TIPOS_AVATAR[0].id, bio: "", redes: {} as Redes, mostrarRedes: false, perfil: PERFIL_VAZIO as Perfil, visual: {} as Visual });
  const [usandoR, setUsandoR] = useState<string[] | null>(null); // acessórios do rascunho (null = os que estão salvos)
  // o nome do balãozinho já vem com o primeiro nome da conta até a pessoa mexer no campo (17/11/2026, jornada:
  // o painel abre antes de a conta carregar, então o valor inicial nascia vazio; calcular na hora de mostrar resolve)
  const [mexeuNome, setMexeuNome] = useState(false);
  const nome = f.nome || (!meu && !mexeuNome ? (usuario?.nome ?? "").trim().split(/\s+/)[0]?.slice(0, 24) ?? "" : "");
  const [aba, setAba] = useState<Aba>("pronto");
  const [perto, setPerto] = useState<boolean | null>(null); // null = a câmera segue a aba (rosto em Rosto e Cabelo)
  const [abrirPerfil, setAbrirPerfil] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [comprando, setComprando] = useState<string | null>(null);
  const [nHist, setNHist] = useState(0);
  const historico = useRef<{ r: Rascunho; campo: string; em: number }[]>([]);
  const antes = useRef<{ uniforme: Pick<Visual, "traje" | "roupa"> | null; cima: Traje | null }>({ uniforme: null, cima: null });
  const carregadoDe = useRef<string | null>(null);
  // preenche o formulário com o que já existe (uma vez por personagem); quem já tem personagem abre em Corpo
  useEffect(() => { if (painel === "montar" && meu && carregadoDe.current !== meu.usuarioId) { carregadoDe.current = meu.usuarioId; const { veiculo: _v, ...visual } = meu.visual ?? {}; void _v; setF({ nome: meu.nome, tipo: meu.tipo, bio: meu.bio, redes: meu.redes ?? {}, mostrarRedes: meu.mostrarRedes, perfil: { profissao: meu.profissao ?? "", nicho: meu.nicho ?? "", servicos: meu.servicos ?? "", preco: meu.preco ?? "", local: meu.local ?? "", portfolio: meu.portfolio ?? [], disponivel: meu.disponivel ?? true }, visual: visual as Visual }); setAbrirPerfil(!!meu.profissao); setUsandoR(null); historico.current = []; setNHist(0); setAba("corpo"); } }, [painel, meu]);
  useEffect(() => { if (painel === "montar" && usuario) void carregarItens(); }, [painel, usuario, carregarItens]);
  if (painel !== "montar") return null;
  if (!usuario) return (
    <div className={`${FLUTUANTE} ${ESTREITO} painel-entra overflow-y-auto p-4`} role="dialog" aria-label="Criar personagem">
      <div className="text-lg font-bold">Seu personagem no mundo</div>
      <p className="mt-1 text-sm text-[#5B6472]">Quem não tem personagem só olha. Com o seu, você anda pelo mapa, fala com a equipe das lojas, conversa com quem está online, faz amigos, negocia e faz calls.</p>
      <div className="mt-3 rounded-2xl bg-[#F1F3F6] px-3 py-2 text-sm"><span className="text-[#5B6472] line-through">{brl(precoCheio)}</span> <b className="text-[#16A34A]">{brl(preco)}/mês</b></div>
      <a href={`/cadastro?destino=${encodeURIComponent("/mundo?personagem=1")}`} className="mt-3 block w-full rounded-xl bg-[#1D4ED8] px-3 py-2.5 text-center text-sm font-bold text-white">Criar conta e montar meu personagem</a>
      <a href={`/entrar?destino=${encodeURIComponent("/mundo?personagem=1")}`} className="mt-1.5 block w-full text-center text-xs font-semibold text-[#1D4ED8]">Já tenho conta</a>
      <button onClick={fechar} className="mt-2 w-full rounded-xl bg-[#F1F3F6] px-3 py-2 text-sm text-[#5B6472]">Agora não</button>
    </div>
  );
  const tipos = TIPOS_AVATAR.filter((t) => genero === "todos" || t.genero === genero);
  const tipo = TIPOS_AVATAR.find((t) => t.id === f.tipo) ?? TIPOS_AVATAR[0];
  // o visual que aparece: o boneco do tipo escolhido com os ajustes por cima
  const base = bonecoDe(tipo.boneco);
  const personalizado = Object.keys(f.visual).length > 0;
  const vc = visualCompleto(base, tipo.roupa, f.visual);
  const bonecoId = personalizado ? codificarVisual(vc, tipo.boneco) : tipo.boneco;
  const def = bonecoDe(bonecoId, base);
  const camisa = vc.roupa;
  const comprados = itens?.comprados ?? [];
  const usando = usandoR ?? itens?.usando ?? meu?.acessorios ?? [];
  const tem = (id: string) => admin || ehGratis(id) || comprados.includes(id);
  // itens pagos que estão no rascunho e a pessoa ainda não comprou
  const faltam = [...itensPagosDoVisual(vc), ...usando.filter((i) => (ACESSORIO_POR_ID[i]?.preco ?? 0) > 0)].filter((i) => !tem(i));
  const praia = vc.traje === "semCamisa" || vc.traje === "biquini" || vc.traje === "saida";
  const vestido = vc.traje === "vestido";
  const trajes = base.traje && NOME_PRAIA[base.traje] ? [...TRAJES_CIMA, { id: base.traje, nome: NOME_PRAIA[base.traje] ?? "Praia" }] : TRAJES_CIMA;
  const empresas = meus.map((ch) => terrenos[ch]).filter((t): t is Terreno => !!t && t.status === "ativo");
  const empresaDoUniforme = vc.uniforme ? terrenos[vc.uniforme] : null;
  const pertoAgora = perto ?? (aba === "rosto" || aba === "cabelo");
  // Desfazer: cada mudança guarda o rascunho de antes; mudanças seguidas no mesmo campo (arrastar a cor livre) contam uma vez
  const guardar = (campo: string) => {
    const h = historico.current, agora = agoraMs(), ult = h[h.length - 1];
    if (ult && ult.campo === campo && agora - ult.em < 900) { ult.em = agora; return; }
    h.push({ r: { tipo: f.tipo, visual: f.visual, usando }, campo, em: agora }); if (h.length > 60) h.shift(); setNHist(h.length);
  };
  const mudarVisual = (p: Partial<Visual>, campo = Object.keys(p).join(",")) => { guardar(campo); setF({ ...f, visual: semVazios({ ...f.visual, ...p }) }); };
  const mudarUsando = (l: string[]) => { guardar(`acessorios:${l.join(",")}`); setUsandoR(limparEquipados(l)); };
  const desfazer = () => { const h = historico.current.pop(); setNHist(historico.current.length); if (!h) return; setF({ ...f, tipo: h.r.tipo, visual: h.r.visual }); setUsandoR(h.r.usando); };
  const escolherAba = (a: Aba) => { setAba(a); setPerto(null); };
  const aleatorio = () => { guardar(`aleatorio:${agoraMs()}`); const r = visualAleatorio(); setF({ ...f, visual: r.visual }); setUsandoR(r.usando); };
  const escolherCima = (t: Traje) => mudarVisual({ traje: t }, "traje");
  const escolherBaixo = (b: Baixo | "vestido") => {
    if (b === "vestido") { if (!vestido) antes.current.cima = vc.traje; mudarVisual({ traje: "vestido" }, "traje"); return; }
    mudarVisual({ baixo: b, ...(vestido ? { traje: antes.current.cima && antes.current.cima !== "vestido" ? antes.current.cima : "camisa" } : {}), ...(b === "jeans" && vc.baixo !== "jeans" ? { calca: COR_JEANS } : {}) }, "baixo");
  };
  const escolherSapato = (s: Sapato) => mudarVisual({ sapato: s, ...(COR_SAPATO[s] && vc.sapato !== s ? { calcado: COR_SAPATO[s] } : {}) }, "sapato");
  const vestirUniforme = (t: Terreno) => {
    if (!vc.uniforme) antes.current.uniforme = { traje: f.visual.traje, roupa: f.visual.roupa };
    mudarVisual({ uniforme: t.chave, roupa: t.cor.toUpperCase(), traje: PECAS_UNIFORME.includes(vc.traje) ? vc.traje : "polo" }, "uniforme");
  };
  const tirarUniforme = () => { const a = antes.current.uniforme; mudarVisual({ uniforme: undefined, traje: a?.traje, roupa: a?.roupa }, "uniforme"); antes.current.uniforme = null; };
  const retrato = (d: Partial<BonecoDef>, t = 54, zoom = false) => <RetratoBoneco def={{ ...def, ...d }} roupa={camisa} tamanho={t} zoom={zoom} acessorios={usando} />;
  const selo = (item?: string) => (item ? <SeloPago preco={brl(ITEM_PAGO_POR_ID[item]?.preco ?? 0)} tem={tem(item)} /> : undefined);
  // salvar: mostra o "salvo com sucesso" e fecha sozinho (se ainda não pagou, fica aberto no Pix). Com item pago que
  // ainda não é seu, o botão salva sem ele (as peças pagas voltam para a comum parecida)
  const clicarSalvar = async () => {
    setErro(null);
    let visual = f.visual, lista = usando;
    if (faltam.length) {
      const v: Record<string, unknown> = { ...f.visual };
      if (faltam.includes(ITEM_DO_TRAJE[vc.traje] ?? "-")) v.traje = PECA_COMUM[vc.traje];
      if (faltam.includes(ITEM_DO_SAPATO[vc.sapato] ?? "-")) v.sapato = PECA_COMUM[vc.sapato];
      visual = semVazios(v as Visual); lista = usando.filter((i) => !faltam.includes(i));
      setF({ ...f, visual }); setUsandoR(lista);
    }
    setSalvando(true); const e = await salvar({ ...f, visual, nome, acessorios: lista }); setSalvando(false);
    if (e) { setErro(e); return; }
    setUsandoR(null);
    if (!usePersonagem.getState().ativo) { setAviso("Personagem salvo! Agora é só ativar no Pix pra entrar no mapa."); return; }
    setSalvo(true); setTimeout(() => { setSalvo(false); fechar(); }, 1300);
  };
  const clicarPagar = async (creditos = false) => { setErro(null); setPagando(true); const e1 = meu ? null : await salvar({ ...f, nome }); if (e1) { setErro(e1); setPagando(false); return; } const e = await pagar(1, creditos); setPagando(false); if (e) setErro(e); };
  // a cobrança de um item: sempre pela função única do personagemStore (créditos, Pix ou os dois; frente creditos)
  const comprar = async (id: string, creditos = false) => { setErro(null); if (!pagamentoLigado && !creditos) { setErro("Pagamento em instantes: estamos ligando o Mercado Pago."); return; } setComprando(id); const e = await comprarItem(id, creditos); setComprando(null); if (e) setErro(e); };
  const setRede = (k: keyof Redes, v: string) => setF({ ...f, redes: { ...f.redes, [k]: v } });
  const campoRede = (k: keyof Redes, icone: NomeIcone, dica: string) => (
    <label className="flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 focus-within:border-[#1D4ED8]">
      <Icone nome={icone} tamanho={16} className="shrink-0 text-[#8A93A3]" />
      <input value={f.redes[k] ?? ""} onChange={(e) => setRede(k, e.target.value)} placeholder={dica} aria-label={dica} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
    </label>
  );
  const pixAberto = pix?.lote === "personagem";
  const pixItem = pix?.tipo === "item" && pix.status === "pendente" ? pix.lote : null;
  const fecharBotao = (cls: string) => <button onClick={fechar} aria-label="Fechar" className={`${BOTAO_PREVIA} ${cls}`}><Icone nome="fechar" tamanho={18} /></button>;
  return (
    <div role="dialog" aria-label="Meu personagem" data-editor-personagem="" data-boneco={bonecoId} data-usando={usando.join(",")} className="painel-entra absolute inset-x-0 bottom-0 z-20 flex h-[88dvh] flex-col overflow-hidden rounded-t-3xl bg-white text-[#1D2128] shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-20 sm:h-[min(44rem,calc(100dvh-7rem))] sm:w-[min(50rem,calc(100vw-1.5rem))] sm:flex-row sm:rounded-3xl">
      {salvo && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/95">
          <svg viewBox="0 0 64 64" className="salvo-pop h-20 w-20"><circle cx="32" cy="32" r="30" fill="#16A34A" /><path d="M18 33 L28 43 L46 23" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" className="salvo-risco" /></svg>
          <div className="text-lg font-bold text-[#166534]">Salvo com sucesso</div>
        </div>
      )}
      {/* prévia 3D: no celular em cima, no computador à esquerda */}
      <div className="relative h-[30dvh] max-h-[15.5rem] min-h-[10.5rem] shrink-0 sm:h-auto sm:max-h-none sm:w-[17rem] md:w-[19rem]" style={{ background: `radial-gradient(120% 95% at 50% 100%, ${clarear(camisa, 0.62)} 0%, #F6F8FB 64%)` }}>
        <PreviaBoneco def={def} camisa={camisa} acessorios={usando} perto={pertoAgora} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold leading-tight">{nome.trim() || (meu ? meu.nome : "Seu personagem")}</div>
            <div className="mt-0.5 text-xs text-[#5B6472]">{ativo ? `Ativo até ${meu?.pagoAte ? dataBR(meu.pagoAte) : "—"}` : meu ? "Falta ativar para entrar no mapa" : "Monte o seu e entre no mapa"}</div>
          </div>
          {fecharBotao("pointer-events-auto sm:hidden")}
        </div>
        <span className="pointer-events-none absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-black/15 sm:hidden" />
        <div className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-1 text-[11px] font-medium text-[#5B6472]"><Icone nome="girarDir" tamanho={13} />Arraste para girar</div>
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          <button onClick={desfazer} disabled={!nHist} aria-label="Desfazer" title="Desfazer a última mudança" className={BOTAO_PREVIA}><Icone nome="desfazer" tamanho={18} /></button>
          <button onClick={aleatorio} aria-label="Aleatório" title="Visual aleatório" className={BOTAO_PREVIA}><Icone nome="dado" tamanho={18} /></button>
          <button onClick={() => setPerto(!pertoAgora)} aria-label={pertoAgora ? "Ver o corpo inteiro" : "Ver o rosto de perto"} title={pertoAgora ? "Ver o corpo inteiro" : "Ver o rosto de perto"} className={BOTAO_PREVIA}><Icone nome={pertoAgora ? "zoomMenos" : "zoomMais"} tamanho={18} /></button>
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* nome e abas (roláveis para o lado, dentro do painel) */}
        <div className="shrink-0 border-b border-black/5 px-4 pt-3">
          <div className="flex items-center gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-[#F4F6F9] px-3 py-2 focus-within:ring-2 focus-within:ring-[#1D4ED8]/30">
              <span className="shrink-0 text-xs font-semibold text-[#5B6472]">Nome no balãozinho</span>
              <input value={nome} onChange={(e) => { setMexeuNome(true); setF({ ...f, nome: e.target.value.slice(0, 24) }); }} placeholder="Ex.: Bia" className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:font-normal" />
            </label>
            {fecharBotao("hidden !bg-[#F4F6F9] sm:grid")}
          </div>
          <div role="tablist" aria-label="Partes do personagem" className="-mx-4 mt-2 flex gap-1 overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ABAS.map((a) => (
              <button key={a.id} role="tab" aria-selected={aba === a.id} onClick={() => escolherAba(a.id)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${aba === a.id ? "bg-[#1D2128] text-white" : "bg-[#F4F6F9] text-[#5B6472] hover:bg-[#E9ECF1]"}`}>
                <Icone nome={a.icone} tamanho={16} />{a.nome}
              </button>
            ))}
          </div>
        </div>
        {/* conteúdo da aba */}
        <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-3">
          {pixAberto && <div className="mb-3"><PixAberto chave="personagem" /></div>}
          {pixItem && <div className="mb-3"><PixAberto chave={pixItem} /></div>}
          {aba === "pronto" && (
            <>
              <p className="text-xs text-[#5B6472]">Comece por um visual pronto e ajuste os detalhes nas outras abas.</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{(["todos", "feminino", "masculino", "neutro"] as const).map((g) => <button key={g} onClick={() => setGenero(g)} className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${genero === g ? "bg-[#1D4ED8] text-white" : "bg-[#F1F3F6] text-[#5B6472] hover:bg-[#E6E9EE]"}`}>{g === "todos" ? "Todos" : g[0].toUpperCase() + g.slice(1)}</button>)}</div>
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                {tipos.map((t) => { const sel = f.tipo === t.id; return (
                  <button key={t.id} onClick={() => { guardar(`tipo:${t.id}`); setF({ ...f, tipo: t.id, visual: {} }); }} title={t.nome} aria-pressed={sel} className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl border-2 p-1.5 pb-2 transition-colors ${sel ? "border-[#1D4ED8] bg-[#EEF3FF]" : "border-transparent bg-[#F4F6F9] hover:bg-[#EBEEF3]"}`}>
                    <MiniAvatar boneco={t.boneco} roupa={t.roupa} tamanho={50} />
                    <span className={`w-full truncate text-center text-[11px] font-semibold ${sel ? "text-[#1D4ED8]" : "text-[#3A414C]"}`}>{t.nome}</span>
                  </button>); })}
              </div>
              {personalizado && <div className="mt-3 flex items-start gap-2 rounded-2xl bg-[#EEF3FF] px-3 py-2 text-xs text-[#1D3A8A]"><Icone nome="editar" tamanho={16} className="mt-px shrink-0" /><span>Visual personalizado a partir de <b>{tipo.nome}</b>. Escolher outro visual pronto desfaz os ajustes (o botão Desfazer traz de volta).</span></div>}
            </>
          )}
          {aba === "corpo" && (
            <>
              <Cores titulo="Tom de pele" cores={PELES} valor={vc.pele} mudar={(c) => mudarVisual({ pele: c })} />
              <Opcoes titulo="Altura" colunas={3} opcoes={ALTURAS.map((a) => ({ id: a.id, nome: a.nome, figura: <Silhueta altura={ALTURA_FIGURA[a.id]} cor={camisa} /> }))} valor={vc.altura} mudar={(a) => mudarVisual({ altura: a })} />
              <Opcoes titulo="Biotipo" colunas={3} opcoes={BIOTIPOS.map((b) => ({ id: b.id, nome: b.nome, figura: <Silhueta largura={LARGURA_FIGURA[b.id]} cor={camisa} /> }))} valor={vc.biotipo} mudar={(b) => mudarVisual({ biotipo: b })} />
            </>
          )}
          {aba === "rosto" && (
            <>
              <Opcoes titulo="Olhos" colunas={5} opcoes={OLHOS.map((o) => ({ id: o.id, nome: o.nome, figura: retrato({ olhos: o.id }, 54, true) }))} valor={vc.olhos} mudar={(o) => mudarVisual({ olhos: o })} />
              {vc.olhos !== "felizes" && <Cores titulo="Cor dos olhos" cores={CORES_OLHOS} valor={vc.corOlhos} mudar={(c) => mudarVisual({ corOlhos: c })} />}
              <Opcoes titulo="Sobrancelhas" opcoes={SOBRANCELHAS.map((s) => ({ id: s.id, nome: s.nome, figura: retrato({ sobrancelha: s.id }, 54, true) }))} valor={vc.sobrancelha} mudar={(s) => mudarVisual({ sobrancelha: s })} />
              <Opcoes titulo="Boca" opcoes={BOCAS.map((b) => ({ id: b.id, nome: b.nome, figura: retrato({ boca: b.id }, 54, true) }))} valor={vc.boca} mudar={(b) => mudarVisual({ boca: b })} />
              <Opcoes titulo="Sardas e pintas" opcoes={MARCAS.map((m) => ({ id: m.id, nome: m.nome, figura: retrato({ marcas: m.id }, 54, true) }))} valor={vc.marcas} mudar={(m) => mudarVisual({ marcas: m })} />
              <Opcoes titulo="Óculos de grau" opcoes={[{ id: "nenhum" as const, nome: "Sem óculos", figura: retrato({ oculos: false }, 54, true) }, ...MODELOS_OCULOS.map((m) => ({ id: m.id, nome: m.nome, figura: retrato({ oculos: true, oculosModelo: m.id }, 54, true) }))]} valor={vc.oculos ? vc.oculosModelo : "nenhum"} mudar={(m) => mudarVisual(m === "nenhum" ? { oculos: false } : { oculos: true, oculosModelo: m }, "oculos")} dica="Grátis. Óculos escuros e aviador estão em Acessórios." />
            </>
          )}
          {aba === "cabelo" && (
            <>
              <Opcoes titulo="Corte" opcoes={ESTILOS_CABELO.map((e) => ({ id: e.id, nome: e.nome, figura: retrato({ estiloCabelo: e.id }) }))} valor={vc.estiloCabelo} mudar={(e) => mudarVisual({ estiloCabelo: e })} />
              <Cores titulo="Cor do cabelo" cores={CORES_CABELO} valor={vc.cabelo} mudar={(c) => mudarVisual({ cabelo: c })} />
              <Opcoes titulo="Barba e bigode" colunas={5} opcoes={BARBAS.map((b) => ({ id: b.id, nome: b.nome, figura: retrato({ barba: b.id }, 54, true) }))} valor={vc.barba} mudar={(b) => mudarVisual({ barba: b })} />
            </>
          )}
          {aba === "roupa" && (
            <>
              {vc.uniforme && <div className="mb-3 flex items-center gap-2 rounded-2xl bg-[#EEF3FF] px-3 py-2 text-xs text-[#1D3A8A]"><Icone nome="uniforme" tamanho={16} className="shrink-0" /><span className="min-w-0 flex-1">De uniforme{empresaDoUniforme ? <> da <b>{empresaDoUniforme.empresaNome}</b></> : null}: a cor é a da empresa.</span><button onClick={tirarUniforme} className="shrink-0 font-bold underline">Tirar</button></div>}
              <Opcoes titulo="Parte de cima" opcoes={trajes.map((t) => ({ id: t.id, nome: t.nome, figura: retrato({ traje: t.id }), selo: selo(ITEM_DO_TRAJE[t.id]) }))} valor={vestido ? ("" as Traje) : vc.traje} mudar={escolherCima} dica={vestido ? "O vestido já cobre a parte de cima. Escolher uma peça aqui troca o vestido por ela." : undefined} />
              {!vc.uniforme && <Cores titulo={vestido ? "Cor do vestido" : vc.traje === "blazer" || vc.traje === "terno" ? `Cor do ${vc.traje === "terno" ? "terno" : "blazer"}` : "Cor da parte de cima"} cores={CORES_ROUPA} valor={vc.roupa} mudar={(c) => mudarVisual({ roupa: c })} />}
              {vc.traje === "camisa" && !vc.uniforme && <p className="mt-2 text-[11px] text-[#5B6472]">A camiseta leva o logo da Nuvem no peito e o crachá.</p>}
              {praia ? <p className="mt-4 rounded-2xl bg-[#F4F6F9] px-3 py-2 text-xs text-[#5B6472]">Na praia o personagem anda de chinelo, com bermuda ou biquíni. Escolha outra parte de cima para trocar a parte de baixo e os sapatos.</p> : (
                <>
                  <Opcoes titulo="Parte de baixo" colunas={5} opcoes={BAIXOS.map((b) => ({ id: b.id, nome: b.nome, figura: <FiguraPeca tipo={b.id} cor={b.id === "vestido" ? camisa : vc.calca} /> }))} valor={vestido ? "vestido" : vc.baixo} mudar={escolherBaixo} />
                  {!vestido && <Cores titulo={vc.baixo === "saia" ? "Cor da saia" : vc.baixo === "bermuda" ? "Cor da bermuda" : "Cor da calça"} cores={CORES_CALCA} valor={vc.calca} mudar={(c) => mudarVisual({ calca: c })} />}
                  <Opcoes titulo="Sapatos" opcoes={SAPATOS.map((s) => ({ id: s.id, nome: s.nome, figura: <FiguraPeca tipo={s.id} cor={vc.calcado} />, selo: selo(ITEM_DO_SAPATO[s.id]) }))} valor={vc.sapato} mudar={escolherSapato} />
                  <Cores titulo={vc.sapato === "sandalia" ? "Cor da sandália" : vc.sapato === "social" ? "Cor do sapato" : "Cor do tênis"} cores={CORES_CALCADO} valor={vc.calcado} mudar={(c) => mudarVisual({ calcado: c })} />
                  {vc.sapato === "tenis" && <Cores titulo="Sola e listra" cores={CORES_CALCADO} valor={vc.tenis} nenhum="Liso" mudar={(c) => mudarVisual({ tenis: c })} />}
                </>
              )}
            </>
          )}
          {aba === "acessorios" && (
            <>
              <p className="text-xs text-[#5B6472]">Um por lugar. Relógio, pulseira e brincos são grátis; os outros você experimenta aqui e, para salvar com eles, compra no Pix.</p>
              {LUGARES.map(([lugar, nomeL]) => {
                const lista = ACESSORIOS.filter((a) => a.lugar === lugar); if (!lista.length) return null;
                return (
                  <section key={lugar} className="mt-4">
                    <div className="text-[13px] font-semibold">{nomeL} <span className="text-[11px] font-normal text-[#8A93A3]">· um por vez</span></div>
                    <ul className="mt-1.5 divide-y divide-black/5 overflow-hidden rounded-2xl bg-[#F7F8FA]">
                      {lista.map((a) => {
                        const uso = usando.includes(a.id), seu = tem(a.id);
                        return (
                          <li key={a.id} className={`flex items-center gap-2.5 px-2.5 py-2 ${uso ? "bg-[#F3EEFF]" : ""}`}>
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white shadow-sm" style={{ color: a.cor === "#FFFFFF" || a.cor === "#EFE6CF" || a.cor === "#E5E7EB" ? "#8C97A6" : a.cor }}><Icone nome={ICONE_ACESSORIO[a.id] ?? "mais"} tamanho={20} /></span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[12px] font-bold">{a.nome}</div>
                              <div className="text-[11px] text-[#5B6472]">{a.preco === 0 ? "Grátis" : seu ? "Na sua conta" : <span className="inline-flex items-center gap-0.5"><Icone nome="cadeado" tamanho={11} />{brl(a.preco)}</span>}{uso && !seu ? " · experimentando" : ""}</div>
                            </div>
                            <button type="button" data-acessorio={a.id} onClick={() => mudarUsando(uso ? usando.filter((x) => x !== a.id) : [a.id, ...usando.filter((x) => ACESSORIO_POR_ID[x]?.lugar !== a.lugar)])} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${uso ? "bg-white text-[#5B6472] ring-1 ring-black/10" : seu ? "bg-[#7C3AED] text-white" : "bg-[#1D2128] text-white"}`}>{uso ? "Tirar" : seu ? "Usar" : "Experimentar"}</button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
              <div className="mt-3 text-[11px] text-[#5B6472]">Comprou, é seu para sempre: troque quando quiser, sem pagar de novo. Quem passa por você no mapa vê o visual novo.</div>
            </>
          )}
          {aba === "uniforme" && (empresas.length ? (
            <>
              <p className="text-xs text-[#5B6472]">Vista a cor e a logo da sua empresa num clique. Quem passa por você no mapa, a sua ficha e o topo do site mostram o uniforme.</p>
              <div className="mt-3 space-y-2">
                {empresas.map((t) => {
                  const este = vc.uniforme === t.chave;
                  return (
                    <div key={t.chave} className={`flex items-center gap-3 rounded-2xl border-2 p-2.5 ${este ? "border-[#1D4ED8] bg-[#EEF3FF]" : "border-transparent bg-[#F4F6F9]"}`}>
                      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl" style={{ background: t.cor }}>{t.temLogo ? <img src={`/api/terrenos/${encodeURIComponent(t.chave)}/logo`} alt="" className="h-9 w-9 rounded-md bg-white object-contain p-0.5" /> : <span className="text-lg font-black text-white">{t.empresaNome.slice(0, 1).toUpperCase()}</span>}</span>
                      <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{t.empresaNome}</div><div className="text-[11px] text-[#5B6472]">{este ? "Você está de uniforme" : t.temLogo ? "Cor e logo da empresa" : "Cor da empresa (sem logo cadastrada)"}</div></div>
                      {este ? <button onClick={tirarUniforme} className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#5B6472] ring-1 ring-black/10">Tirar</button>
                        : <button data-vestir-uniforme={t.chave} onClick={() => vestirUniforme(t)} className="shrink-0 rounded-xl bg-[#1D4ED8] px-3 py-2 text-xs font-bold text-white">Vestir o uniforme</button>}
                    </div>
                  );
                })}
              </div>
              {vc.uniforme && <Opcoes titulo="Peça do uniforme" colunas={5} opcoes={PECAS_UNIFORME.map((t) => ({ id: t, nome: TRAJES_CIMA.find((x) => x.id === t)?.nome ?? t, figura: retrato({ traje: t }) }))} valor={vc.traje} mudar={(t) => mudarVisual({ traje: t }, "traje")} />}
            </>
          ) : (
            <div className="rounded-2xl bg-[#F4F6F9] p-3 text-xs text-[#5B6472]"><b className="mb-0.5 block text-[13px] text-[#1D2128]">Uniforme da sua empresa</b>Quem tem empresa no mapa veste a cor e a logo dela num clique. Escolha um lote livre no mapa para abrir a sua.</div>
          ))}
          {aba === "perfil" && (
            <>
              {meu && <MeusSelos />}
              <label className="mt-1 block text-[13px] font-semibold">Sobre você<span className="ml-1 font-normal text-[#8A93A3]">aparece na ficha</span>
                <textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value.slice(0, 200) })} rows={2} placeholder="Ex.: Dona de loja de roupas em Aracaju, procuro fornecedores." className="mt-1.5 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-normal outline-none focus:border-[#1D4ED8]" />
              </label>
              <div className="mt-4 text-[13px] font-semibold">Redes sociais<span className="ml-1 font-normal text-[#8A93A3]">para trocar com quem você quiser</span></div>
              <div className="mt-1.5 grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2">
                {campoRede("instagram", "instagram", "Instagram (@)")}
                {campoRede("whatsapp", "telefone", "WhatsApp com DDD")}
                {campoRede("linkedin", "maleta", "LinkedIn")}
                {campoRede("site", "globo", "Site")}
              </div>
              <Interruptor ligado={f.mostrarRedes} mudar={(v) => setF({ ...f, mostrarRedes: v })}><b className="block font-semibold">Mostrar minhas redes para todo mundo</b><span className="text-xs text-[#5B6472]">Desligado, só quem você aceitar vê.</span></Interruptor>
              <CamposPerfil perfil={f.perfil} aberto={abrirPerfil} abrir={() => setAbrirPerfil(true)} mudar={(p) => setF({ ...f, perfil: { ...f.perfil, ...p } })} />
            </>
          )}
          {erro && <div className="mt-3 text-xs font-semibold text-[#E2575B]">{erro}</div>}
          {aviso && <div className="mt-3 text-xs font-semibold text-[#166534]">{aviso}</div>}
        </div>
        {/* rodapé: itens pagos no visual, ativar (se ainda não pagou) e salvar */}
        <div className="shrink-0 border-t border-black/5 p-3 sm:px-4">
          {faltam.length > 0 && (
            <div data-itens-pagos="" className="mb-2 rounded-2xl bg-[#FFF8E6] p-2.5">
              <div className="flex items-center gap-1 text-[12px] font-bold text-[#7A5A00]"><Icone nome="cadeado" tamanho={14} />Itens pagos no visual</div>
              {faltam.map((id) => (
                <div key={id} className="mt-1.5 text-xs">
                  <div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate font-semibold">{ITEM_PAGO_POR_ID[id]?.nome ?? id}</span><span className="shrink-0 font-bold">{brl(ITEM_PAGO_POR_ID[id]?.preco ?? 0)}</span></div>
                  {pixItem === `item:${id}`
                    ? <button type="button" data-comprar={id} disabled className="mt-1 w-full rounded-xl bg-[#16A34A] px-3 py-2 text-xs font-bold text-white opacity-50">Pix aberto</button>
                    : <BotaoCobrar classe="mt-1" compacto dados={{ "data-comprar": id }} valor={ITEM_PAGO_POR_ID[id]?.preco ?? 0} rotuloPix="Comprar no Pix" rotuloCreditos="Comprar" pagando={comprando === id} pixLigado={pagamentoLigado} onPagar={(c) => void comprar(id, c)} />}
                </div>
              ))}
              <div className="mt-1 text-[11px] text-[#5B6472]">Comprou, é seu para sempre. Ou salve sem eles: as peças pagas saem do visual.</div>
            </div>
          )}
          {!ativo && !pixAberto && (
            <div className="mb-2 flex items-center gap-3 rounded-2xl bg-[#F3FBF5] px-3 py-2">
              <div className="min-w-0 flex-1 text-xs"><span className="text-[#5B6472] line-through">{brl(precoCheio)}</span> <b className="text-sm text-[#166534]">{brl(preco)}</b><span className="text-[#5B6472]">/mês</span><div className="truncate text-[11px] text-[#5B6472]">Entre no mapa, converse, negocie e faça calls.</div></div>
              <BotaoCobrar classe="w-44 shrink-0" compacto valor={preco} rotuloPix="Ativar no Pix" rotuloCreditos="Ativar" pagando={pagando} pixLigado={pagamentoLigado} onPagar={(c) => void clicarPagar(c)} />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={fechar} className="rounded-xl bg-[#F1F3F6] px-4 py-2.5 text-sm font-semibold text-[#5B6472]">Fechar</button>
            <button onClick={clicarSalvar} data-salvar-personagem="" disabled={salvando || nome.trim().length < 2} title={nome.trim().length < 2 ? "Dê um nome ao seu personagem" : undefined} className="min-w-0 flex-1 truncate rounded-xl bg-[#1D4ED8] px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">{salvando ? "Salvando…" : faltam.length ? "Salvar sem os itens pagos" : meu ? "Salvar personagem" : "Criar personagem"}</button>
          </div>
          {nome.trim().length < 2 && <p className="mt-1.5 text-center text-[12px] text-[#5B6472]">Escreva o nome do balãozinho lá em cima para continuar.</p>}
        </div>
      </div>
    </div>
  );
}

// Ficha de outro personagem com as 4 opções: Conversar, Negociar, Fazer uma call, Amizade
export function FichaPersonagem() {
  const painel = usePersonagem((s) => s.painel);
  const o = usePersonagem((s) => s.outroSelecionado);
  const ativo = usePersonagem((s) => s.ativo);
  const meu = usePersonagem((s) => s.meu);
  const abrirChat = usePersonagem((s) => s.abrirChat);
  const abrir = usePersonagem((s) => s.abrir);
  const fechar = usePersonagem((s) => s.fechar);
  const pedirAmizade = usePersonagem((s) => s.pedirAmizade);
  const responderAmizade = usePersonagem((s) => s.responderAmizade);
  const ligar = usePersonagem((s) => s.ligar);
  const [fichaDe, setFichaDe] = useState<{ id: string; dados: Outro | null }>({ id: "", dados: null });
  const [avisoDe, setAvisoDe] = useState<{ id: string; texto: string | null }>({ id: "", texto: null });
  const [negociando, setNegociando] = useState(false);
  useEffect(() => {
    if (painel !== "ficha" || !o) return;
    const id = o.usuarioId; let vivo = true;
    fetch(`/api/personagens/${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).then((d: Outro | null) => { if (vivo && d) { setFichaDe({ id, dados: d }); const sel = usePersonagem.getState().outroSelecionado; if (sel && sel.usuarioId === id) usePersonagem.setState({ outroSelecionado: { ...sel, relacao: d.relacao, redes: d.redes ?? sel.redes } }); } }).catch(() => {});
    return () => { vivo = false; };
  }, [painel, o?.usuarioId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (painel !== "ficha" || !o) return null;
  const ficha = fichaDe.id === o.usuarioId ? fichaDe.dados : null;
  const perfilPublico = (ficha as (Outro & { perfilPublico?: string | null }) | null)?.perfilPublico ?? null; // perfil do cadastro (20/11/2026)
  const aviso = avisoDe.id === o.usuarioId ? avisoDe.texto : null;
  const setAviso = (t: string | null) => setAvisoDe({ id: o.usuarioId, texto: t });
  const p: Outro = { ...(ficha ?? o), ...o, redes: o.redes ?? ficha?.redes, relacao: o.relacao ?? ficha?.relacao, bio: ficha?.bio || o.bio };
  const precisa = !ativo;
  const guardar = (f: () => void | Promise<void>) => { if (precisa) { abrir("montar"); return; } void f(); };
  const rel = p.relacao?.status ?? "nenhuma";
  const redes = p.redes && Object.values(p.redes).some(Boolean) ? p.redes : null;
  const souEu = meu?.usuarioId === p.usuarioId;
  const amizade = () => guardar(async () => {
    if (rel === "pediram" && p.relacao?.id) { const e = await responderAmizade(p.relacao.id, true); setAviso(e ?? `Agora vocês são amigos! As redes de ${p.nome} aparecem aqui embaixo.`); return; }
    if (rel === "amigos") { setAviso("Vocês já são amigos."); return; }
    const e = await pedirAmizade(p.usuarioId); setAviso(e ?? "Pedido de amizade enviado! Quando aceitar, as redes aparecem aqui.");
  });
  const call = () => guardar(async () => { if (!p.online) { setAviso(`${p.nome} não está online agora. Mande uma mensagem que recebe quando entrar.`); return; } const e = await ligar(p, true); if (e) setAviso(e); else fechar(); });
  return (
    <div className={`${FLUTUANTE} ${ESTREITO} painel-entra overflow-y-auto p-4`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3"><MiniAvatar boneco={p.boneco} roupa={p.roupa} tamanho={48} acessorios={p.acessorios} /><div><div className="text-lg font-bold leading-tight">{p.nome}</div><div className="text-xs text-[#5B6472]">{p.online ? <span className="text-[#16A34A]">● online agora</span> : "offline"}{souEu && " · você"}{rel === "amigos" && <span className="ml-1.5 rounded-full bg-[#FDE8F3] px-1.5 py-0.5 text-[10px] font-bold text-[#9D174D]">amigos</span>}</div></div></div>
        <button onClick={fechar} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5" aria-label="Fechar"><Icone nome="fechar" tamanho={16} /></button>
      </div>
      {ficha?.selos && ficha.selos.length > 0 && <Selos ids={ficha.selos} />}
      {ficha?.perfil && <PerfilNaFicha perfil={ficha.perfil} reputacao={ficha.reputacao} />}
      {!ficha?.perfil && ficha?.reputacao && ficha.reputacao.n > 0 && <div className="mt-1 text-xs font-semibold text-[#7A5A00]"><EstrelaMedia />{ficha.reputacao.media?.toFixed(1).replace(".", ",")} · {ficha.reputacao.n} {ficha.reputacao.n === 1 ? "avaliação" : "avaliações"}</div>}
      {p.bio && <p className="mt-2 text-sm text-[#1D2128]">{p.bio}</p>}
      {/* perfil do cadastro (20/11/2026): o que a pessoa oferece e procura, em /perfil/<apelido> */}
      {perfilPublico && <a href={`/perfil/${perfilPublico}`} target="_blank" rel="noopener" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#1D4ED8] hover:underline"><Icone nome="perfil" tamanho={14} />Ver o perfil completo</a>}
      {!souEu && !negociando && (
        <div className="mt-3 grid grid-cols-2 gap-1.5 text-center text-[12px] font-semibold">
          <button onClick={() => guardar(() => abrirChat(o))} className="rounded-xl bg-[#EEF3FF] px-2 py-2.5 text-[#1D4ED8]"><div className="grid place-items-center"><Icone nome="conversar" tamanho={20} /></div>Conversar</button>
          <button onClick={() => guardar(() => setNegociando(true))} className="rounded-xl bg-[#FFF4D6] px-2 py-2.5 text-[#7A5A00]"><div className="grid place-items-center"><Icone nome="negociar" tamanho={20} /></div>Negociar</button>
          <button onClick={call} className={`rounded-xl px-2 py-2.5 ${p.online ? "bg-[#E3F6EA] text-[#166534]" : "bg-[#F1F3F6] text-[#9AA3AD]"}`}><div className="grid place-items-center"><Icone nome="chamada" tamanho={20} /></div>Fazer uma chamada</button>
          <button onClick={amizade} className={`rounded-xl px-2 py-2.5 ${rel === "amigos" ? "bg-[#F1F3F6] text-[#5B6472]" : "bg-[#FDE8F3] text-[#9D174D]"}`}><div className="grid place-items-center"><Icone nome={rel === "amigos" ? "check" : "amizade"} tamanho={20} /></div>{rel === "amigos" ? "Amigos" : rel === "pedi" ? "Pedido enviado" : rel === "pediram" ? "Aceitar amizade" : "Amizade"}</button>
        </div>
      )}
      {negociando && <FormNegociar para={p} aoFechar={() => setNegociando(false)} aoEnviar={(msg) => { setNegociando(false); setAviso(msg); }} />}
      {redes && (
        <div className="mt-3 rounded-2xl bg-[#F1F3F6] p-3 text-sm">
          <div className="text-[12px] font-bold text-[#5B6472]">Redes sociais</div>
          <LinksRedes redes={redes} />
        </div>
      )}
      {!redes && !souEu && rel !== "amigos" && <div className="mt-2 text-[11px] text-[#5B6472]">As redes sociais aparecem quando vocês forem amigos.</div>}
      {precisa && <div className="mt-3 rounded-xl bg-[#FFF4D6] px-3 py-2 text-xs text-[#7A5A00]">Pra conversar, negociar, fazer call e ter amigos você precisa do seu personagem (<b>de R$ 19,90 por R$ 5,90/mês</b>). <button onClick={() => abrir("montar")} className="font-bold underline">Montar agora</button></div>}
      {aviso && <div className="mt-2 text-xs font-semibold text-[#166534]">{aviso}</div>}
    </div>
  );
}

const PERFIL_VAZIO: Perfil = { profissao: "", nicho: "", servicos: "", preco: "", local: "", portfolio: [], disponivel: true };

// Selos das missões de visitante (12/11/2026): medalhas com o nome, na ficha de quem conquistou
export function Selos({ ids }: { ids: string[] }) {
  const lista = ids.map((i) => MISSAO_POR_ID[i]).filter(Boolean);
  if (!lista.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1" aria-label="Selos conquistados">
      {lista.map((m) => <span key={m.id} title={`${m.nome}: ${m.desc}`} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm" style={{ background: m.cor }}><Icone nome={ICONE_MISSAO[m.id] ?? "selo"} tamanho={12} traco={2.2} />{m.nome}</span>)}
    </div>
  );
}

// Meus selos no painel do personagem: os conquistados coloridos, os outros apagados com o progresso
type MissaoProgresso = Missao & { feito: number; completa: boolean };
function MeusSelos() {
  const [lista, setLista] = useState<MissaoProgresso[] | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch("/api/workend/missoes", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])).then((j) => { if (vivo && Array.isArray(j)) setLista(j as MissaoProgresso[]); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  if (!lista?.length) return null;
  const feitas = lista.filter((m) => m.completa).length;
  const proxima = lista.find((m) => !m.completa);
  return (
    <div className="mb-4 rounded-2xl bg-[#F7F8FA] p-3">
      <div className="flex items-center justify-between"><div className="text-[13px] font-semibold">Meus selos</div><div className="text-[11px] font-semibold text-[#5B6472]">{feitas} de {lista.length}</div></div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {lista.map((m) => <span key={m.id} title={`${m.nome}: ${m.desc} (${m.feito}/${m.meta})`} className={`flex h-9 w-9 items-center justify-center rounded-full ${m.completa ? "text-white shadow-sm" : "text-[#8A93A3]"}`} style={{ background: m.completa ? m.cor : "#E3E6EA" }}><Icone nome={ICONE_MISSAO[m.id] ?? "selo"} tamanho={18} /></span>)}
      </div>
      <div className="mt-1.5 text-[11px] text-[#5B6472]">{proxima ? <>Próximo: <b className="text-[#1D2128]">{proxima.nome}</b> · {proxima.desc} ({proxima.feito}/{proxima.meta})</> : "Você conquistou todos os selos!"} Os selos aparecem na sua ficha para todo mundo.</div>
    </div>
  );
}

// Perfil profissional no formulário do personagem (11/11/2026): quem procura profissionais acha você em /encontrar
function CamposPerfil({ perfil, aberto, abrir, mudar }: { perfil: Perfil; aberto: boolean; abrir: () => void; mudar: (p: Partial<Perfil>) => void }) {
  if (!aberto) return <button type="button" onClick={abrir} className="mt-5 flex w-full items-start gap-2 rounded-2xl border-2 border-dashed border-[#1D4ED8]/40 px-3 py-2.5 text-left text-xs font-semibold text-[#1D4ED8]"><Icone nome="maleta" tamanho={18} className="mt-px shrink-0" /><span>Sou profissional: aparecer na busca de profissionais<span className="block font-normal text-[#5B6472]">Diga o que você faz, onde atende e quanto cobra. Empresas e clientes acham você em Encontrar.</span></span></button>;
  const port = [...perfil.portfolio, { titulo: "", url: "" }].slice(0, 3);
  const campo = "mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-normal outline-none focus:border-[#1D4ED8]";
  return (
    <div className="mt-5 rounded-2xl border border-[#1D4ED8]/20 bg-[#F5F8FF] p-3">
      <div className="text-[13px] font-semibold text-[#1D4ED8]">Perfil profissional<span className="ml-1 font-normal text-[#5B6472]">aparece na busca</span></div>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <label className="block text-xs font-semibold text-[#5B6472]">O que você faz<input value={perfil.profissao} onChange={(e) => mudar({ profissao: e.target.value.slice(0, 60) })} placeholder="Ex.: Fotógrafa de produtos" className={campo} /></label>
        <label className="block text-xs font-semibold text-[#5B6472]">Área<select value={perfil.nicho} onChange={(e) => mudar({ nicho: e.target.value })} className={`${campo} bg-white`}><option value="">Escolha</option>{NICHOS.map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}</select></label>
      </div>
      <label className="mt-2 block text-xs font-semibold text-[#5B6472]">Serviços que você oferece<textarea value={perfil.servicos} onChange={(e) => mudar({ servicos: e.target.value.slice(0, 600) })} rows={3} placeholder="Ex.: Fotos de cardápio e de loja, edição e entrega em 3 dias." className={campo} /></label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block text-xs font-semibold text-[#5B6472]">Preço<input value={perfil.preco} onChange={(e) => mudar({ preco: e.target.value.slice(0, 60) })} placeholder="Ex.: a partir de R$ 150" className={campo} /></label>
        <label className="block text-xs font-semibold text-[#5B6472]">Onde atende<input value={perfil.local} onChange={(e) => mudar({ local: e.target.value.slice(0, 60) })} placeholder="Ex.: Remoto · Aracaju (SE)" className={campo} /></label>
      </div>
      <div className="mt-2 text-xs font-semibold text-[#5B6472]">Trabalhos (links do portfólio)</div>
      {port.map((p, i) => (
        <div key={i} className="mt-1 grid grid-cols-[1fr_1.4fr] gap-1.5">
          <input value={p.titulo} onChange={(e) => { const l = [...port]; l[i] = { ...p, titulo: e.target.value.slice(0, 60) }; mudar({ portfolio: l.filter((x) => x.url || x.titulo) }); }} placeholder="Título" className="rounded-xl border border-black/10 px-3 py-1.5 text-sm" />
          <input value={p.url} onChange={(e) => { const l = [...port]; l[i] = { ...p, url: e.target.value.slice(0, 200) }; mudar({ portfolio: l.filter((x) => x.url || x.titulo) }); }} placeholder="Link (Behance, Drive, site…)" className="rounded-xl border border-black/10 px-3 py-1.5 text-sm" />
        </div>
      ))}
      <label className="mt-2 flex items-center gap-2 text-xs text-[#5B6472]"><input type="checkbox" checked={perfil.disponivel} onChange={(e) => mudar({ disponivel: e.target.checked })} /> Disponível para novos trabalhos</label>
    </div>
  );
}

// O perfil profissional na ficha de outra pessoa
function PerfilNaFicha({ perfil, reputacao }: { perfil: Perfil; reputacao?: { media: number | null; n: number } }) {
  return (
    <div className="mt-2 rounded-2xl bg-[#F5F8FF] p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><b>{perfil.profissao || "Profissional"}</b>{perfil.disponivel ? <span className="rounded-full bg-[#E3F6EA] px-1.5 py-0.5 text-[10px] font-bold text-[#166534]">disponível</span> : <span className="rounded-full bg-[#F1F3F6] px-1.5 py-0.5 text-[10px] font-bold text-[#5B6472]">agenda cheia</span>}{reputacao && reputacao.n > 0 && <span className="text-xs font-semibold text-[#7A5A00]"><EstrelaMedia />{reputacao.media?.toFixed(1).replace(".", ",")} ({reputacao.n})</span>}</div>
      {(perfil.local || perfil.preco) && <div className="text-xs text-[#5B6472]">{[perfil.local, perfil.preco].filter(Boolean).join(" · ")}</div>}
      {perfil.servicos && <p className="mt-1 whitespace-pre-line text-xs text-[#1D2128]">{perfil.servicos}</p>}
      {perfil.portfolio.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{perfil.portfolio.map((p) => <a key={p.url} href={p.url} target="_blank" rel="noreferrer nofollow" className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#1D4ED8]">{p.titulo}</a>)}</div>}
    </div>
  );
}

export function LinksRedes({ redes }: { redes: Redes }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {redes.instagram && <a href={`https://instagram.com/${redes.instagram}`} target="_blank" rel="noreferrer" className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#9D174D]">@{redes.instagram}</a>}
      {redes.whatsapp && <a href={`https://wa.me/55${redes.whatsapp}`} target="_blank" rel="noreferrer" className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#166534]">WhatsApp</a>}
      {redes.linkedin && <a href={redes.linkedin.startsWith("http") ? redes.linkedin : `https://linkedin.com/in/${redes.linkedin}`} target="_blank" rel="noreferrer" className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#1D4ED8]">LinkedIn</a>}
      {redes.site && <a href={redes.site.startsWith("http") ? redes.site : `https://${redes.site}`} target="_blank" rel="noreferrer" className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#1D2128]">Site</a>}
    </div>
  );
}

// Formulário de proposta (o que você propõe, detalhes, valor opcional)
export function FormNegociar({ para, aoFechar, aoEnviar }: { para: { usuarioId: string; nome: string }; aoFechar: () => void; aoEnviar: (msg: string) => void }) {
  const negociar = usePersonagem((s) => s.negociar);
  const [f, setF] = useState({ titulo: "", texto: "", valor: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enviar = async () => { setEnviando(true); const e = await negociar(para.usuarioId, f); setEnviando(false); if (e) setErro(e); else aoEnviar(`Proposta enviada pra ${para.nome}. Acompanhe em Minha rede › Negociações.`); };
  return (
    <div className="mt-3 rounded-2xl border border-[#D97706]/30 bg-[#FFFBEB] p-3">
      <div className="text-[12px] font-bold text-[#7A5A00]"><Icone nome="negociar" tamanho={13} className="mr-1 inline align-[-2px]" />Proposta pra {para.nome}</div>
      <input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value.slice(0, 80) })} placeholder="O que você propõe? Ex.: Parceria de fornecimento" className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#D97706]" />
      <textarea value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value.slice(0, 1000) })} rows={3} placeholder="Detalhes: prazos, o que cada um faz, condições…" className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#D97706]" />
      <input value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value.replace(/[^\d.,]/g, "").slice(0, 12) })} placeholder="Valor em R$ (opcional)" inputMode="decimal" className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#D97706]" />
      {erro && <div className="mt-1 text-xs font-semibold text-[#E2575B]">{erro}</div>}
      <div className="mt-2 flex gap-1.5"><button onClick={aoFechar} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#5B6472]">Cancelar</button><button onClick={enviar} disabled={enviando || f.titulo.trim().length < 3} className="flex-1 rounded-xl bg-[#D97706] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{enviando ? "Enviando…" : "Enviar proposta"}</button></div>
    </div>
  );
}

// Uma mensagem do chat: texto, proposta (cartão com aceitar/recusar), pedido/aceite de amizade
function Bolha({ m, minha, outroNome, status }: { m: Mensagem; minha: boolean; outroNome: string; status?: string }) {
  const responderNegociacao = usePersonagem((s) => s.responderNegociacao);
  const [erro, setErro] = useState<string | null>(null);
  if (m.tipo === "negocio") {
    let d: { negociacaoId?: string; titulo?: string; texto?: string; valor?: number | null } = {}; try { d = JSON.parse(m.texto); } catch { d = { titulo: m.texto }; }
    const st = status ?? "aberta";
    const cor = st === "aceita" ? "#16A34A" : st === "recusada" || st === "cancelada" ? "#E2575B" : st === "concluida" || st === "avaliada" ? "#1D4ED8" : st === "entregue" ? "#7C3AED" : "#D97706";
    const rotulo = st === "aberta" ? "Proposta aberta" : st === "aceita" ? "Em andamento" : st === "entregue" ? "Esperando confirmação" : st === "recusada" ? "Proposta recusada" : st === "cancelada" ? "Proposta cancelada" : "Negócio concluído";
    return (
      <div className={`flex ${minha ? "justify-end" : "justify-start"}`}>
        <div className="max-w-[88%] rounded-2xl border-2 bg-white px-3 py-2 text-sm text-[#1D2128]" style={{ borderColor: cor }}>
          <div className="text-[12px] font-bold" style={{ color: cor }}><Icone nome="negociar" tamanho={12} className="mr-1 inline align-[-2px]" />{rotulo}</div>
          <div className="font-bold">{d.titulo}</div>
          {d.texto && <div className="text-xs text-[#5B6472]">{d.texto}</div>}
          {d.valor != null && <div className="mt-0.5 text-xs font-bold">{brl(Number(d.valor))}</div>}
          {st === "aberta" && d.negociacaoId && (minha
            ? <button onClick={async () => { const e = await responderNegociacao(d.negociacaoId!, "cancelada"); if (e) setErro(e); }} className="mt-1.5 text-[11px] font-semibold text-[#5B6472] underline">Cancelar proposta</button>
            : <div className="mt-1.5 flex gap-1.5"><button onClick={async () => { const e = await responderNegociacao(d.negociacaoId!, "aceita"); if (e) setErro(e); }} className="rounded-lg bg-[#16A34A] px-2.5 py-1 text-xs font-bold text-white">Aceitar</button><button onClick={async () => { const e = await responderNegociacao(d.negociacaoId!, "recusada"); if (e) setErro(e); }} className="rounded-lg bg-[#F1F3F6] px-2.5 py-1 text-xs font-bold text-[#5B6472]">Recusar</button></div>)}
          {st === "aceita" && d.negociacaoId && <button onClick={async () => { const e = await responderNegociacao(d.negociacaoId!, "concluida"); if (e) setErro(e); }} className="mt-1.5 text-[11px] font-semibold text-[#1D4ED8] underline">Marcar como concluído</button>}
          {(st === "entregue" || st === "concluida" || st === "avaliada") && <a href="/app/rede" className="mt-1.5 block text-[11px] font-semibold text-[#1D4ED8] underline">{st === "entregue" ? "Confirmar ou responder em Minha rede" : "Avaliar em Minha rede"}</a>}
          {erro && <div className="mt-1 text-[11px] font-semibold text-[#E2575B]">{erro}</div>}
        </div>
      </div>
    );
  }
  if (m.tipo === "negocio_status") {
    let d: { titulo?: string; status?: string } = {}; try { d = JSON.parse(m.texto); } catch { d = {}; }
    const quem = minha ? "Você" : outroNome;
    const verbo = d.status === "aceita" ? "aceitou a proposta" : d.status === "recusada" ? "recusou a proposta" : d.status === "cancelada" ? "cancelou a proposta" : d.status === "entregue" ? "marcou como concluído o negócio" : d.status === "avaliada" ? "avaliou o negócio" : "confirmou a conclusão do negócio";
    return <div className="py-0.5 text-center text-[11px] text-[#5B6472]"><Icone nome="negociar" tamanho={13} className="mr-1 inline align-[-2px]" />{quem} {verbo} “{d.titulo}”</div>;
  }
  if (m.tipo === "amizade_pedido" || m.tipo === "amizade_aceite" || m.tipo === "chamada") return <div className="py-0.5 text-center text-[11px] text-[#5B6472]"><Icone nome={m.tipo === "chamada" ? "chamada" : "amizade"} tamanho={13} className="mr-1 inline align-[-2px]" />{minha ? "Você" : outroNome}: {m.texto}</div>;
  return (
    <div className={`flex ${minha ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-sm ${minha ? "bg-[#1D4ED8] text-white" : "bg-[#F1F3F6] text-[#1D2128]"}`}>{m.texto}</div>
    </div>
  );
}

// Corpo do chat (lista + campo), usado no mapa e no painel Minha rede
export function CorpoChat({ o, altura = "h-full" }: { o: Outro; altura?: string }) {
  const meu = usePersonagem((s) => s.meu);
  const mensagens = usePersonagem((s) => s.mensagens);
  const enviar = usePersonagem((s) => s.enviar);
  const ligar = usePersonagem((s) => s.ligar);
  const [texto, setTexto] = useState("");
  const [negociando, setNegociando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [mensagens.length]);
  const mandar = async () => { if (!texto.trim()) return; const e = await enviar("chat", texto.trim()); if (e) setErro(e); else { setTexto(""); setErro(null); } };
  // status atual de cada proposta (a última mensagem de status vence)
  const statusDe: Record<string, string> = {};
  for (const m of mensagens) if (m.tipo === "negocio_status") { try { const d = JSON.parse(m.texto); if (d.negociacaoId) statusDe[d.negociacaoId] = d.status; } catch { /* ignora */ } }
  const pediuAmizade = mensagens.some((m) => m.tipo === "amizade_pedido" && m.deId === o.usuarioId) && !mensagens.some((m) => m.tipo === "amizade_aceite");
  return (
    <div className={`flex ${altura} min-h-0 flex-col`}>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        {mensagens.length === 0 && <div className="py-6 text-center text-xs text-[#5B6472]">Diga oi para começar a conversa</div>}
        {mensagens.map((m) => { let nid: string | undefined; if (m.tipo === "negocio") { try { nid = JSON.parse(m.texto).negociacaoId; } catch { /* ignora */ } } return <Bolha key={m.id} m={m} minha={m.deId === meu?.usuarioId} outroNome={o.nome} status={nid ? statusDe[nid] : undefined} />; })}
        {pediuAmizade && o.relacao?.status === "pediram" && o.relacao.id && <AceitarAmizadeInline pedidoId={o.relacao.id} nome={o.nome} />}
        <div ref={fim} />
      </div>
      <div className="border-t border-black/5 p-2">
        {negociando ? <FormNegociar para={o} aoFechar={() => setNegociando(false)} aoEnviar={() => setNegociando(false)} /> : (
          <>
            <div className="mb-1 flex gap-1 text-[11px]"><button onClick={() => setNegociando(true)} className="rounded-full bg-[#FFF4D6] px-2 py-0.5 font-semibold text-[#7A5A00] inline-flex items-center gap-1"><Icone nome="negociar" tamanho={13} />Negociar</button><button onClick={async () => { const e = await ligar(o, true); if (e) setErro(e); }} className="rounded-full bg-[#E3F6EA] px-2 py-0.5 font-semibold text-[#166534] inline-flex items-center gap-1"><Icone nome="chamada" tamanho={13} />Chamada</button></div>
            <div className="flex gap-1.5"><input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void mandar(); }} placeholder="Escreva…" className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-[#1D4ED8]" /><button onClick={mandar} className="rounded-xl bg-[#1D4ED8] px-3 py-2 text-sm font-bold text-white">Enviar</button></div>
          </>
        )}
        {erro && <div className="mt-1 text-xs font-semibold text-[#E2575B]">{erro}</div>}
      </div>
    </div>
  );
}
function AceitarAmizadeInline({ pedidoId, nome }: { pedidoId: string; nome: string }) {
  const responder = usePersonagem((s) => s.responderAmizade);
  return <div className="flex gap-1.5"><button onClick={() => void responder(pedidoId, true)} className="flex-1 rounded-xl bg-[#FDE8F3] px-3 py-2 text-xs font-bold text-[#9D174D]">Aceitar amizade de {nome}</button><button onClick={() => void responder(pedidoId, false)} className="rounded-xl bg-[#F1F3F6] px-3 py-2 text-xs font-bold text-[#5B6472]">Recusar</button></div>;
}

// Janela de chat no mapa
export function ChatPersonagem() {
  const painel = usePersonagem((s) => s.painel);
  const o = usePersonagem((s) => s.outroSelecionado);
  const fechar = usePersonagem((s) => s.fechar);
  const selecionarOutro = usePersonagem((s) => s.selecionarOutro);
  if (painel !== "chat" || !o) return null;
  return (
    <div className={`${FLUTUANTE} ${LARGO} painel-entra flex h-[72vh] flex-col overflow-hidden sm:h-[min(70vh,560px)]`}>
      <div className="flex items-center justify-between border-b border-black/5 p-3">
        <button onClick={() => selecionarOutro(o)} className="flex items-center gap-2 text-left"><MiniAvatar boneco={o.boneco} roupa={o.roupa} tamanho={36} /><div><div className="text-sm font-bold leading-tight">{o.nome}</div><div className="text-[11px] text-[#5B6472]">{o.online ? <span className="text-[#16A34A]">● online · ao vivo</span> : "offline · recebe quando entrar"}</div></div></button>
        <button onClick={fechar} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5" aria-label="Fechar"><Icone nome="fechar" tamanho={16} /></button>
      </div>
      <CorpoChat o={o} altura="flex-1" />
    </div>
  );
}

// Caixa de entrada (lista de conversas)
export function CaixaPersonagem() {
  const painel = usePersonagem((s) => s.painel);
  const conversas = usePersonagem((s) => s.conversas);
  const carregarCaixa = usePersonagem((s) => s.carregarCaixa);
  const abrirChat = usePersonagem((s) => s.abrirChat);
  const fechar = usePersonagem((s) => s.fechar);
  useEffect(() => { if (painel === "caixa") void carregarCaixa(); }, [painel, carregarCaixa]);
  if (painel !== "caixa") return null;
  return (
    <div className={`${FLUTUANTE} ${ESTREITO} painel-entra overflow-y-auto p-3`}>
      <div className="flex items-center justify-between px-1"><div className="text-sm font-bold">Minhas conversas</div><button onClick={fechar} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5" aria-label="Fechar"><Icone nome="fechar" tamanho={16} /></button></div>
      <div className="mt-2 max-h-[60vh] space-y-1 overflow-y-auto">
        {conversas.length === 0 && <div className="py-6 text-center text-xs text-[#5B6472]">Nenhuma conversa ainda. Clique num personagem no mapa.</div>}
        {conversas.map((c) => (
          <button key={c.outroId} onClick={() => abrirChat({ usuarioId: c.outroId, nome: c.nome, boneco: c.boneco, roupa: c.roupa, bio: "", x: 0, z: 0, rot: 0, online: c.online })} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-[#F1F3F6]">
            <MiniAvatar boneco={c.boneco} roupa={c.roupa} tamanho={36} />
            <div className="min-w-0 flex-1"><div className="flex items-center gap-1 text-sm font-bold">{c.nome}{c.online && <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />}</div><div className="truncate text-xs text-[#5B6472]">{c.tipo === "negocio" ? <Icone nome="negociar" tamanho={12} className="mr-1 inline align-[-1px]" /> : null}{c.ultimo}</div></div>
            {c.naoLidas > 0 && <span className="rounded-full bg-[#1D4ED8] px-1.5 py-0.5 text-[10px] font-bold text-white">{c.naoLidas}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
