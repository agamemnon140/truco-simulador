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
- **Bots com inteligência evoluída** (algoritmo genético): o `inocente`
  (heurística simples) e o `melhorada_1`, treinado por simulação — ~**76% de
  vitórias** contra o inocente em partidas com sementes novas.
- Formatos: duplas (2v2), mano a mano (1v1) e trios (3v3).

## Como rodar

```bash
npm install

npm start          # jogo interativo no terminal (escolha humanos/bots no início)
npm run demo       # demonstração automática: bots vs bots, sem digitar nada
npm run demo:verbose  # demo detalhada: cartas de cada um, jogadas e apostas
npm run demo:onze     # demonstra a mão de onze (11x9 e 11x11)
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
    genome.ts        # genoma: pesos/limiares + (de)serialização
    personalities.ts # registro: inocente, melhorada_1...
    humanCli.ts      # jogador humano via terminal
  training/
    arena.ts     # partidas em massa (sementes comuns + espelhamento)
    ga.ts        # algoritmo genético (seleção, crossover, mutação)
    train.ts     # evolui em escada (inocente → melhorada_N)
    evaluate.ts  # mede força vs inocente em sementes novas
    rng.ts       # RNG determinístico do treino
  genomes/
    melhorada_1.json  # genoma treinado (versionado; usado no jogo)
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
GENS=30 GAMES=120 RUNGS=2 npm run train   # gera src/genomes/melhorada_N.json
GAMES=800 npm run evaluate                # ~76% de vitórias vs inocente
```

No HTML e no CLI dá para escolher a inteligência de cada equipe (inocente ×
melhorada_1) e assistir à diferença.

## Próximos passos (fora do MVP)

- Interface gráfica/web reaproveitando o `core` (já está isolado para isso).
- Mais degraus na escada (melhorada_2, _3…) e simulação em massa para estatísticas.
- Outras variantes (Gaúcho/Argentina: envido, flor) via novos `RuleSet`.
