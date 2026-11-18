// Pix do DONO da loja (17/11/2026, frente "atendente que fecha a venda"): validação da chave Pix que o dono cadastra em
// /app/vendas e o BR Code estático (Pix copia e cola) de cada pedido, com o valor já dentro. O dinheiro vai direto da
// conta do cliente para a do dono: o WorkEnd não recebe nem repassa nada e não confirma pagamento sozinho.
// ATENÇÃO: isto NÃO é o Pix do próprio WorkEnd (o dono pagando o lote), que fica em ./mercadopago.ts.
// Funções puras, sem banco: testadas em /root/workend-video/testes/vendas-unidade.mjs.

export type TipoChavePix = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";
export const NOME_TIPO_CHAVE: Record<TipoChavePix, string> = { cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Celular", aleatoria: "Chave aleatória" };
export const MAX_NOME_RECEBEDOR = 25;
export const MAX_CIDADE_RECEBEDOR = 15;

const soDigitos = (s: string) => s.replace(/\D/g, "");

function cpfValido(d: string) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}
function cnpjValido(d: string) {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (n: number) => { const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += +d[i] * pesos[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === +d[12] && dv(13) === +d[13];
}
const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// celular com DDD: "(79) 99999-0000", "79999990000", "+55 79 99999-0000" → "+5579999990000" (o formato da chave no Pix)
function telefoneDaChave(bruto: string): string | null {
  let d = soDigitos(bruto);
  if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 11) return null;
  if (!/^[1-9][1-9]9\d{8}$/.test(d)) return null; // DDD de 11 a 99 e celular começando com 9
  return `+55${d}`;
}

// Tipo da chave pelo jeito que ela está escrita (sugestão para o formulário; quem decide é o dono)
export function adivinharTipo(bruto: string): TipoChavePix | null {
  const s = bruto.trim();
  if (!s) return null;
  if (s.includes("@")) return "email";
  if (UUID.test(s.toLowerCase())) return "aleatoria";
  if (s.startsWith("+")) return "telefone";
  const d = soDigitos(s);
  if (d.length === 14) return "cnpj";
  if (d.length === 11) return cpfValido(d) ? "cpf" : telefoneDaChave(d) ? "telefone" : "cpf";
  if (d.length === 13 && d.startsWith("55")) return "telefone";
  return null;
}

export class ErroChavePix extends Error {}

// Confere e normaliza a chave no formato que o Pix usa. Lança ErroChavePix com a explicação para o dono.
export function validarChavePix(tipoBruto: unknown, chaveBruta: unknown): { tipo: TipoChavePix; chave: string } {
  const bruto = (typeof chaveBruta === "string" ? chaveBruta : "").trim().slice(0, 120);
  if (!bruto) throw new ErroChavePix("Escreva a sua chave Pix.");
  const tipo = (typeof tipoBruto === "string" && tipoBruto in NOME_TIPO_CHAVE ? tipoBruto : adivinharTipo(bruto)) as TipoChavePix | null;
  if (!tipo) throw new ErroChavePix("Não reconheci essa chave. Use CPF, CNPJ, e-mail, celular com DDD ou a chave aleatória.");
  if (tipo === "cpf") { const d = soDigitos(bruto); if (!cpfValido(d)) throw new ErroChavePix("Esse CPF não é válido. Confira os números."); return { tipo, chave: d }; }
  if (tipo === "cnpj") { const d = soDigitos(bruto); if (!cnpjValido(d)) throw new ErroChavePix("Esse CNPJ não é válido. Confira os números."); return { tipo, chave: d }; }
  if (tipo === "email") {
    const e = bruto.toLowerCase();
    if (e.length > 77 || !EMAIL.test(e)) throw new ErroChavePix("Esse e-mail não parece certo. Escreva assim: nome@exemplo.com.");
    return { tipo, chave: e };
  }
  if (tipo === "telefone") { const t = telefoneDaChave(bruto); if (!t) throw new ErroChavePix("Escreva o celular com DDD, assim: (79) 99999-0000."); return { tipo, chave: t }; }
  const a = bruto.toLowerCase();
  if (!UUID.test(a)) throw new ErroChavePix("A chave aleatória tem 32 letras e números em 5 grupos, assim: 123e4567-e89b-12d3-a456-426614174000.");
  return { tipo, chave: a };
}
// tipo de uma chave já guardada (o formato normalizado não deixa dúvida: celular começa com +55)
export function tipoDaChaveGuardada(chave: string): TipoChavePix {
  if (chave.startsWith("+")) return "telefone";
  if (chave.includes("@")) return "email";
  if (UUID.test(chave)) return "aleatoria";
  return chave.length === 14 ? "cnpj" : "cpf";
}

// O BR Code só aceita letras sem acento, números e uns poucos sinais
export function textoBrCode(t: string, max: number) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 .,\-/&]/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
}

// CRC16-CCITT (polinômio 0x1021, começa em 0xFFFF), como pede o manual do BR Code. Confere: "123456789" → 29B1.
export function crc16(s: string) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
const campo = (id: string, valor: string) => {
  if (valor.length > 99) throw new Error(`Campo ${id} do BR Code grande demais.`);
  return `${id}${String(valor.length).padStart(2, "0")}${valor}`;
};

// BR Code estático com valor (EMV): GUI br.gov.bcb.pix + chave, valor, nome (até 25) e cidade (até 15) sem acento,
// identificador (txid "***" ou até 25 letras e números) e o CRC no fim.
export function montarBrCode(d: { chave: string; nome: string; cidade: string; valorCentavos: number; txid?: string }) {
  if (!Number.isInteger(d.valorCentavos) || d.valorCentavos < 1) throw new Error("Valor do Pix inválido.");
  const nome = textoBrCode(d.nome, MAX_NOME_RECEBEDOR) || "RECEBEDOR";
  const cidade = textoBrCode(d.cidade, MAX_CIDADE_RECEBEDOR) || "BRASIL";
  const txid = (d.txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const valor = (d.valorCentavos / 100).toFixed(2);
  const corpo = campo("00", "01")
    + campo("26", campo("00", "br.gov.bcb.pix") + campo("01", d.chave))
    + campo("52", "0000") + campo("53", "986") + campo("54", valor) + campo("58", "BR")
    + campo("59", nome) + campo("60", cidade) + campo("62", campo("05", txid)) + "6304";
  return corpo + crc16(corpo);
}

// Confere um copia e cola (estrutura TLV e CRC): usado nos testes e na tela do dono
export function brCodeValido(codigo: string) {
  if (!/^000201/.test(codigo) || codigo.length < 30) return false;
  if (crc16(codigo.slice(0, -4)) !== codigo.slice(-4).toUpperCase()) return false;
  let i = 0;
  while (i < codigo.length) {
    const tam = Number(codigo.slice(i + 2, i + 4));
    if (!Number.isInteger(tam) || i + 4 + tam > codigo.length) return false;
    if (codigo.slice(i, i + 2) === "63") return i + 4 + tam === codigo.length && tam === 4;
    i += 4 + tam;
  }
  return false;
}
