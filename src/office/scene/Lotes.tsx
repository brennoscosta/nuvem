"use client";
// Lotes à venda: casinhas (modelos do Higgsfield, instanciados por modelo) e terrenos vazios, todos com a placa
// "À VENDA" na frente. As placas são juntadas num <Estatico> (uma textura compartilhada → um draw call).
import * as THREE from "three";
import { useLotesComEscritorio } from "./EscritorioCliente";
import { useEffect, useMemo } from "react";
import { Obra, LOTES_EM_OBRA_VISTOS } from "./ObraFesta";
import { alturaPredio } from "../data/escritorio";
import type { ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { caixa, cilindro, esfera, mat, plano } from "./geo";
import { ComFallback, type ItemInstancia } from "./Modelos";
import { ModeloInstanciadoNoite } from "./PredioMaterial";
import { ArvoresInstanciadas } from "./Arvores";
import { Estatico } from "./Estatico";
import { QUARTEIROES, centroLote, frenteDoLote, LOTE, nomeNicho, type ModeloCasa } from "../data/mundo";
import { useMundo, LOTES, LOTE_POR_CHAVE, useAgora, promocaoAtiva, type Rascunho } from "../mundoStore";
import { useDestaque } from "../destaque";

// Altura real (m) e pra onde o modelo olha (rotação que leva a frente do GLB pro +z)
const CASA: Record<ModeloCasa, { altura: number; frente: number }> = {
  casaVelha: { altura: 5.2, frente: -Math.PI / 2 },
  casaTerrea: { altura: 5.0, frente: -Math.PI / 2 },
  casaSobrado: { altura: 7.6, frente: -Math.PI / 2 },
  casaColonial: { altura: 7.8, frente: -Math.PI / 2 },
  casaModerna: { altura: 4.6, frente: -Math.PI / 2 },
};

type Casa = { modelo: ModeloCasa; pos: [number, number, number]; rot: number; escala: number };
type Terreno = { pos: [number, number, number]; rot: number; arvore: boolean };

// emObra: lotes reservados (sem pagar): a casa sai e entra a obra (12/11/2026)
function listar(comEscritorio: Set<string>, emObra: Set<string>) {
  const casas: Casa[] = [], terrenos: Terreno[] = [], placas: { chave: string; pos: [number, number, number]; rot: number }[] = [];
  for (const q of QUARTEIROES) {
    if (!q.lotes) continue;
    q.lotes.forEach((l, k) => {
      const [x, z] = centroLote(q.i, q.j, k);
      const rot = frenteDoLote(k);
      const frente = k >= 2 ? 1 : -1; // lado da rua
      const chave = `${q.i},${q.j},${k}`;
      // placa perto da calçada, num canto do lote
      if (l.tipo === "praca") return; // a praça tem a cena dela (scene/Praca.tsx), sem placa de venda
      placas.push({ chave, pos: [x + (k % 2 ? 6.5 : -6.5), 0, z + frente * (LOTE / 2 - 1.6)], rot });
      if (comEscritorio.has(chave) || emObra.has(chave)) return; // o escritório do cliente (ou a obra) ocupa o lote: a casa/terreno original some
      if (l.tipo === "casa") casas.push({ modelo: l.modelo, pos: [x, 0, z - frente * 1.2], rot, escala: l.escala ?? 1 });
      else terrenos.push({ pos: [x, 0, z], rot, arvore: !!l.arvore });
    });
  }
  return { casas, terrenos, placas };
}

// Placa "À VENDA": textura desenhada uma vez (canvas) e compartilhada por todas
let texPlaca: THREE.CanvasTexture | null = null;
function texturaPlaca() {
  if (texPlaca) return texPlaca;
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, 512, 256);
  g.fillStyle = "#1D4ED8"; g.fillRect(0, 0, 512, 54);
  g.fillStyle = "#FFFFFF"; g.font = "bold 30px Inter, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("WORKEND", 256, 28);
  g.fillStyle = "#0F172A"; g.font = "bold 96px Inter, Arial, sans-serif"; g.fillText("À VENDA", 256, 140);
  g.fillStyle = "#475569"; g.font = "28px Inter, Arial, sans-serif"; g.fillText("compre seu chão e monte sua empresa", 256, 218);
  texPlaca = new THREE.CanvasTexture(c); texPlaca.colorSpace = THREE.SRGBColorSpace; texPlaca.anisotropy = 4;
  return texPlaca;
}
let matPlaca: THREE.MeshBasicMaterial | null = null;
const materialPlaca = () => matPlaca ?? (matPlaca = new THREE.MeshBasicMaterial({ map: texturaPlaca(), toneMapped: false }));

function Placa({ pos, rot }: { pos: [number, number, number]; rot: number }) {
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      {[-0.7, 0.7].map((x) => <mesh key={x} geometry={caixa(0.08, 1.9, 0.08)} material={mat("#6B4F2A", { rough: 0.9 })} position={[x, 0.95, 0]} castShadow />)}
      <mesh geometry={caixa(1.9, 1.0, 0.06)} material={mat("#F7F7F5")} position={[0, 1.5, 0]} castShadow />
      <mesh geometry={plano(1.8, 0.9)} material={materialPlaca()} position={[0, 1.5, 0.035]} />
    </group>
  );
}

