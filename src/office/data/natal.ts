// Época de Natal do WorkEnd (arquivo compartilhado: cena 3D, cabeçalho do site e servidor). Só datas, sem React.
// 12/11/2026: de 1º/12 a 6/1. 20/11/2026 (pedido do dono: "adicione a temática de Natal também"): começa em 20/11 e vai
// até 6/1 (Dia de Reis), todo ano, pelo horário de Brasília. ?natal=1 liga e ?natal=0 desliga (prévias e fotos).
export function epocaDeNatal(agora = new Date()): boolean {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", month: "numeric", day: "numeric" }).formatToParts(agora);
  const mes = Number(p.find((x) => x.type === "month")?.value), dia = Number(p.find((x) => x.type === "day")?.value);
  return mes === 12 || (mes === 1 && dia <= 6) || (mes === 11 && dia >= 20);
}

// Script do <head> do site (app/workend/layout.tsx): põe a classe "we-natal" no <html> antes de pintar, para o sininho do
// logotipo aparecer sem piscar. Brasília é UTC-3 o ano todo (sem horário de verão desde 2019).
export const SCRIPT_NATAL = `(function(){try{var q=location.search.match(/[?&]natal=([01])/),on;if(q)on=q[1]==="1";else{var d=new Date(Date.now()-108e5),m=d.getUTCMonth()+1,dd=d.getUTCDate();on=m===12||(m===1&&dd<=6)||(m===11&&dd>=20)}if(on)document.documentElement.classList.add("we-natal")}catch(e){}})();`;

// no navegador: ?natal=1 liga, ?natal=0 desliga; sem parâmetro, a época
export function natalNoNavegador(): boolean {
  const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("natal") : null;
  return q === "1" ? true : q === "0" ? false : epocaDeNatal();
}
