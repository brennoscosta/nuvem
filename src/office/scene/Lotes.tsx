"use client";
// Lotes à venda: casas e terrenos vazios. 20/11/2026 (pedido do dono: "parece casas abandonadas"): as casas deixaram de
// ser os modelos GLB do Higgsfield (textura com mancha e rachadura) e são desenhadas em código, limpas e sentadas num
// embasamento acima do quintal (scene/KitPredio.tsx › CasasDesenhadas). Desde 18/11/2026 cada lote
// livre é um "ponto disponível" (scene/PontoDisponivel.tsx): divisa com mureta ou meio-fio, quintal bem acabado, número
// do lote e a placa "Ponto disponível · Lote N", acesa à noite. As peças fixas são juntadas num <Estatico>.
import { ESPACOS_DO_LOTE } from "../data/quiosques";
import { Icone } from "../ui/Icone";
import * as THREE from "three";
import { useLotesComEscritorio } from "./EscritorioCliente";
import { useEffect, useMemo } from "react";
import { Obra, LOTES_EM_OBRA_VISTOS } from "./ObraFesta";
import { alturaPredio } from "../data/escritorio";
import type { ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { caixa, mat, plano } from "./geo";
import { CasasDesenhadas, type CasaLote } from "./KitPredio";
import { ArvoresInstanciadas } from "./Arvores";
import { Estatico } from "./Estatico";
import { QuintaisEstaticos, LuzesQuintais, detalhesDosQuintais, type Quintal } from "./PontoDisponivel";
import { GramadoLotes, TufosFlores } from "./Gramado";
import { frenteDoLote, LOTE, nomeNicho } from "../data/mundo";
import { useMundo, LOTES, LOTE_POR_CHAVE, useAgora, promocaoAtiva, type Rascunho } from "../mundoStore";
import { useDestaque } from "../destaque";
import { usePersonagem } from "../personagemStore";

// emObra: lotes reservados (sem pagar): a casa sai e entra a obra (12/11/2026)
function listar(comEscritorio: Set<string>, emObra: Set<string>) {
  const quintais: Quintal[] = [];
  for (const l of LOTES) {
    if (l.lote.tipo === "praca") continue; // a praça tem a cena dela (scene/Praca.tsx)
    if (comEscritorio.has(l.chave) || emObra.has(l.chave)) continue; // o escritório do cliente (ou a obra) ocupa o lote: a casa/terreno original some
    quintais.push({ l, casa: l.lote.tipo === "casa" ? { modelo: l.lote.modelo, escala: l.lote.escala ?? 1 } : null, arvore: l.lote.tipo === "vazio" && !!l.lote.arvore });
  }
  return quintais;
}

export function Lotes() {
  const comEscritorio = useLotesComEscritorio();
  const terrenosMundo = useMundo((s) => s.terrenos);
  const chavesObra = Object.values(terrenosMundo).filter((t) => t.status === "reservado").map((t) => t.chave).sort().join("|");
  const { quintais, detalhes, casas } = useMemo(() => {
    const quintais = listar(comEscritorio, new Set(chavesObra ? chavesObra.split("|") : []));
    const casas: CasaLote[] = quintais.filter((q) => q.casa).map((q) => ({ chave: q.l.chave, x: q.l.centro[0], z: q.l.centro[1], rot: frenteDoLote(q.l.k), modelo: q.casa!.modelo, escala: q.casa!.escala, numero: q.l.numero }));
    return { quintais, detalhes: detalhesDosQuintais(quintais), casas };
  }, [comEscritorio, chavesObra]);
  const reservados = useMundo((s) => s.terrenos);
  const selecionado = useMundo((s) => s.loteSelecionado);
  const hover = useMundo((s) => s.loteHover);
  const rascunho = useMundo((s) => s.rascunho);
  const chavesReservadas = Object.keys(reservados).sort().join("|");
  const vagas = useMundo((s) => s.vagas);
  const rascunhoEsc = useMundo((s) => s.rascunhoEscritorio);
  const agora = useAgora();
  const destaqueSemana = useDestaque(); // loja destaque da semana (13/11/2026): selo dourado no balão
  // lote duplo: o balão do principal vai para o meio dos dois terrenos; a ampliação em obras mostra o tapume com a marca do principal
  const anexoAtivo = useMemo(() => { const m: Record<string, string> = {}; for (const t of Object.values(reservados)) if (t.anexoDe && t.status === "ativo") m[t.anexoDe] = t.chave; return m; }, [reservados]);
  // placa "Ponto disponível" só nos lotes livres (o lote reservado ganha a placa da empresa). O lote em rascunho também perde a placa.
  const emRascunho = rascunho && selecionado ? selecionado : null;
  // espaço de 5 × 5 m (24/11/2026): o lote com espaço reservado, alugado ou em rascunho também perde a placa, que fica
  // na faixa da frente, onde os espaços nascem (data/quiosques.ts › ESPACOS)
  const comPlaca = useMemo(() => {
    const res = new Set(chavesReservadas ? chavesReservadas.split("|") : []);
    const ocupado = (ch: string) => (ESPACOS_DO_LOTE[ch] ?? []).some((e) => res.has(e.chave) || e.chave === emRascunho);
    return new Set(LOTES.filter((l) => !res.has(l.chave) && l.chave !== emRascunho && !ocupado(l.chave)).map((l) => l.chave));
  }, [chavesReservadas, emRascunho]);
  return (
    <group>
      <Estatico key={chavesReservadas + "|" + (emRascunho ?? "") + "|" + [...comEscritorio].join(",")}>
        <QuintaisEstaticos quintais={quintais} comPlaca={comPlaca} />
      </Estatico>
      {/* grama aparada, capim, flores e azaleias dos quintais (instanciados) e as luzes da noite */}
      <GramadoLotes areas={detalhes.areas} />
      <TufosFlores tufos={detalhes.tufos} flores={detalhes.flores} />
      <ArvoresInstanciadas especie="azaleia" itens={detalhes.azaleias} />
      <LuzesQuintais varandas={detalhes.varandas} lampioes={detalhes.lampioes} pocas={detalhes.pocas} />
      <CasasDesenhadas casas={casas} />
      {/* lotes reservados: tapume e placa da empresa; o rascunho do painel aparece ao vivo */}
      {LOTES.map((l) => {
        const t = reservados[l.chave];
        const r: Rascunho | null = l.chave === emRascunho ? rascunho : null;
        if (!t && !r) return null;
        if (t?.anexoDe) {
          const p = reservados[t.anexoDe];
          if (t.status === "ativo" && comEscritorio.has(l.chave)) return null; // o prédio do principal já ocupa este terreno
          return <LoteReservado key={l.chave} chave={l.chave} nome={p?.empresaNome ?? t.empresaNome} cor={p?.cor ?? t.cor} logo={p?.temLogo ? `/api/terrenos/${encodeURIComponent(p.chave)}/logo` : null} nicho={p?.nicho} ativo={false} comEscritorio={false} semBalao obra={t.status === "reservado"} />;
        }
        const anexo = anexoAtivo[l.chave]; const meio = anexo && LOTE_POR_CHAVE[anexo] ? (LOTE_POR_CHAVE[anexo].centro[0] - l.centro[0]) / 2 : 0;
        // o balão sobe com o prédio (andares a mais e cobertura); no lote em edição, segue o rascunho
        const esc = l.chave === selecionado && rascunhoEsc ? rascunhoEsc : t?.escritorio ?? null;
        const alturaBalao = t?.status === "ativo" && esc && comEscritorio.has(l.chave) ? Math.max(meio ? 12.4 : 10.5, alturaPredio(esc, !!anexo) + 2.2) : undefined;
        return <LoteReservado key={l.chave} chave={l.chave} nome={r?.empresaNome ?? t?.empresaNome ?? ""} cor={r?.cor ?? t?.cor ?? "#1D4ED8"} logo={r ? r.logoDataUrl : t?.temLogo ? `/api/terrenos/${encodeURIComponent(l.chave)}/logo` : null} nicho={r?.nicho ?? t?.nicho} ativo={t?.status === "ativo"} comEscritorio={comEscritorio.has(l.chave)} meio={meio} vagas={t?.status === "ativo" ? vagas[l.chave] ?? 0 : 0} promo={t?.status === "ativo" ? promocaoAtiva(t, agora)?.texto ?? null : null} alturaBalao={alturaBalao} obra={t?.status === "reservado"} semana={t?.status === "ativo" && destaqueSemana?.chave === l.chave} />;
      })}
      {/* caixas de clique + contorno do lote sob o mouse / selecionado */}
      {LOTES.map((l) => <AlvoLote key={l.chave} chave={l.chave} centro={l.centro} estado={selecionado === l.chave ? "sel" : hover === l.chave ? "hover" : null} />)}
    </group>
  );
}

// Plano invisível que recebe o clique do lote + moldura quando está sob o mouse ou selecionado
function AlvoLote({ chave, centro, estado }: { chave: string; centro: [number, number]; estado: "sel" | "hover" | null }) {
  const selecionarLote = useMundo((s) => s.selecionarLote);
  const setLoteHover = useMundo((s) => s.setLoteHover);
  const meio = LOTE / 2 - 0.4;
  const cor = estado === "sel" ? "#1D4ED8" : "#FFFFFF";
  return (
    <group position={[centro[0], 0, centro[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} geometry={plano(LOTE - 0.8, LOTE - 0.8)} visible={false}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          // dentro deste prédio (17/11/2026): tocar no chão anda por dentro (data/plantaInterna.ts), não abre o cartão
          const st = usePersonagem.getState(), p = st.predio, principal = useMundo.getState().terrenos[chave]?.anexoDe ?? chave;
          if (p && p.chave === principal && (p.fase === "recepcao" || p.fase === "dentro")) { st.irPara(e.point.x, e.point.z); return; }
          selecionarLote(chave);
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setLoteHover(chave); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setLoteHover(null); document.body.style.cursor = ""; }} />
      {estado && (
        <group>
          {[[0, -meio, LOTE - 0.8, 0.25], [0, meio, LOTE - 0.8, 0.25], [-meio, 0, 0.25, LOTE - 0.8], [meio, 0, 0.25, LOTE - 0.8]].map(([x, z, w, d], i) => (
            <mesh key={i} geometry={caixa(w, 0.08, d)} material={mat(cor, { emissive: cor, ei: estado === "sel" ? 0.6 : 0.3 })} position={[x, 0.08, z]} />
          ))}
        </group>
      )}
    </group>
  );
}

// Textura da placa da empresa: faixa na cor, nome grande, logo (quando carregar) e "Reservado · WorkEnd"
const cachePlacas = new Map<string, THREE.CanvasTexture>();
function texturaEmpresa(nome: string, cor: string, logo: string | null, ativo = false) {
  const k = `${nome}|${cor}|${logo ?? ""}|${ativo ? 1 : 0}`;
  const pronta = cachePlacas.get(k); if (pronta) return pronta;
  const c = document.createElement("canvas"); c.width = 512; c.height = 300;
  const g = c.getContext("2d")!;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const desenhar = (img: HTMLImageElement | null) => {
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 512, 300);
    g.fillStyle = cor; g.fillRect(0, 0, 512, 46);
    g.fillStyle = "#FFFFFF"; g.font = "bold 22px Inter, Arial, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(ativo ? "ABERTA" : "EM OBRAS", 18, 24);
    g.textAlign = "right"; g.fillText("WORKEND", 494, 24);
    const x0 = img ? 170 : 24, larg = 512 - x0 - 24;
    if (img) { const s = 120, r = Math.min(s / img.width, s / img.height), w = img.width * r, h = img.height * r; g.drawImage(img, 24 + (s - w) / 2, 95 + (s - h) / 2, w, h); }
    g.fillStyle = "#0F172A"; g.textAlign = img ? "left" : "center"; g.textBaseline = "alphabetic";
    let tam = 56; g.font = `bold ${tam}px Inter, Arial, sans-serif`;
    const texto = nome.trim() || "Sua empresa";
    while (g.measureText(texto).width > larg && tam > 22) { tam -= 4; g.font = `bold ${tam}px Inter, Arial, sans-serif`; }
    g.fillText(texto, img ? x0 : 256, 165, larg);
    g.fillStyle = "#64748B"; g.font = "24px Inter, Arial, sans-serif"; g.fillText(ativo ? "Empresa ativa · visite por dentro" : "Reservado · aguardando pagamento", img ? x0 : 256, 215, larg);
    g.fillStyle = cor; g.fillRect(0, 288, 512, 12);
    tex.needsUpdate = true;
  };
  desenhar(null);
  if (logo) { const img = new Image(); img.onload = () => desenhar(img); img.src = logo; }
  cachePlacas.set(k, tex);
  if (cachePlacas.size > 60) { const primeira = cachePlacas.keys().next().value; if (primeira) { cachePlacas.get(primeira)?.dispose(); cachePlacas.delete(primeira); } }
  return tex;
}

