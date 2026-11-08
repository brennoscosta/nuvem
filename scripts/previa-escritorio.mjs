// Prévia do escritório do cliente: admin ativa um lote → nasce com atendente + CEO → painel Montar escritório
// (layouts, setores, equipe) → salva → fotos por fora e por dentro.
import { chromium } from "playwright";
const base = process.argv[2] || "http://workend.localhost:3077";
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist","--enable-webgl"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const erros = []; p.on("pageerror", (e) => erros.push(e.message));
const foto = async (n) => { await p.screenshot({ path: `.higgs/esc-${n}.jpg`, type: "jpeg", quality: 80 }); console.log("foto", n); };
await p.goto(`${base}/app/admin`, { waitUntil: "networkidle" }); await p.waitForTimeout(2000);
console.log("login:", await p.evaluate(async () => (await fetch("/api/workend/admin-senha", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ senha: "teste" }) })).status));
const LOTE = "0,-1,2"; // lote sul do quarteirão norte (casa colonial)
await p.evaluate(async (l) => { await fetch(`/api/terrenos/${encodeURIComponent(l)}/reservar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ empresaNome: "Padaria da Maria", cor: "#D97706" }) }); await fetch(`/api/admin/terrenos/${encodeURIComponent(l)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao: "ativar", meses: 1 }) }); }, LOTE);
const esc = await p.evaluate(async (l) => (await fetch(`/api/terrenos/${encodeURIComponent(l)}/escritorio`)).json(), LOTE);
console.log("escritório padrão:", esc.layout, esc.setores.map((s) => s.nome), esc.equipe.map((m) => `${m.nome} (${m.papel})`));
const cam = "cam=4,15,-14,-10,1,-42";
await p.goto(`${base}/mundo?lote=${encodeURIComponent(LOTE)}&qualidade=alta&${cam}`, { waitUntil: "domcontentloaded" });
await p.waitForSelector("canvas"); await p.waitForTimeout(12000);
await p.getByText(/Ver por fora/).click(); await p.waitForTimeout(4000);
await foto("1-fora-moderno");
await foto("1b-cartao-edicao");
await p.getByRole("button", { name: /Prédio/ }).click(); await p.waitForTimeout(800);
await p.getByRole("button", { name: /Sobrado comercial/ }).click(); await p.waitForTimeout(2500);
await foto("2-painel-sobrado");
await p.getByRole("button", { name: /Setores/ }).click(); await p.waitForTimeout(300);
await p.getByRole("button", { name: "+ Adicionar setor" }).click(); await p.getByRole("button", { name: "+ Adicionar setor" }).click(); await p.waitForTimeout(400);
const inputs = p.locator("input[list=cargos-sugeridos]"); await inputs.nth(1).fill("Vendas"); await inputs.nth(2).fill("Marketing");
await p.getByRole("button", { name: /Equipe/ }).click(); await p.waitForTimeout(300);
await p.getByRole("button", { name: "Contratar profissional" }).click(); await p.waitForTimeout(1500); await foto("2b-catalogo"); await p.getByRole("button", { name: /^Vendedor/ }).click(); await p.waitForTimeout(300); await p.getByRole("button", { name: "Criar do zero" }).click(); await p.waitForTimeout(400);
await p.locator("input[placeholder=Nome]").nth(0).fill("Carla"); await p.locator("input[placeholder=Nome]").nth(1).fill("Maria");
await p.getByRole("button", { name: "Salvar escritório" }).click(); await p.waitForTimeout(3000);
const esc2 = await p.evaluate(async (l) => (await fetch(`/api/terrenos/${encodeURIComponent(l)}/escritorio`)).json(), LOTE);
console.log("salvo:", esc2.layout, esc2.setores.map((s) => `${s.nome}×${s.mesas}`), esc2.equipe.map((m) => `${m.nome}:${m.papel}${m.setorId ? "@" + m.setorId : ""}`));
await foto("3-fora-salvo");
await p.getByText(/Ver por dentro/).click(); await p.waitForTimeout(4000);
await foto("4-dentro");
await p.goto(`${base}/mundo?lote=${encodeURIComponent(LOTE)}&qualidade=alta&cam=-10,13,-28,-10,0,-41`, { waitUntil: "domcontentloaded" });
await p.waitForSelector("canvas"); await p.waitForTimeout(12000);
await foto("5-dentro-perto");
// loja
await p.evaluate(async (l) => fetch(`/api/terrenos/${encodeURIComponent(l)}/escritorio`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ layout: "loja" }) }), LOTE);
await p.evaluate(() => window.__mundo.getState().carregar()); await p.waitForTimeout(1500);
await p.getByText(/Ver por fora/).click(); await p.waitForTimeout(4000);
await foto("6-fora-loja");
await p.evaluate(async (l) => fetch(`/api/admin/terrenos/${encodeURIComponent(l)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao: "liberar" }) }), LOTE);
console.log(JSON.stringify({ erros: erros.slice(0, 6) }));
await b.close();
