// Uso: CHROME=<chromium> node scripts/medir-grupos.mjs "<url com ?medir=1>" [profundidade] [filtro de caminho] [mínimo]
// Os grupos do mapa têm nome (scene/Mundo.tsx › G), então a lista diz o que pesa: placas, trafego, quiosques...
// Conta exata de desenhos por grupo: peças visíveis dentro do campo da câmera real (como o three.js decide), sem depender de quadros
import { chromium } from "playwright";
const url = process.argv[2], prof = +(process.argv[3] ?? 3), FILTRO = process.argv[4] ?? ".", MIN = +(process.argv[5] ?? 3);
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto(url, { timeout: 120000 }); await p.waitForSelector("canvas", { state: "attached", timeout: 120000 }); await p.waitForTimeout(22000);
const r = await p.evaluate(async ([prof, FILTRO, MIN]) => {
  const gl = window.__cena, cena = window.__cenaObjetos, re = new RegExp(FILTRO);
  const orig = gl.render.bind(gl); let cam = null; gl.render = (s, c) => { if (s === cena) cam = c; return orig(s, c); };
  await new Promise((res) => setTimeout(res, 800)); gl.render = orig;
  if (!cam) return { erro: "sem câmera" };
  const M4 = cam.matrixWorld.constructor, V3 = cam.position.constructor;
  const pm = new M4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse), e = pm.elements;
  const planos = [[e[3]-e[0],e[7]-e[4],e[11]-e[8],e[15]-e[12]],[e[3]+e[0],e[7]+e[4],e[11]+e[8],e[15]+e[12]],[e[3]+e[1],e[7]+e[5],e[11]+e[9],e[15]+e[13]],[e[3]-e[1],e[7]-e[5],e[11]-e[9],e[15]-e[13]],[e[3]-e[2],e[7]-e[6],e[11]-e[10],e[15]-e[14]],[e[3]+e[2],e[7]+e[6],e[11]+e[10],e[15]+e[14]]].map(([a,b,c,d]) => { const l = Math.hypot(a,b,c); return [a/l,b/l,c/l,d/l]; });
  const dentro = (o) => { if (!o.frustumCulled) return true; let s = o.boundingSphere; if (!s && (o.isInstancedMesh || o.isSkinnedMesh) && o.computeBoundingSphere) { o.computeBoundingSphere(); s = o.boundingSphere; } const g = o.geometry; if (!s) { if (!g.boundingSphere) g.computeBoundingSphere(); s = g.boundingSphere; } if (!s) return true; const c = new V3().copy(s.center).applyMatrix4(o.matrixWorld), rr = s.radius * o.matrixWorld.getMaxScaleOnAxis(); return planos.every(([a,b,cc,d]) => a*c.x + b*c.y + cc*c.z + d >= -rr); };
  const custoDe = (raiz) => { let n = 0, tri = 0; const tipos = new Map(); const ir = (o) => { if (!o.visible) return; if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && dentro(o)) { const mats = Array.isArray(o.material) ? o.material : [o.material]; const g = o.geometry; const k = (Array.isArray(o.material) && g?.groups?.length) ? g.groups.filter((gr) => mats[gr.materialIndex]?.visible !== false).length : (mats[0]?.visible === false ? 0 : 1); n += k; const t = g?.index ? g.index.count / 3 : (g?.attributes?.position?.count ?? 0) / 3; tri += t * (o.isInstancedMesh ? o.count : 1); const mt = mats[0]; const nome = (mt?.type ?? "?").replace("Material", "") + (mt?.map ? "+t" : ""); tipos.set(nome, (tipos.get(nome) ?? 0) + k); } for (const c of o.children) ir(c); }; ir(raiz); return { n, tri: Math.round(tri), tipos: [...tipos].sort((a, b) => b[1] - a[1]).slice(0, 3).map((t) => t.join(":")).join(" ") }; };
  const total = custoDe(cena);
  const nomes = (o) => { const s = []; o.traverse((c) => { if (c.name && s.length < 3 && !s.includes(c.name)) s.push(c.name); }); return s.join(","); };
  const out = [];
  const andar = (o, d, cam_) => { for (const [i, c] of o.children.entries()) { if (!c.visible) continue; const x = custoDe(c); const caminho = cam_ + "/" + i; if (x.n < MIN) continue; out.push({ cam: caminho, d, ...x, nome: c.name || nomes(c) }); if (d < prof && !c.isMesh && re.test(caminho)) andar(c, d + 1, caminho); } };
  andar(cena, 0, "");
  return { total, info: gl.info.render.calls, programas: gl.info.programs?.length, out };
}, [prof, FILTRO, MIN]);
if (r.erro) { console.log(r.erro); process.exit(1); }
console.log("TOTAL contado", r.total.n, "tri", r.total.tri, "| renderer", r.info, "| programas", r.programas);
for (const g of r.out.slice(0, +(process.env.LINHAS ?? 120))) console.log("  ".repeat(g.d) + String(g.n).padStart(4), String(g.tri).padStart(8), g.cam.padEnd(16), (g.nome || "-").slice(0, 40).padEnd(40), g.tipos);
await b.close();
