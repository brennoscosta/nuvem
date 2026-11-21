"use client";
// Excluir minha conta (21/11/2026, LGPD art. 18): seção discreta no fim de Meu perfil. Fechada, é só o título e um botão.
// Aberta, busca no servidor o que a pessoa perde (lote e dias pagos, créditos, unidades de IA, agentes, modelos de prédio
// e itens), diz o que é apagado e o que fica guardado sem identificar e pede a confirmação: a senha ou, para a conta só
// do Google, a palavra EXCLUIR. O botão final é vermelho e diz o que acontece. Regras em src/server/exclusao.ts.
import { useId, useState } from "react";
import type { ResumoExclusao } from "@/server/exclusao";

const PALAVRA = "EXCLUIR";
const num = (n: number) => n.toLocaleString("pt-BR");
const creditos = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

function Perdas({ r }: { r: ResumoExclusao }) {
  const linhas: React.ReactNode[] = [];
  for (const l of r.lotes) linhas.push(
    <li key={`l-${l.rotulo}`}><b>{l.rotulo}{l.nome ? ` · ${l.nome}` : ""}</b>: {l.rotulo.startsWith("Ampliação") ? "sai junto com o lote principal e volta a ficar à venda." : "a loja fecha, sai do mapa e o lote volta a ficar à venda."}
      {l.ativo && l.dias > 0 ? ` Ainda faltam ${plural(l.dias, "dia pago", "dias pagos")} (até ${l.ate}).` : !l.ativo ? " A reserva é cancelada." : ""}</li>,
  );
  if (r.socios) linhas.push(<li key="socios">{r.socios === 1 ? "A pessoa sócia da sua loja perde o acesso a ela." : `As ${num(r.socios)} pessoas sócias da sua loja perdem o acesso a ela.`}</li>);
  for (const s of r.sociedades) linhas.push(<li key={`s-${s}`}>Você sai da sociedade da <b>{s}</b>. A loja continua com quem é titular dela.</li>);
  const saldo = r.creditos.comprado + r.creditos.bonus;
  if (saldo > 0) linhas.push(<li key="cred"><b>{creditos(saldo)} créditos</b> na carteira{r.creditos.comprado > 0 && r.creditos.bonus > 0 ? ` (${creditos(r.creditos.comprado)} comprados e ${creditos(r.creditos.bonus)} de bônus)` : r.creditos.bonus > 0 ? " de bônus" : ""}.</li>);
  if (r.unidades > 0) linhas.push(<li key="ia"><b>{plural(r.unidades, "unidade", "unidades")} de IA</b> da sua empresa.</li>);
  if (r.agentes.length) linhas.push(<li key="ag">{r.agentes.length === 1 ? "O agente contratado" : `Os ${r.agentes.length} agentes contratados`}: {r.agentes.join(", ")}.</li>);
  if (r.modelos.length) linhas.push(<li key="mod">{r.modelos.length === 1 ? "O modelo de prédio comprado" : "Os modelos de prédio comprados"}: {r.modelos.join(", ")}.</li>);
  if (r.itens > 0) linhas.push(<li key="it">{r.itens === 1 ? "O item do personagem que está na sua conta." : `Os ${num(r.itens)} itens do personagem que estão na sua conta.`}</li>);
  for (const o of r.outros) linhas.push(<li key={`o-${o}`}>{o}.</li>);
  if (!linhas.length) return <p>Não há lote, saldo nem compras na sua conta.</p>;
  return <ul className="ex-lista">{linhas}</ul>;
}

