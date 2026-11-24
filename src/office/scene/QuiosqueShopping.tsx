"use client";
// Quiosques de shopping, abertos, para os espaços de 10 × 10 m dos lotes (24/11/2026, pedido do dono: "lotes menores que
// 20x20 usam modelos específicos, tipo quiosques de shopping, abertos" e "6 modelos por enquanto"). Sem paredes nem
// toldo: balcão com a logo da empresa, expositores na cor dela, o letreiro no alto e a atendente no meio. Os da orla
// continuam com os desenhos de praia (scene/Quiosques.tsx › Corpo). Cada espaço recebe um modelo pela posição, sem
// repetir o do vizinho (data/quiosques.ts › ESPACOS).
// Tudo cabe na pegada do quiosque (data/quiosques.ts › pegadaQuiosque: 4,6 m de largura, do fundo a 1,7 m atrás do centro
// até 2,75 m na frente), então a posição, o giro, o balcão do cliente e a área de clique continuam os mesmos. A atendente
// fica em (0, 0, −0,25), atrás do balcão da frente. Só peças paradas: entram no <Estatico> dos quiosques (poucas malhas).
import * as THREE from "three";
import { caixa, cilindro, esfera, mat, plano, toro } from "./geo";
import { leve } from "./qualidade";
import type { ModeloShopping } from "../data/quiosques";

export interface PropsShopping {
  modelo: ModeloShopping;
  cor: string;
  letreiro: THREE.Material; // nome e logo da empresa (texturaLetreiro)
  painel: THREE.Material | null; // logo grande na frente do balcão (texturaBalcao)
  lampada: THREE.Material; // acende à noite
}

const Y0 = 0.12; // piso do quiosque
const HB = 1.0; // altura do balcão

