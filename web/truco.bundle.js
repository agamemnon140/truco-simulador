"use strict";
var Truco = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/web/browser-entry.ts
  var browser_entry_exports = {};
  __export(browser_entry_exports, {
    simulate: () => simulate
  });

  // src/core/betting.ts
  function initBetting() {
    return { level: -1, lastRaiser: null };
  }
  function currentValue(s, rules) {
    return s.level < 0 ? rules.baseValue : rules.bettingLevels[s.level].value;
  }
  function isMaxed(s, rules) {
    return s.level >= rules.bettingLevels.length - 1;
  }
  function nextLevel(s, rules) {
    if (isMaxed(s, rules)) return null;
    const index = s.level + 1;
    const lvl = rules.bettingLevels[index];
    return { index, name: lvl.name, value: lvl.value };
  }
  function canPropose(s, team, rules) {
    if (isMaxed(s, rules)) return false;
    return s.lastRaiser === null || s.lastRaiser !== team;
  }
  function forfeitValueOnRun(s, rules) {
    return currentValue(s, rules);
  }
  function acceptRaise(s, proposer, rules) {
    if (isMaxed(s, rules)) {
      throw new Error("Nao ha aumento para aceitar: aposta no maximo.");
    }
    return { level: s.level + 1, lastRaiser: proposer };
  }

  // src/core/types.ts
  function cardsEqual(a, b) {
    return a.rank === b.rank && a.suit === b.suit;
  }
  function cardToString(card) {
    return `${card.rank} de ${card.suit}`;
  }

  // src/core/deck.ts
  var ALL_SUITS = [
    "ouros" /* Ouros */,
    "espadas" /* Espadas */,
    "copas" /* Copas */,
    "paus" /* Paus */
  ];
  var ALL_RANKS = [
    "4" /* Quatro */,
    "5" /* Cinco */,
    "6" /* Seis */,
    "7" /* Sete */,
    "Q" /* Dama */,
    "J" /* Valete */,
    "K" /* Rei */,
    "A" /* As */,
    "2" /* Dois */,
    "3" /* Tres */
  ];
  function buildDeck() {
    const deck = [];
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        deck.push({ rank, suit });
      }
    }
    return deck;
  }
  function shuffle(cards, rng = Math.random) {
    const out = cards.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }
  function deal(numPlayers, cardsPerPlayer, rng = Math.random) {
    const needed = numPlayers * cardsPerPlayer + 1;
    const deck = shuffle(buildDeck(), rng);
    if (deck.length < needed) {
      throw new Error(
        `Baralho insuficiente: precisa de ${needed} cartas, tem ${deck.length}.`
      );
    }
    const hands = Array.from({ length: numPlayers }, () => []);
    let idx = 0;
    for (let c = 0; c < cardsPerPlayer; c++) {
      for (let seat = 0; seat < numPlayers; seat++) {
        hands[seat].push(deck[idx++]);
      }
    }
    const vira = deck[idx++];
    const rest = deck.slice(idx);
    return { hands, vira, rest };
  }

  // src/core/ranking.ts
  function manilhaRank(vira, rules) {
    const order = rules.rankOrder;
    const idx = order.indexOf(vira.rank);
    if (idx < 0) {
      throw new Error(`Rank da vira invalido para esta variante: ${vira.rank}`);
    }
    return order[(idx + 1) % order.length];
  }
  function isManilha(card, vira, rules) {
    return card.rank === manilhaRank(vira, rules);
  }
  function cardStrength(card, vira, rules) {
    const commonRange = rules.rankOrder.length;
    if (isManilha(card, vira, rules)) {
      const suitRank = rules.manilhaSuitOrder.indexOf(card.suit);
      if (suitRank < 0) {
        throw new Error(`Naipe sem ordem definida para manilha: ${card.suit}`);
      }
      return commonRange + suitRank;
    }
    const rankIdx = rules.rankOrder.indexOf(card.rank);
    if (rankIdx < 0) {
      throw new Error(`Rank invalido para esta variante: ${card.rank}`);
    }
    return rankIdx;
  }
  function compareCards(a, b, vira, rules) {
    return cardStrength(a, vira, rules) - cardStrength(b, vira, rules);
  }

  // src/core/vaza.ts
  function resolveVaza(plays, vira, teamOfSeat, rules) {
    if (plays.length === 0) {
      throw new Error("Vaza sem jogadas.");
    }
    let maxStrength3 = -Infinity;
    for (const p of plays) {
      const s = cardStrength(p.card, vira, rules);
      if (s > maxStrength3) maxStrength3 = s;
    }
    const topSeats = plays.filter((p) => cardStrength(p.card, vira, rules) === maxStrength3).map((p) => p.seat);
    const topTeams = new Set(topSeats.map((seat) => teamOfSeat[seat]));
    if (topTeams.size === 1) {
      const leaderSeat = topSeats[0];
      return {
        winningTeam: teamOfSeat[leaderSeat],
        winningSeat: leaderSeat,
        tied: false
      };
    }
    return { winningTeam: null, winningSeat: null, tied: true };
  }

  // src/core/hand.ts
  function decideHand(results, rules) {
    const r1 = results[0];
    const r2 = results[1];
    const r3 = results[2];
    if (!r2) return "continue";
    const t1 = r1.winningTeam;
    const t2 = r2.winningTeam;
    if (t1 !== null && t2 !== null) {
      if (t1 === t2) return t1;
      if (!r3) return "continue";
      if (r3.winningTeam !== null) return r3.winningTeam;
      return t1;
    }
    if (t1 === null && t2 !== null) return t2;
    if (t1 !== null && t2 === null) return t1;
    if (!r3) return "continue";
    if (r3.winningTeam !== null) return r3.winningTeam;
    return rules.cancelOnFullTie ? "cancel" : "cancel";
  }
  function firstOpponentAfter(seat, team, teamOfSeat) {
    const n = teamOfSeat.length;
    for (let k = 1; k < n; k++) {
      const s = (seat + k) % n;
      if (teamOfSeat[s] !== team) return s;
    }
    throw new Error("Nenhum adversario encontrado (mesa de uma equipe so?).");
  }
  async function playHand(cfg) {
    const { rules, players, teamOfSeat, scores, firstSeat, observer } = cfg;
    const n = rules.numPlayers;
    const dealt = deal(n, rules.cardsPerPlayer, cfg.rng);
    const vira = dealt.vira;
    const manilha = manilhaRank(vira, rules);
    const hands = dealt.hands.map((h) => h.slice());
    let betting = initBetting();
    const vazaResults = [];
    const allVazaPlays = [];
    let leader = firstSeat;
    const threshold = rules.pointsToWin - 1;
    const teamsAtThreshold = [];
    for (let t = 0; t < rules.numTeams; t++) {
      if (scores[t] === threshold) teamsAtThreshold.push(t);
    }
    const onzeActive = rules.maoDeOnze && teamsAtThreshold.length > 0;
    const onzeBoth = onzeActive && teamsAtThreshold.length >= 2;
    const onzeSingle = onzeActive && teamsAtThreshold.length === 1;
    const noTruco = onzeActive;
    const blind = onzeBoth;
    const effectiveBase = onzeSingle ? rules.maoDeOnzeValue : rules.baseValue;
    const valueNow = () => betting.level < 0 ? effectiveBase : currentValue(betting, rules);
    observer?.onDeal?.({
      vira,
      manilha,
      leader,
      hands: hands.map((h) => h.slice())
    });
    const buildView = (seat, currentVazaPlays) => ({
      seat,
      team: teamOfSeat[seat],
      hand: hands[seat],
      vira,
      manilha,
      rules,
      scores,
      teamOfSeat,
      completedVazaPlays: allVazaPlays,
      completedVazaResults: vazaResults,
      currentVazaPlays,
      handValue: valueNow(),
      blind
    });
    if (onzeSingle) {
      const teamAt11 = teamsAtThreshold[0];
      observer?.onMaoDeOnze?.({ mode: "single", teamAt11, value: effectiveBase });
      let deciderSeat = firstSeat;
      for (let k = 0; k < n; k++) {
        const s = (firstSeat + k) % n;
        if (teamOfSeat[s] === teamAt11) {
          deciderSeat = s;
          break;
        }
      }
      const partnerHands = [];
      for (let s = 0; s < n; s++) {
        if (s !== deciderSeat && teamOfSeat[s] === teamAt11) {
          partnerHands.push(hands[s].slice());
        }
      }
      const oppSeat = firstOpponentAfter(deciderSeat, teamAt11, teamOfSeat);
      const opponentTeam2 = teamOfSeat[oppSeat];
      const ctx = {
        partnerHands,
        value: effectiveBase,
        foldValue: rules.baseValue
      };
      const decision = await players[deciderSeat].decideMaoDeOnze(
        buildView(deciderSeat, []),
        ctx
      );
      observer?.onMaoDeOnzeDecision?.({ team: teamAt11, decision });
      if (decision === "fold") {
        const result = {
          winningTeam: opponentTeam2,
          points: rules.baseValue,
          reason: "fold"
        };
        observer?.onHandEnd?.(result);
        return result;
      }
    } else if (onzeBoth) {
      observer?.onMaoDeOnze?.({ mode: "both", value: effectiveBase });
    }
    const negotiate = async (starter, currentVazaPlays) => {
      let proposer = starter;
      for (; ; ) {
        const lvl = nextLevel(betting, rules);
        if (!lvl) return null;
        const proposingTeam = teamOfSeat[proposer];
        const proposal = {
          proposer,
          proposingTeam,
          level: lvl.index,
          name: lvl.name,
          value: lvl.value,
          forfeitValue: forfeitValueOnRun(betting, rules)
        };
        observer?.onRaiseProposed?.(proposal);
        const responderSeat = firstOpponentAfter(
          proposer,
          proposingTeam,
          teamOfSeat
        );
        const canCounter = lvl.index < rules.bettingLevels.length - 1;
        const response = await players[responderSeat].respondToRaise(
          buildView(responderSeat, currentVazaPlays),
          proposal,
          canCounter
        );
        observer?.onRaiseResponse?.({ responder: responderSeat, response });
        if (response === "run") {
          return { winner: proposingTeam, points: proposal.forfeitValue };
        }
        betting = acceptRaise(betting, proposingTeam, rules);
        if (response === "accept" || isMaxed(betting, rules) || !canCounter) {
          return null;
        }
        proposer = responderSeat;
      }
    };
    for (let v = 0; v < rules.cardsPerPlayer; v++) {
      const plays = [];
      for (let k = 0; k < n; k++) {
        const seat = (leader + k) % n;
        const team = teamOfSeat[seat];
        for (; ; ) {
          const allowRaise = !noTruco && canPropose(betting, team, rules);
          const action = await players[seat].chooseAction(
            buildView(seat, plays),
            allowRaise
          );
          if (action.type === "raise") {
            if (!allowRaise) {
              continue;
            }
            const outcome = await negotiate(seat, plays);
            if (outcome) {
              const result2 = {
                winningTeam: outcome.winner,
                points: outcome.points,
                reason: "run"
              };
              observer?.onHandEnd?.(result2);
              return result2;
            }
            continue;
          }
          const hand = hands[seat];
          const idx = hand.findIndex((c) => cardsEqual(c, action.card));
          if (idx < 0) {
            throw new Error(
              `Jogador ${seat} tentou jogar carta que nao possui.`
            );
          }
          hand.splice(idx, 1);
          plays.push({ seat, card: action.card });
          observer?.onPlay?.({ seat, card: action.card, vazaIndex: v });
          break;
        }
      }
      const result = resolveVaza(plays, vira, teamOfSeat, rules);
      vazaResults.push(result);
      allVazaPlays.push(plays);
      observer?.onVazaResolved?.({ vazaIndex: v, result, plays });
      const decision = decideHand(vazaResults, rules);
      if (decision === "cancel") {
        const handResult = {
          winningTeam: null,
          points: 0,
          reason: "cancelled"
        };
        observer?.onHandEnd?.(handResult);
        return handResult;
      }
      if (decision !== "continue") {
        const handResult = {
          winningTeam: decision,
          points: valueNow(),
          reason: "vazas"
        };
        observer?.onHandEnd?.(handResult);
        return handResult;
      }
      if (result.winningSeat !== null) leader = result.winningSeat;
    }
    const fallback = {
      winningTeam: null,
      points: 0,
      reason: "cancelled"
    };
    observer?.onHandEnd?.(fallback);
    return fallback;
  }

  // src/core/match.ts
  function assignTeams(rules) {
    return Array.from(
      { length: rules.numPlayers },
      (_, seat) => seat % rules.numTeams
    );
  }
  async function playMatch(cfg) {
    const { rules, players, observer } = cfg;
    if (players.length !== rules.numPlayers) {
      throw new Error(
        `Esperados ${rules.numPlayers} jogadores, recebidos ${players.length}.`
      );
    }
    const teamOfSeat = assignTeams(rules);
    const scores = new Array(rules.numTeams).fill(0);
    if (cfg.initialScores) {
      for (let t = 0; t < rules.numTeams; t++) {
        scores[t] = cfg.initialScores[t] ?? 0;
      }
    }
    let firstSeat = cfg.startSeat ?? 0;
    let handsPlayed = 0;
    observer?.onMatchStart?.({ teamOfSeat });
    while (Math.max(...scores) < rules.pointsToWin) {
      handsPlayed++;
      observer?.onHandStart?.({ handNumber: handsPlayed, firstSeat });
      const result = await playHand({
        rules,
        players,
        teamOfSeat,
        scores,
        firstSeat,
        rng: cfg.rng,
        observer
      });
      if (result.winningTeam !== null) {
        scores[result.winningTeam] += result.points;
      }
      observer?.onScoreUpdate?.({ result, scores });
      firstSeat = (firstSeat + 1) % rules.numPlayers;
    }
    let winningTeam = 0;
    for (let t = 1; t < scores.length; t++) {
      if (scores[t] > scores[winningTeam]) winningTeam = t;
    }
    observer?.onMatchEnd?.({ winningTeam, scores });
    return { winningTeam, scores, handsPlayed };
  }

  // src/core/rules.ts
  var TRUCO_PAULISTA = {
    name: "Truco Paulista",
    numPlayers: 4,
    numTeams: 2,
    cardsPerPlayer: 3,
    pointsToWin: 12,
    rankOrder: [
      "4" /* Quatro */,
      "5" /* Cinco */,
      "6" /* Seis */,
      "7" /* Sete */,
      "Q" /* Dama */,
      "J" /* Valete */,
      "K" /* Rei */,
      "A" /* As */,
      "2" /* Dois */,
      "3" /* Tres */
    ],
    manilhaSuitOrder: ["ouros" /* Ouros */, "espadas" /* Espadas */, "copas" /* Copas */, "paus" /* Paus */],
    baseValue: 1,
    bettingLevels: [
      { name: "Truco", value: 3 },
      { name: "Seis", value: 6 },
      { name: "Nove", value: 9 },
      { name: "Doze", value: 12 }
    ],
    cancelOnFullTie: true,
    maoDeOnze: true,
    maoDeOnzeValue: 3
  };

  // src/genomes/melhorada_1.json
  var melhorada_1_default = {
    cardWeights: [
      0.6320121256527582,
      -0.9531346257727189,
      0.7268595920843197,
      0.974154489045978,
      0.5226883793784259,
      1.0342311685513275,
      -0.21225382125683,
      -2.3288655688080073,
      0.22708427166906922,
      -0.21678439289184323,
      -0.2856453944881859,
      -0.5714897155779238,
      0.08864763194822219,
      -0.6479734018838894,
      -0.9917134013282911,
      -0.5650054651284167,
      0.396423040725513,
      -0.11862927414832497,
      -0.307271754073707,
      0.43780309825667457
    ],
    betWeights: [
      0.07950002828827472,
      2.3362247098154327,
      1.4862968857940897,
      1.0738391625373815,
      -1.3688822787084112,
      -0.4429819347782922,
      -1.540427507575953,
      0.8606941234320402,
      1.1849045126371673,
      0.09966691686862623,
      0.7568128545555959,
      0.21754672179446655,
      -0.12998594601311597,
      0.22952527038005668,
      -0.26652616128622175,
      -0.828941748097397,
      -0.02612630362066289,
      1.6957361143842875
    ],
    thrCall: 1.948422762721058,
    thrAccept: 1.4564325806818252,
    thrRaise: 1.7455257253607661,
    pBluff: -2.818299054752243,
    playTemp: -0.10088760137400857
  };

  // src/genomes/melhorada_2.json
  var melhorada_2_default = {
    cardWeights: [
      -0.5252722386080103,
      0.21521001926620323,
      1.3111542629111832,
      0.9483956547558959,
      -0.7023838788117504,
      0.5144875085847903,
      -1.0588304321368895,
      -1.6072570494793905,
      1.1379771189596897,
      0.05832846903102325,
      -0.9416598711449305,
      1.1733840885886349,
      1.052885543604732,
      0.664565574139556,
      -1.7111257376805522,
      0.7056863866913633,
      -0.4300746283178435,
      -0.8169408598823236,
      -1.6406825608154019,
      -0.12618387830298225
    ],
    betWeights: [
      -0.10176293315399847,
      1.0772415915957716,
      0.007711496342550105,
      -1.1674455427145496,
      -0.20267532879335176,
      -0.3481446820015018,
      1.0844605840127703,
      -0.16510881248158674,
      -0.4311298629487015,
      0.690170522389208,
      0.5064816842442712,
      -1.4878009442258038,
      0.15195732532998643,
      -0.09417373623589836,
      0.8094852705797542,
      -1.0140697443000652,
      0.669016293226989,
      -0.9045342012922233
    ],
    thrCall: 0.2132866160161575,
    thrAccept: 2.822449750199241,
    thrRaise: 1.4896539089961747,
    pBluff: -2.6304547446360838,
    playTemp: 0.021871988449151464
  };

  // src/players/bot.ts
  function maxStrength(view) {
    return view.rules.rankOrder.length + view.rules.manilhaSuitOrder.length - 1;
  }
  function handScore(view) {
    if (view.hand.length === 0) return 0;
    const max = maxStrength(view);
    let sum = 0;
    for (const c of view.hand) sum += cardStrength(c, view.vira, view.rules);
    return sum / (max * view.hand.length);
  }
  function currentBest(view) {
    let best = null;
    for (const p of view.currentVazaPlays) {
      if (best === null || compareCards(p.card, best, view.vira, view.rules) > 0) {
        best = p.card;
      }
    }
    return best;
  }
  function cardsScore(cards, view) {
    if (cards.length === 0) return 0;
    const max = maxStrength(view);
    let sum = 0;
    for (const c of cards) sum += cardStrength(c, view.vira, view.rules);
    return sum / (max * cards.length);
  }
  function pickCard(view) {
    if (view.blind) return view.hand[0];
    const hand = [...view.hand].sort(
      (a, b) => cardStrength(a, view.vira, view.rules) - cardStrength(b, view.vira, view.rules)
    );
    const best = currentBest(view);
    if (best === null) {
      return hand[hand.length - 1];
    }
    for (const c of hand) {
      if (compareCards(c, best, view.vira, view.rules) > 0) return c;
    }
    return hand[0];
  }
  var BotPlayer = class {
    constructor(name) {
      this.name = name;
    }
    async chooseAction(view, canRaise) {
      if (canRaise && handScore(view) > 0.7) {
        return { type: "raise" };
      }
      return { type: "play", card: pickCard(view) };
    }
    async respondToRaise(view, _proposal, canCounter) {
      const score = handScore(view);
      if (score > 0.78 && canCounter) return "raise";
      if (score > 0.35) return "accept";
      return "run";
    }
    async decideMaoDeOnze(view, ctx) {
      const all = [...view.hand, ...ctx.partnerHands.flat()];
      const score = cardsScore(all, view);
      return score > 0.45 ? "play" : "fold";
    }
  };

  // src/players/features.ts
  var CONTEXT_FEATURE_COUNT = 12;
  var CARD_OWN_FEATURE_COUNT = 8;
  var HAND_STRENGTH_FEATURE_COUNT = 6;
  var CARD_FEATURE_COUNT = CARD_OWN_FEATURE_COUNT + CONTEXT_FEATURE_COUNT;
  var BET_FEATURE_COUNT = HAND_STRENGTH_FEATURE_COUNT + CONTEXT_FEATURE_COUNT;
  var CONTEXT_FEATURE_NAMES = [
    "bias",
    "rodada",
    "minhasVazas",
    "vazasAdv",
    "ganhou1a",
    "lideraVaza",
    "parceiroLidera",
    "placarMeu",
    "placarAdv",
    "difPlacar",
    "proximidade",
    "valorEmJogo"
  ];
  var CARD_OWN_FEATURE_NAMES = [
    "forca",
    "manilha",
    "venceMesa",
    "pWin",
    "fracMaisFortes",
    "posicaoVaza",
    "forcaRelativa",
    "cobreParceiro"
  ];
  var HAND_STRENGTH_FEATURE_NAMES = [
    "bias",
    "forcaMedia",
    "melhorCarta",
    "manilhas",
    "cartasFortes",
    "cartasRestantes"
  ];
  var CARD_FEATURE_NAMES = [
    ...CARD_OWN_FEATURE_NAMES,
    ...CONTEXT_FEATURE_NAMES
  ];
  var BET_FEATURE_NAMES = [
    ...HAND_STRENGTH_FEATURE_NAMES,
    ...CONTEXT_FEATURE_NAMES
  ];
  function maxStrength2(view) {
    return view.rules.rankOrder.length + view.rules.manilhaSuitOrder.length - 1;
  }
  function str(view, card) {
    return cardStrength(card, view.vira, view.rules);
  }
  function opponentTeam(view) {
    let opp = view.team === 0 ? 1 : 0;
    for (let t = 0; t < view.scores.length; t++) {
      if (t !== view.team && view.scores[t] >= view.scores[opp]) opp = t;
    }
    return opp;
  }
  function trickContext(view) {
    const plays = view.currentVazaPlays;
    let bestCard = null;
    let bestSeat = -1;
    for (const p of plays) {
      if (bestCard === null || compareCards(p.card, bestCard, view.vira, view.rules) > 0) {
        bestCard = p.card;
        bestSeat = p.seat;
      }
    }
    const n = view.rules.numPlayers;
    const myPos = plays.length;
    let opponentsAfter = 0;
    for (let k = 1; k <= n - 1 - myPos; k++) {
      const s = (view.seat + k) % n;
      if (view.teamOfSeat[s] !== view.team) opponentsAfter++;
    }
    const bestTeam = bestSeat >= 0 ? view.teamOfSeat[bestSeat] : null;
    const teamWinning = bestTeam !== null && bestTeam === view.team;
    const partnerWinning = teamWinning && bestSeat >= 0 && bestSeat !== view.seat;
    return {
      hasPlays: plays.length > 0,
      bestCard,
      bestTeam,
      teamWinning,
      partnerWinning,
      opponentsAfter
    };
  }
  function unseenCards(view) {
    const seen = [
      ...view.hand,
      view.vira,
      ...view.completedVazaPlays.flat().map((p) => p.card),
      ...view.currentVazaPlays.map((p) => p.card)
    ];
    return buildDeck().filter((c) => !seen.some((s) => cardsEqual(s, c)));
  }
  function contextFeatures(view, trick) {
    const myTeam = view.team;
    const opp = opponentTeam(view);
    const results = view.completedVazaResults;
    let myWins = 0;
    let oppWins = 0;
    for (const r of results) {
      if (r.winningTeam === myTeam) myWins++;
      else if (r.winningTeam !== null) oppWins++;
    }
    let firstVaza = 0.5;
    const r0 = results[0];
    if (r0) firstVaza = r0.winningTeam === myTeam ? 1 : r0.winningTeam === null ? 0.5 : 0;
    const trickLead = !trick.hasPlays ? 0.5 : trick.teamWinning ? 1 : 0;
    const P = view.rules.pointsToWin;
    const scoreMy = view.scores[myTeam] ?? 0;
    const scoreOpp = view.scores[opp] ?? 0;
    const maxStake = view.rules.bettingLevels.at(-1)?.value ?? P;
    return [
      1,
      // 0: bias (intercepto)
      results.length / 2,
      // 1: qual e a rodada (0/0.5/1)
      myWins / 2,
      // 2: vazas que minha dupla ganhou
      oppWins / 2,
      // 3: vazas que a adversaria ganhou
      firstVaza,
      // 4: ganhei a 1a vaza?
      trickLead,
      // 5: quem ganha a vaza atual
      trick.partnerWinning ? 1 : 0,
      // 6: meu parceiro esta ganhando a vaza
      scoreMy / P,
      // 7: meu placar (proximidade de vencer)
      scoreOpp / P,
      // 8: placar do adversario
      (scoreMy - scoreOpp) / P,
      // 9: diferenca de placar (quem ganha a partida)
      Math.max(scoreMy, scoreOpp) / P,
      // 10: proximidade do fim
      view.handValue / maxStake
      // 11: valor em jogo nesta mao
    ];
  }
  function precompute(view) {
    const trick = trickContext(view);
    return {
      trick,
      unseen: unseenCards(view),
      context: contextFeatures(view, trick)
    };
  }
  function cardFeatures(view, card, pre) {
    const max = maxStrength2(view);
    const s = str(view, card);
    const { trick, unseen, context } = pre;
    const beatsTable = !trick.hasPlays ? 0.5 : trick.bestCard && compareCards(card, trick.bestCard, view.vira, view.rules) > 0 ? 1 : 0;
    let stronger = 0;
    for (const c of unseen) if (str(view, c) > s) stronger++;
    const strongerFrac = unseen.length > 0 ? stronger / unseen.length : 0;
    const canBeat = !trick.hasPlays || beatsTable === 1;
    const pWin = canBeat ? Math.pow(1 - strongerFrac, trick.opponentsAfter) : 0;
    const n = view.rules.numPlayers;
    const position = n > 1 ? view.currentVazaPlays.length / (n - 1) : 0;
    const sorted = [...view.hand].sort((a, b) => str(view, a) - str(view, b));
    const idx = sorted.findIndex((c) => cardsEqual(c, card));
    const relRank = view.hand.length > 1 ? idx / (view.hand.length - 1) : 0.5;
    const wastesOnPartner = trick.partnerWinning && trick.bestCard && compareCards(card, trick.bestCard, view.vira, view.rules) > 0 ? 1 : 0;
    const own = [
      s / max,
      // 0: forca absoluta normalizada
      isManilha(card, view.vira, view.rules) ? 1 : 0,
      // 1: e manilha
      beatsTable,
      // 2: vence a mesa agora
      pWin,
      // 3: prob. estimada de vencer a vaza
      strongerFrac,
      // 4: fracao de cartas nao vistas mais fortes
      position,
      // 5: posicao na vaza
      relRank,
      // 6: forca relativa dentro da mao
      wastesOnPartner
      // 7: cobriria o parceiro (desperdicio)
    ];
    return [...own, ...context];
  }
  function betFeatures(view, pre) {
    const max = maxStrength2(view);
    const hand = view.hand;
    const cpp = view.rules.cardsPerPlayer || 1;
    let sum = 0;
    let maxCard = 0;
    let manilhas = 0;
    let strong = 0;
    for (const c of hand) {
      const v = str(view, c);
      sum += v;
      if (v > maxCard) maxCard = v;
      if (isManilha(c, view.vira, view.rules)) manilhas++;
      if (v / max > 0.7) strong++;
    }
    const avg = hand.length > 0 ? sum / (max * hand.length) : 0;
    const strength = [
      1,
      // 0: bias
      avg,
      // 1: forca media (handScore atual)
      maxCard / max,
      // 2: forca da melhor carta
      manilhas / cpp,
      // 3: nº de manilhas
      strong / cpp,
      // 4: nº de cartas fortes
      hand.length / cpp
      // 5: cartas restantes
    ];
    return [...strength, ...pre.context];
  }

  // src/players/explain.ts
  function build(names, weights, values) {
    const contributions = [];
    let score = 0;
    for (let i = 0; i < weights.length; i++) {
      const contribution = weights[i] * values[i];
      score += contribution;
      contributions.push({
        index: i,
        name: names[i] ?? `f${i}`,
        value: values[i],
        weight: weights[i],
        contribution
      });
    }
    return { score, contributions };
  }
  function explainCardChoice(genome, view) {
    const pre = precompute(view);
    const cards = view.hand.map((card) => {
      const { score, contributions } = build(
        CARD_FEATURE_NAMES,
        genome.cardWeights,
        cardFeatures(view, card, pre)
      );
      return { card, score, contributions, chosen: false };
    });
    let chosenIndex = 0;
    for (let i = 1; i < cards.length; i++) {
      if (cards[i].score > cards[chosenIndex].score) chosenIndex = i;
    }
    if (cards[chosenIndex]) cards[chosenIndex].chosen = true;
    return { cards, chosenIndex };
  }
  function explainBetting(genome, view) {
    const pre = precompute(view);
    const { score, contributions } = build(
      BET_FEATURE_NAMES,
      genome.betWeights,
      betFeatures(view, pre)
    );
    return {
      s: score,
      contributions,
      thrCall: genome.thrCall,
      thrAccept: genome.thrAccept,
      thrRaise: genome.thrRaise
    };
  }
  function topContributions(contributions, k = 3) {
    return [...contributions].filter((c) => Math.abs(c.contribution) > 1e-9).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, k);
  }
  function differentiatingContributions(exp, cardIndex, k = 3) {
    const cards = exp.cards;
    const chosen = cards[cardIndex];
    if (!chosen || cards.length === 0) return [];
    const n = chosen.contributions.length;
    const diffs = [];
    for (let i = 0; i < n; i++) {
      let mean = 0;
      for (const c of cards) mean += c.contributions[i].contribution;
      mean /= cards.length;
      diffs.push({
        name: chosen.contributions[i].name,
        diff: chosen.contributions[i].contribution - mean
      });
    }
    return diffs.filter((d) => Math.abs(d.diff) > 1e-9).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, k);
  }
  var sign = (x) => x >= 0 ? "+" : "\u2212";
  var fmt = (x) => `${sign(x)}${Math.abs(x).toFixed(2)}`;
  function formatCardChoice(exp, name) {
    const chosen = exp.cards[exp.chosenIndex];
    const reasons = differentiatingContributions(exp, exp.chosenIndex, 3).map((d) => `${d.name} ${fmt(d.diff)}`).join(", ");
    return `   [explica] ${name} jogou ${cardToString(chosen.card)} (score ${chosen.score.toFixed(2)}): ${reasons || "carta unica"}`;
  }
  function formatBetting(exp, name) {
    const reasons = topContributions(exp.contributions, 3).map((c) => `${c.name} ${fmt(c.contribution)}`).join(", ");
    return `   [explica] ${name} apostou: S=${exp.s.toFixed(2)} (limiar truco ${exp.thrCall.toFixed(2)}); ${reasons}`;
  }

  // src/players/evolvedBot.ts
  function dot(weights, features) {
    let s = 0;
    for (let i = 0; i < weights.length; i++) s += weights[i] * features[i];
    return s;
  }
  function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }
  var EvolvedBotPlayer = class {
    constructor(name, genome, rng = Math.random, onDecision) {
      this.name = name;
      this.genome = genome;
      this.rng = rng;
      this.onDecision = onDecision;
    }
    /** Score S da situacao para decisoes de aposta. */
    situationScore(view) {
      const pre = precompute(view);
      return dot(this.genome.betWeights, betFeatures(view, pre));
    }
    async chooseAction(view, canRaise) {
      if (canRaise && !view.blind) {
        const s = this.situationScore(view);
        const bluff = this.rng() < sigmoid(this.genome.pBluff);
        if (s > this.genome.thrCall || bluff) {
          this.onDecision?.({
            seat: view.seat,
            name: this.name,
            raised: true,
            betting: explainBetting(this.genome, view)
          });
          return { type: "raise" };
        }
      }
      const card = this.pickCard(view);
      if (this.onDecision) {
        const cardChoice = explainCardChoice(this.genome, view);
        cardChoice.cards.forEach((c, i) => {
          c.chosen = cardsEqual(c.card, card);
          if (c.chosen) cardChoice.chosenIndex = i;
        });
        this.onDecision({
          seat: view.seat,
          name: this.name,
          raised: false,
          betting: explainBetting(this.genome, view),
          cardChoice
        });
      }
      return { type: "play", card };
    }
    /** Escolhe a carta: argmax do cardScore, ou softmax se playTemp > 0. */
    pickCard(view) {
      const hand = view.hand;
      if (view.blind || hand.length === 1) return hand[0];
      const pre = precompute(view);
      const scores = hand.map((c) => dot(this.genome.cardWeights, cardFeatures(view, c, pre)));
      const temp = Math.max(0, this.genome.playTemp);
      if (temp <= 1e-6) {
        let best = 0;
        for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
        return hand[best];
      }
      const maxS = Math.max(...scores);
      const exps = scores.map((s) => Math.exp((s - maxS) / temp));
      const total = exps.reduce((a, b) => a + b, 0);
      let r = this.rng() * total;
      for (let i = 0; i < exps.length; i++) {
        r -= exps[i];
        if (r <= 0) return hand[i];
      }
      return hand[hand.length - 1];
    }
    async respondToRaise(view, _proposal, canCounter) {
      const s = this.situationScore(view);
      const bluff = this.rng() < sigmoid(this.genome.pBluff) * 0.5;
      if (canCounter && (s > this.genome.thrRaise || bluff)) return "raise";
      if (s > this.genome.thrAccept) return "accept";
      return "run";
    }
    async decideMaoDeOnze(view, ctx) {
      const all = [...view.hand, ...ctx.partnerHands.flat()];
      const max = view.rules.rankOrder.length + view.rules.manilhaSuitOrder.length - 1;
      let sum = 0;
      for (const c of all) sum += cardStrength(c, view.vira, view.rules);
      const score = all.length > 0 ? sum / (max * all.length) : 0;
      return score > 0.45 ? "play" : "fold";
    }
  };

  // src/players/genome.ts
  var SCALAR_COUNT = 5;
  var GENOME_LENGTH = CARD_FEATURE_COUNT + BET_FEATURE_COUNT + SCALAR_COUNT;
  function parseGenome(obj) {
    const g = obj;
    const okArr = (a, n) => Array.isArray(a) && a.length === n && a.every((x) => typeof x === "number");
    if (!okArr(g.cardWeights, CARD_FEATURE_COUNT)) {
      throw new Error(`cardWeights invalido (esperado ${CARD_FEATURE_COUNT} numeros).`);
    }
    if (!okArr(g.betWeights, BET_FEATURE_COUNT)) {
      throw new Error(`betWeights invalido (esperado ${BET_FEATURE_COUNT} numeros).`);
    }
    for (const k of ["thrCall", "thrAccept", "thrRaise", "pBluff", "playTemp"]) {
      if (typeof g[k] !== "number") throw new Error(`Campo ${k} ausente/invalido no genoma.`);
    }
    return {
      cardWeights: g.cardWeights,
      betWeights: g.betWeights,
      thrCall: g.thrCall,
      thrAccept: g.thrAccept,
      thrRaise: g.thrRaise,
      pBluff: g.pBluff,
      playTemp: g.playTemp
    };
  }

  // src/players/personalities.ts
  var melhorada1Genome = parseGenome(melhorada_1_default);
  var melhorada2Genome = parseGenome(melhorada_2_default);
  var PERSONALITIES = [
    {
      id: "inocente",
      label: "Inocente",
      description: "Heuristica simples (baseline).",
      create: (name) => new BotPlayer(name)
    },
    {
      id: "melhorada_1",
      label: "Melhorada 1",
      description: "Evoluida vs inocente. Forte no geral (~79% vs inocente).",
      create: (name, rng, onDecision) => new EvolvedBotPlayer(name, melhorada1Genome, rng, onDecision)
    },
    {
      id: "melhorada_2",
      label: "Melhorada 2",
      description: "Evoluida vs inocente+melhorada_1. Bate a melhorada_1 (~80%), mas fraca vs inocente.",
      create: (name, rng, onDecision) => new EvolvedBotPlayer(name, melhorada2Genome, rng, onDecision)
    }
  ];
  function getPersonality(id) {
    return PERSONALITIES.find((p) => p.id === id) ?? PERSONALITIES[0];
  }

  // src/cli/render.ts
  var SUIT_SYMBOL = {
    ["ouros" /* Ouros */]: "\u2666",
    ["espadas" /* Espadas */]: "\u2660",
    ["copas" /* Copas */]: "\u2665",
    ["paus" /* Paus */]: "\u2663"
  };
  function fmtCard(card) {
    return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
  }
  function teamName(team) {
    return `Equipe ${team + 1}`;
  }

  // src/web/browser-entry.ts
  function seededRng(seed) {
    let s = seed >>> 0;
    return () => {
      s = 1664525 * s + 1013904223 >>> 0;
      return s / 4294967296;
    };
  }
  async function simulate(options = {}) {
    const names = options.names ?? ["Bot A1", "Bot B1", "Bot A2", "Bot B2"];
    const out = [];
    const line = (s = "") => out.push(s);
    const fmtHand = (h) => h.map(fmtCard).join("  ");
    let playSeq = 0;
    const persA = getPersonality(options.teamABot ?? "melhorada_1");
    const persB = getPersonality(options.teamBBot ?? "inocente");
    const observer = {
      onMatchStart({ teamOfSeat }) {
        line("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
        line("            SIMULADOR DE TRUCO \u2014 bots vs bots");
        line("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
        names.forEach(
          (n, seat) => line(`   assento ${seat}: ${n}  \u2192  ${teamName(teamOfSeat[seat])}`)
        );
        line(`Inteligencia \u2192 ${teamName(0)}: ${persA.label}   \xD7   ${teamName(1)}: ${persB.label}`);
        line(`Variante: ${TRUCO_PAULISTA.name} \u2014 ate ${TRUCO_PAULISTA.pointsToWin} pontos.`);
      },
      onHandStart({ handNumber, firstSeat }) {
        playSeq = 0;
        line("");
        line("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
        line(`MAO ${handNumber}  \u2014  comeca ${names[firstSeat]}`);
      },
      onDeal({ vira, manilha, hands }) {
        line(`Vira: ${fmtCard(vira)}  \u2192  manilha desta mao: ${manilha}`);
        hands.forEach(
          (h, seat) => line(`   ${names[seat].padEnd(8)} ${fmtHand(h)}`)
        );
      },
      onMaoDeOnze({ mode, teamAt11, value }) {
        if (mode === "single") {
          line(`*** MAO DE ONZE: ${teamName(teamAt11)} esta com 11 \u2014 sem truco, vale ${value}. A dupla decide jogar ou correr. ***`);
        } else {
          line(`*** MAO DE ONZE 11x11: jogada FECHADA (as cegas), vale ${value}, sem truco. ***`);
        }
      },
      onMaoDeOnzeDecision({ team, decision }) {
        line(`   >>> ${teamName(team)} decidiu: ${decision === "play" ? "JOGAR" : "CORRER"}.`);
      },
      onPlay({ seat, card }) {
        playSeq++;
        line(`   (${playSeq}o) ${names[seat].padEnd(8)} joga ${fmtCard(card)}`);
      },
      onRaiseProposed(p) {
        line(`   >>> ${names[p.proposer]} PEDE ${p.name.toUpperCase()} (vale ${p.value}; se correrem, leva ${p.forfeitValue})`);
      },
      onRaiseResponse({ responder, response }) {
        const label = response === "accept" ? "ACEITA" : response === "run" ? "CORRE" : "AUMENTA";
        line(`   <<< ${names[responder]} ${label}`);
      },
      onVazaResolved({ vazaIndex, result }) {
        const who = result.winningTeam === null ? "EMPATE" : teamName(result.winningTeam);
        line(`   = Vaza ${vazaIndex + 1}: ${who}`);
        playSeq = 0;
      },
      onScoreUpdate({ result, scores }) {
        const motivo = result.reason === "fold" ? "adversario correu (mao de onze)" : result.reason === "run" ? "adversario correu o truco" : result.reason === "cancelled" ? "mao anulada" : "venceu as vazas";
        const ganho = result.winningTeam === null ? "ninguem pontua" : `${teamName(result.winningTeam)} +${result.points}`;
        line(`>> ${ganho} (${motivo}).`);
        line(`   PLACAR: ${scores.map((s, t) => `${teamName(t)} ${s}`).join("   |   ")}`);
      },
      onMatchEnd({ winningTeam, scores }) {
        line("");
        line("\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588");
        line(`  ${teamName(winningTeam)} VENCEU A PARTIDA  (${scores.map((s, t) => `${teamName(t)} ${s}`).join("  |  ")})`);
        line("\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588");
      }
    };
    const onDecision = options.explain ? (info) => {
      if (info.raised) line(formatBetting(info.betting, info.name));
      else if (info.cardChoice) line(formatCardChoice(info.cardChoice, info.name));
    } : void 0;
    const players = names.map((n, seat) => {
      const pers = seat % 2 === 0 ? persA : persB;
      const rng = options.seed === void 0 ? void 0 : seededRng(options.seed * 100 + seat + 1);
      return pers.create(n, rng, onDecision);
    });
    await playMatch({
      rules: TRUCO_PAULISTA,
      players,
      observer,
      rng: options.seed === void 0 ? void 0 : seededRng(options.seed),
      initialScores: options.initialScores
    });
    return out;
  }
  return __toCommonJS(browser_entry_exports);
})();
