"use client";
// Personagens dos visitantes no mapa: o meu (ando clicando no chão; mando a posição a cada 3 s) e os outros online
// (chegam na batida; deslizam até a posição nova). Todo personagem tem um balãozinho com o nome; clicar num outro
// abre a ficha com as opções (conversa, chat ao vivo, negócios, redes sociais). Desde 12/11/2026 cada um aparece com as
// roupas e acessórios que comprou (boné, óculos, mochila…), desenhados em scene/Boneco.tsx.
// 19/11/2026: bicicleta (data/veiculos.ts e scene/Bicicleta.tsx). De bicicleta ele anda 2,5 vezes mais rápido, pelos
// mesmos caminhos; ao entrar num prédio para na vaga ao lado da porta, desce e segue a pé; ao sair, passa pela vaga e sobe.
// Os outros veem (o estado vai na batida) e aparecem pedalando para mim.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { BonecoProcedural, useAnimacao, HIPS, type BonecoHandle } from "./Boneco";
import { SombraContato } from "./SombraContato";
import { bonecoDe, BONECOS } from "../data/bonecos";
import { MUNDO, passeioNaCalcada, pontoNaCalcada } from "../data/mundo";
import { usePersonagem, minhaPos, type Outro } from "../personagemStore";
import { modoMundo, useMundo } from "../mundoStore";
import { useEscritorio } from "../store";
import { sedeDe } from "../data/sedes";
import { VEICULOS } from "../data/veiculos";
import { Bicicleta, BicicletaParada, SombraAlongada, usePedalar, bicicletasNaCena, type BicicletaHandle } from "./Bicicleta";

// entrar e sair dos prédios (17/11/2026): marcos do caminho (calçada da porta, porta e balcão), ver personagemStore.ts
const perto = (a: readonly [number, number], b: readonly [number, number], r = 0.7) => Math.hypot(a[0] - b[0], a[1] - b[1]) < r;
function passouPor(ponto: [number, number]) {
  const p = usePersonagem.getState().predio; if (!p) return;
  // chegou na calçada da porta: a vista vira "por dentro" e a câmera vai até a recepção (numa sede, olhando pela frente
  // dela: 19/11/2026, cada sede num lote, de frente para a rua dela)
  if (p.fase === "indo" && perto(ponto, p.fora)) { usePersonagem.setState({ predio: { ...p, fase: "entrando" } }); useEscritorio.getState().setVista("dentro"); useMundo.setState({ alvoCamera: [p.espera[0], 0.5, p.espera[1]], giroCamera: sedeDe(p.chave)?.rot ?? null }); }
  // saindo: passou pela porta, a vista volta para fora
  else if (p.fase === "saindo" && perto(ponto, p.porta)) useEscritorio.getState().setVista("fora");
  // saindo e passou pela calçada (tocou na rua estando dentro): a visita acaba aqui e ele segue pela rua
  else if (p.fase === "saindo" && perto(ponto, p.fora)) usePersonagem.setState({ predio: null, falaRecepcao: null });
}
// chegou no balcão: o dono é reconhecido na hora; o visitante espera a vez (mais 4 s por pessoa na frente dele)
function chegouNoBalcao() {
  const st = usePersonagem.getState(), p = st.predio; if (!p) return;
  const dono = useMundo.getState().meus.includes(p.chave); // dono ou sócio
  const fila = dono ? 0 : st.outros.filter((o) => o.online && perto([o.x, o.z], p.espera, 2.6)).length;
  const nome = st.meu?.nome ?? "";
  usePersonagem.setState({
    predio: { ...p, fase: "recepcao", fila, esperaMs: dono ? 0 : 3500 + fila * 4000 },
    falaRecepcao: { chave: p.chave, texto: dono ? `Bem-vindo de volta${nome ? `, ${nome}` : ""}! A equipe já sabe que você chegou.` : fila ? "Olá! Já vou te atender, aguarde a sua vez." : "Olá! Seja bem-vindo. Só um instante, já vou te atender." },
  });
}

// ?correr=1 (só roteiros de teste): o navegador do servidor desenha poucos quadros por segundo e o boneco anda devagar demais
const CORRER = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("correr") ? 8 : 1;
const VEL = 2.2 * CORRER; // m/s (um pouco mais rápido que os pedestres)
const VEL_PASSEIO = 1.0; // quando passeia sozinho, anda no ritmo dos outros pedestres
const PAUSA_PASSEIO = 9; // s parado antes de sair passeando pela calçada
const def = (id: string) => bonecoDe(id, BONECOS[1]); // catálogo ou visual personalizado (v1:…)

