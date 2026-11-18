// QR Code do Pix copia e cola dos pedidos (17/11/2026). O projeto não tinha biblioteca de QR (o QR do pagamento do lote
// vem pronto do Mercado Pago), então este é um gerador pequeno feito a partir da norma ISO/IEC 18004: modo byte, correção
// de erro nível M (aguenta ~15% de sujeira), versão escolhida pelo tamanho do texto e a máscara de menor penalidade.
// Devolve a matriz de módulos (true = escuro). Desenho em ../ui/QrCode.tsx. Conferido com um leitor de QR nos testes.

// nível M, versões 1 a 40 (índice 0 sem uso): códigos de correção por bloco e número de blocos
const ECC_POR_BLOCO = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const BLOCOS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
const BITS_FORMATO_M = 0; // L=1, M=0, Q=3, H=2

function modulosDeDados(v: number) {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
  return r;
}
const codewordsDeDados = (v: number) => Math.floor(modulosDeDados(v) / 8) - ECC_POR_BLOCO[v] * BLOCOS[v];

// multiplicação no corpo GF(256) com o polinômio 0x11D
function mult(x: number, y: number) {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
  return z & 0xff;
}
function divisorRS(grau: number) {
  const r = new Array<number>(grau).fill(0); r[grau - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grau; i++) {
    for (let j = 0; j < r.length; j++) { r[j] = mult(r[j], raiz); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
    raiz = mult(raiz, 0x02);
  }
  return r;
}
function restoRS(dados: number[], divisor: number[]) {
  const r = new Array<number>(divisor.length).fill(0);
  for (const b of dados) {
    const fator = b ^ (r.shift() as number);
    r.push(0);
    divisor.forEach((c, i) => { r[i] ^= mult(c, fator); });
  }
  return r;
}

function posicoesAlinhamento(v: number, tam: number) {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2;
  const passo = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const r = [6];
  for (let p = tam - 7; r.length < n; p -= passo) r.splice(1, 0, p);
  return r;
}

const MASCARAS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0, (_x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

export function qrMatriz(texto: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(texto));
  // menor versão em que o texto cabe
  let v = 1;
  for (; v <= 40; v++) { const bits = 4 + (v < 10 ? 8 : 16) + bytes.length * 8; if (bits <= codewordsDeDados(v) * 8) break; }
  if (v > 40) throw new Error("Texto grande demais para um QR Code.");
  const capacidade = codewordsDeDados(v) * 8;

  // bits: modo byte (0100), tamanho, dados, terminador e enchimento
  const bits: number[] = [];
  const poe = (val: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  poe(4, 4); poe(bytes.length, v < 10 ? 8 : 16); for (const b of bytes) poe(b, 8);
  poe(0, Math.min(4, capacidade - bits.length));
  poe(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacidade; pad ^= 0xec ^ 0x11) poe(pad, 8);
  const dados: number[] = [];
  for (let i = 0; i < bits.length; i += 8) dados.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // blocos com correção de erro, intercalados
  const nBlocos = BLOCOS[v], eccLen = ECC_POR_BLOCO[v], brutos = Math.floor(modulosDeDados(v) / 8);
  const curtos = nBlocos - (brutos % nBlocos), tamCurto = Math.floor(brutos / nBlocos);
  const div = divisorRS(eccLen);
  const blocos: number[][] = [];
  for (let i = 0, k = 0; i < nBlocos; i++) {
    const d = dados.slice(k, k + tamCurto - eccLen + (i < curtos ? 0 : 1)); k += d.length;
    const ecc = restoRS(d, div);
    if (i < curtos) d.push(0);
    blocos.push(d.concat(ecc));
  }
  const final: number[] = [];
  for (let i = 0; i < blocos[0].length; i++) blocos.forEach((b, j) => { if (i !== tamCurto - eccLen || j >= curtos) final.push(b[i]); });

  // padrões fixos (localizadores, linhas de tempo, alinhamento, formato e versão)
  const tam = v * 4 + 17;
  const m: boolean[][] = Array.from({ length: tam }, () => new Array<boolean>(tam).fill(false));
  const fixo: boolean[][] = Array.from({ length: tam }, () => new Array<boolean>(tam).fill(false));
  const poeFixo = (x: number, y: number, escuro: boolean) => { m[y][x] = escuro; fixo[y][x] = true; };
  for (let i = 0; i < tam; i++) { poeFixo(6, i, i % 2 === 0); poeFixo(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [tam - 4, 3], [3, tam - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, dist = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < tam && y >= 0 && y < tam) poeFixo(x, y, dist !== 2 && dist !== 4);
    }
  }
  const al = posicoesAlinhamento(v, tam);
  for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) poeFixo(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const formato = (mascara: number) => {
    const d = (BITS_FORMATO_M << 3) | mascara;
    let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, bit = (i: number) => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) poeFixo(8, i, bit(i));
    poeFixo(8, 7, bit(6)); poeFixo(8, 8, bit(7)); poeFixo(7, 8, bit(8));
    for (let i = 9; i < 15; i++) poeFixo(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) poeFixo(tam - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) poeFixo(8, tam - 15 + i, bit(i));
    poeFixo(8, tam - 8, true);
  };
  formato(0);
  if (v >= 7) {
    let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (v << 12) | r;
    for (let i = 0; i < 18; i++) { const bit = ((b >>> i) & 1) === 1, a = tam - 11 + (i % 3), c = Math.floor(i / 3); poeFixo(a, c, bit); poeFixo(c, a, bit); }
  }

  // dados em zigue-zague, de duas em duas colunas, da direita para a esquerda
  let i = 0;
  for (let dir = tam - 1; dir >= 1; dir -= 2) {
    if (dir === 6) dir = 5;
    for (let vert = 0; vert < tam; vert++) for (let j = 0; j < 2; j++) {
      const x = dir - j, subindo = ((dir + 1) & 2) === 0, y = subindo ? tam - 1 - vert : vert;
      if (!fixo[y][x] && i < final.length * 8) { m[y][x] = ((final[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
    }
  }

  // máscara: testa as 8 e fica com a de menor penalidade
  const aplicar = (k: number) => { for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) if (!fixo[y][x] && MASCARAS[k](x, y)) m[y][x] = !m[y][x]; };
  let melhor = 0, menor = Infinity;
  for (let k = 0; k < 8; k++) {
    aplicar(k); formato(k);
    const p = penalidade(m);
    if (p < menor) { menor = p; melhor = k; }
    aplicar(k); // desfaz (a máscara é um "ou exclusivo")
  }
  aplicar(melhor); formato(melhor);
  return m;
}

function penalidade(m: boolean[][]) {
  const tam = m.length;
  let p = 0, escuros = 0;
  const linha = (get: (i: number) => boolean) => {
    let corrida = 1;
    for (let i = 1; i <= tam; i++) {
      if (i < tam && get(i) === get(i - 1)) { corrida++; continue; }
      if (corrida >= 5) p += 3 + (corrida - 5);
      corrida = 1;
    }
    // padrão parecido com o localizador (1:1:3:1:1 com 4 claros de um lado)
    for (let i = 0; i + 11 <= tam; i++) {
      let a = "";
      for (let k = 0; k < 11; k++) a += get(i + k) ? "1" : "0";
      if (a === "10111010000" || a === "00001011101") p += 40;
    }
  };
  for (let y = 0; y < tam; y++) linha((x) => m[y][x]);
  for (let x = 0; x < tam; x++) linha((y) => m[y][x]);
  for (let y = 0; y < tam - 1; y++) for (let x = 0; x < tam - 1; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
  }
  for (const l of m) for (const c of l) if (c) escuros++;
  const total = tam * tam;
  p += (Math.ceil(Math.abs(escuros * 20 - total * 10) / total) - 1) * 10;
  return p;
}

// caminho SVG dos módulos escuros (com 4 módulos de margem clara, como pede a norma)
export function qrCaminho(m: boolean[][], margem = 4) {
  let d = "";
  m.forEach((l, y) => l.forEach((c, x) => { if (c) d += `M${x + margem} ${y + margem}h1v1h-1z`; }));
  return { d, lado: m.length + margem * 2 };
}
