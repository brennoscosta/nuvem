"use client";
// Cartão do lote (o que tem ali, status, "Quero esse chão") e o painel "Montar minha empresa" (nome, logo, cor),
// que reflete ao vivo na placa e no tapume do lote. Reservar precisa da conta do WorkEnd.
import { useRef, useState } from "react";
import { useMundo, LOTE_POR_CHAVE, descricaoLote, linkCadastro, modoMundo, CORES_EMPRESA } from "../mundoStore";
import { useEscritorio } from "../store";

export function CartaoLote() {
  const chave = useMundo((s) => s.loteSelecionado);
  const terreno = useMundo((s) => (chave ? s.terrenos[chave] : undefined));
  const meu = useMundo((s) => s.meu);
  const usuario = useMundo((s) => s.usuario);
  const painel = useMundo((s) => s.painelEmpresa);
  const selecionarLote = useMundo((s) => s.selecionarLote);
  const abrirPainel = useMundo((s) => s.abrirPainel);
  const desistir = useMundo((s) => s.desistir);
  const agenteSelecionado = useEscritorio((s) => s.selecionado);
  const [confirma, setConfirma] = useState<string | null>(null); // lote cujo "Desistir" está aguardando confirmação
  if (!chave || painel || agenteSelecionado) return null;
  const confirmaDesistir = confirma === chave;
  const l = LOTE_POR_CHAVE[chave]; if (!l) return null;
  const ehMeu = meu === chave;
  const livre = !terreno;
  return (
    <div className="absolute right-3 top-20 z-10 w-80 rounded-2xl bg-white/97 p-4 text-[#1D2128] shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#1D4ED8]">WorkEnd · Lote {l.numero}</div>
          <div className="text-lg font-bold">{livre ? "À venda" : ehMeu ? "Seu chão" : terreno.empresaNome}</div>
          <div className="text-xs text-[#5B6472]">20 × 20 m · {descricaoLote(l)}</div>
        </div>
        <button onClick={() => selecionarLote(null)} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5">✕</button>
      </div>

      {livre && (
        <>
          <div className="mt-3 rounded-2xl bg-[#F1F3F6] px-3 py-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-[#5B6472]">Preço</span><span className="font-semibold">em breve</span></div>
            <div className="mt-1 text-xs text-[#5B6472]">Quem reservar agora entra primeiro, com condição de fundador. Sem cobrança nesta fase.</div>
          </div>
          {usuario ? (
            <button onClick={abrirPainel} className="mt-3 w-full rounded-xl bg-[#1D4ED8] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#1a44c2]">{meu ? "Trocar meu chão por este" : "Quero esse chão"}</button>
          ) : (
            <a href={linkCadastro(chave)} className="mt-3 block w-full rounded-xl bg-[#1D4ED8] px-3 py-2.5 text-center text-sm font-bold text-white hover:bg-[#1a44c2]">Quero esse chão</a>
          )}
          {!usuario && <div className="mt-2 text-center text-[11px] text-[#5B6472]">Você cria sua conta no WorkEnd e volta direto pra este lote.{!modoMundo() && " Abre em workend.online."}</div>}
          {usuario && meu && <div className="mt-2 text-center text-[11px] text-[#5B6472]">Nesta fase cada conta tem um chão; o seu atual (Lote {LOTE_POR_CHAVE[meu]?.numero}) fica livre.</div>}
        </>
      )}

      {!livre && (
        <>
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#F1F3F6] px-3 py-2">
            {terreno.temLogo ? <img src={`/api/terrenos/${encodeURIComponent(chave)}/logo`} alt="" className="h-10 w-10 rounded-lg bg-white object-contain" /> : <span className="h-10 w-10 rounded-lg" style={{ background: terreno.cor }} />}
            <div className="text-sm"><div className="font-semibold">{terreno.empresaNome}</div><div className="text-xs text-[#5B6472]">{terreno.status === "ativo" ? "Empresa ativa" : "Reservado · escritório em obras"}</div></div>
          </div>
          {ehMeu ? (
            <div className="mt-3 flex gap-2">
              <button onClick={abrirPainel} className="flex-1 rounded-xl bg-[#1D4ED8] px-3 py-2 text-sm font-bold text-white">Editar placa</button>
              {confirmaDesistir
                ? <button onClick={() => { desistir(); setConfirma(null); }} className="rounded-xl bg-[#E2575B] px-3 py-2 text-sm font-bold text-white">Confirmar</button>
                : <button onClick={() => setConfirma(chave)} className="rounded-xl bg-[#F1F3F6] px-3 py-2 text-sm font-semibold text-[#5B6472]">Desistir</button>}
            </div>
          ) : (
            <div className="mt-3 text-xs text-[#5B6472]">Este chão já tem dono. Clique num lote com placa “À venda” pra escolher o seu.</div>
          )}
        </>
      )}
    </div>
  );
}

// Reduz a imagem pra 256 px (PNG) antes de enviar: logo pequeno, placa nítida
async function prepararLogo(f: File): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const c = document.createElement("canvas"); const S = 256; c.width = S; c.height = S;
    const g = c.getContext("2d")!; const r = Math.min(S / img.width, S / img.height), w = img.width * r, h = img.height * r;
    g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
    return c.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
}

