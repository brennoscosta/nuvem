// Prévia da fase 2: reserva de 10 min (contagem e expiração), cartão com botão de pagar, admin (cartão e /app/admin).
// Usa o banco de teste local: precisa de PGURL (ex.: postgres://claude@127.0.0.1:5499/nuvemteste) pra mexer nos prazos e no papel.
// Uso: PGURL=... node scripts/previa-admin.mjs [base]
import { chromium } from "playwright";
import { execSync } from "node:child_process";
const [, , base = "http://workend.localhost:3077"] = process.argv;
const LOTE = "0,-1,1";
const psql = (q) => execSync(`psql "${process.env.PGURL}" -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") erros.push("console: " + m.text().slice(0, 200)); });
const foto = async (nome) => { await page.screenshot({ path: `.higgs/adm-${nome}.jpg`, type: "jpeg", quality: 82 }); console.log("foto", nome); };
const esperaCena = async (ms = 15000) => { await page.waitForSelector("canvas", { timeout: 120000 }); await page.waitForTimeout(ms); };

// conta nova
const email = `admin${Date.now()}@exemplo.com`;
await page.goto(`${base}/cadastro`, { waitUntil: "networkidle", timeout: 120000 }); await page.waitForTimeout(1200);
await page.fill("input[autocomplete=name]", "Brenno Teste"); await page.fill("input[autocomplete=organization]", "Mundo Nuvem"); await page.fill("input[type=email]", email); await page.fill("input[type=password]", "senha12345");
await page.click("button[type=submit]"); await page.waitForURL(/\/app/, { timeout: 60000 });
await foto("1-dashboard-sem-chao");

// reserva pela API (como o painel faria) e abre o lote: contagem regressiva + botão de pagar (desligado sem token)
const r = await page.evaluate(async (l) => { const x = await fetch(`/api/terrenos/${encodeURIComponent(l)}/reservar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ empresaNome: "Mundo Nuvem", cor: "#7C3AED" }) }); return [x.status, await x.text()]; }, LOTE);
console.log("reserva:", r[0], r[1].slice(0, 160));
await page.goto(`${base}/mundo?lote=${encodeURIComponent(LOTE)}&qualidade=alta&cam=-10,24,-20,10,0,-62`, { waitUntil: "domcontentloaded" });
await esperaCena();
await foto("2-reservado-contagem");

// pagar sem token → erro amigável
const pagar = await page.evaluate(async (l) => { const x = await fetch(`/api/terrenos/${encodeURIComponent(l)}/pagar`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); return [x.status, await x.text()]; }, LOTE);
console.log("pagar sem token:", pagar[0], pagar[1]);

// expira em 8 s: a contagem zera e o lote volta a ficar livre
psql(`UPDATE terreno SET reservado_ate = now() + interval '8 seconds' WHERE chave = '${LOTE}'`);
await page.evaluate(() => window.__mundo.getState().carregar());
await page.waitForTimeout(12000);
const depois = await page.evaluate(() => fetch("/api/terrenos").then((r) => r.json()));
console.log("depois de expirar:", JSON.stringify(depois.terrenos), "meu:", depois.meu);
await page.waitForTimeout(1500);
await foto("3-expirou-livre");

// vira admin, reserva de novo e ativa por 30 dias (como se tivesse pago); cartão do admin + /app/admin
psql(`UPDATE usuario SET papel = 'admin' WHERE email = '${email}'`);
await page.evaluate(async (l) => fetch(`/api/terrenos/${encodeURIComponent(l)}/reservar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ empresaNome: "Mundo Nuvem", cor: "#7C3AED" }) }), LOTE);
await page.evaluate(async (l) => fetch(`/api/admin/terrenos/${encodeURIComponent(l)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao: "ativar", meses: 1 }) }), LOTE);
// outro usuário reserva um lote vizinho (pra testar liberar/banir pelo admin)
const ctx2 = await browser.newContext(); const p2 = await ctx2.newPage();
await p2.goto(`${base}/cadastro`, { waitUntil: "networkidle" }); await p2.waitForTimeout(1200);
await p2.fill("input[autocomplete=name]", "Outro Dono"); await p2.fill("input[type=email]", `outro${Date.now()}@exemplo.com`); await p2.fill("input[type=password]", "senha12345"); await p2.click("button[type=submit]"); await p2.waitForURL(/\/app/, { timeout: 60000 });
await p2.evaluate(async () => fetch(`/api/terrenos/${encodeURIComponent("0,-1,2")}/reservar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ empresaNome: "Loja Suspeita", cor: "#DC2626" }) }));
await ctx2.close();

await page.goto(`${base}/mundo?lote=${encodeURIComponent("0,-1,2")}&qualidade=alta&cam=-10,24,-20,-10,0,-42`, { waitUntil: "domcontentloaded" });
await esperaCena();
await foto("4-admin-cartao-de-outro");
await page.goto(`${base}/mundo?lote=${encodeURIComponent(LOTE)}&qualidade=alta&cam=-10,24,-20,10,0,-62`, { waitUntil: "domcontentloaded" });
await esperaCena();
await foto("5-meu-chao-ativo");
await page.goto(`${base}/app/admin`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
await foto("6-app-admin");
await page.goto(`${base}/app`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await foto("7-dashboard-ativo");
await page.goto(`${base}/politicas`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await foto("8-politicas");
console.log(JSON.stringify({ erros: erros.slice(0, 10) }));
await browser.close();
