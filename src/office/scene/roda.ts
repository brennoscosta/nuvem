// A roda do mouse tem que dar zoom em qualquer lugar da tela: em cima da barra de cima, dos botões, dos crachás dos
// bonecos, dos balões dos lotes e dos cartões. Esses elementos ficam por cima do canvas e engolem o evento, então o
// zoom parecia "travado" (ex.: logo depois de clicar em "Ver por fora", com o mouse ainda no botão). Aqui escutamos a
// roda na janela e repassamos pro canvas (onde os controles de câmera escutam), menos quando o mouse está sobre algo
// que rola de verdade (lista, texto longo) — aí a rolagem normal vale.
import { useEffect } from "react";

function rolavel(el: Element | null): boolean {
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    const h = e as HTMLElement;
    if (h.scrollHeight > h.clientHeight + 1) {
      const ov = getComputedStyle(h).overflowY;
      if (ov === "auto" || ov === "scroll") return true;
    }
  }
  return false;
}

export function useRodaNoCanvas() {
  useEffect(() => {
    const ouvir = (e: WheelEvent) => {
      const alvo = e.target as Element | null;
      if (!alvo || alvo.tagName === "CANVAS" || rolavel(alvo)) return;
      const canvas = document.querySelector<HTMLCanvasElement>("canvas");
      if (!canvas) return;
      e.preventDefault();
      canvas.dispatchEvent(new WheelEvent("wheel", { deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ, deltaMode: e.deltaMode, clientX: e.clientX, clientY: e.clientY, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, bubbles: true, cancelable: true })); // bubbles: os controles escutam no pai do canvas
    };
    window.addEventListener("wheel", ouvir, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", ouvir, { capture: true } as EventListenerOptions);
  }, []);
}