// Balão com o nome da empresa flutuando sobre a loja (tamanho fixo na tela, grande e legível). Toda loja tem um:
// as dos clientes, a Nuvem e a lanchonete.
// destaque (11/11/2026, vindo de /encontrar com ?nicho=): as lojas da área pulsam e as outras ficam apagadas
export function nichoDestacado(): string | null { return typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("nicho"); }
export function Balao({ position, nome, cor, logo, subtitulo, onClick, apagado = false, destaque = false, selo = null, promo = null, semana = false }: { position: [number, number, number]; nome: string; cor: string; logo?: string | null; subtitulo: string; onClick?: () => void; apagado?: boolean; destaque?: boolean; selo?: string | null; promo?: string | null; semana?: boolean }) {
  return (
    <Html position={position} zIndexRange={[4, 0]} style={{ pointerEvents: "none", transform: "translate(-50%, -100%)" }}>
      <div className={`flex w-max select-none flex-col items-center transition-[opacity,transform] duration-500 ${apagado ? "scale-75 opacity-25" : ""} ${destaque ? "balao-destaque" : ""}`}>
        {/* selo em cima do balão (ex.: "Estamos contratando", 12/11/2026) */}
        {/* loja destaque da semana (13/11/2026) */}
        {semana && <div className={`${promo || selo ? "mb-1" : "-mb-1.5"} flex items-center gap-1 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#FACC15] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-[#3B2A00] shadow-md ring-2 ring-white`}><Icone nome="estrela" tamanho={13} traco={2.2} />Destaque da semana</div>}
        {/* promoção na fachada (12/11/2026) */}
        {promo && <div className={`balao-promo ${selo ? "mb-1" : "-mb-1.5"} flex items-center gap-1 rounded-full bg-[#E11D48] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-white shadow-md ring-2 ring-white`}><Icone nome="etiqueta" tamanho={13} traco={2.2} />{promo}</div>}
        {selo && <div className="-mb-1.5 rounded-full bg-[#FACC15] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#1D2128] shadow-md ring-2 ring-white">{selo}</div>}
        <div className={`pointer-events-auto flex items-center gap-2.5 rounded-2xl px-4 py-2 shadow-xl ${onClick ? "cursor-pointer" : ""}`} style={{ background: cor }} onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
          {logo && <img src={logo} alt="" crossOrigin="anonymous" className="h-9 w-9 rounded-lg bg-white/95 object-contain p-0.5" />}
          <div className="leading-tight">
            <div className="text-[20px] font-black tracking-tight text-white drop-shadow">{nome.trim() || "Sua empresa"}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/80">{subtitulo}</div>
          </div>
        </div>
        <div className="h-0 w-0 border-x-[9px] border-t-[10px] border-x-transparent" style={{ borderTopColor: cor }} />
      </div>
    </Html>
  );
}