// Terreno vazio: grama mais clara com mato baixo; às vezes uma árvore grande (instanciada em Mundo)
function Terreno({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh geometry={plano(LOTE - 1.5, LOTE - 1.5)} material={mat("#8CC978", { rough: 1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]} receiveShadow />
      {[[-5, -4], [4, -6], [6, 3], [-3, 6], [1, 1]].map(([x, z], i) => (
        <mesh key={i} geometry={esfera(0.5 + (i % 3) * 0.15, 7)} material={mat(i % 2 ? "#6FB15F" : "#9ACD6B")} position={[x, 0.2, z]} scale={[1, 0.5, 1]} />
      ))}
    </group>
  );
}

// Azaleias floridas nos canteiros das casas (v63): instanciadas, na mesma posição do canteiro do Jardim (-5,5 ; 6,5 no lote)
function AzaleiasDosJardins({ casas }: { casas: { pos: [number, number, number]; rot: number }[] }) {
  const itens: ItemInstancia[] = useMemo(() => casas.map((c) => { const lx = -5.5, lz = 6.5, cs = Math.cos(c.rot), sn = Math.sin(c.rot); return { pos: [c.pos[0] + lx * cs + lz * sn, 0.22, c.pos[2] - lx * sn + lz * cs] as [number, number, number], rot: c.rot, altura: 1.15 }; }), [casas]);
  return <ArvoresInstanciadas especie="azaleia" itens={itens} />;
}

// Caminho da calçada até a porta da casa e um canteiro na frente
function Jardim({ pos, rot }: { pos: [number, number, number]; rot: number }) {
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <mesh geometry={plano(1.4, 6)} material={mat("#D9D5CC", { rough: 0.95 })} rotation={[-Math.PI / 2, 0, 0]} position={[1.2, -0.01, 6.5]} receiveShadow />
      <mesh geometry={cilindro(0.9, 1.1, 0.25, 12)} material={mat("#5C4634", { rough: 1 })} position={[-5.5, 0.12, 6.5]} />
      {/* a azaleia florida do canteiro fica fora do Estatico (ela balança com o vento): ver AzaleiasDosJardins */}
    </group>
  );
}

export function Lotes() {
  const comEscritorio = useLotesComEscritorio();
  const terrenosMundo = useMundo((s) => s.terrenos);
  const chavesObra = Object.values(terrenosMundo).filter((t) => t.status === "reservado").map((t) => t.chave).sort().join("|");
  const { casas, terrenos, placas, porModelo } = useMemo(() => {
    const r = listar(comEscritorio, new Set(chavesObra ? chavesObra.split("|") : []));
    const m = new Map<ModeloCasa, ItemInstancia[]>();
    for (const c of r.casas) {
      const info = CASA[c.modelo];
      const lista = m.get(c.modelo) ?? []; m.set(c.modelo, lista);
      lista.push({ pos: c.pos, rot: c.rot + info.frente, altura: info.altura * c.escala });
    }
    return { ...r, porModelo: [...m.entries()] };
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
  // placas "À venda" só nos lotes livres (o lote reservado ganha a placa da empresa). O lote em rascunho também perde a placa.
  const emRascunho = rascunho && selecionado ? selecionado : null;
  const livres = placas.filter((p) => !reservados[p.chave] && p.chave !== emRascunho);
  return (
    <group>
      <Estatico key={chavesReservadas + "|" + (emRascunho ?? "") + "|" + [...comEscritorio].join(",")}>
        {terrenos.map((t, i) => <Terreno key={i} pos={t.pos} />)}
        {casas.map((c, i) => <Jardim key={i} pos={c.pos} rot={c.rot} />)}
        {livres.map((p) => <Placa key={p.chave} pos={p.pos} rot={p.rot} />)}
      </Estatico>
      <AzaleiasDosJardins casas={casas} />
      {porModelo.map(([modelo, itens]) => (
        <ComFallback key={modelo} fallback={<Estatico>{itens.map((it, i) => <CasaProcedural key={i} pos={it.pos} rot={it.rot ?? 0} altura={it.altura ?? 5} />)}</Estatico>}>
          <ModeloInstanciadoNoite nome={modelo} itens={itens} />
        </ComFallback>
      ))}
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
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); selecionarLote(chave); }}
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
        {semana && <div className={`${promo || selo ? "mb-1" : "-mb-1.5"} flex items-center gap-1 rounded-full bg-gradient-to-r from-[#F59E0B] to-[#FACC15] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-[#3B2A00] shadow-md ring-2 ring-white`}><span aria-hidden>⭐</span>Destaque da semana</div>}
        {/* promoção na fachada (12/11/2026) */}
        {promo && <div className={`balao-promo ${selo ? "mb-1" : "-mb-1.5"} flex items-center gap-1 rounded-full bg-[#E11D48] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-white shadow-md ring-2 ring-white`}><span aria-hidden>🏷️</span>{promo}</div>}
        {selo && <div className="-mb-1.5 rounded-full bg-[#FACC15] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#1D2128] shadow-md ring-2 ring-white">{selo}</div>}
        <div className={`pointer-events-auto flex items-center gap-2.5 rounded-2xl px-4 py-2 shadow-xl ${onClick ? "cursor-pointer" : ""}`} style={{ background: cor }} onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
          {logo && <img src={logo} alt="" className="h-9 w-9 rounded-lg bg-white/95 object-contain p-0.5" />}
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

// Se o GLB faltar: caixinha com telhado
function CasaProcedural({ pos, rot, altura }: { pos: [number, number, number]; rot: number; altura: number }) {
  const h = altura * 0.6;
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <mesh geometry={caixa(8, h, 7)} material={mat("#EADFC8")} position={[0, h / 2, 0]} castShadow />
      <mesh geometry={cilindro(0, 6.2, altura * 0.4, 4)} material={mat("#B5552F")} position={[0, h + altura * 0.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow />
    </group>
  );
}
