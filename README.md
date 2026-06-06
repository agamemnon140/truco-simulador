# Simulador de Truco

### ▶ Jogar online (simulação de bots): **https://agamemnon140.github.io/truco-simulador/**

> Se a página abrir o README em vez do jogo, é cache do navegador — recarregue
> com **Ctrl+F5**.

Simulador do jogo de truco em TypeScript, com **motor de regras puro**
(reaproveitável por CLI hoje e por uma interface web no futuro) e uma CLI
jogável no terminal.

Variante inicial: **Truco Paulista** (duplas, até 12 pontos), com motor
configurável para trocar de variante e de formato.

## O que já faz

- Distribui as cartas (baralho de 40, embaralhamento com RNG injetável).
- Calcula a **manilha** a partir da vira e a força das cartas (incluindo a
  ordem de naipes ♦ < ♠ < ♥ < ♣ entre manilhas).
- Resolve o **vencedor de cada vaza**, tratando empates ("canga").
- Decide o vencedor da **mão** com as regras de empate do truco.
- **Truco e escalada**: pedir / aceitar / correr / aumentar (1 → 3 → 6 → 9 → 12).
- **Acumula a pontuação** por equipe e encerra a partida em 12 pontos.
- **Mão de onze** (regras adaptadas):
  - Uma equipe com 11: ninguém pode trucar; a mão vale **3**; a dupla de 11 vê
    as cartas dos dois parceiros e decide **jogar** (vale 3) ou **correr**
    (adversário leva 1) antes da 1ª carta.
  - Ambas com 11: mão jogada **fechada/às cegas** (os jogadores não veem as
    próprias cartas), vale 1, sem truco.
- Jogadores **humanos e/ou bots**, escolhidos antes da partida.
- **Bots com inteligência evoluída** (algoritmo genético): `inocente`
  (heurística), `melhorada_1/2/3`, a `melhorada_4` (**não-linear**, features em
  faixas) e a **`melhorada_5`** — fitness **ponderado por geração** (última
  domina) com **piso de 50%**: **ganha de todas**, inclusive da m4 (~52% em
  sementes novas).
- Formatos: duplas (2v2), mano a mano (1v1) e trios (3v3).

## Como rodar

```bash
npm install

npm start          # jogo interativo no terminal (escolha humanos/bots no início)
npm run demo       # demonstração automática: bots vs bots, sem digitar nada
npm run demo:verbose  # demo detalhada: cartas de cada um, jogadas e apostas
npm run demo:onze     # demonstra a mão de onze (11x9 e 11x11)
npm run demo:explica  # Melhorada x Inocente, mostrando o "porquê" de cada jogada
npm test           # bateria de testes (regras, vazas, apostas, mão de onze...)

# Bots evolutivos (algoritmo genético)
npm run train      # evolui melhorada_N vs inocente (escada/hall of fame)
npm run evaluate   # mede a força do genoma vs inocente em sementes novas
```

### Versão HTML (assistir bots no navegador)

Página estilo terminal (só texto) que roda uma simulação entre bots usando o
mesmo motor de regras. Tem controles de velocidade, semente e a opção de
começar 9×9 (para chegar logo na mão de onze).

**Para usar: abra o arquivo `index.html` na raiz do projeto** (duplo clique).
Ele é **autossuficiente** — o JavaScript está embutido, não depende de mais
nenhum arquivo nem de servidor. Clique em **“▶ Nova simulação”**.

Regerar a página (após mudar o motor):

```bash
npm run build:web   # gera o index.html (autossuficiente) e web/truco.bundle.js
```

