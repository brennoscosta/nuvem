// Renderiza um GLB em 4 ângulos (de cima, olhando de +z, +x, -z, -x) pra conferir textura e orientação.
// Uso: node scripts/cidade/ver.mjs <modelo.glb> <saida.jpg>
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const [, , glb, out = "ver.jpg"] = process.argv;
const raiz = process.cwd();
const tipos = { ".js": "text/javascript", ".glb": "model/gltf-binary", ".html": "text/html" };
const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const f = p === "/__glb" ? path.resolve(glb) : path.join(raiz, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": tipos[path.extname(f)] ?? "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => srv.listen(0, r));
const porta = srv.address().port;
const html = `<!doctype html><html><body style="margin:0;background:#dfe8f0"><canvas id=c width=1600 height=1200></canvas>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from "three"; import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
const canvas=document.getElementById("c"); const r=new THREE.WebGLRenderer({canvas,antialias:true}); r.setScissorTest(true);
const scene=new THREE.Scene(); scene.background=new THREE.Color("#dfe8f0");
scene.add(new THREE.HemisphereLight("#fff","#aab",1.2)); const d=new THREE.DirectionalLight("#fff",2); d.position.set(3,6,4); scene.add(d);
const g=await new GLTFLoader().loadAsync("/__glb"); const o=g.scene; scene.add(o);
const box=new THREE.Box3().setFromObject(o); const s=new THREE.Vector3(); box.getSize(s); const c=new THREE.Vector3(); box.getCenter(c);
const R=Math.max(s.x,s.y,s.z)*1.6;
const vistas=[[0,1],[1,0],[0,-1],[-1,0]]; // de onde a câmera olha (x,z)
for(let i=0;i<4;i++){ const [vx,vz]=vistas[i]; const cam=new THREE.PerspectiveCamera(35,4/3,0.01,100);
 cam.position.set(c.x+vx*R, c.y+R*0.7, c.z+vz*R); cam.lookAt(c);
 const x=(i%2)*800, y=(1-Math.floor(i/2))*600; r.setViewport(x,y,800,600); r.setScissor(x,y,800,600); r.render(scene,cam); }
window.__dims=[s.x,s.y,s.z]; window.__ok=true;
</script></body></html>`;
fs.writeFileSync(path.join(raiz, ".higgs", "_ver.html"), html);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("pageerror", e.message));
await page.goto(`http://localhost:${porta}/.higgs/_ver.html`);
await page.waitForFunction(() => window.__ok, null, { timeout: 120000 });
const dims = await page.evaluate(() => window.__dims);
await page.screenshot({ path: out, type: "jpeg", quality: 80 });
console.log(JSON.stringify({ out, dims: dims.map((v) => +v.toFixed(3)), vistas: "cima-esq: câmera em +z (vê a face sul) · cima-dir: +x (face leste) · baixo-esq: -z (face norte) · baixo-dir: -x (face oeste)" }));
await browser.close(); srv.close();
