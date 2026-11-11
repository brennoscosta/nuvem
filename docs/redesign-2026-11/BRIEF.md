# WorkEnd — brief de handoff

Pacote para continuar o redesign de `workend.online`. Contém a marca nova, a landing
page reestruturada e as regras que mantêm as duas coerentes.

```
index.html                       página completa, sem dependência de build
tokens.css                       as variáveis de cor e fonte
assets/workend-logotipo.svg      logotipo em contornos (não depende da fonte)
assets/workend-logotipo-branco.svg
assets/workend-favicon.svg       o W, para aba e ícone de app
```

Abrir `index.html` direto no navegador já funciona. Não há build, framework nem
dependência além do Inter vindo do Google Fonts.

---

## 1. A marca

O logotipo é **WorkEnd** com `Work` em Archivo 400 e `End` em Archivo 700,
espacejamento `-0.03em`, tudo em `--ink`. Não existe símbolo, e não deve ser criado um.

A razão do peso: o nome solto soa como *weekend* e pode ser lido como "fim do
trabalho", o oposto do produto. Com `End` destacado, o nome passa a ler **End-ereço** —
que é exatamente o posicionamento já escrito no `<title>` do site atual
("o mapa 3D onde a sua empresa tem endereço").

Os SVGs estão em contornos, não em texto. Isso significa que o logotipo renderiza igual
em qualquer máquina, sem carregar Archivo. **Não substituir por `<text>` nem por um
`<span>` com font-family.** No HTML o SVG está embutido e o `path` herda a cor via
`.logo path{fill:var(--ink)}`, então ele acompanha tema claro e escuro sozinho.

Regras de uso:

- Área de respiro em volta: metade da altura das letras maiúsculas, em todos os lados.
- Altura mínima: 18px. Abaixo disso usar o favicon.
- Nunca girar, inclinar, esticar, aplicar sombra ou contorno.
- Nunca colorir só uma das duas palavras. O contraste é de peso, não de cor.
- Sobre fundo escuro usar `workend-logotipo-branco.svg`.

## 2. Cor

Todos os valores em `tokens.css`, lidos do site em produção em 11/11/2026.
`--blue: #0A6CFF` é a cor da marca e de toda ação. Não introduzir uma segunda cor de
destaque: a página inteira funciona com azul, tinta e os cinzas.

Contrastes já verificados — manter se mexer:

| Par | Razão | Serve para |
|---|---|---|
| `--ink` sobre `--bg` | 12,7:1 | texto corrido |
| `--muted` sobre `--bg` | 4,7:1 | texto secundário |
| branco sobre `--blue` | 4,6:1 | botões |
| `--blue` sobre `--bg` | 3,6:1 | **só** título grande e botão. Nunca texto pequeno |
| `--blue-lit` sobre `--night` | 6,3:1 | azul dentro do visor escuro |

## 3. Tipografia

Inter continua sendo a fonte de interface, como já é hoje. Archivo aparece
exclusivamente no logotipo, e já está vetorizada — não precisa ser carregada.

Escala: título 40–78px, seção 30–46px, apoio 17–21px, corpo 17px, miúdo 14–15px.
Entrelinha 1.02 nos títulos e 1.6 no corpo. Tracking negativo só acima de 30px.
Largura máxima de leitura: 62 caracteres.

## 4. O 3D — a regra principal

**O mundo é 3D, a interface é plana, e as duas nunca se misturam.** É o que The Sims
resolveu: a cena tridimensional vive dentro de um visor delimitado e tudo em volta é
chapado e silencioso. O erro da página atual é 3D solto, girado e recortado no meio do
conteúdo.

Na prática:

- Toda cena 3D fica dentro de `.viewport` ou `.cut`, com fundo `--night` e cantos de 14px.
- Uma única direção de luz e um único horário para a biblioteca inteira. A escolha aqui é
  fim de tarde, com as janelas acesas em `--blue-lit`. Os renders atuais do site estão em
  luz de dia, saturados e incompatíveis entre si — precisam ser refeitos ou corrigidos
  em grade de cor antes de entrar.
