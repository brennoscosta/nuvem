// Prévia do fluxo de compra de lote: visitante (cartão com "Quero esse chão"), cadastro com ?lote=, painel
// "Montar minha empresa" ao vivo e reserva. Uso: node scripts/previa-lote.mjs [base] (padrão http://workend.localhost:3077)
import { chromium } from "playwright";
const [, , base = "http://workend.localhost:3077"] = process.argv;
const LOTE = "-1,0,2";
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") erros.push("console: " + m.text().slice(0, 200)); });
const foto = async (nome) => { await page.screenshot({ path: `.higgs/lote-${nome}.jpg`, type: "jpeg", quality: 82 }); console.log("foto", nome); };
const esperaCena = async (ms = 16000) => { await page.waitForSelector("canvas", { timeout: 120000 }); await page.waitForTimeout(ms); };

// 1) visitante no /mundo clica num lote
await page.goto(`${base}/mundo?qualidade=alta&cam=-50,30,45,-62,0,12`, { waitUntil: "domcontentloaded", timeout: 120000 });
await esperaCena();
await page.evaluate((l) => window.__mundo.getState().selecionarLote(l), LOTE);
await page.waitForTimeout(2500);
await foto("1-visitante");
const linkCadastro = await page.getAttribute("a:has-text('Quero esse chão')", "href");
console.log("link cadastro:", linkCadastro);

// 2) cadastro com ?lote= → volta pro mundo com o painel aberto
const email = `teste${Date.now()}@exemplo.com`;
await page.goto(`${base}${linkCadastro}`, { waitUntil: "networkidle" }); await page.waitForTimeout(1200);
await page.fill("input[autocomplete=name]", "Maria Teste");
await page.fill("input[autocomplete=organization]", "Padaria da Maria");
await page.fill("input[type=email]", email);
await page.fill("input[type=password]", "senha12345");
await page.click("button[type=submit]");
await page.waitForURL(/\/mundo\?lote=/, { timeout: 60000 });
await esperaCena(14000);
await foto("2-painel-aberto");

// 3) preenche nome, cor e logo (gera um PNG simples) e vê ao vivo
await page.fill("input[placeholder^='Ex.:']", "Padaria da Maria");
await page.click("button[aria-label='#D97706']");
const png = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = c.height = 200; const g = c.getContext("2d"); g.fillStyle = "#D97706"; g.beginPath(); g.arc(100, 100, 90, 0, 7); g.fill(); g.fillStyle = "#fff"; g.font = "bold 110px Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("M", 100, 108); return c.toDataURL("image/png").split(",")[1]; });
await page.setInputFiles("input[type=file]", { name: "logo.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
await page.waitForTimeout(2500);
await foto("3-rascunho-ao-vivo");

// 4) reserva
await page.click("button:has-text('Reservar este chão')");
await page.waitForTimeout(4000);
await foto("4-reservado");
const api = await page.evaluate(() => fetch("/api/terrenos").then((r) => r.json()));
console.log("api/terrenos:", JSON.stringify(api));

// 5) zoom no lote reservado
await page.goto(`${base}/mundo?qualidade=alta&cam=-70,14,38,-62,0,12`, { waitUntil: "domcontentloaded" });
await esperaCena(14000);
await foto("5-placa-perto");
console.log(JSON.stringify({ erros: erros.slice(0, 10) }));
await browser.close();
