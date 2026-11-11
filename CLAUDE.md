# WorkEnd (workend.online) — regras de design

Desde 11/11/2026 o site segue o redesign do designer. Antes de mexer no visual do WorkEnd, leia
`docs/redesign-2026-11/BRIEF.md` inteiro (marca, cores, tipografia, 3D, movimento) — as regras dele valem
acima de preferência pessoal. Resumo do que mais quebra:

- Logotipo: só o SVG em contornos (`src/app/workend/_marca.tsx`, `public/workend/marca/`). Nunca em texto,
  nunca com símbolo ao lado, cor via `.logo path{fill:var(--ink)}`; altura mínima 18px.
- Cores: tokens em `src/app/workend/workend.css` (escopo `.we`). `--blue` é a única cor de destaque e nunca
  vai em texto pequeno. Os nomes antigos (`--tinta`, `--azul`, …) só apontam para os novos.
- 3D só dentro de `.viewport`/`.cut` com fundo `--night`, luz de fim de tarde, nada girado ou solto.
  A placa `.sign` do hero é HTML por cima do render, nunca parte da imagem.
- Movimento: só a barra do letreiro acendendo, hover/foco, `<details>` e a troca de prédio. Nada de
  animação ao rolar, parallax, carrossel automático ou contador animado.
- Sem depoimentos, avaliações, logos de clientes ou números de prova social inventados.
