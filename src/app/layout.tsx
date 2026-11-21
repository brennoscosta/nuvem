import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Escritório Nuvem",
  description: "Escritório virtual 3D com agentes de IA em hierarquia",
};

// iPhone e iPad (21/11/2026, print do dono com o cartão da sede cortado): o Safari amplia a página ao tocar num campo e
// não volta sozinho. maximum-scale=1 tira esse zoom automático, e o iOS continua deixando a pessoa ampliar com a pinça
// (ele ignora o limite para o gesto). Só no iOS: no Android o mesmo limite tiraria a pinça. O observador reaplica quando
// o Next troca a etiqueta ao mudar de página. Junto com os 16 px nos campos (globals.css).
const SCRIPT_SEM_ZOOM_IOS = `(function(){try{var n=navigator,ios=/iPhone|iPad|iPod/.test(n.userAgent)||(n.platform==="MacIntel"&&n.maxTouchPoints>1);if(!ios)return;var f=function(){var m=document.querySelector("meta[name=viewport]");if(!m)return;var c=m.getAttribute("content")||"";if(c.indexOf("maximum-scale")<0)m.setAttribute("content",c+(c?", ":"")+"maximum-scale=1")};f();new MutationObserver(f).observe(document.head,{childList:true,subtree:true,attributes:true,attributeFilter:["content"]})}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_SEM_ZOOM_IOS }} />
        {children}
      </body>
    </html>
  );
}
