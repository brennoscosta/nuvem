// Prévia do módulo de e-mails: cadastro e reserva registram envios; admin edita, pré-visualiza, salva e restaura.
import { chromium } from "playwright";
const base = process.argv[2] || "http://workend.localhost:3077";
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } }); const p = await ctx.newPage();
const erros = []; p.on("pageerror", (e) => erros.push(e.message));
const email = `maria${Date.now()}@exemplo.com`;
await p.goto(`${base}/cadastro`, { waitUntil: "networkidle" }); await p.waitForTimeout(1200);
await p.fill("input[autocomplete=name]", "Maria Teste"); await p.fill("input[autocomplete=organization]", "Padaria da Maria"); await p.fill("input[type=email]", email); await p.fill("input[type=password]", "senha12345");
await p.click("button[type=submit]"); await p.waitForURL(/\/app/, { timeout: 60000 });
const r = await p.evaluate(async () => (await fetch(`/api/terrenos/${encodeURIComponent("0,1,1")}/reservar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ empresaNome: "Padaria da Maria", cor: "#D97706" }) })).status);
console.log("reserva:", r);
await p.evaluate(() => fetch("/api/workend/sair", { method: "POST" }));
// admin
await p.goto(`${base}/app/admin`, { waitUntil: "networkidle" }); await p.waitForTimeout(800);
await p.fill("input[type=password]", process.env.ADMIN_SENHA || "teste"); await p.click("button[type=submit]"); await p.waitForTimeout(4000);
await p.goto(`${base}/app/admin`, { waitUntil: "networkidle" }); await p.waitForTimeout(2500);
const d = await p.evaluate(() => fetch("/api/admin/emails").then((r) => r.json()));
console.log("envios registrados:", d.envios.map((e) => `${e.chave}→${e.para} [${e.status}]`));
await p.getByRole("button", { name: /Lote reservado/ }).click(); await p.waitForTimeout(400);
await p.getByRole("button", { name: "Pré-visualizar" }).click(); await p.waitForTimeout(2500);
await p.getByText("E-mails", { exact: true }).scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
await p.screenshot({ path: ".higgs/em-1-editor.jpg", type: "jpeg", quality: 80 });
// edita e salva
const ta = p.locator("textarea").first(); await ta.fill("<h1>Oi {{nome}}</h1><p>Teste editado pro {{lote}}.</p>");
await p.getByRole("button", { name: "Salvar", exact: true }).click(); await p.waitForTimeout(2000);
const d2 = await p.evaluate(() => fetch("/api/admin/emails").then((r) => r.json()));
console.log("reserva editado:", d2.modelos.find((m) => m.chave === "reserva").editado, "|", d2.modelos.find((m) => m.chave === "reserva").html.slice(0, 40));
const t = await p.evaluate(() => fetch("/api/admin/emails/teste", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chave: "reserva" }) }).then((r) => r.json()));
console.log("prévia montada:", t.assunto, "|", /Teste editado pro Lote 7/.test(t.html));
await p.getByRole("button", { name: "Restaurar padrão" }).click(); await p.waitForTimeout(2000);
const d3 = await p.evaluate(() => fetch("/api/admin/emails").then((r) => r.json()));
console.log("restaurado:", !d3.modelos.find((m) => m.chave === "reserva").editado);
await p.getByText("Últimos envios").scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
await p.screenshot({ path: ".higgs/em-2-envios.jpg", type: "jpeg", quality: 80 });
console.log(JSON.stringify({ erros: erros.slice(0, 5) }));
await b.close();