> `web/index.html` + `web/truco.bundle.js` são a versão em dois arquivos (útil
> para servir via HTTP / GitHub Pages). O `index.html` da raiz é a versão de
> arquivo único para abrir direto.
```

> Observação: `npm start` precisa de um **terminal real**. Rodar com a entrada
> redirecionada (pipe) não funciona bem por causa de uma limitação do readline
> do Node com EOF. Para ver uma partida sem interação, use `npm run demo`.

## Estrutura

```
src/
  core/        # MOTOR PURO (sem I/O) — reutilizável por qualquer interface
    types.ts     # Card, Suit, Rank, Seat, TeamId
    deck.ts      # baralho de 40 e distribuição (RNG injetável)
    rules.ts     # RuleSet configurável (Paulista, 1v1, trios)
    ranking.ts   # manilha pela vira e força das cartas
    vaza.ts      # vencedor de uma vaza (+ empates)
    betting.ts   # máquina de estados do truco
    hand.ts      # condução de uma mão + regras de empate
    match.ts     # partida: equipes, placar, até 12
  players/
    player.ts        # interface Player (humano/bot/futura UI)
    bot.ts           # bot básico por heurística ("inocente")
    evolvedBot.ts    # bot com inteligência evoluída (usa um genoma)
    features.ts      # avaliação contextual (carta + contexto da partida)
    buckets.ts       # config das features em faixas (baixo/médio/alto)
    score.ts         # scorer: parte linear + contribuição de faixa; TV/granularidade
    genome.ts        # genoma: pesos/limiares + faixas + (de)serialização/migração
    explain.ts       # decompõe a decisão em contribuições (inclui faixas)
    personalities.ts # registro: inocente, melhorada_1..4
    humanCli.ts      # jogador humano via terminal
  training/
    arena.ts     # partidas em massa (sementes comuns + espelhamento); evaluateVsPool
    ga.ts        # algoritmo genético (seleção, crossover, mutação)
    train.ts     # evolui em escada (fitness = média vs pool)
    train-rr.ts  # round-robin: fitness = pior caso vs pool fixo (melhorada_3)
    train-rr4.ts # round-robin não-linear (faixas + parcimônia) (melhorada_4)
    train-rr5.ts # fitness ponderado por geração + piso de 50% (melhorada_5)
    evaluate.ts  # mede força (vs inocente, ou genoma vs genoma) em sementes novas
    rng.ts       # RNG determinístico do treino
  genomes/
    melhorada_1.json  # genomas treinados (versionados; usados no jogo)
    melhorada_2.json
    melhorada_3.json
    melhorada_4.json
    melhorada_5.json
  cli/
    setup.ts     # configuração pré-partida
    render.ts    # formatação para o terminal
    main.ts      # ponto de entrada interativo
    demo.ts      # partida automática (bots)
  web/
    browser-entry.ts  # simula uma partida e devolve o transcript (texto)
  index.ts       # exporta o core para reuso (ex.: web)
web/
  index.html         # página estilo terminal (assistir bots)
  truco.bundle.js    # bundle do motor para o navegador (gerado por build:web)
