// Lembrete do perfil no painel Meu escritório (20/11/2026, frente "cadastro"): quem pulou ou não terminou o formulário do
// cadastro vê o que falta e volta direto na etapa; quem terminou vê o endereço do perfil público e o atalho para quem combina.
import Link from "next/link";
import { resumoPerfil } from "@/server/perfis";
import { Icone } from "@/office/ui/Icone";
import "./perfil/perfil.css";

export async function LembretePerfil({ usuarioId }: { usuarioId: string }) {
  const r = await resumoPerfil(usuarioId).catch(() => null);
  if (!r) return null;
  if (r.completo) {
    return (
      <div className="cd-lembrete-curto" data-teste="perfil-completo">
        <Icone nome="perfil" tamanho={18} />
        {r.publico && r.apelido
          ? <span className="cd-end">Seu perfil público: <Link href={`/perfil/${r.apelido}`}>workend.online/perfil/{r.apelido}</Link></span>
          : <span><b>Seu perfil está fechado.</b> Só você vê.</span>}
        <Link href="/app/perfil">Editar</Link>
        <Link href="/encontrar?tipo=perfis">Quem combina com você</Link>
      </div>
    );
  }
  const feitas = r.respondidas.length;
  const primeira = r.faltam[0]?.id;
  return (
    <section className="cd-lembrete" aria-label="Seu perfil" data-teste="perfil-falta">
      <div className="min-w-0">
        <h2>{feitas === 0 ? "Conte ao WorkEnd o que você faz" : `Seu perfil: faltam ${r.faltam.length} de ${r.total} partes`}</h2>
        <p>{feitas === 0
          ? "Leva uns 2 minutos: o que você oferece, o que procura e onde atende. Assim quem procura chega até você."
          : "Com o perfil completo, você aparece para quem procura o que você oferece."}</p>
        <div className="cd-lembrete-trilho" aria-hidden="true"><i style={{ width: `${Math.max(4, (feitas / r.total) * 100)}%` }} /></div>
        <div className="cd-lembrete-faltam">
          {r.faltam.map((f) => <Link key={f.id} href={`/app/perfil/comecar?etapa=${f.id}`}>{f.curto}</Link>)}
        </div>
      </div>
      <div className="cd-lembrete-acoes">
        <Link href={`/app/perfil/comecar${primeira ? `?etapa=${primeira}` : ""}`} className="btn btn-azul">{feitas === 0 ? "Montar meu perfil" : "Continuar de onde parei"}</Link>
        <Link href="/app/perfil" className="btn btn-linha">Ver tudo</Link>
      </div>
    </section>
  );
}
