// Insígnias do passaporte da cidade no perfil público (20/11/2026, frente "visitante"): quantos lugares a pessoa carimbou
// e os vistos que ganhou (Turista da cidade, Viajante, Desbravador, Caçador de presentes). Sem nada, não aparece.
import { insigniasDe } from "@/server/passaporte";

export async function InsigniasCidade({ usuarioId }: { usuarioId: string }) {
  const r = await insigniasDe(usuarioId).catch(() => null);
  if (!r || (!r.carimbos && !r.insignias.length)) return null;
  return (
    <section className="pg-cartao cd-pub-bloco" data-guia="perfil-insignias">
      <h2 className="cd-pub-h3">Passaporte da cidade</h2>
      <p className="cd-pub-texto">{r.carimbos} {r.carimbos === 1 ? "lugar carimbado" : "lugares carimbados"} na cidade do WorkEnd</p>
      {r.insignias.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-3">
          {r.insignias.map((i) => (
            <li key={i.id} title={i.frase} className="flex w-[84px] flex-col items-center text-center">
              <svg viewBox="0 0 60 60" width="52" height="52" aria-hidden="true">
                <circle cx="30" cy="30" r="27" fill={i.cor} />
                <circle cx="30" cy="30" r="22" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1.2" strokeDasharray="2 2" />
                <path d="M30 15l4.2 8.6 9.4 1.4-6.8 6.6 1.6 9.4L30 36.6l-8.4 4.4 1.6-9.4-6.8-6.6 9.4-1.4z" fill="#fff" />
              </svg>
              <b className="mt-1 text-[12px] leading-tight">{i.nome}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