export function QuiosqueShopping({ modelo, cor, letreiro, painel, lampada }: PropsShopping) {
  const poucos = leve();
  const piso = mat("#ECE8E1", { rough: 0.6 }), tampo = mat("#FBFAF7", { rough: 0.35 }), corMat = mat(cor, { rough: 0.6 });
  const metal = mat("#2F343B", { metal: 0.4, rough: 0.4 }), cromo = mat("#C9CED6", { metal: 0.7, rough: 0.25 });
  const madeira = mat("#B8875A", { rough: 0.8 }), vidro = mat("#CFE8F3", { opacity: 0.35, rough: 0.1 });
  // balcão reto: corpo na cor da empresa, tampo branco, faixa de luz embaixo do tampo
  const balcao = (w: number, d: number, x: number, z: number, rot = 0, comPainel = false) => (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh geometry={caixa(w, HB - 0.06, d)} material={corMat} position={[0, Y0 + (HB - 0.06) / 2, 0]} castShadow />
      <mesh geometry={caixa(w + 0.08, 0.06, d + 0.1)} material={tampo} position={[0, Y0 + HB - 0.03, 0.02]} />
      {!poucos && <mesh geometry={caixa(w, 0.03, 0.02)} material={lampada} position={[0, Y0 + HB - 0.09, d / 2 + 0.03]} />}
      {comPainel && painel && <mesh geometry={plano(Math.min(1.5, w - 0.3), 0.62)} material={painel} position={[0, Y0 + 0.5, d / 2 + 0.006]} />}
    </group>
  );
  const coluna = (x: number, z: number, h: number) => <mesh key={`c${x},${z}`} geometry={cilindro(0.05, 0.05, h, 8)} material={metal} position={[x, Y0 + h / 2, z]} castShadow />;
  // placa com o letreiro dos dois lados (frente e fundo)
  const placa = (w: number, h: number, y: number, z = 0) => (
    <group position={[0, y, z]}>
      <mesh geometry={caixa(w + 0.1, h + 0.1, 0.08)} material={metal} />
      <mesh geometry={plano(w, h)} material={letreiro} position={[0, 0, 0.045]} />
      <mesh geometry={plano(w, h)} material={letreiro} position={[0, 0, -0.045]} rotation={[0, Math.PI, 0]} />
    </group>
  );
  // expositor baixo na cor da empresa com produtos (cubinhos claros)
  const expositor = (x: number, z: number, rot = 0) => (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh geometry={caixa(0.9, 1.5, 0.4)} material={corMat} position={[0, Y0 + 0.75, 0]} castShadow />
      {[0.55, 0.95, 1.35].map((y) => <mesh key={y} geometry={caixa(0.82, 0.03, 0.36)} material={tampo} position={[0, Y0 + y, 0.03]} />)}
      {!poucos && [0.62, 1.02].flatMap((y) => [-0.25, 0, 0.25].map((xx) => <mesh key={`${y}${xx}`} geometry={caixa(0.14, 0.12, 0.14)} material={cromo} position={[xx, Y0 + y + 0.06, 0.04]} />))}
    </group>
  );
  return (
    <group>
      {/* piso claro do quiosque */}
      <mesh geometry={caixa(4.4, Y0, 4.0)} material={piso} position={[0, Y0 / 2, 0.4]} receiveShadow />

      {modelo === "ilha" && (
        <group>
          {/* balcão em volta: frente (com a logo), fundo e os dois lados, com passagem atrás para a atendente */}
          {balcao(3.4, 0.6, 0, 1.6, 0, true)}
          {balcao(3.4, 0.6, 0, -1.3, Math.PI)}
          {balcao(1.9, 0.6, -1.4, 0.15, Math.PI / 2)}
          {balcao(1.4, 0.6, 1.4, -0.1, -Math.PI / 2)}
          {[[-1.85, -1.55], [1.85, -1.55], [-1.85, 1.85], [1.85, 1.85]].map(([x, z]) => coluna(x, z, 2.9))}
          <mesh geometry={caixa(3.9, 0.12, 3.6)} material={corMat} position={[0, Y0 + 2.95, 0.15]} />
          <mesh geometry={caixa(3.5, 0.02, 3.2)} material={lampada} position={[0, Y0 + 2.88, 0.15]} />
          {placa(2.9, 0.56, Y0 + 3.35, 0.15)}
        </group>
      )}

      {modelo === "letraL" && (
        <group>
          {balcao(3.2, 0.6, -0.3, 1.5, 0, true)}
          {balcao(2.2, 0.6, 1.6, 0.6, -Math.PI / 2)}
          {/* fundo: dois expositores altos e a barra do letreiro em duas colunas */}
          {expositor(-1.2, -1.35)}
          {expositor(0, -1.35)}
          {coluna(-2.0, -1.5, 3.2)}{coluna(2.0, -1.5, 3.2)}
          <mesh geometry={caixa(4.2, 0.1, 0.12)} material={metal} position={[0, Y0 + 3.1, -1.5]} />
          {placa(3.2, 0.6, Y0 + 2.65, -1.5)}
          {!poucos && [-1.2, 0, 1.2].map((x) => <mesh key={x} geometry={esfera(0.09, 10)} material={lampada} position={[x, Y0 + 2.2, -1.25]} />)}
        </group>
      )}

      {modelo === "carrinho" && (
        <group>
          {/* carrinho: balcão sobre rodas, com o puxador, e um teto leve em quatro hastes */}
          <group position={[0, 0.28, 0.6]}>
            {balcao(2.6, 1.1, 0, 0, 0, true)}
          </group>
          {[-1.05, 1.05].map((x) => <mesh key={x} geometry={cilindro(0.32, 0.32, 0.1, 16)} material={metal} position={[x, 0.34, 1.2]} rotation={[0, 0, Math.PI / 2]} />)}
          {[-1.05, 1.05].map((x) => <mesh key={`t${x}`} geometry={cilindro(0.32, 0.32, 0.1, 16)} material={metal} position={[x, 0.34, 0.0]} rotation={[0, 0, Math.PI / 2]} />)}
          <mesh geometry={toro(0.25, 0.03, 12, Math.PI)} material={cromo} position={[-1.5, Y0 + 1.25, 0.6]} rotation={[0, Math.PI / 2, 0]} />
          {[[-1.2, 0.1], [1.2, 0.1], [-1.2, 1.1], [1.2, 1.1]].map(([x, z]) => coluna(x, z, 2.5))}
          <mesh geometry={caixa(2.9, 0.08, 1.6)} material={corMat} position={[0, Y0 + 2.55, 0.6]} castShadow />
          <mesh geometry={caixa(2.9, 0.34, 0.04)} material={tampo} position={[0, Y0 + 2.4, 1.4]} />
          {placa(2.2, 0.48, Y0 + 2.95, 0.6)}
          {expositor(0, -1.2)}
        </group>
      )}

      {modelo === "circular" && (
        <group>
          {/* balcão redondo em 7 gomos, aberto atrás para a atendente entrar */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const a = Math.PI / 2 - Math.PI * 0.9 + (i * (Math.PI * 1.8)) / 6, r = 1.55;
            return <group key={i}>{balcao(1.3, 0.55, Math.cos(a) * r, Math.sin(a) * r + 0.2, -a + Math.PI / 2, i === 3)}</group>;
          })}
          {/* aro suspenso com luz e o letreiro em cima, em três colunas */}
          {[0, 1, 2].map((i) => { const a = (i * Math.PI * 2) / 3 + Math.PI / 2; return coluna(Math.cos(a) * 2.05, Math.sin(a) * 2.05 + 0.2, 3.0); })}
          <mesh geometry={toro(2.05, 0.08, 32)} material={corMat} position={[0, Y0 + 3.0, 0.2]} rotation={[Math.PI / 2, 0, 0]} />
          {!poucos && <mesh geometry={toro(1.9, 0.03, 32)} material={lampada} position={[0, Y0 + 2.92, 0.2]} rotation={[Math.PI / 2, 0, 0]} />}
          {placa(2.7, 0.56, Y0 + 3.45, 0.2)}
        </group>
      )}

      {modelo === "vitrine" && (
        <group>
          {/* expositores de vidro na frente e nos lados, painel alto atrás com o letreiro */}
          {[-0.9, 0.9].map((x) => (
            <group key={x} position={[x, 0, 1.55]}>
              <mesh geometry={caixa(1.7, 0.55, 0.6)} material={corMat} position={[0, Y0 + 0.275, 0]} castShadow />
              <mesh geometry={caixa(1.7, 0.45, 0.6)} material={vidro} position={[0, Y0 + 0.78, 0]} />
              <mesh geometry={caixa(1.74, 0.04, 0.64)} material={tampo} position={[0, Y0 + 1.02, 0]} />
              {!poucos && [-0.5, 0, 0.5].map((xx) => <mesh key={xx} geometry={caixa(0.22, 0.14, 0.22)} material={cromo} position={[xx, Y0 + 0.64, 0]} />)}
            </group>
          ))}
          {painel && <mesh geometry={plano(1.3, 0.48)} material={painel} position={[0, Y0 + 0.3, 1.856]} />}
          {balcao(1.6, 0.5, -1.85, 0.4, Math.PI / 2)}
          {balcao(1.6, 0.5, 1.85, 0.4, -Math.PI / 2)}
          <mesh geometry={caixa(4.0, 2.7, 0.14)} material={tampo} position={[0, Y0 + 1.35, -1.45]} castShadow />
          <mesh geometry={caixa(4.0, 0.7, 0.16)} material={corMat} position={[0, Y0 + 2.4, -1.44]} />
          <mesh geometry={plano(3.4, 0.56)} material={letreiro} position={[0, Y0 + 2.4, -1.355]} />
          {[0.8, 1.3].map((y) => <mesh key={y} geometry={caixa(3.4, 0.04, 0.28)} material={tampo} position={[0, Y0 + y, -1.28]} />)}
        </group>
      )}

      {modelo === "pergolado" && (
        <group>
          {balcao(3.6, 0.65, 0, 1.5, 0, true)}
          {balcao(3.0, 0.55, 0, -1.25, Math.PI)}
          {/* pergolado de madeira: quatro pilares, duas vigas e as ripas por cima */}
          {[[-2.0, -1.55], [2.0, -1.55], [-2.0, 2.0], [2.0, 2.0]].map(([x, z]) => <mesh key={`p${x}${z}`} geometry={caixa(0.14, 2.8, 0.14)} material={madeira} position={[x, Y0 + 1.4, z]} castShadow />)}
          {[-1.55, 2.0].map((z) => <mesh key={`v${z}`} geometry={caixa(4.3, 0.16, 0.14)} material={madeira} position={[0, Y0 + 2.86, z]} />)}
          {(poucos ? [-1.6, -0.6, 0.4, 1.4] : [-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8]).map((x) => <mesh key={`r${x}`} geometry={caixa(0.08, 0.1, 3.8)} material={madeira} position={[x, Y0 + 2.99, 0.22]} castShadow />)}
          {/* placa pendurada na viga da frente */}
          {[-1.0, 1.0].map((x) => <mesh key={`f${x}`} geometry={cilindro(0.012, 0.012, 0.3, 6)} material={metal} position={[x, Y0 + 2.63, 2.0]} />)}
          {placa(2.6, 0.5, Y0 + 2.25, 2.0)}
          {!poucos && [-1.4, 0, 1.4].map((x) => <mesh key={`l${x}`} geometry={esfera(0.08, 10)} material={lampada} position={[x, Y0 + 2.7, 0.2]} />)}
        </group>
      )}
    </group>
  );
}
