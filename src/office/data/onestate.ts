// 24/11/2026: a Social RP saiu da cidade (data/sedes.ts); ficam aqui só as medidas da torre que o código das sedes usa.
// Sede da Social RP (antes OneState RP; o nome mudou em 16/11/2026) na cidade (16/11/2026, pedido do dono: "coloque um prédio desse para o OneState, com logo e todas
// as áreas do site"). Ocupa o quarteirão 1,1 (sudeste) inteiro, como a Nuvem e a lanchonete: o último na ordem da planta,
// então nenhum lote mudou de número. Térreo = saguão; do 1º andar para cima, cada sala é uma área do site, com o nome
// iluminado na fachada (a divisão por andar e por face fica em data/sedes.ts › areasDoAndarDe). Tocar no prédio abre o
// cartão com todas as áreas (src/office/ui/CartaoOneState.tsx), cada uma levando à página no onestatebr.com.br.
// Torre. 18/11/2026, pedido do dono ("os prédios podem ser menores ainda"): antes 22 x 16 m com andares de 4 m; depois
// 19 x 14 m com pé-direito de 3,4 m, no quarteirão inteiro. 19/11/2026 (pedido do dono: cada sede num lote só): 16 m de
// frente por 13 m de fundo, em coordenadas do LOTE de 20 x 20 m: origem no centro do lote e a frente, com a porta da rua,
// para +z. Cada sede leva este desenho para o seu lote, virado para a rua da frente (data/sedes.ts › paraMundoSede).
// A fachada da frente fica a 5,2 m da divisa (pórtico ou marquise, o jardim e a calçada até a porta); o fundo a 1,8 m.
// O interior (data/plantaSede.ts) usa a mesma fachada da frente. `andares` é só o padrão antigo; cada sede tem o seu
// número de andares (data/sedes.ts).
export const Z_FRENTE_SEDE = 4.8; // z local da fachada da frente (a da porta)
export const SEDE = { x: 0, z: Z_FRENTE_SEDE - 13 / 2, w: 16, d: 13, andar: 3.4, andares: 4 };

export interface AreaOneState { id: string; nome: string; href: string; cor: string }