function Nome({ nome, cor, eu = false, online = true, onClick }: { nome: string; cor: string; eu?: boolean; online?: boolean; onClick?: () => void }) {
  return (
    <Html position={[0, 1.5, 0]} center zIndexRange={[6, 0]} style={{ pointerEvents: "none" }}>
      <div className="flex w-max select-none flex-col items-center" onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
        <div className={`pointer-events-auto flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-bold leading-none shadow-md ${onClick ? "cursor-pointer" : ""} ${eu ? "bg-[#1D4ED8] text-white" : "bg-white/95 text-[#1D2128]"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-[#16A34A]" : "bg-[#9AA3AD]"}`} />{nome}{eu && <span className="text-[8px] font-black uppercase text-white/70">você</span>}
        </div>
        <div className={`h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent ${eu ? "border-t-[#1D4ED8]" : "border-t-white/95"}`} />
      </div>
    </Html>
  );
}

// Meu boneco: anda até o destino clicado com arranque e freada suaves; a posição viva fica em `minhaPos` (sem
// re-render por quadro); a câmera não segue (o mapa é livre), mas o botão com meu nome na barra centraliza em mim.
function Meu() {
  const meu = usePersonagem((s) => s.meu);
  const ativo = usePersonagem((s) => s.ativo);
  const destino = usePersonagem((s) => s.destino);
  const veiculo = usePersonagem((s) => s.veiculo);
  const corBici = usePersonagem((s) => s.corBicicleta);
  const g = useRef<THREE.Group>(null);
  const inclina = useRef<THREE.Group>(null); // boneco + bicicleta: deita um pouco nas curvas
  const h = useRef<BonecoHandle>(null);
  const bike = useRef<BicicletaHandle>(null);
  const vel = useRef(0); // velocidade atual (m/s), acelera e freia
  const paradoDesde = useRef(0); // 0 = marca na primeira frame; passeia sozinho depois de um tempo parado
  const pausaAte = useRef(0); // descendo ou subindo na bicicleta: fica parado um instante
  const fase = useMemo(() => 1.3, []);
  useAnimacao(h, () => (usePersonagem.getState().veiculo ? "pedal" : vel.current > 0.15 ? "walk" : "idle"), fase, HIPS.procedural.base);
  usePedalar(h, g, inclina, bike, () => !!usePersonagem.getState().veiculo);
  // posição inicial: a salva no servidor (encostada na calçada, nunca no meio da rua)
  useEffect(() => { if (g.current && meu) { const [x, z] = pontoNaCalcada(meu.x, meu.z); g.current.position.set(x, 0, z); g.current.rotation.y = meu.rot; usePersonagem.getState().setPosicao(x, z, meu.rot); } }, [meu?.usuarioId, ativo]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    const o = g.current; if (!o) return; dt = Math.min(dt, CORRER > 1 ? 0.4 : 0.1);
    const st = usePersonagem.getState();
    const vc = st.veiculo ? VEICULOS[st.veiculo] : null;
    // dentro do prédio não tem bicicleta: se entrou montado por outro caminho, desce ali mesmo
    if (vc && st.predio && st.predio.fase !== "indo") usePersonagem.setState({ veiculo: null, bicicletaParada: { x: o.position.x, z: o.position.z, rot: o.rotation.y, chave: st.predio.chave }, acaoNoPonto: null });
    // longe da bicicleta parada (mais de 20 m, na rua): ela é guardada
    const bp = st.bicicletaParada;
    if (bp && !st.predio && Math.hypot(bp.x - o.position.x, bp.z - o.position.z) > 20) usePersonagem.setState({ bicicletaParada: null });
    if (performance.now() < pausaAte.current) { vel.current = 0; minhaPos.vel = 0; return; }
    if (!destino) {
      vel.current = Math.max(0, vel.current - (vc ? vc.freio * CORRER : 8) * dt);
      if (!paradoDesde.current) paradoDesde.current = performance.now();
      // como um pedestre comum: depois de um tempo parado, dá uma volta pela calçada (um clique no chão interrompe); de
      // bicicleta não sai passeando sozinho
      if (performance.now() - paradoDesde.current > PAUSA_PASSEIO * 1000 && st.painel !== "chat" && !st.predio && !vc) { paradoDesde.current = performance.now(); usePersonagem.setState({ destino: passeioNaCalcada(o.position.x, o.position.z), passeio: true }); st.avisarMovimento(); }
      minhaPos.vel = 0; return;
    }
    const dx = destino[0] - o.position.x, dz = destino[1] - o.position.z; const dist = Math.hypot(dx, dz);
    const velMax = st.passeio ? VEL_PASSEIO : vc ? vc.vel * CORRER : VEL;
    const acel = vc ? vc.acel * CORRER : 6, freio = vc ? vc.freio * CORRER : 8;
    // freia nos últimos 60 cm do caminho (nas esquinas do meio do caminho segue sem frear), acelera no resto. Também para
    // no ponto de descer ou subir na bicicleta. De bicicleta a freada começa antes, a que dá para parar sem tranco.
    const ultimo = st.rota.length === 0;
    const acao = st.acaoNoPonto, noPonto = !!acao && perto(destino, acao.ponto, 0.05);
    const para = ultimo || noPonto;
    const alvo = !para ? velMax : vc ? Math.max(0.4, Math.min(velMax, Math.sqrt(2 * freio * 0.8 * dist))) : dist < 0.6 ? Math.max(0.5, velMax * (dist / 0.6)) : velMax;
    vel.current = vel.current < alvo ? Math.min(alvo, vel.current + acel * dt) : Math.max(alvo, vel.current - freio * dt);
    // chegou numa esquina do caminho: segue para o próximo ponto (data/caminhos.ts) sem parar
    if (!para && dist < 0.35) { passouPor(destino); const [prox, ...resto] = usePersonagem.getState().rota; usePersonagem.setState({ destino: prox, rota: resto }); st.avisarMovimento(); return; }
    if (dist < 0.06) {
      o.position.set(destino[0], 0, destino[1]); vel.current = 0; minhaPos.vel = 0;
      passouPor(destino);
      if (noPonto && acao) {
        const agora = usePersonagem.getState();
        if (acao.acao === "descer" && agora.veiculo) usePersonagem.setState({ veiculo: null, acaoNoPonto: null, bicicletaParada: { ...(acao.parada ?? { x: o.position.x, z: o.position.z, rot: o.rotation.y, chave: null }), de: [o.position.x, o.position.z, o.rotation.y] } });
        else if (acao.acao === "subir" && !agora.veiculo && agora.bicicletaParada && Math.hypot(agora.bicicletaParada.x - o.position.x, agora.bicicletaParada.z - o.position.z) < 2.5) {
          o.rotation.y = agora.bicicletaParada.rot; // pega a bicicleta como ela estava
          usePersonagem.setState({ veiculo: "bicicleta", bicicletaParada: null, acaoNoPonto: null });
        } else usePersonagem.setState({ acaoNoPonto: null });
        pausaAte.current = performance.now() + 450;
        // no meio do caminho: depois do instante parado, segue para o próximo ponto
        if (!ultimo) { const [prox, ...resto] = usePersonagem.getState().rota; usePersonagem.setState({ destino: prox, rota: resto }); minhaPos.x = o.position.x; minhaPos.z = o.position.z; minhaPos.rot = o.rotation.y; st.avisarMovimento(); return; }
      }
      const pd = usePersonagem.getState().predio;
      if (pd && (pd.fase === "entrando" || pd.fase === "indo") && perto(destino, pd.espera, 0.4)) { o.rotation.y = pd.olhar; chegouNoBalcao(); }
      else if (pd && pd.fase === "saindo" && perto(destino, pd.fora, 0.4)) usePersonagem.setState({ predio: null, falaRecepcao: null });
      paradoDesde.current = performance.now() - (st.passeio ? PAUSA_PASSEIO * 400 : 0);
      usePersonagem.setState({ destino: null, passeio: false }); st.setPosicao(o.position.x, o.position.z, o.rotation.y); st.avisarMovimento();
      return;
    }
    const p = Math.min(dist, vel.current * dt); o.position.x += (dx / dist) * p; o.position.z += (dz / dist) * p;
    const r = Math.atan2(dx, dz); let d = r - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += d * Math.min(1, dt * (vc ? vc.giro : 12));
    minhaPos.x = o.position.x; minhaPos.z = o.position.z; minhaPos.rot = o.rotation.y; minhaPos.vel = vel.current;
  });
  if (!meu || !ativo) return null;
  const b = def(meu.boneco);
  return (
    <group ref={g}>{/* posição só via ref: passar position= aqui faria o boneco pular de volta a cada re-render */}
      <group ref={inclina}>
        <BonecoProcedural ref={h} def={b} camisa={meu.roupa} cracha="#FFD166" acessorios={meu.acessorios} />
        {veiculo === "bicicleta" && <Bicicleta ref={bike} cor={corBici} quem="minha" />}
      </group>
      {veiculo ? <SombraAlongada /> : <SombraContato r={0.36} />}
      <Nome nome={meu.nome} cor={meu.roupa} eu />
    </group>
  );
}
// a minha bicicleta parada (na vaga da porta de um prédio, com paraciclo, ou onde desci)
function MinhaBicicletaParada() {
  const b = usePersonagem((s) => s.bicicletaParada);
  const cor = usePersonagem((s) => s.corBicicleta);
  const ativo = usePersonagem((s) => s.ativo);
  if (!b || !ativo) return null;
  return <BicicletaParada key={`${b.x.toFixed(2)},${b.z.toFixed(2)}`} x={b.x} z={b.z} rot={b.rot} de={b.de} cor={cor} paraciclo={!!b.chave} />;
}

