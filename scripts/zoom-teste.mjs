// Testa que a roda do mouse faz zoom em qualquer lugar (inclusive sobre crachás/balões) e nas duas vistas; tira fotos da lanchonete com os letreiros.
import { chromium } from "playwright";
const base = process.argv[2] || "http://workend.localhost:3077";
const b = await chromium.launch({ executablePath: process.env.CHROME, args: ["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist","--enable-webgl"] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const erros = []; p.on("pageerror", (e) => erros.push(e.message));
await p.goto(`${base}/mundo?medir=1`, { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForSelector("canvas", { timeout: 180000 }); await p.waitForTimeout(15000);
await p.evaluate(() => { const gl = window.__cena; const orig = gl.render.bind(gl); gl.render = (s, c) => { window.__pos = [c.position.x, c.position.y, c.position.z]; return orig(s, c); }; });
const pos = async () => p.evaluate(() => window.__pos?.map((n) => +n.toFixed(1)));
const dist = (a, t) => Math.hypot(a[0] - t[0], a[1] - t[1], a[2] - t[2]);
const wheel = async (n, dy) => { for (let i = 0; i < n; i++) { await p.mouse.wheel(0, dy); await p.waitForTimeout(60); } await p.waitForTimeout(1500); };
await p.mouse.move(640, 400);
console.log("inicio (dentro)", await pos());
await wheel(40, 300); const maxDentro = await pos(); console.log("zoom max dentro", maxDentro, "dist≈", dist(maxDentro, [0, 0, 0.5]).toFixed(1));
await wheel(40, -300); console.log("zoom in dentro", await pos());
await p.getByText(/Ver por fora/).click(); await p.waitForTimeout(3000);
console.log("apos ver por fora", await pos());
// mouse em cima do crachá do CEO (centro do prédio)
const rotulo = p.locator("[data-rotulo]").first(); const bb = await rotulo.boundingBox(); console.log("crachá em", bb && [Math.round(bb.x + bb.width / 2), Math.round(bb.y + bb.height / 2)]);
if (bb) await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
await wheel(10, 300); console.log("zoom out fora com mouse no crachá", await pos());
await wheel(10, -300); console.log("zoom in fora com mouse no crachá", await pos());
await p.getByText(/Ver por dentro/).click(); await p.waitForTimeout(3000);
await wheel(10, 300); console.log("zoom out dentro com o mouse ainda no botão", await pos());
await p.mouse.move(640, 90); await wheel(10, -300); console.log("zoom in com o mouse na barra de cima", await pos());
// lanchonete com letreiros
await p.goto(`${base}/mundo?cam=20,16,-30,52,2,-5`, { waitUntil: "domcontentloaded" });
await p.waitForSelector("canvas"); await p.waitForTimeout(12000);
await p.getByText(/Ver por fora/).click(); await p.waitForTimeout(4000);
await p.screenshot({ path: ".higgs/letreiro-frente.jpg", type: "jpeg", quality: 80 });
await p.goto(`${base}/mundo?cam=95,22,-40,56,3,-5`, { waitUntil: "domcontentloaded" });
await p.waitForSelector("canvas"); await p.waitForTimeout(12000);
await p.getByText(/Ver por fora/).click(); await p.waitForTimeout(4000);
await p.screenshot({ path: ".higgs/letreiro-tras.jpg", type: "jpeg", quality: 80 });
console.log(JSON.stringify({ erros: erros.slice(0, 5) }));
await b.close();
