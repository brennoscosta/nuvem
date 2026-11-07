// Prévia do admin por senha: /app/admin sem login → senha ADMIN_SENHA → conta do dono; preço 0,99 pro admin; editar/dias/transferir.
import { chromium } from "playwright";
const base = process.argv[2] || "http://workend.localhost:3077";
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } }); const p = await ctx.newPage();
const erros = []; p.on("pageerror", (e) => erros.push(e.message));
await p.goto(`${base}/app/admin`, { waitUntil: "networkidle" }); await p.waitForTimeout(800);
await p.screenshot({ path: ".higgs/adm2-1-senha.jpg", type: "jpeg", quality: 80 });
await p.fill("input[type=password]", process.env.ADMIN_SENHA || "teste"); await p.click("button[type=submit]");
await p.waitForTimeout(4000); await p.waitForLoadState("networkidle");
const eu = await p.evaluate(() => fetch("/api/workend/eu").then((r) => r.json()));
console.log("logado como:", eu.email, "papel:", eu.papel);
const t = await p.evaluate(() => fetch("/api/terrenos").then((r) => r.json()));
console.log("preco pro admin:", t.preco, "admin:", t.admin);
// reserva um lote como admin e confere o cartão com o preço
const LOTE = "1,-1,1";
const r = await p.evaluate(async (l) => { const x = await fetch(`/api/terrenos/${encodeURIComponent(l)}/reservar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ empresaNome: "Teste Admin", cor: "#16A34A" }) }); return x.status; }, LOTE);
console.log("reserva admin:", r);
// ações novas
const acao = async (body) => p.evaluate(async ([l, body]) => { const x = await fetch(`/api/admin/terrenos/${encodeURIComponent(l)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); return [x.status, await x.text()]; }, [LOTE, body]);
console.log("editar:", await acao({ acao: "editar", empresaNome: "Teste Editado", cor: "#DC2626" }));
console.log("dias +45:", await acao({ acao: "dias", dias: 45 }));
console.log("dias -10:", await acao({ acao: "dias", dias: -10 }));
console.log("transferir p/ inexistente:", await acao({ acao: "transferir", email: "ninguem@x.com" }));
const lista = await p.evaluate(() => fetch("/api/admin/terrenos").then((r) => r.json()));
const meu = lista.find((x) => x.chave === LOTE); console.log("lote depois:", meu && { nome: meu.empresaNome, cor: meu.cor, status: meu.status, pagoAte: meu.pagoAte });
await p.goto(`${base}/app/admin`, { waitUntil: "networkidle" }); await p.waitForTimeout(2500);
await p.screenshot({ path: ".higgs/adm2-2-painel.jpg", type: "jpeg", quality: 80, fullPage: true });
// cartão do lote no mapa com preço 0,99
await p.goto(`${base}/mundo?lote=${encodeURIComponent(LOTE)}&qualidade=leve`, { waitUntil: "domcontentloaded" });
await p.waitForSelector("canvas"); await p.waitForTimeout(9000);
const txt = await p.evaluate(() => document.body.innerText); console.log("cartão tem 0,99:", /0,99/.test(txt), "| trecho:", (txt.match(/Renovar[^\n]*|Pagar[^\n]*/) || [""])[0]);
await p.screenshot({ path: ".higgs/adm2-3-cartao.jpg", type: "jpeg", quality: 80 });
// limpa
await acao({ acao: "liberar" });
console.log(JSON.stringify({ erros: erros.slice(0, 5) }));
await b.close();
