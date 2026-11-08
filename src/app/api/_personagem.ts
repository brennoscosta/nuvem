// Guarda das rotas da rede: precisa estar logado e com personagem ativo (pago ou admin)
import { usuarioAtual, type Usuario } from "@/server/usuarios";
import { meuPersonagem, personagemAtivo } from "@/server/personagens";
export class ErroHttp extends Error { constructor(msg: string, public status: number) { super(msg); } }
export async function exigirPersonagem(): Promise<Usuario> {
  const u = await usuarioAtual(); if (!u) throw new ErroHttp("Entre na sua conta.", 401);
  if (!personagemAtivo(await meuPersonagem(u.id), u)) throw new ErroHttp("Ative seu personagem pra interagir com as pessoas.", 402);
  return u;
}
export const statusDe = (e: unknown) => (e instanceof ErroHttp ? e.status : 500);