export function ExcluirConta() {
  const [aberto, setAberto] = useState(false);
  const [r, setR] = useState<ResumoExclusao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [palavra, setPalavra] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const idCampo = useId();

  const abrir = async () => {
    setAberto(true); setErro(null); setCarregando(true);
    try {
      const x = await fetch("/api/workend/excluir-conta", { cache: "no-store" });
      const j = await x.json().catch(() => ({}));
      if (!x.ok) throw new Error((j as { erro?: string }).erro || "Não deu para conferir a sua conta agora. Tente de novo.");
      setR(j as ResumoExclusao);
    } catch (e) { setErro((e as Error).message); } finally { setCarregando(false); }
  };
  const fechar = () => { setAberto(false); setSenha(""); setPalavra(""); setErro(null); };
  const excluir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!r) return;
    setOcupado(true); setErro(null);
    try {
      const x = await fetch("/api/workend/excluir-conta", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(r.confirmar === "senha" ? { senha } : { palavra }) });
      const j = (await x.json().catch(() => ({}))) as { erro?: string; destino?: string };
      if (!x.ok) throw new Error(j.erro || "Não deu para excluir a conta agora. Tente de novo.");
      window.location.assign(j.destino || "/?conta=excluida");
    } catch (x) { setErro((x as Error).message); setOcupado(false); }
  };

  const pronto = !!r && !r.bloqueio && (r.confirmar === "senha" ? senha.length > 0 : palavra.trim() === PALAVRA);
  const lote = r?.lotes.find((l) => !l.rotulo.startsWith("Ampliação"));
  const libera = !r?.lotes.length ? "" : r.lotes.length === 1 && lote ? ` e liberar o ${lote.rotulo}` : " e liberar os lotes";
  return (
    <section className="pg-cartao ex-secao" id="excluir-conta" aria-labelledby="ex-titulo">
      <div className="ex-topo">
        <div className="min-w-0">
          <h2 id="ex-titulo">Excluir minha conta</h2>
          <p className="cd-sub">Apaga a sua conta e os seus dados pessoais do WorkEnd. Não dá para desfazer.</p>
        </div>
        {!aberto && <button type="button" className="btn btn-linha" onClick={abrir}>Quero excluir minha conta</button>}
      </div>
      {aberto && (
        <div className="ex-corpo">
          {carregando && <p className="cd-dica" role="status">Conferindo o que está na sua conta…</p>}
          {!r && erro && <p className="cd-erro-txt" role="alert">{erro}</p>}
          {r?.bloqueio && (
            <>
              <p className="ex-bloqueio" role="alert">{r.bloqueio}</p>
              <div className="ex-botoes"><button type="button" className="btn btn-linha" onClick={fechar}>Fechar</button></div>
            </>
          )}
          {r && !r.bloqueio && (
            <>
              <h3>O que você perde</h3>
              <Perdas r={r} />
              <p className="ex-nota">O que foi pago e ainda não foi usado é perdido. A exclusão não devolve dinheiro.</p>
              <h3>O que é apagado</h3>
              <p>A sua conta (nome, e-mail e senha), o personagem e o visual dele, o perfil público, as mensagens e conversas, o passaporte, os amigos, quem você segue e os seus avisos{r.lotes.length ? ". E a loja inteira: o prédio, a vitrine, os cupons, a agenda, os pedidos, a equipe de IA e as conversas dela, as conexões e as chaves de API" : ""}. O seu e-mail fica livre para uma conta nova.</p>
              <h3>O que fica guardado, sem identificar você</h3>
              <p>Os registros de pagamento (valor, data, forma de pagamento e o número no Mercado Pago) e os extratos de créditos e de unidades de IA, pelo prazo que a lei exige. Eles ficam sem o seu nome, o seu e-mail e a sua conta.</p>
              <form onSubmit={excluir} className="ex-confirma">
                {r.confirmar === "senha" ? (
                  <label className="cd-campo" htmlFor={idCampo}>
                    <span className="cd-rotulo">Para confirmar, digite a sua senha</span>
                    <input id={idCampo} name="senha" type="password" autoComplete="current-password" className="cd-entrada" value={senha} onChange={(e) => { setSenha(e.target.value); setErro(null); }} disabled={ocupado} />
                  </label>
                ) : (
                  <label className="cd-campo" htmlFor={idCampo}>
                    <span className="cd-rotulo">Você entra pelo Google. Para confirmar, digite {PALAVRA}</span>
                    <input id={idCampo} name="confirmacao" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} className="cd-entrada" value={palavra} onChange={(e) => { setPalavra(e.target.value); setErro(null); }} disabled={ocupado} />
                  </label>
                )}
                {erro && <p className="cd-erro-txt" role="alert">{erro}</p>}
                <div className="ex-botoes">
                  <button type="submit" className="btn ex-botao" disabled={!pronto || ocupado}>{ocupado ? "Excluindo a conta…" : `Excluir a conta, apagar meus dados${libera}`}</button>
                  <button type="button" className="btn btn-linha" onClick={fechar} disabled={ocupado}>Manter minha conta</button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </section>
  );
}
