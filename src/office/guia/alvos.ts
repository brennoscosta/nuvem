// Guia passo a passo: como achar os alvos na tela. Vale sempre o primeiro elemento VISÍVEL (o mesmo botão costuma
// existir duas vezes, uma para o computador e outra para o celular, com uma delas escondida).
import type { Alvo } from "./tipos";

export function visivel(el: Element | null | undefined): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement || el instanceof SVGElement)) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const cs = getComputedStyle(el);
  if (cs.visibility === "hidden" || cs.display === "none") return false;
  // transparente só porque a animação de entrada ainda não começou (cena 3D pesada atrasa o primeiro quadro): já conta
  return Number(cs.opacity) > 0.05 || el.getAnimations().some((a) => a.playState !== "finished");
}
export function primeiro(seletor: string, raiz: ParentNode = document): HTMLElement | null {
  for (const el of Array.from(raiz.querySelectorAll<HTMLElement>(seletor))) if (visivel(el)) return el;
  return null;
}
// o primeiro visível cujo texto bate (ex.: o botão "Entrar no prédio" dentro do cartão)
export function porTexto(seletor: string, re: RegExp, raiz: ParentNode = document): HTMLElement | null {
  for (const el of Array.from(raiz.querySelectorAll<HTMLElement>(seletor))) if (re.test((el.textContent ?? "").replace(/\s+/g, " ").trim()) && visivel(el)) return el;
  return null;
}
// o cartão (ou seção) de um título: h2/h3 com aquele texto e o bloco que o contém
export function cartaoDoTitulo(re: RegExp, blocos = ".pg-cartao, .rounded-2xl, section"): HTMLElement | null {
  const t = porTexto("h2, h3", re);
  const c = t?.closest<HTMLElement>(blocos) ?? null;
  return visivel(c) ? c : null;
}
// link da barra de cima; em telas menores os links moram no menu e o alvo vira o botão do menu
export const linkDaBarra = (href: string) => primeiro(`.cab-nav a[href="${href}"]`);
export const menuDaBarra = () => primeiro(".cab-hamburguer");

export function resolverAlvo(a: Alvo): HTMLElement | null {
  if (typeof a === "string") return primeiro(a);
  const el = a();
  return visivel(el) ? (el as HTMLElement) : null;
}