```

## Bots evolutivos (algoritmo genético)

A inteligência `melhorada_1` foi **aprendida por simulação**, não programada à
mão. Cada bot é parametrizado por um **genoma** (pesos + limiares) que pondera
features **contextuais**: a carta vence a mesa agora? o parceiro já está ganhando
a vaza (para "amarrar")? qual a probabilidade de vencer dadas as cartas não
vistas? em que vaza estamos, quantas cada dupla ganhou, quem lidera, qual o
placar? Esses pesos decidem **qual carta jogar** e **as apostas** (truco /
aceitar / correr), com um gene de **blefe**.

O algoritmo genético faz muitos bots jogarem contra o `inocente` (e, em degraus
seguintes, contra os campeões anteriores — *hall of fame*), selecionando os
melhores. Para medir habilidade e não sorte, cada candidato joga as **mesmas
sementes** (baralhos) e em **partidas espelhadas**.

```bash
# Escada (fitness = média vs o pool): gera melhorada_1 e melhorada_2
POP=60 GENS=40 GAMES=300 RUNGS=2 npm run train
# Round-robin (fitness = PIOR CASO vs pool fixo {inocente,m1,m2}): gera melhorada_3
POP=80 GENS=50 GAMES=150 npm run train:rr
# Round-robin NAO-LINEAR (faixas + parcimonia) vs {inocente,m1,m2,m3}: gera melhorada_4
POP=70 GENS=45 GAMES=120 LAMBDA=0.01 npm run train:rr4
# Fitness PONDERADO por geracao (ultima domina) + piso de 50% vs {inocente,m1..m4}: gera melhorada_5
POP=70 GENS=45 GAMES=100 WEIGHTS=1,1,2,4,16 LAMBDA_FLOOR=5 npm run train:rr5
# Avaliar em sementes novas (genoma vs inocente, ou genoma vs genoma)
GAMES=800 npm run evaluate src/genomes/melhorada_4.json
GAMES=800 npm run evaluate src/genomes/melhorada_4.json src/genomes/melhorada_3.json
```

Resultados (1600 partidas espelhadas, sementes novas):

| Confronto | Vitórias |
|---|---|
| melhorada_1 vs inocente | ~79% |
| melhorada_2 vs inocente | ~57% |
| melhorada_2 vs melhorada_1 | ~80% |
| **melhorada_3** vs inocente | **~69%** |
| **melhorada_3** vs melhorada_1 | **~68%** |
| **melhorada_3** vs melhorada_2 | **~85%** |
| **melhorada_4** vs inocente | **~70%** |
| **melhorada_4** vs melhorada_1 | **~64%** |
| **melhorada_4** vs melhorada_2 | **~91%** |
| **melhorada_4** vs melhorada_3 | **~63%** |

A `melhorada_2` exibiu **não-transitividade** (bate a m1 mas perde p/ inocente):
treinada com fitness = *média* contra um pool misto, especializou-se em vencer o
campeão anterior. A `melhorada_3` corrige isso com **fitness de pior caso**
(o *mínimo* das taxas contra cada membro do pool fixo) — assim ganha de todos.

A `melhorada_4` testa **não-linearidade** ao estilo GTO: cada variável vira
**faixas (baixo/médio/alto)** com **limiares evolutivos** e uma **penalidade de
parcimônia** (variação total) que deixa a *granularidade* emergir — o GA decide
quantas faixas cada variável usa. Resultado: a maioria usou 4 faixas (`pWin`,
`forcaRelativa`, `forcaMedia`, `difPlacar`, `valorEmJogo`), e `fracMaisFortes`
colapsou para 2 — e a m4 **supera a m3** (a não-linearidade agregou valor real).

A `melhorada_5` muda o **fitness**: média **ponderada por geração** (pesos
exponenciais `1,1,2,4,16` — a última domina) **menos** uma penalidade forte de
**piso de 50%** em cada confronto. Resultado: **ganha de todas as gerações**
(sementes novas: inocente 58%, m1 60%, m2 88%, m3 59%, **m4 52%**) sem regredir.
A margem sobre a m4 é **estreita (~52%)** — sinal de que a fronteira da
arquitetura linear/faixas está **saturando**.

A `melhorada_6` adiciona duas ideias: **comunicação mínima** entre parceiros (as
3 consultas do modo humano — `signal`/`canWin`/`trucoAdvice`, sinais
**verdadeiros** — usadas por **todas** as gerações evoluídas, via um protocolo
**fixo** no bot, **só quando a decisão está incerta**) e **features de intuição
GTO** (blefe polarizado). A m6 **ganha de todas** em sementes novas (pior caso
~55%, vs m4 ~62%, vs m5 ~66%). **Porém, a ablação é honesta**: o ganho vem de
**mais evolução** (outra passada round-robin pior-caso, agora vs `{inocente,
m1…m5}`), **não** das duas novidades — o protocolo de comunicação **fixo** chega
a **custar ~1–3pp** (ele perturba uma política já boa) e as features GTO são
**neutras** (~50% num duelo m6 × m6-sem-GTO). Lições: sinais **verdadeiros**
deveriam ajudar (é o teto **TMECor** do CFR), mas para extrair valor é preciso
**evoluir o uso do sinal** (limiar/pesos no genoma), não um ajuste fixo; e
intuição **GTO ≠ exploração** contra bots exploráveis. (`npm run train:rr6`,
avaliação `tsx src/training/evaluate-m6.ts`.)

A `melhorada_7` ataca o **pólo da exploração**: um **canal de observação** no
motor (`Player.observe`) alimenta um **modelo dos adversários** (com que
frequência cada time truca/corre/blefa, força das cartas), e essas estatísticas
viram **features evoluídas** de aposta. A m7 fica **marginalmente à frente / na
prática empatada com a m6** (pior caso ~52%, dentro do ruído). **A ablação é
honesta e clara: a inferência é NEUTRA** — m7-com-modelo × m7-sem-modelo = 50.0%,
e contra um bot que sempre corre o modelo só agrega +0.2pp (a política estática
já ganha ~87%). Motivos: **dados por partida são escassos** (poucas mãos até 12
pontos) e a política estática **já explora**; por isso o GA deixou os pesos de
oponente ~0. **Lição:** a saturação persiste — para a inferência pagar é preciso
**memória persistente entre partidas** (modelar um oponente fixo por muitas mãos)
e re-evoluir com esse sinal confiável. (`npm run train:rr7`, avaliação
`tsx src/training/evaluate-m7.ts`.)

## Equilíbrio (GTO) — resolver matematicamente (CFR)

Toda a linha m1…m5 é **best-response** (melhor resposta a um pool) — daí a
não-transitividade e a saturação. A alternativa é **calcular o equilíbrio**
(minimax/GTO), que é **inexplorável** e tem um alvo único: a **exploitability →
0**. O módulo `src/equilibrium/` resolve subjogos por **CFR** (counterfactual
regret minimization):

```bash
npm run solve   # valida o CFR vs a forma fechada do paper de von Neumann
                # e resolve o subjogo "última vaza 1v1" do truco (GTO)