// Lote reservado: tapume baixo em volta (branco com faixa na cor da empresa) e placa grande na frente (enquanto não paga)
function LoteReservado({ chave, nome, cor, logo, nicho, ativo = false, comEscritorio = false, semBalao = false, meio = 0, vagas = 0, promo = null, alturaBalao, obra = false, semana = false }: { chave: string; nome: string; cor: string; logo: string | null; nicho?: string; ativo?: boolean; comEscritorio?: boolean; semBalao?: boolean; meio?: number; vagas?: number; promo?: string | null; alturaBalao?: number; obra?: boolean; semana?: boolean }) {
  const l = LOTE_POR_CHAVE[chave];
  // a sessão viu este lote em obra: quando ele virar prédio, o prédio sobe com animação (scene/ObraFesta.tsx)
  useEffect(() => { if (obra) LOTES_EM_OBRA_VISTOS.add(chave); }, [obra, chave]);
  const tex = useMemo(() => texturaEmpresa(nome, cor, logo, ativo), [nome, cor, logo, ativo]);
  const filtro = useMemo(() => nichoDestacado(), []);
  if (!l) return null;
  const [x, z] = l.centro; const rot = frenteDoLote(l.k); const frente = l.k >= 2 ? 1 : -1;
  const m = LOTE / 2 - 0.6, comp = LOTE - 1.2;
  const lados: [number, number, number, number][] = [[0, -m, comp, 0.12], [0, m, comp, 0.12], [-m, 0, 0.12, comp], [m, 0, 0.12, comp]];
  return (
    <group position={[x, 0, z]}>
      {!comEscritorio && lados.map(([lx, lz, w, d], i) => (
        <group key={i}>
          <mesh geometry={caixa(w, 1.1, d)} material={mat("#F4F4F2", { rough: 0.9 })} position={[lx, 0.75, lz]} castShadow />
          <mesh geometry={caixa(w + (w > d ? 0 : 0.02), 0.3, d + (w > d ? 0.02 : 0))} material={mat(cor, { rough: 0.7 })} position={[lx, 1.45, lz]} />
        </group>
      ))}
      {obra && <Obra frente={frente as 1 | -1} semente={(l.numero * 1.37) % 6.28} />}
      {!semBalao && <Balao position={[meio, alturaBalao ?? (comEscritorio ? (meio ? 12.4 : 10.5) : obra ? 9.5 : 7.5), 0]} nome={nome} cor={cor} logo={logo} subtitulo={ativo ? nomeNicho(nicho) : "Reservado · em obras"} onClick={() => useMundo.getState().selecionarLote(chave)} apagado={!!filtro && (!ativo || nicho !== filtro)} destaque={!!filtro && ativo && nicho === filtro} selo={vagas > 0 ? `Estamos contratando · ${vagas}` : null} promo={promo} semana={semana} />}
      {/* placa na frente só enquanto está reservado: comprou, a placa sai e fica o prédio com o letreiro */}
      {!ativo && <group position={[l.k % 2 ? -3.5 : 3.5, 0, frente * (m - 0.2)]} rotation={[0, rot, 0]}>
        {[-1.3, 1.3].map((px) => <mesh key={px} geometry={caixa(0.12, 2.6, 0.12)} material={mat("#3A3F47")} position={[px, 1.3, 0]} castShadow />)}
        <mesh geometry={caixa(3.0, 1.75, 0.08)} material={mat("#F7F7F5")} position={[0, 2.1, 0]} castShadow />
        <mesh geometry={plano(2.9, 1.7)} position={[0, 2.1, 0.045]}>
          <meshBasicMaterial key={tex.uuid} map={tex} toneMapped={false} />
        </mesh>
      </group>}
    </group>
  );
}