export function PainelEmpresa() {
  const aberto = useMundo((s) => s.painelEmpresa);
  const chave = useMundo((s) => s.loteSelecionado);
  const rascunho = useMundo((s) => s.rascunho);
  const setRascunho = useMundo((s) => s.setRascunho);
  const fechar = useMundo((s) => s.fecharPainel);
  const reservar = useMundo((s) => s.reservar);
  const meu = useMundo((s) => s.meu);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);
  if (!aberto || !chave || !rascunho) return null;
  const l = LOTE_POR_CHAVE[chave];
  const editando = meu === chave;
  const enviar = async () => { setEnviando(true); setErro(null); const e = await reservar(); setEnviando(false); if (e) setErro(e); };
  return (
    <div className="absolute right-3 top-20 z-20 w-[22rem] rounded-2xl bg-white/97 p-4 text-[#1D2128] shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#1D4ED8]">Lote {l?.numero} · {editando ? "sua placa" : "montar minha empresa"}</div>
          <div className="text-lg font-bold">{editando ? "Editar a placa" : "Como vai se chamar?"}</div>
          <div className="text-xs text-[#5B6472]">Olhe o lote no mapa: a placa e o tapume mudam enquanto você preenche.</div>
        </div>
        <button onClick={fechar} className="rounded-full px-2 text-[#5B6472] hover:bg-black/5">✕</button>
      </div>

      <label className="mt-3 block text-xs font-semibold text-[#5B6472]">Nome da empresa
        <input autoFocus value={rascunho.empresaNome} onChange={(e) => setRascunho({ empresaNome: e.target.value.slice(0, 60) })} placeholder="Ex.: Padaria do Zé" className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm font-normal text-[#1D2128] outline-none focus:border-[#1D4ED8]" />
      </label>

      <div className="mt-3 text-xs font-semibold text-[#5B6472]">Cor da marca</div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {CORES_EMPRESA.map((c) => <button key={c} onClick={() => setRascunho({ cor: c })} className={`h-7 w-7 rounded-full border-2 ${rascunho.cor === c ? "border-[#1D2128]" : "border-transparent"}`} style={{ background: c }} aria-label={c} />)}
        <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border border-black/10 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title="Outra cor">
          <input type="color" value={rascunho.cor} onChange={(e) => setRascunho({ cor: e.target.value.toUpperCase() })} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>

      <div className="mt-3 text-xs font-semibold text-[#5B6472]">Logomarca (opcional)</div>
      <div className="mt-1 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-[#F1F3F6]">
          {rascunho.logoDataUrl ? <img src={rascunho.logoDataUrl} alt="" className="h-full w-full object-contain" /> : <span className="text-[10px] text-[#5B6472]">sem logo</span>}
        </div>
        <div className="flex flex-col gap-1">
          <button onClick={() => arquivo.current?.click()} className="rounded-xl bg-[#F1F3F6] px-3 py-1.5 text-xs font-semibold text-[#1D4ED8]">{rascunho.logoDataUrl ? "Trocar imagem" : "Enviar imagem"}</button>
          {rascunho.logoDataUrl && <button onClick={() => setRascunho({ logoDataUrl: null })} className="text-left text-[11px] text-[#5B6472]">Remover</button>}
          <input ref={arquivo} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setRascunho({ logoDataUrl: await prepararLogo(f) }); } catch { setErro("Não consegui ler essa imagem."); } e.target.value = ""; }} />
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-[#F1F3F6] px-3 py-2 text-xs text-[#5B6472]">Reservar não cobra nada agora. Quando a compra abrir, você decide se confirma; até lá o lote fica no seu nome.</div>
      {erro && <div className="mt-2 text-xs font-semibold text-[#E2575B]">{erro}</div>}
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={fechar} className="rounded-xl px-4 py-2 text-sm text-[#5B6472]">Cancelar</button>
        <button onClick={enviar} disabled={enviando || rascunho.empresaNome.trim().length < 2} className="rounded-xl bg-[#1D4ED8] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{enviando ? "Salvando…" : editando ? "Salvar placa" : "Reservar este chão"}</button>
      </div>
    </div>
  );
}

// Na barra do topo, quando estamos no mapa do WorkEnd: quem está logado (ou o botão de entrar)
export function ContaWorkend() {
  const usuario = useMundo((s) => s.usuario);
  const meu = useMundo((s) => s.meu);
  const sair = useMundo((s) => s.sairWorkend);
  const selecionarLote = useMundo((s) => s.selecionarLote);
  if (!modoMundo()) return null;
  if (!usuario) return <a href="/entrar" className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">Entrar</a>;
  return (
    <div className="flex items-center gap-1.5">
      {meu && <button onClick={() => selecionarLote(meu)} className="rounded-full bg-[#1D4ED8] px-3 py-1.5 text-xs font-bold text-white">Meu chão · Lote {LOTE_POR_CHAVE[meu]?.numero}</button>}
      <a href="/app" className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80" title={usuario.email}>{usuario.nome.split(" ")[0]}</a>
      <button onClick={sair} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/60">Sair</button>
    </div>
  );
}
