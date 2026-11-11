"use client";
// Cenas dos 3 passos da página inicial: imagens 3D feitas no Higgsfield (public/workend/passos, originais em
// /root/workend-arte/passos no VPS) com animação por cima. As posições vêm de medidas nas imagens originais
// (2368×1776); a caixa da cena tem a mesma proporção (4:3), então porcentagem da caixa = porcentagem da imagem.
import { useEffect, useRef, useState } from "react";
import { Maquina } from "./efeitos";

const W = 2368, H = 1776;
const pc = (x: number, y: number) => ({ left: `${((x / W) * 100).toFixed(2)}%`, top: `${((y / H) * 100).toFixed(2)}%` });

const Cursor = () => <svg className="wp-cursor" viewBox="0 0 24 24" width="30" height="30"><path d="M4 2l15 11-6.5 1.2L16 21l-2.6 1.1-3-6.6L5 20z" fill="#121419" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" /></svg>;

// Passo 1: o cursor clica no lote vazio, ele acende em azul e vira "Sua empresa"
export function CenaLote() {
  return (
    <div className="wi-cena wp-arte wp-lote" aria-hidden>
      <img src="/workend/passos/lote.webp" alt="" loading="lazy" decoding="async" draggable={false} />
      <svg className="wp-lote-marca" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"><polygon points="1157,1025 1497,1204 1182,1407 841,1195" /></svg>
      <i className="wp-toque" style={pc(1180, 1225)} />
      <span className="wp-pino" style={pc(1172, 1105)}><b>Sua empresa</b><small>Lote 12 · livre agora</small></span>
      <span className="wp-reserva" style={pc(1175, 1440)}>Reservado por 1 hora</span>
      <Cursor />
    </div>
  );
}

// Matriz CSS que leva um retângulo w×h para os 4 cantos (sup. esq., sup. dir., inf. dir., inf. esq.) — homografia
function matriz(w: number, h: number, p: [number, number][]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = p;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / det, k = (dx1 * dy3 - dx3 * dy1) / det;
  const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3, d = y1 - y0 + g * y1, e = y3 - y0 + k * y3;
  return `matrix3d(${[a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, x0, y0, 0, 1].map((n) => +n.toFixed(6)).join(",")})`;
}
const PLACA: [number, number][] = [[585, 937], [1003, 1025], [1003, 1173], [587, 1085]];
const PW = 600, PH = 210;

// Passo 2: o nome da empresa é digitado dentro do letreiro, na perspectiva da fachada
export function CenaFachada() {
  const caixa = useRef<HTMLDivElement>(null);
  const [m, setM] = useState("");
  useEffect(() => {
    const el = caixa.current; if (!el) return;
    const calc = () => { const w = el.clientWidth, h = el.clientHeight; if (w && h) setM(matriz(PW, PH, PLACA.map(([x, y]) => [(x / W) * w, (y / H) * h]))); };
    calc(); const ro = new ResizeObserver(calc); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={caixa} className="wi-cena wp-arte wp-fachada" aria-hidden>
      <img src="/workend/passos/fachada.webp" alt="" loading="lazy" decoding="async" draggable={false} />
      <div className="wp-placa" style={{ width: PW, height: PH, transform: m || undefined, visibility: m ? "visible" : "hidden" }}>
        <Maquina textos={["Padaria do Bairro", "Studio Ana", "Oficina 77", "Clínica Sorriso"]} />
        <b />
      </div>
    </div>
  );
}

// Passo 3: a equipe entra pela porta e cada pessoa vai para a sua sala
const SALAS = [
  { nome: "Diretoria", cargo: "B", cor: "#D9A23A", tx: 1010, ty: 430, lx: 760, ly: 250 },
  { nome: "Atendimento", cargo: "F", cor: "#3FBFA8", tx: 1610, ty: 600, lx: 1830, ly: 410 },
  { nome: "Vendas", cargo: "R", cor: "#22A86B", tx: 700, ty: 790, lx: 380, ly: 700 },
  { nome: "Social media", cargo: "J", cor: "#F2913D", tx: 1360, ty: 1090, lx: 1560, ly: 1170 },
];
export function CenaEquipe() {
  const porta = pc(870, 1270);
  return (
    <div className="wi-cena wp-arte wp-equipe" aria-hidden>
      <img src="/workend/passos/equipe.webp" alt="" loading="lazy" decoding="async" draggable={false} />
      {SALAS.map((s, k) => {
        const alvo = pc(s.tx, s.ty), rot = pc(s.lx, s.ly);
        return (
          <span key={s.nome}>
            <span className="wp-sala" style={{ ...rot, ["--cor" as string]: s.cor, ["--k" as string]: k }}><i />{s.nome}</span>
            <span className="wp-gente" style={{ ["--cor" as string]: s.cor, ["--k" as string]: k, ["--px" as string]: porta.left, ["--py" as string]: porta.top, ["--tx" as string]: alvo.left, ["--ty" as string]: alvo.top }}>{s.cargo}</span>
          </span>
        );
      })}
    </div>
  );
}
