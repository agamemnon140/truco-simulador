# Simulador de Truco

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
- Jogadores **humanos e/ou bots**, escolhidos antes da partida.
- Formatos: duplas (2v2), mano a mano (1v1) e trios (3v3).

## Como rodar

```bash
npm install

npm start     # jogo interativo no terminal (escolha humanos/bots no início)
npm run demo  # demonstração automática: bots vs bots, sem digitar nada
npm test      # bateria de testes (regras, vazas, apostas, mão e partida)
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
    player.ts    # interface Player (humano/bot/futura UI)
    bot.ts       # bot básico por heurística
    humanCli.ts  # jogador humano via terminal
  cli/
    setup.ts     # configuração pré-partida
    render.ts    # formatação para o terminal
    main.ts      # ponto de entrada interativo
    demo.ts      # partida automática (bots)
  index.ts       # exporta o core para reuso (ex.: web)
```

## Próximos passos (fora do MVP)

- Interface gráfica/web reaproveitando o `core` (já está isolado para isso).
- Bot mais sofisticado e simulação em massa para estatísticas.
- Outras variantes (Gaúcho/Argentina: envido, flor) via novos `RuleSet`.
- Regra "mão de 11" (já existe o campo `maoDeOnze` no `RuleSet`).
