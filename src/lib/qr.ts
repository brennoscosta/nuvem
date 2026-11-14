// QR Code feito aqui, sem pacote (13/11/2026, material de divulgação em /app/divulgar). Modo byte (UTF-8), correção M,
// versões 1 a 6 (até 106 bytes: sobra para "https://workend.online/loja/123?ind=ABCDEF"). Segue a ISO/IEC 18004, com a
// mesma lógica do gerador de referência de Nayuki: Reed-Solomon em GF(256), blocos intercalados, máscara pela menor penalidade.
const ECC_POR_BLOCO = [-1, 10, 16, 26, 18, 24, 16]; // nível M
const BLOCOS = [-1, 1, 1, 1, 2, 2, 4];
const MAX_VERSAO = 6;

function modulosDeDados(v: number) {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
  return r;
}
const codewordsDeDados = (v: number) => Math.floor(modulosDeDados(v) / 8) - ECC_POR_BLOCO[v] * BLOCOS[v];

// ---------- Reed-Solomon ----------
function mult(x: number, y: number) {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
  return z & 0xff;
}
function divisor(grau: number) {
  const r: number[] = new Array(grau).fill(0); r[grau - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grau; i++) {
    for (let j = 0; j < r.length; j++) { r[j] = mult(r[j], raiz); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
    raiz = mult(raiz, 0x02);
  }
  return r;
}
function resto(dados: number[], div: number[]) {
  const r = div.map(() => 0);
  for (const b of dados) { const f = b ^ (r.shift() as number); r.push(0); div.forEach((c, i) => { r[i] ^= mult(c, f); }); }
  return r;
}

// ---------- montagem ----------
export function gerarQR(texto: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(texto));
  let v = 1;
  for (; v <= MAX_VERSAO; v++) if (4 + 8 + bytes.length * 8 <= codewordsDeDados(v) * 8) break;
  if (v > MAX_VERSAO) throw new Error("Texto grande demais para o QR Code.");
  // bits: modo byte (0100), tamanho (8 bits até a versão 9), dados, terminador e enchimento
  const bits: number[] = [];
  const poe = (val: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  poe(0b0100, 4); poe(bytes.length, 8); for (const b of bytes) poe(b, 8);
  const cap = codewordsDeDados(v) * 8;
  poe(0, Math.min(4, cap - bits.length)); poe(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) poe(pad, 8);
  const dados: number[] = []; for (let i = 0; i < bits.length; i += 8) dados.push(parseInt(bits.slice(i, i + 8).join(""), 2));

  // correção em blocos e intercalação
  const nBlocos = BLOCOS[v], eccLen = ECC_POR_BLOCO[v], brutos = Math.floor(modulosDeDados(v) / 8);
  const nCurtos = nBlocos - (brutos % nBlocos), lenCurto = Math.floor(brutos / nBlocos), div = divisor(eccLen);
  const blocos: number[][] = [];
  for (let i = 0, k = 0; i < nBlocos; i++) {
    const dat = dados.slice(k, k + lenCurto - eccLen + (i < nCurtos ? 0 : 1)); k += dat.length;
    const ecc = resto(dat, div); if (i < nCurtos) dat.push(0);
    blocos.push(dat.concat(ecc));
  }
  const final: number[] = [];
  for (let i = 0; i < blocos[0].length; i++) blocos.forEach((b, j) => { if (i !== lenCurto - eccLen || j >= nCurtos) final.push(b[i]); });

  // matriz
  const n = v * 4 + 17;
  const m: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));
  const fixo: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));
  const poeFixo = (x: number, y: number, escuro: boolean) => { m[y][x] = escuro; fixo[y][x] = true; };
  for (let i = 0; i < n; i++) { poeFixo(6, i, i % 2 === 0); poeFixo(i, 6, i % 2 === 0); }
  const localizador = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < n && y >= 0 && y < n) poeFixo(x, y, d !== 2 && d !== 4);
    }
  };
  localizador(3, 3); localizador(n - 4, 3); localizador(3, n - 4);
  if (v > 1) {
    const nAl = Math.floor(v / 7) + 2, passo = Math.ceil((v * 4 + 4) / (nAl * 2 - 2)) * 2;
    const pos = [6]; for (let p = n - 7; pos.length < nAl; p -= passo) pos.splice(1, 0, p);
    for (let i = 0; i < pos.length; i++) for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) poeFixo(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  const formato = (mascara: number) => {
    const d = (0 << 3) | mascara; // nível M = 0
    let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, bit = (i: number) => ((b >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) poeFixo(8, i, bit(i));
    poeFixo(8, 7, bit(6)); poeFixo(8, 8, bit(7)); poeFixo(7, 8, bit(8));
    for (let i = 9; i < 15; i++) poeFixo(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) poeFixo(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) poeFixo(8, n - 15 + i, bit(i));
    poeFixo(8, n - 8, true);
  };
  formato(0); // reserva as posições antes de espalhar os dados
  // dados em zigue-zague, de baixo para cima, de duas em duas colunas
  let i = 0;
  for (let dir = n - 1; dir >= 1; dir -= 2) {
    if (dir === 6) dir = 5;
    for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++) {
      const x = dir - j, sobe = ((dir + 1) & 2) === 0, y = sobe ? n - 1 - vert : vert;
      if (!fixo[y][x] && i < final.length * 8) { m[y][x] = ((final[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
    }
  }
  const mascarar = (k: number) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (fixo[y][x]) continue;
      const inv = [(x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0, (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
        ((x * y) % 2) + ((x * y) % 3) === 0, (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (((x + y) % 2) + ((x * y) % 3)) % 2 === 0][k];
      if (inv) m[y][x] = !m[y][x];
    }
  };
  let melhor = 0, menor = Infinity;
  for (let k = 0; k < 8; k++) { mascarar(k); formato(k); const p = penalidade(m); if (p < menor) { menor = p; melhor = k; } mascarar(k); }
  mascarar(melhor); formato(melhor);
  return m;
}

// regras de penalidade da norma (blocos, sequências, padrões parecidos com o localizador, equilíbrio de escuros)
function penalidade(m: boolean[][]) {
  const n = m.length; let r = 0;
  const contaPadroes = (h: number[]) => { const k = h[1]; const nucleo = k > 0 && h[2] === k && h[3] === k * 3 && h[4] === k && h[5] === k; return (nucleo && h[0] >= k * 4 && h[6] >= k ? 1 : 0) + (nucleo && h[6] >= k * 4 && h[0] >= k ? 1 : 0); };
  const soma = (run: number, h: number[]) => { if (h[0] === 0) run += n; h.pop(); h.unshift(run); };
  const linha = (get: (a: number) => boolean) => {
    let cor = false, run = 0; const h = [0, 0, 0, 0, 0, 0, 0];
    for (let a = 0; a < n; a++) {
      if (get(a) === cor) { run++; if (run === 5) r += 3; else if (run > 5) r++; }
      else { soma(run, h); if (!cor) r += contaPadroes(h) * 40; cor = get(a); run = 1; }
    }
    if (cor) { soma(run, h); run = 0; }
    run += n; soma(run, h); r += contaPadroes(h) * 40;
  };
  for (let y = 0; y < n; y++) linha((x) => m[y][x]);
  for (let x = 0; x < n; x++) linha((y) => m[y][x]);
  let escuros = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (m[y][x]) escuros++;
    if (y < n - 1 && x < n - 1) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) r += 3; }
  }
  const total = n * n; r += (Math.ceil(Math.abs(escuros * 20 - total * 10) / total) - 1) * 10;
  return r;
}

// desenha num canvas com a margem de 4 módulos que a norma pede
export function desenharQR(g: CanvasRenderingContext2D, m: boolean[][], x: number, y: number, lado: number, cor = "#111418", fundo = "#FFFFFF") {
  const n = m.length + 8, t = lado / n;
  g.fillStyle = fundo; g.fillRect(x, y, lado, lado);
  g.fillStyle = cor;
  for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) if (m[r][c]) g.fillRect(Math.floor(x + (c + 4) * t), Math.floor(y + (r + 4) * t), Math.ceil(t), Math.ceil(t));
}