// Outro personagem online: anda sozinho rumo ao destino que veio na batida, na velocidade dele (não fica parado
// esperando a próxima atualização); se a posição do servidor divergir muito, corrige suavemente.
function OutroBoneco({ o }: { o: Outro }) {
  const g = useRef<THREE.Group>(null);
  const h = useRef<BonecoHandle>(null);
  const srv = useRef({ x: o.x, z: o.z, rot: o.rot, destino: o.destino ?? null, vel: o.vel ?? 0 });
  const vel = useRef(0);
  const inclina = useRef<THREE.Group>(null);
  const bike = useRef<BicicletaHandle>(null);
  const fase = useMemo(() => (o.usuarioId.charCodeAt(o.usuarioId.length - 1) % 10) / 3, [o.usuarioId]);
  const montado = !!o.veiculo?.montado;
  const montadoRef = useRef(montado);
  useEffect(() => { montadoRef.current = montado; }, [montado]);
  useEffect(() => { const g0 = g.current; if (g0) { g0.position.set(o.x, 0, o.z); g0.rotation.y = o.rot; } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    srv.current = { x: o.x, z: o.z, rot: o.rot, destino: o.destino ?? null, vel: o.vel ?? 0 };
    // divergiu demais (teleporte, aba que ficou parada): pula pra posição do servidor
    const g0 = g.current; if (g0 && Math.hypot(o.x - g0.position.x, o.z - g0.position.z) > 6) { g0.position.set(o.x, 0, o.z); g0.rotation.y = o.rot; }
  }, [o.x, o.z, o.rot, o.destino, o.vel]);
  useAnimacao(h, () => (montadoRef.current ? "pedal" : vel.current > 0.15 ? "walk" : "idle"), fase, HIPS.procedural.base);
  usePedalar(h, g, inclina, bike, () => montadoRef.current);
  useFrame((_, dt) => {
    const g0 = g.current; if (!g0) return; dt = Math.min(dt, 0.1);
    const s = srv.current;
    // alvo: o destino dele (se está andando) ou a posição que o servidor conhece
    const alvoX = s.destino ? s.destino[0] : s.x, alvoZ = s.destino ? s.destino[1] : s.z;
    const dx = alvoX - g0.position.x, dz = alvoZ - g0.position.z; const dist = Math.hypot(dx, dz);
    // de bicicleta a correção também é mais rápida (sem isso ele ficava para trás e pulava)
    const teto = montadoRef.current ? VEICULOS.bicicleta.vel * CORRER : VEL;
    const velMax = s.destino ? Math.max(0.6, s.vel || teto) : Math.min(teto, Math.max(0.8, dist / 1.5)); // sem destino: só corrige a diferença
    const alvoV = dist < 0.05 ? 0 : dist < 0.6 ? Math.max(0.4, velMax * (dist / 0.6)) : velMax;
    vel.current = vel.current < alvoV ? Math.min(alvoV, vel.current + 6 * dt) : Math.max(alvoV, vel.current - 8 * dt);
    if (dist > 0.05) {
      const p = Math.min(dist, vel.current * dt); g0.position.x += (dx / dist) * p; g0.position.z += (dz / dist) * p;
      const r = Math.atan2(dx, dz); let d = r - g0.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g0.rotation.y += d * Math.min(1, dt * 12);
    } else { vel.current = 0; let d = s.rot - g0.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g0.rotation.y += d * Math.min(1, dt * 6); }
  });
  const selecionar = () => usePersonagem.getState().selecionarOutro(o);
  // posição viva dos outros (só pra testes/prévias)
  useEffect(() => { const w = window as unknown as { __outros?: () => number[] }; w.__outros = () => (g.current ? [g.current.position.x, g.current.position.z] : []); }, []);
  return (
    <group ref={g}>{/* posição só via ref (ver Meu) */}
      <group ref={inclina}>
        <BonecoProcedural ref={h} def={def(o.boneco)} camisa={o.roupa} cracha="#B8C0CC" acessorios={o.acessorios} />
        {montado && <Bicicleta ref={bike} cor={o.veiculo?.cor ?? VEICULOS.bicicleta.cores[0].cor} quem="outros" />}
      </group>
      {montado ? <SombraAlongada /> : <SombraContato r={0.36} />}
      {/* área de clique (invisível) em volta do boneco */}
      <mesh position={[0, 0.6, 0]} onClick={(e) => { e.stopPropagation(); selecionar(); }} onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
        <cylinderGeometry args={[0.45, 0.45, 1.3, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Nome nome={o.nome} cor={o.roupa} online={o.online} onClick={selecionar} />
    </group>
  );
}

// Chão clicável: no modo mundo, com personagem ativo, clicar no chão manda o boneco andar até lá
function ChaoClicavel() {
  const ativo = usePersonagem((s) => s.ativo);
  if (!ativo || !modoMundo()) return null;
  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={(e) => { e.stopPropagation(); usePersonagem.getState().irPara(e.point.x, e.point.z); }}>
      <planeGeometry args={[MUNDO.x * 2, MUNDO.z * 2]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

// bicicletas que os outros deixaram paradas (na porta de um prédio ou onde desceram)
function ParadasDosOutros({ outros }: { outros: Outro[] }) {
  return <>{outros.map((o) => { const v = o.veiculo; if (!v || v.montado || !v.parada) return null; const p = v.parada; return <BicicletaParada key={`${o.usuarioId}|${p[0]},${p[1]}`} x={p[0]} z={p[1]} rot={p[2]} cor={v.cor} paraciclo={v.vaga} />; })}</>;
}

// tecla B: sobe ou desce da bicicleta (não vale digitando num campo nem com Ctrl/Cmd/Alt)
function useTeclaBicicleta() {
  useEffect(() => {
    if (!modoMundo()) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "b" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      usePersonagem.getState().alternarBicicleta();
    };
    window.addEventListener("keydown", tecla);
    if (new URLSearchParams(window.location.search).has("medir")) Object.assign(window, { __bicicletas: bicicletasNaCena });
    return () => window.removeEventListener("keydown", tecla);
  }, []);
}

export function Personagens() {
  useTeclaBicicleta();
  const outros = usePersonagem((s) => s.outros);
  const carregar = usePersonagem((s) => s.carregar);
  const batida = usePersonagem((s) => s.batida);
  const atualizarChat = usePersonagem((s) => s.atualizarChat);
  // carrega o meu e começa as batidas (presença a cada 3 s; chat aberto a cada 2,5 s)
  useEffect(() => {
    if (!modoMundo()) return;
    let vivo = true;
    void carregar().then(() => { void batida(); if (new URLSearchParams(window.location.search).get("personagem") === "1") usePersonagem.getState().abrir("montar"); });
    const t1 = setInterval(() => { if (vivo && document.visibilityState === "visible") void batida(); }, 3000);
    const t2 = setInterval(() => { if (vivo && usePersonagem.getState().painel === "chat") void atualizarChat(); }, 2500);
    return () => { vivo = false; clearInterval(t1); clearInterval(t2); };
  }, [carregar, batida, atualizarChat]);
  return (
    <group>
      <ChaoClicavel />
      <Meu />
      <MinhaBicicletaParada />
      {outros.map((o) => <OutroBoneco key={o.usuarioId} o={o} />)}
      <ParadasDosOutros outros={outros} />
    </group>
  );
}
