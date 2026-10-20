import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const erros = []; page.on("pageerror", (e) => erros.push(e.message));
await page.goto("http://localhost:3077/?demo=1&turbo=12&cam=4,14,16,2,0,-2", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector("canvas", { timeout: 120000 });
await page.waitForTimeout(40000); // todo mundo sentado
// abre o menu via store (hover real depende de raycast no canvas; aqui simulo o estado)
await page.evaluate(() => { const s = window.__esc.getState(); const ceo = Object.values(s.agentes).find(a => a.nivel === "ceo"); s.setHover(ceo.id); });
await page.mouse.move(700, 450);
await page.waitForTimeout(800);
await page.screenshot({ path: "/home/claude/previas/menu-hover.jpg", type: "jpeg", quality: 82 });
await page.locator("button:has-text('Chamar reunião por setor')").click();
await page.waitForTimeout(500);
await page.locator("button:has-text('Suporte')").first().click();
await page.locator("button:has-text('Vendas')").first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: "/home/claude/previas/menu-setores.jpg", type: "jpeg", quality: 82 });
await page.locator("button:has-text('Chamar pra sala de reunião')").click();
await page.waitForTimeout(22000);
await page.screenshot({ path: "/home/claude/previas/reuniao.jpg", type: "jpeg", quality: 82 });
const st = await page.evaluate(() => { const s = window.__esc.getState(); return { reuniao: s.reuniaoAtiva && s.reuniaoAtiva.participantes.map(id => s.agentes[id].nome + ":" + s.agentes[id].status) }; });
console.log(JSON.stringify({ st, erros }));
await browser.close();