```

- **Validação**: recupera o valor do modelo de von Neumann (`1/9`) e seus
  limiares (`a≈0.11`, `b≈0.78`), com exploitability ~`0.0001`.
- **Subjogo do truco**: a estratégia GTO é **polarizada** (como no pôquer): troca
  **com a pior carta (blefe) e com as melhores (valor)**, e dá *check* no meio; o
  adversário só paga/aumenta com cartas fortes (value-raise só com manilhas).
  Contraste interessante: nossos bots evoluídos blefam pouco e de forma
  **uniforme**, não polarizada — eles *exploram*, o GTO é *inexplorável*.

### Última vaza 2v2 — jogo de TIME (duplas coordenadas)

O 2v2 **não é** dois-jogadores soma-zero: é um **jogo de time**. A versão
tratável modela cada dupla como um **coordenador** (estratégia conjunta sabendo
as 2 cartas do time) → vira 2-jogadores soma-zero → CFR vale. O resultado é o
**team-maxmin com correlação (TMECor)** — um **teto** (duplas reais não se
comunicam). O caso sem comunicação (TME) é NP-difícil, fora de escopo.

`npm run solve` também resolve a última vaza 2v2 (exploitability ~`0.0004`,
valor `+0.089` ao time que lidera) e imprime as **frequências GTO por par de
cartas**. A estrutura é a mesma do pôquer, **modulada por ter 2 cartas**: truca
por **valor** com manilha, **blefa** com o par fraco, dá **check** com a região
forte-mas-sem-manilha (3/2/A/K). A 2ª carta importa (`Q+4` → blefe; `Q+6` → quase
nunca).

### Duas últimas vazas 2v2 (A ganhou a 1ª) — MCCFR

Estende para **2 vazas**: cada jogador tem 2 cartas, então além do truco há a
decisão de **qual carta jogar** (com info sequencial). O deal de 8 cartas é
grande demais para enumerar → **MCCFR** (amostra o deal). `npm run solve` resolve
isso (parâmetro `ITERS2`).

Resultado (vira 4♣): valor **~0.66 ao Time A** (fortemente favorecido — para
perder, B precisa vencer **as duas** vazas restantes). A estratégia GTO
(tendências; `npm run solve` imprime, estável entre sementes):

- **Quando trucar** (por melhor carta de A): é **polarizado** — truca quase
  sempre com mão **fraca** (99%, semi-blefe: já está ganhando a mão) e com
  **manilha** (89%, valor), mas **dá check com as fortes-sem-manilha (A/2/3, ~36%)**
  (bluff-catchers que preferem showdown barato).
- **Qual carta na vaza 2** (a outra sobra p/ a 3): tende a **liderar a fraca e
  guardar a forte** (joga a mais forte só ~41%); com manilha, **guarda p/ a vaza
  3 ~45–55%**. Seguidores cobrem um pouco mais quando estão **perdendo** a vaza
  (amarram quando já ganham).

> Ressalva: aqui a **exploitability exata** é cara (8 cartas) — a convergência é
> monitorada pelo valor (clássico CFR converge devagar; ~0.66 ainda drifta). São
> **tendências** (estrutura robusta, % aproximada); números cravados pediriam
> **CFR+**.

> Próximo salto possível: CFR na **mão 1v1 completa** (3 vazas + escalada) com
> abstração de cartas por força → bot **inexplorável** de verdade.

No HTML e no CLI dá para escolher a inteligência de cada equipe (inocente ×
melhorada_1…5) e assistir à diferença. Há também um **modo
"explicar jogada"** (toggle no HTML, `npm run demo:explica` no CLI) que mostra,
a cada decisão da Melhorada, as features que mais pesaram — ex.: *"jogou 6♣:
cobreParceiro +0.81"* (escolheu não cobrir o parceiro = amarrar).

## Próximos passos (fora do MVP)

- Interface gráfica/web reaproveitando o `core` (já está isolado para isso).
- Mais degraus na escada (melhorada_2, _3…) e simulação em massa para estatísticas.
- Outras variantes (Gaúcho/Argentina: envido, flor) via novos `RuleSet`.