- Nenhuma imagem 3D girada, inclinada ou recortada fora de um visor.
- Proporções a respeitar: hero **12:5**, miniaturas de prédio **260:180**.

### Onde entram as imagens de vocês

Os SVGs no HTML são **marcação de enquadramento, não arte final**. Cada um está num
elemento com `data-asset`:

| Slot | O que entra |
|---|---|
| `data-asset="hero-3d"` | o prédio principal ao entardecer, 12:5 |
| `data-asset="dollhouse"` | o corte com a parede da frente removida e as salas |
| `data-asset="predio-0"` a `predio-5"` | os seis tipos de prédio, mesmo ângulo e mesma luz |

Trocar o `<svg>` interno por `<img>` ou `<video>` preservando a proporção e o
`border-radius` do contêiner.

**Crítico:** a placa `.sign` sobre o hero é HTML posicionado por cima do visor, não parte
da imagem. Ela precisa continuar assim — é o que faz o nome digitado aparecer aceso na
fachada em tempo real. Se a placa for embutida no render, a interação morre.

## 5. Transições

A página tem **um** momento de movimento, e é proposital: a barra do letreiro acende
quando o campo recebe texto (`.is-lit .sign-bar`). É a única animação que ganha atenção
porque é a única que existe.

Pode entrar:

- estado de hover e foco nos cards de prédio e nos botões
- abrir e fechar do `<details>` no FAQ
- transição suave ao trocar o prédio selecionado

Não entrar:

- fade-and-slide-up em cada seção ao rolar — é o tique mais reconhecível de página
  gerada, e some com a hierarquia
- parallax, carrossel automático, contador animado nos números
- qualquer animação que dispare sozinha fora da primeira dobra

`@media (prefers-reduced-motion:reduce)` já está no CSS e desliga tudo. Manter.

Se entrar 3D real (WebGL, Spline, vídeo): carregar sob demanda, comprimir e medir o LCP.
3D pesado na primeira dobra derruba conversão mais do que a cena bonita recupera — a
meta é LCP abaixo de 2,5 segundos.

## 6. Por que a página encolheu

O site atual tem 13 seções e quatro títulos contando a mesma coisa. Aqui são sete:

hero · salas · prédios · cidade · preço · dúvidas · fechamento

O que mudou e por quê:

- **Prédios e simulador viraram um bloco.** Escolher o prédio e acender o letreiro são a
  mesma ação; separar em duas seções obrigava a contar a história duas vezes.
- **A seção de IA virou uma caixa ao lado do preço.** Uma seção inteira para 39
  especialistas que "chegam em breve", com os cards repetidos, cobrava confiança
  adiantada antes de a pessoa ver o preço.
- **A contagem de lotes saiu da primeira dobra.** "27 de 28 lotes livres agora" comunica
  *a cidade está vazia*. Agora ela aparece na seção do mapa, onde responde a outra
  pergunta: "ainda dá para escolher onde?".
- **O preço subiu para o hero.** A pessoa decide com o número na mão.

## 7. Bug a corrigir no site atual

O `<h1>` de hoje sai da página como `Abraasportasda sua empresa`. As palavras estão em
`<span>` separados para receber cor e não há espaço entre eles — leitor de tela e
indexador leem uma palavra só. Colocar espaço real dentro do span, ou quebrar por linha
em vez de por palavra.

## 8. Pendências

Tudo em `[COLCHETES]` no código precisa de conteúdo real de vocês:

- descrição de cinco dos seis prédios (só a do Cubo de vidro está escrita)
- resposta do FAQ sobre não renovar
- os 13 setores reais — o corte dollhouse usa seis nomes genéricos de exemplo
- **depoimentos: não há nenhum e nenhum foi inventado.** Quando existirem, o lugar é
  entre a seção da cidade e o preço
- confirmar se o plano de R$ 5,90 mantém o preço riscado de R$ 19,90. Foi removido aqui:
  desconto riscado em cima de um valor tão baixo lê como ruído, não como oferta
