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

  // src/web/index.ts
  var index_exports = {};
  __export(index_exports, {
    CALC_POLICIES: () => CALC_POLICIES,
    PERSONALITIES: () => PERSONALITIES,
    Rank: () => Rank,
    Suit: () => Suit,
    TRUCO_PAULISTA: () => TRUCO_PAULISTA,
    calcScenario: () => calcScenario,
    cardStrength: () => cardStrength,
    cardToString: () => cardToString,
    fmtCard: () => fmtCard,
    manilhaRank: () => manilhaRank,
    playInteractive: () => playInteractive,
    resolveVaza: () => resolveVaza,
    simulate: () => simulate,
    teamName: () => teamName
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
  var Suit = /* @__PURE__ */ ((Suit2) => {
    Suit2["Ouros"] = "ouros";
    Suit2["Espadas"] = "espadas";
    Suit2["Copas"] = "copas";
    Suit2["Paus"] = "paus";
    return Suit2;
  })(Suit || {});
  var Rank = /* @__PURE__ */ ((Rank3) => {
    Rank3["Quatro"] = "4";
    Rank3["Cinco"] = "5";
    Rank3["Seis"] = "6";
    Rank3["Sete"] = "7";
    Rank3["Dama"] = "Q";
    Rank3["Valete"] = "J";
    Rank3["Rei"] = "K";
    Rank3["As"] = "A";
    Rank3["Dois"] = "2";
    Rank3["Tres"] = "3";
    return Rank3;
  })(Rank || {});
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

  // src/players/consult.ts
  function signalLevel(hand, vira, rules) {
    if (hand.some((c) => isManilha(c, vira, rules))) return 2;
    if (hand.some((c) => c.rank === "3" /* Tres */)) return 1;
    return 0;
  }
  function trucoAdviceLevel(hand, vira, rules) {
    const man = hand.filter((c) => isManilha(c, vira, rules)).length;
    const big = hand.filter((c) => c.rank === "3" /* Tres */ || c.rank === "2" /* Dois */).length;
    if (man >= 1 || big >= 2) return 2;
    if (big >= 1) return 1;
    return 0;
  }
  function canWinLevel(hand, vira, rules, oppBestStrength) {
    if (hand.length === 0) return 0;
    const myBest = Math.max(...hand.map((c) => cardStrength(c, vira, rules)));
    const hasMan = hand.some((c) => isManilha(c, vira, rules));
    if (myBest > oppBestStrength && hasMan) return 2;
    if (myBest > oppBestStrength) return 1;
    return 0;
  }
  function partnerSignalsOf(hand, vira, rules, oppBestStrength) {
    return {
      signal: signalLevel(hand, vira, rules),
      canWin: canWinLevel(hand, vira, rules, oppBestStrength),
      trucoAdvice: trucoAdviceLevel(hand, vira, rules)
    };
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
    const broadcast = (ev) => {
      for (let i = 0; i < n; i++) players[i].observe?.(ev, i);
    };
    const emitHandEnd = (r) => {
      observer?.onHandEnd?.(r);
      broadcast({ type: "handEnd", winningTeam: r.winningTeam, points: r.points });
    };
    broadcast({ type: "handStart", teamOfSeat, vira });
    const partnerSeat = (seat) => {
      for (let k = 1; k < n; k++) {
        const s = (seat + k) % n;
        if (teamOfSeat[s] === teamOfSeat[seat]) return s;
      }
      return -1;
    };
    const buildView = (seat, currentVazaPlays) => {
      let partnerSignals;
      const pSeat = partnerSeat(seat);
      if (!blind && pSeat >= 0) {
        let oppBest = -1;
        for (const p of currentVazaPlays) {
          if (teamOfSeat[p.seat] !== teamOfSeat[seat]) {
            const s = cardStrength(p.card, vira, rules);
            if (s > oppBest) oppBest = s;
          }
        }
        partnerSignals = partnerSignalsOf(hands[pSeat], vira, rules, oppBest);
      }
      return {
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
        blind,
        partnerSignals
      };
    };
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
        emitHandEnd(result);
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
        broadcast({
          type: "raiseProposed",
          seat: proposer,
          team: proposingTeam,
          level: lvl.index,
          value: lvl.value
        });
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
        broadcast({
          type: "raiseResponse",
          seat: responderSeat,
          team: teamOfSeat[responderSeat],
          response,
          proposingTeam
        });
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
              emitHandEnd(result2);
              return result2;
            }
            continue;
          }
          if (action.type === "fold") {
            const oppSeat = firstOpponentAfter(seat, team, teamOfSeat);
            const result2 = {
              winningTeam: teamOfSeat[oppSeat],
              points: valueNow(),
              reason: "giveup"
            };
            emitHandEnd(result2);
            return result2;
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
          broadcast({ type: "play", seat, team, card: action.card, vazaIndex: v });
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
        emitHandEnd(handResult);
        return handResult;
      }
      if (decision !== "continue") {
        const handResult = {
          winningTeam: decision,
          points: valueNow(),
          reason: "vazas"
        };
        emitHandEnd(handResult);
        return handResult;
      }
      if (result.winningSeat !== null) leader = result.winningSeat;
    }
    const fallback = {
      winningTeam: null,
      points: 0,
      reason: "cancelled"
    };
    emitHandEnd(fallback);
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

  // src/genomes/melhorada_3.json
  var melhorada_3_default = {
    cardWeights: [
      0.02330786737004622,
      -0.9528627996735958,
      1.1472020354997619,
      1.091080833844001,
      -0.5828416002387864,
      0.03216497285727998,
      -0.9676469159656421,
      -1.877298532820676,
      -0.47161881463357697,
      1.096694147493814,
      0.10316231364960612,
      -0.5532868228285285,
      -2.127267662413126,
      0.08132129437937981,
      1.321142053209161,
      -0.6735068717616628,
      -1.2627473189251157,
      0.6657864214458842,
      -0.9096542568390997,
      -0.27660694630252325
    ],
    betWeights: [
      0.23666479945597937,
      -0.46792159047393866,
      0.8920081049161471,
      0.17366970655162514,
      1.4887789802698963,
      -0.4874670055677193,
      -0.39882859953057126,
      0.15650168784839028,
      1.3381974934333871,
      0.3639033801148371,
      2.230572372849126,
      -0.5546358425529001,
      0.08087923799251238,
      0.22885684254344285,
      2.0256414057930163,
      -0.669340520302993,
      0.11318817435540586,
      0.21871189104718378
    ],
    thrCall: 1.5131061321590165,
    thrAccept: 1.6323383596479375,
    thrRaise: 1.4361679643698224,
    pBluff: -2.4694821155084985,
    playTemp: 0.005161231686963019
  };

  // src/genomes/melhorada_4.json
  var melhorada_4_default = {
    cardWeights: [
      -0.9734242666737752,
      -0.38299549021014323,
      1.2741312815690071,
      1.6659563867070486,
      -0.5780774336706427,
      -0.10924197550960037,
      -0.6842587621418892,
      -1.8539148722022234,
      0.9635608622504561,
      -0.6340666766289855,
      -0.23254128901402144,
      -0.2001646835044764,
      0.2355730615108909,
      -0.11315815440720872,
      -0.6457507122488508,
      -1.0791133747851782,
      -0.3561594562119179,
      0.528110211813976,
      0,
      0.024660049444437088
    ],
    betWeights: [
      -0.517630620371592,
      1.709974169979617,
      1.3513221798057715,
      2.18919408499585,
      0.7542154401446286,
      -0.17669196043986563,
      -0.6078075280184025,
      -0.5870389070436766,
      1.3401803564224046,
      -0.30203262124442554,
      0.7535942366891537,
      0.6140374220160373,
      -0.7068571724899022,
      0.0295263416949994,
      0.06865829783284376,
      -0.5800347668996203,
      0.880426939820059,
      0.4771636022442203
    ],
    thrCall: 1.1912638895914758,
    thrAccept: 0.7825738185398353,
    thrRaise: 1.6328746456778092,
    pBluff: -2.3173098535036174,
    playTemp: 0.16634355428470296,
    cardBucketThresholds: [
      0.7394416229412754,
      -0.6242468593081935,
      0.6201091220979353,
      -0.006277585916141859,
      0.4992975869580281,
      0.9176208463170513,
      0.6577572065973594,
      0.501328432199208,
      0.7797613831992927
    ],
    cardBucketWeights: [
      0.1987764784607848,
      -0.15990470249869515,
      0.03691170526427203,
      -0.10296209072694182,
      -0.16981662827844754,
      -0.01767976195740694,
      -0.041093023483813704,
      -0.06759781390878054,
      0.38237763242509015,
      0.28534553716546057,
      -0.2476273307014858,
      -0.18942527107471147
    ],
    betBucketThresholds: [
      0.240868774660282,
      0.302815759946163,
      0.5491092699034624,
      0.12838510672893433,
      0.25677039657515593,
      -0.5588687386429264,
      0.4649854487652979,
      0.4526305983522664,
      0.9024653218038117
    ],
    betBucketWeights: [
      -0.0694429327917203,
      0.03052499625243548,
      -0.07085922695256887,
      0.04338522969017691,
      0.34561216078378804,
      0.4222959352846311,
      0.3399511061671423,
      0.11740861737739418,
      -0.5002593331443941,
      0.2855723319007034,
      -0.10903765245461222,
      -0.22123105693687042
    ]
  };

  // src/genomes/melhorada_5.json
  var melhorada_5_default = {
    cardWeights: [
      -0.4,
      0.8527174017274575,
      1.3314953692532976,
      1.4258957416801101,
      0.7189975000420961,
      0.46741507400150006,
      -1.3040695303454708,
      1.1091449382415721,
      0.056096447674423205,
      -1.0172114742998444,
      -1.0428773746596587,
      1.4116927662511516,
      -0.662694671721126,
      -1.4221462529980824,
      -1.3698649585996745,
      -0.07806449802580273,
      0.46008742149481063,
      -1.1152387155459338,
      1.1104890319984406,
      -0.6285584886293736
    ],
    betWeights: [
      0.7412285696755433,
      0.18328080940142988,
      -0.8618911233976723,
      2.0623423879509786,
      0.6417907369245979,
      -0.5461946867674344,
      -0.45021429988545364,
      0.49095828476230124,
      0.27865016924802605,
      -1.0808802564027546,
      0.38080979732413833,
      1.5230735926721863,
      0.7855379964377699,
      -0.3702097130531178,
      0.11390345855072698,
      -0.869137422285807,
      0.5042569420729061,
      -0.19123975730259962
    ],
    thrCall: 1.8701386297571247,
    thrAccept: -0.2676352033381372,
    thrRaise: 1.240486222418571,
    pBluff: -2.5287625732604373,
    playTemp: -0.9632571338157194,
    cardBucketThresholds: [
      1.0978962404784083,
      0.1085576797151658,
      0.08928533875802563,
      0.26238586288288807,
      0.3771705787226072,
      0.5674288551175806,
      0.27193736631908755,
      0.3739449715596137,
      0.7338789662982818
    ],
    cardBucketWeights: [
      -0.207579655056919,
      0.12731933316200914,
      0.20066006604292153,
      0.0551434868420931,
      -0.11055494500918639,
      -0.13581453518526101,
      -0.037228851710713246,
      0.03728301709116792,
      0.16414316649056052,
      -0.4256390175720041,
      -0.3912226848483321,
      -0.3986327489514254
    ],
    betBucketThresholds: [
      0.6316030888656244,
      1.1765637501981314,
      0.0847963234031619,
      0.07805969796092863,
      0.31884510514228304,
      1.2752715912317065,
      0.6035569468062155,
      0.808734097854375,
      0.13228455933515762
    ],
    betBucketWeights: [
      -0.4339711591454882,
      -0.2710633079960528,
      -0.1418770127471375,
      -0.24651988174555917,
      0.2258468206290144,
      -0.19652634873106156,
      -0.2402803556609027,
      0.5796801002306381,
      -0.23841951689157642,
      0.38694615531550364,
      0.11352712409429555,
      0.11702368678465731
    ]
  };

  // src/genomes/melhorada_6.json
  var melhorada_6_default = {
    cardWeights: [
      -0.22578993346299892,
      -0.9068899381607889,
      1.7534961985855564,
      1.6288936674784673,
      0.791171222276303,
      -0.28885488713388874,
      -1.1954879760960795,
      -2.7038943655471472,
      0.654266519605091,
      -0.7112835444048878,
      -0.006965842354839838,
      1763163607279017e-19,
      -0.5586734905464822,
      -0.6730720302027654,
      -0.022080842604697337,
      0.20684932165874065,
      -0.5889503472954555,
      -1.2053875528035682,
      -1.3173966380075224,
      -0.3006664245322686
    ],
    betWeights: [
      -0.3616680587917174,
      0.9703532543499023,
      1.3115563623593873,
      2.075876417313022,
      0.6806729351727765,
      -0.6963913796460156,
      -1.437725080129685,
      0.9995463616862647,
      1.6522634373926923,
      -0.03739906528506987,
      0.8319185996676355,
      -0.30598660992664356,
      -0.10773202983098727,
      -0.21591694368034603,
      -0.014364459644615121,
      -0.9898762618803658,
      0.5947847090823822,
      0.2568162377689622,
      0.09595201708317541,
      -0.03485351890608802
    ],
    thrCall: 1.6986662337955925,
    thrAccept: -0.5771082665716245,
    thrRaise: 1.5092827362817256,
    pBluff: -2.568657993705654,
    playTemp: -0.890157880049659,
    cardBucketThresholds: [
      0.9630698348671332,
      0.41516923606387707,
      0.6852848261512783,
      0.13666691517649188,
      0.5525456300097613,
      0.5762108479712053,
      0.15092260356345838,
      0.4762582188362056,
      0.6175107051808801
    ],
    cardBucketWeights: [
      -0.08613318169275315,
      -0.03707469364925106,
      0.07408139569001534,
      0.029974919473882113,
      0.0012481302909117253,
      -0.13669415520257322,
      0.24860559434883556,
      0.057090914251128375,
      0.050801699196029816,
      -0.27947527111927517,
      -0.1451863839384302,
      -0.33229942449211763
    ],
    betBucketThresholds: [
      0.7973153384094868,
      1.2472587699684168,
      0.17607703171632197,
      0.1597867063776348,
      0.9074383051383244,
      -0.7579143370528707,
      0.263858049983593,
      0.8491327908508797,
      1.6730227667160358
    ],
    betBucketWeights: [
      0.01491282904657091,
      -0.1999017894357682,
      -0.015392200821511576,
      0.274996072609051,
      0.27847638268348945,
      0.1403559954385874,
      0.05704341184412216,
      0.4720166177144881,
      0.026710440302213964,
      0.08946608607459709,
      -0.028093307329962902,
      -0.11338242645558944
    ]
  };

  // src/genomes/melhorada_7.json
  var melhorada_7_default = {
    cardWeights: [
      -0.48200256782841705,
      -1.0947051290095615,
      1.3823347779241986,
      1.4220299831117267,
      0.5405975579212292,
      -0.09045291411010961,
      -1.2715616780018062,
      -2.7038943655471472,
      0.6325969957760517,
      -0.9156567541134111,
      0.3615464664225621,
      -0.1379581963158255,
      -0.5586734905464822,
      -0.7798472793204702,
      -0.0672392808122906,
      0.03329758586033277,
      0.2312091137809679,
      -1.530052002795428,
      -1.388971077034883,
      0.420890545676497
    ],
    betWeights: [
      -0.34459903971076,
      0.9703532543499023,
      1.4741128628398268,
      2.0071182590168526,
      0.7296489675533383,
      -1.4703617430229812,
      -1.3418654515931798,
      0.9404809227579113,
      1.6129744050958474,
      -0.20374674199044263,
      1.1775737161793938,
      0.5410375805448779,
      0.7195375101642156,
      -0.32536598194447536,
      -0.014364459644615121,
      -0.8931996958420775,
      0.5373111790512187,
      0.43661552864132613,
      -0.30431412156419385,
      -0.06511713883514672,
      -0.004673585897117895,
      0.1219786444743601,
      -0.12061101426997364,
      0.10137004062691303
    ],
    thrCall: 1.394266389833835,
    thrAccept: -0.7206226748783386,
    thrRaise: 2.09903920704878,
    pBluff: -2.7054867713592445,
    playTemp: 0.2967444670767607,
    cardBucketThresholds: [
      0.9318554942054279,
      0.5334543441901962,
      0.9472511185111175,
      -0.23060100755079765,
      0.05502748043157177,
      0.8621481473318753,
      -0.11393735819787715,
      0.41356484940778,
      0.875915456299261
    ],
    cardBucketWeights: [
      -0.40896071319368554,
      -0.18431248771714304,
      0.20047980460066456,
      -0.20781015067606778,
      0.0012481302909117253,
      -0.14931046332489062,
      0.335964765083749,
      0.057090914251128375,
      -0.47641091862690077,
      -0.17202388583302877,
      -0.3463986496829305,
      -0.08548348796325504
    ],
    betBucketThresholds: [
      1.1127652122457468,
      1.0641270331131423,
      0.8862017315876769,
      0.16808187627485943,
      1.2335404239573216,
      -0.8053213788612419,
      -0.16863903039999856,
      0.6197749180754631,
      1.7513992572010129
    ],
    betBucketWeights: [
      -0.07077556730212393,
      0.09841458672707237,
      -0.31590447366783364,
      0.274996072609051,
      -0.7788995703761346,
      -0.48851387506608485,
      -0.565665619964632,
      0.3660110816049989,
      0.21518689003027097,
      -0.025165785734406226,
      -0.20485268069742313,
      -0.4790107787661747
    ]
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
  var GTO_FEATURE_COUNT = 2;
  var OPP_FEATURE_COUNT = 4;
  var CARD_FEATURE_COUNT = CARD_OWN_FEATURE_COUNT + CONTEXT_FEATURE_COUNT;
  var BET_FEATURE_COUNT = HAND_STRENGTH_FEATURE_COUNT + CONTEXT_FEATURE_COUNT + GTO_FEATURE_COUNT + OPP_FEATURE_COUNT;
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
  var GTO_FEATURE_NAMES = ["bluffability", "aFrenteTarde"];
  var OPP_FEATURE_NAMES = ["oppFold", "oppTruco", "oppBluff", "oppAggr"];
  var NEUTRAL_OPP_FEATURES = new Array(OPP_FEATURE_COUNT).fill(0.5);
  var BET_FEATURE_NAMES = [
    ...HAND_STRENGTH_FEATURE_NAMES,
    ...CONTEXT_FEATURE_NAMES,
    ...GTO_FEATURE_NAMES,
    ...OPP_FEATURE_NAMES
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
  function betFeatures(view, pre, oppFeatures = NEUTRAL_OPP_FEATURES) {
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
    const results = view.completedVazaResults;
    const bluffability = Math.max(0, 0.5 - avg) * 2;
    const wonFirst = results.length >= 1 && results[0].winningTeam === view.team ? 1 : 0;
    const vazaNorm = cpp > 1 ? results.length / (cpp - 1) : 0;
    const aFrenteTarde = wonFirst * Math.min(1, vazaNorm);
    return [...strength, ...pre.context, bluffability, aFrenteTarde, ...oppFeatures];
  }

  // src/players/buckets.ts
  var N_BUCKETS = 4;
  var CARD_BUCKET_VARS = [
    { name: "pWin", index: 3, min: 0, max: 1 },
    { name: "fracMaisFortes", index: 4, min: 0, max: 1 },
    { name: "forcaRelativa", index: 6, min: 0, max: 1 }
  ];
  var BET_BUCKET_VARS = [
    { name: "forcaMedia", index: 1, min: 0, max: 1 },
    { name: "difPlacar", index: 15, min: -1, max: 1 },
    { name: "valorEmJogo", index: 17, min: 0, max: 1 }
  ];
  var THRESH_PER_VAR = N_BUCKETS - 1;
  var WEIGHTS_PER_VAR = N_BUCKETS;
  var CARD_THRESH_COUNT = CARD_BUCKET_VARS.length * THRESH_PER_VAR;
  var CARD_BUCKET_W_COUNT = CARD_BUCKET_VARS.length * WEIGHTS_PER_VAR;
  var BET_THRESH_COUNT = BET_BUCKET_VARS.length * THRESH_PER_VAR;
  var BET_BUCKET_W_COUNT = BET_BUCKET_VARS.length * WEIGHTS_PER_VAR;
  function bucketIndex(raw, min, max, thresholds) {
    const span = max - min || 1;
    const x = Math.min(1, Math.max(0, (raw - min) / span));
    const sorted = [...thresholds].sort((a, b) => a - b);
    let i = 0;
    for (const t of sorted) {
      if (x >= t) i++;
      else break;
    }
    return i;
  }

  // src/players/score.ts
  function dot(weights, features) {
    let s = 0;
    for (let i = 0; i < weights.length; i++) s += weights[i] * features[i];
    return s;
  }
  function bucketContribs(featureValues, vars, thresholds, weights) {
    const out = [];
    for (let v = 0; v < vars.length; v++) {
      const cfg = vars[v];
      const raw = featureValues[cfg.index];
      const thr = thresholds.slice(v * THRESH_PER_VAR, (v + 1) * THRESH_PER_VAR);
      const b = bucketIndex(raw, cfg.min, cfg.max, thr);
      out.push({ name: cfg.name, bucket: b, value: raw, weight: weights[v * N_BUCKETS + b] });
    }
    return out;
  }
  function cardScoreParts(genome, view, card, pre) {
    const feats = cardFeatures(view, card, pre);
    const linear = dot(genome.cardWeights, feats);
    const buckets = bucketContribs(
      feats,
      CARD_BUCKET_VARS,
      genome.cardBucketThresholds,
      genome.cardBucketWeights
    );
    const bucketSum = buckets.reduce((s, b) => s + b.weight, 0);
    return { score: linear + bucketSum, linear, buckets };
  }
  function situationScoreParts(genome, view, pre, oppFeatures) {
    const feats = betFeatures(view, pre, oppFeatures);
    const linear = dot(genome.betWeights, feats);
    const buckets = bucketContribs(
      feats,
      BET_BUCKET_VARS,
      genome.betBucketThresholds,
      genome.betBucketWeights
    );
    const bucketSum = buckets.reduce((s, b) => s + b.weight, 0);
    return { score: linear + bucketSum, linear, buckets };
  }
  function cardScore(genome, view, card, pre) {
    return cardScoreParts(genome, view, card, pre).score;
  }
  function situationScore(genome, view, pre, oppFeatures) {
    return situationScoreParts(genome, view, pre, oppFeatures).score;
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
  function bucketToContribs(buckets, baseIndex) {
    return buckets.map((b, v) => ({
      index: baseIndex + v,
      name: `${b.name}[b${b.bucket}]`,
      value: b.value,
      weight: b.weight,
      contribution: b.weight
      // indicador da faixa ativa = 1 -> contribuicao = peso
    }));
  }
  function explainCardChoice(genome, view) {
    const pre = precompute(view);
    const cards = view.hand.map((card) => {
      const lin = build(CARD_FEATURE_NAMES, genome.cardWeights, cardFeatures(view, card, pre));
      const parts = cardScoreParts(genome, view, card, pre);
      const contributions = [
        ...lin.contributions,
        ...bucketToContribs(parts.buckets, CARD_FEATURE_COUNT)
      ];
      return { card, score: parts.score, contributions, chosen: false };
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
    const lin = build(BET_FEATURE_NAMES, genome.betWeights, betFeatures(view, pre));
    const parts = situationScoreParts(genome, view, pre);
    const contributions = [
      ...lin.contributions,
      ...bucketToContribs(parts.buckets, BET_FEATURE_COUNT)
    ];
    return {
      s: parts.score,
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
  function sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }
  var BET_MARGIN = 0.6;
  var BET_NUDGE = 0.6;
  var CARD_MARGIN = 0.4;
  var CARD_NUDGE = 0.6;
  var EvolvedBotPlayer = class {
    constructor(name, genome, rng = Math.random, onDecision, ignoreSignals = false, opponentModel) {
      this.name = name;
      this.genome = genome;
      this.rng = rng;
      this.onDecision = onDecision;
      this.ignoreSignals = ignoreSignals;
      this.opponentModel = opponentModel;
    }
    /** Recebe os eventos da partida e atualiza o modelo de oponente (se houver). */
    observe(event, selfSeat) {
      this.opponentModel?.observe(event, selfSeat);
    }
    /** Sinais do parceiro (undefined se a comunicacao esta desligada). */
    signals(view) {
      return this.ignoreSignals ? void 0 : view.partnerSignals;
    }
    /** Score S da situacao para decisoes de aposta (linear + faixas + modelo de oponente). */
    situationScore(view) {
      return situationScore(this.genome, view, precompute(view), this.opponentModel?.features());
    }
    async chooseAction(view, canRaise) {
      if (canRaise && !view.blind) {
        const s = this.situationScore(view);
        let propose = s > this.genome.thrCall;
        const ps = this.signals(view);
        if (ps && Math.abs(s - this.genome.thrCall) < BET_MARGIN) {
          propose = s + BET_NUDGE * (ps.trucoAdvice - 1) > this.genome.thrCall;
        }
        const bluff = this.rng() < sigmoid(this.genome.pBluff);
        if (propose || bluff) {
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
      const scores = hand.map((c) => cardScore(this.genome, view, c, pre));
      const ps = this.signals(view);
      if (ps) {
        const sorted = [...scores].sort((a, b) => b - a);
        if ((sorted[0] ?? 0) - (sorted[1] ?? 0) < CARD_MARGIN) {
          const max = view.rules.rankOrder.length + view.rules.manilhaSuitOrder.length - 1;
          for (let i = 0; i < scores.length; i++) {
            const strNorm = cardStrength(hand[i], view.vira, view.rules) / max;
            scores[i] += CARD_NUDGE * (1 - ps.canWin) * strNorm;
          }
        }
      }
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
      let accept = s > this.genome.thrAccept;
      const ps = this.signals(view);
      if (ps && Math.abs(s - this.genome.thrAccept) < BET_MARGIN) {
        accept = s + BET_NUDGE * (ps.trucoAdvice - 1) > this.genome.thrAccept;
      }
      return accept ? "accept" : "run";
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
  var GENOME_LENGTH = CARD_FEATURE_COUNT + BET_FEATURE_COUNT + SCALAR_COUNT + CARD_THRESH_COUNT + CARD_BUCKET_W_COUNT + BET_THRESH_COUNT + BET_BUCKET_W_COUNT;
  function spreadThresholds(numVars) {
    const out = [];
    for (let v = 0; v < numVars; v++) {
      for (let k = 1; k < N_BUCKETS; k++) out.push(k / N_BUCKETS);
    }
    return out;
  }
  function parseGenome(obj) {
    const g = obj;
    const okArr = (a, n) => Array.isArray(a) && a.length === n && a.every((x) => typeof x === "number");
    if (!okArr(g.cardWeights, CARD_FEATURE_COUNT)) {
      throw new Error(`cardWeights invalido (esperado ${CARD_FEATURE_COUNT} numeros).`);
    }
    const cardWeights = g.cardWeights;
    const base = HAND_STRENGTH_FEATURE_COUNT + CONTEXT_FEATURE_COUNT;
    const KNOWN_BET = /* @__PURE__ */ new Set([base, base + GTO_FEATURE_COUNT, BET_FEATURE_COUNT]);
    const bw = g.betWeights;
    if (!Array.isArray(bw) || !bw.every((x) => typeof x === "number") || !KNOWN_BET.has(bw.length)) {
      throw new Error(`betWeights invalido (esperado um de ${[...KNOWN_BET].join("/")} numeros).`);
    }
    const betWeights = bw.length === BET_FEATURE_COUNT ? bw : [...bw, ...new Array(BET_FEATURE_COUNT - bw.length).fill(0)];
    for (const k of ["thrCall", "thrAccept", "thrRaise", "pBluff", "playTemp"]) {
      if (typeof g[k] !== "number") throw new Error(`Campo ${k} ausente/invalido no genoma.`);
    }
    const bucket = (a, n, fill) => okArr(a, n) ? a : fill;
    return {
      cardWeights,
      betWeights,
      thrCall: g.thrCall,
      thrAccept: g.thrAccept,
      thrRaise: g.thrRaise,
      pBluff: g.pBluff,
      playTemp: g.playTemp,
      cardBucketThresholds: bucket(
        g.cardBucketThresholds,
        CARD_THRESH_COUNT,
        spreadThresholds(CARD_BUCKET_VARS.length)
      ),
      cardBucketWeights: bucket(
        g.cardBucketWeights,
        CARD_BUCKET_W_COUNT,
        new Array(CARD_BUCKET_W_COUNT).fill(0)
      ),
      betBucketThresholds: bucket(
        g.betBucketThresholds,
        BET_THRESH_COUNT,
        spreadThresholds(BET_BUCKET_VARS.length)
      ),
      betBucketWeights: bucket(
        g.betBucketWeights,
        BET_BUCKET_W_COUNT,
        new Array(BET_BUCKET_W_COUNT).fill(0)
      )
    };
  }

  // src/players/opponentModel.ts
  var OpponentModel = class {
    constructor(rules) {
      this.rules = rules;
    }
    myTeam = -1;
    teamOfSeat = [];
    vira = null;
    // Respostas do oponente aos NOSSOS trucos (foldToTruco).
    ourAnswered = 0;
    oppRuns = 0;
    // Iniciativa de truco do oponente.
    hands = 0;
    oppProposals = 0;
    // Blefe: maos em que o oponente trucou e a melhor carta dele foi fraca.
    oppProposalHands = 0;
    oppBluffHands = 0;
    // Agressao: forca media (normalizada) das cartas jogadas pelo oponente.
    playSum = 0;
    playCount = 0;
    // Estado temporario da mao corrente.
    handOppProposed = false;
    handOppMaxStrNorm = -1;
    isOpp(team) {
      return this.myTeam >= 0 && team !== this.myTeam;
    }
    observe(ev, selfSeat) {
      switch (ev.type) {
        case "handStart": {
          this.teamOfSeat = ev.teamOfSeat;
          this.myTeam = ev.teamOfSeat[selfSeat];
          this.vira = ev.vira;
          this.hands++;
          this.handOppProposed = false;
          this.handOppMaxStrNorm = -1;
          break;
        }
        case "play": {
          if (this.isOpp(ev.team) && this.vira) {
            const max = this.rules.rankOrder.length + this.rules.manilhaSuitOrder.length - 1;
            const norm = cardStrength(ev.card, this.vira, this.rules) / max;
            this.playSum += norm;
            this.playCount++;
            if (norm > this.handOppMaxStrNorm) this.handOppMaxStrNorm = norm;
          }
          break;
        }
        case "raiseProposed": {
          if (this.isOpp(ev.team)) {
            this.oppProposals++;
            this.handOppProposed = true;
          }
          break;
        }
        case "raiseResponse": {
          if (this.isOpp(ev.team) && ev.proposingTeam === this.myTeam) {
            this.ourAnswered++;
            if (ev.response === "run") this.oppRuns++;
          }
          break;
        }
        case "handEnd": {
          if (this.handOppProposed) {
            this.oppProposalHands++;
            if (this.handOppMaxStrNorm >= 0 && this.handOppMaxStrNorm < 0.5) this.oppBluffHands++;
          }
          break;
        }
      }
    }
    /** Features [0,1] com suavizacao Beta(1,1) -> 0.5 sem dados. */
    features() {
      const beta = (a, n) => (a + 1) / (n + 2);
      const oppFold = beta(this.oppRuns, this.ourAnswered);
      const oppTruco = beta(this.oppProposals, this.hands);
      const oppBluff = beta(this.oppBluffHands, this.oppProposalHands);
      const oppAggr = this.playCount > 0 ? (this.playSum + 0.5) / (this.playCount + 1) : 0.5;
      return [oppFold, oppTruco, oppBluff, oppAggr];
    }
  };

  // src/players/personalities.ts
  var melhorada1Genome = parseGenome(melhorada_1_default);
  var melhorada2Genome = parseGenome(melhorada_2_default);
  var melhorada3Genome = parseGenome(melhorada_3_default);
  var melhorada4Genome = parseGenome(melhorada_4_default);
  var melhorada5Genome = parseGenome(melhorada_5_default);
  var melhorada6Genome = parseGenome(melhorada_6_default);
  var melhorada7Genome = parseGenome(melhorada_7_default);
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
    },
    {
      id: "melhorada_3",
      label: "Melhorada 3",
      description: "Round-robin (pior caso) vs o pool. Ganha de inocente/m1/m2 (pior matchup ~68%).",
      create: (name, rng, onDecision) => new EvolvedBotPlayer(name, melhorada3Genome, rng, onDecision)
    },
    {
      id: "melhorada_4",
      label: "Melhorada 4",
      description: "Nao-linear (features em faixas) round-robin. Bate a m3 (~63%).",
      create: (name, rng, onDecision) => new EvolvedBotPlayer(name, melhorada4Genome, rng, onDecision)
    },
    {
      id: "melhorada_5",
      label: "Melhorada 5",
      description: "Fitness ponderado (ultima domina) + piso 50%. Ganha de TODAS, inclusive m4 (~52%).",
      create: (name, rng, onDecision) => new EvolvedBotPlayer(name, melhorada5Genome, rng, onDecision)
    },
    {
      id: "melhorada_6",
      label: "Melhorada 6",
      description: "Comunicacao minima (sinais do parceiro quando incerta) + intuicoes GTO de blefe.",
      create: (name, rng, onDecision) => new EvolvedBotPlayer(name, melhorada6Genome, rng, onDecision)
    },
    {
      id: "melhorada_7",
      label: "Melhorada 7",
      description: "Modela os adversarios (quem truca/corre/blefa) e adapta para explora-los.",
      create: (name, rng, onDecision) => new EvolvedBotPlayer(
        name,
        melhorada7Genome,
        rng,
        onDecision,
        false,
        new OpponentModel(TRUCO_PAULISTA)
      )
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

  // src/players/humanWeb.ts
  var HumanWebPlayer = class {
    constructor(name, hooks, consultProvider) {
      this.name = name;
      this.hooks = hooks;
      this.consultProvider = consultProvider;
    }
    chooseAction(view, canRaise) {
      const consult = this.consultProvider?.(view.seat);
      return new Promise(
        (resolve) => this.hooks.onActionPrompt({ view, canRaise, consult, resolve })
      );
    }
    respondToRaise(view, proposal, canCounter) {
      const consult = this.consultProvider?.(view.seat);
      return new Promise(
        (resolve) => this.hooks.onRaisePrompt({ view, proposal, canCounter, consult, resolve })
      );
    }
    decideMaoDeOnze(view, ctx) {
      return new Promise(
        (resolve) => this.hooks.onMaoOnzePrompt({ view, ctx, resolve })
      );
    }
  };

  // src/web/play-entry.ts
  function seededRng2(seed) {
    let s = seed >>> 0;
    return () => {
      s = 1664525 * s + 1013904223 >>> 0;
      return s / 4294967296;
    };
  }
  function withDelay(inner, ms) {
    const wait = () => new Promise((r) => setTimeout(r, ms));
    return {
      name: inner.name,
      async chooseAction(view, canRaise) {
        await wait();
        return inner.chooseAction(view, canRaise);
      },
      async respondToRaise(view, proposal, canCounter) {
        await wait();
        return inner.respondToRaise(view, proposal, canCounter);
      },
      async decideMaoDeOnze(view, ctx) {
        await wait();
        return inner.decideMaoDeOnze(view, ctx);
      }
    };
  }
  function partnerWrap(bot, human, deferRaise) {
    return {
      name: bot.name,
      chooseAction(view, canRaise) {
        return bot.chooseAction(view, deferRaise ? false : canRaise);
      },
      respondToRaise(view, proposal, canCounter) {
        return deferRaise ? human.respondToRaise(view, proposal, canCounter) : bot.respondToRaise(view, proposal, canCounter);
      },
      decideMaoDeOnze(view, ctx) {
        return human.decideMaoDeOnze(view, ctx);
      }
    };
  }
  async function playInteractive(opts, ui) {
    const rules = TRUCO_PAULISTA;
    const teamOfSeat = assignTeams(rules);
    const seats = opts.seats;
    const humanSeats = [];
    seats.forEach((s, i) => {
      if (s.kind === "human") humanSeats.push(i);
    });
    const partnerIsHuman = (seat) => teamOfSeat.some(
      (t, other) => other !== seat && t === teamOfSeat[seat] && humanSeats.includes(other)
    );
    const mkRng = (offset) => opts.seed === void 0 ? void 0 : seededRng2(opts.seed * 100 + offset);
    const delay = opts.stepDelayMs ?? 0;
    const allowPartnerRaise = opts.aiPartnerCanRaise !== false;
    let liveHands = [];
    let liveVira = null;
    let liveVaza = -1;
    let liveCurrentPlays = [];
    let liveScores = opts.initialScores ? opts.initialScores.slice() : new Array(rules.numTeams).fill(0);
    const partnerOf = (seat) => {
      const idx = teamOfSeat.findIndex(
        (t, other) => other !== seat && t === teamOfSeat[seat]
      );
      return idx >= 0 ? idx : seat;
    };
    const consultProvider = (seat) => {
      if (!liveVira) return void 0;
      const pSeat = partnerOf(seat);
      const team = teamOfSeat[seat];
      const vira = liveVira;
      const hand = () => liveHands[pSeat] ?? [];
      const str2 = (c) => cardStrength(c, vira, rules);
      return {
        partnerName: players[pSeat]?.name ?? "Parceiro",
        signal() {
          const h = hand();
          const lvl = signalLevel(h, vira, rules);
          const man = h.filter((c) => isManilha(c, vira, rules)).length;
          const three = h.filter((c) => c.rank === "3").length;
          if (lvl === 2) return { kind: "signal", level: 2, text: man > 1 ? `tenho ${man} manilhas! \u{1F4AA}` : "tenho manilha! \u{1F4AA}" };
          if (lvl === 1) return { kind: "signal", level: 1, text: three > 1 ? `tenho ${three} cartas 3 \u{1F44C}` : "tenho um 3 \u{1F44C}" };
          return { kind: "signal", level: 0, text: "n\xE3o tenho nada de especial \u{1F62C}" };
        },
        canWin() {
          const h = hand();
          if (!h.length) return { kind: "canWin", level: 0, text: "j\xE1 joguei minhas cartas" };
          const oppBest = liveCurrentPlays.filter((p) => teamOfSeat[p.seat] !== team).reduce((m, p) => Math.max(m, str2(p.card)), -1);
          const lvl = canWinLevel(h, vira, rules, oppBest);
          if (lvl === 2) return { kind: "canWin", level: 2, text: "fa\xE7o essa, pode deixar! \u{1F4AA}" };
          if (lvl === 1) return { kind: "canWin", level: 1, text: "tenho chance, vou tentar \u{1F91E}" };
          return { kind: "canWin", level: 0, text: "t\xE1 dif\xEDcil, n\xE3o conta comigo \u{1F62C}" };
        },
        trucoAdvice() {
          const h = hand();
          const lvl = trucoAdviceLevel(h, vira, rules);
          if (lvl === 2) return { kind: "truco", level: 2, text: "t\xF4 forte, pode pedir/aceitar! \u{1F525}" };
          if (lvl === 1) return { kind: "truco", level: 1, text: "d\xE1 pra encarar, mas com cuidado \u{1F914}" };
          return { kind: "truco", level: 0, text: "t\xF4 fraco, melhor n\xE3o \u{1F645}" };
        }
      };
    };
    const base = seats.map((cfg, seat) => {
      if (cfg.kind === "human") return new HumanWebPlayer(cfg.name, ui, consultProvider);
      const pers = getPersonality(cfg.botId);
      const onDecision = opts.explain ? (info) => {
        const text = info.raised ? formatBetting(info.betting, info.name) : info.cardChoice ? formatCardChoice(info.cardChoice, info.name) : "";
        if (text) ui.onEvent({ kind: "explain", seat, text });
      } : void 0;
      return pers.create(cfg.name ?? pers.label, mkRng(seat + 1), onDecision);
    });
    const humanMateOf = (seat) => teamOfSeat.findIndex(
      (t, other) => other !== seat && t === teamOfSeat[seat] && humanSeats.includes(other)
    );
    const players = base.map((p, seat) => {
      if (seats[seat].kind !== "ai") return p;
      const mate = partnerIsHuman(seat) ? humanMateOf(seat) : -1;
      if (mate >= 0) p = partnerWrap(p, base[mate], !allowPartnerRaise);
      if (delay > 0) p = withDelay(p, delay);
      return p;
    });
    const names = players.map((p) => p.name);
    const observer = {
      onMatchStart({ teamOfSeat: tos }) {
        const seatBots = seats.map((s) => s.kind === "ai" ? s.botId : null);
        ui.onEvent({ kind: "matchStart", teamOfSeat: tos, names, humanSeats, seatBots });
      },
      onHandStart({ handNumber, firstSeat }) {
        ui.onEvent({ kind: "handStart", handNumber, firstSeat });
      },
      onDeal({ vira, manilha, hands }) {
        liveHands = hands.map((h) => h.slice());
        liveVira = vira;
        liveVaza = -1;
        liveCurrentPlays = [];
        const threshold = rules.pointsToWin - 1;
        const blind = liveScores.filter((s) => s === threshold).length >= 2;
        const humanHands = {};
        if (!blind) for (const s of humanSeats) humanHands[s] = hands[s].slice();
        ui.onEvent({
          kind: "deal",
          vira,
          manilha,
          humanHands,
          handSizes: hands.map((h) => h.length),
          blind
        });
      },
      onMaoDeOnze({ mode, teamAt11, value }) {
        ui.onEvent({ kind: "maoDeOnze", mode, teamAt11, value });
      },
      onMaoDeOnzeDecision({ team, decision }) {
        ui.onEvent({ kind: "maoDeOnzeDecision", team, decision });
      },
      onPlay({ seat, card, vazaIndex }) {
        if (vazaIndex !== liveVaza) {
          liveVaza = vazaIndex;
          liveCurrentPlays = [];
        }
        liveCurrentPlays.push({ seat, card });
        const h = liveHands[seat];
        if (h) {
          const i = h.findIndex((c) => c.rank === card.rank && c.suit === card.suit);
          if (i >= 0) h.splice(i, 1);
        }
        ui.onEvent({ kind: "play", seat, card, vazaIndex });
      },
      onRaiseProposed(proposal) {
        ui.onEvent({ kind: "raiseProposed", proposal });
      },
      onRaiseResponse({ responder, response }) {
        ui.onEvent({ kind: "raiseResponse", responder, response });
      },
      onVazaResolved({ vazaIndex, result, plays }) {
        ui.onEvent({ kind: "vazaResolved", vazaIndex, result, plays });
      },
      onScoreUpdate({ result, scores }) {
        liveScores = scores.slice();
        ui.onEvent({ kind: "score", result, scores });
      },
      onMatchEnd({ winningTeam, scores }) {
        ui.onEvent({ kind: "matchEnd", winningTeam, scores });
      }
    };
    return playMatch({
      rules,
      players,
      observer,
      rng: opts.seed === void 0 ? void 0 : seededRng2(opts.seed),
      initialScores: opts.initialScores
    });
  }

  // src/training/rng.ts
  function seededRng3(seed) {
    let s = seed >>> 0;
    if (s === 0) s = 2654435769;
    return () => {
      s = 1664525 * s + 1013904223 >>> 0;
      return s / 4294967296;
    };
  }

  // src/analysis/worlds.ts
  function seenCards(view) {
    const seen = [view.vira, ...view.hand];
    for (const vaza of view.completedVazaPlays) {
      for (const p of vaza) seen.push(p.card);
    }
    for (const p of view.currentVazaPlays) seen.push(p.card);
    return seen;
  }
  function unknownCards(view) {
    const seen = seenCards(view);
    return buildDeck().filter((c) => !seen.some((s) => cardsEqual(s, c)));
  }
  function playedCountBySeat(view, n) {
    const counts = new Array(n).fill(0);
    for (const vaza of view.completedVazaPlays) {
      for (const p of vaza) counts[p.seat] += 1;
    }
    for (const p of view.currentVazaPlays) counts[p.seat] += 1;
    return counts;
  }
  function remainingBySeat(view) {
    const n = view.rules.numPlayers;
    const played = playedCountBySeat(view, n);
    const remaining = new Array(n);
    for (let s = 0; s < n; s++) remaining[s] = view.rules.cardsPerPlayer - played[s];
    return remaining;
  }
  function dealUnknown(view, remaining, unknown) {
    const n = view.rules.numPlayers;
    const dealt = Array.from({ length: n }, () => []);
    let idx = 0;
    for (let s = 0; s < n; s++) {
      if (s === view.seat) continue;
      for (let c = 0; c < remaining[s]; c++) dealt[s].push(unknown[idx++]);
    }
    return dealt;
  }
  function buildWorldHands(view, dealt) {
    const n = view.rules.numPlayers;
    const hands = new Array(n);
    for (let s = 0; s < n; s++) {
      hands[s] = s === view.seat ? view.hand.slice() : dealt[s].slice();
    }
    return hands;
  }
  function choose(n, k) {
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    let r = 1;
    for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
    return Math.round(r);
  }
  function countWorlds(remaining, heroSeat, u) {
    let pool = u;
    let total = 1;
    for (let s = 0; s < remaining.length; s++) {
      if (s === heroSeat) continue;
      total *= choose(pool, remaining[s]);
      pool -= remaining[s];
      if (!Number.isFinite(total)) return Infinity;
    }
    return total;
  }
  function* combinations(arr, k) {
    if (k === 0) {
      yield { subset: [], rest: arr.slice() };
      return;
    }
    if (k > arr.length) return;
    const idxs = Array.from({ length: k }, (_, i) => i);
    for (; ; ) {
      const subset = idxs.map((i) => arr[i]);
      const chosen = new Set(idxs);
      const rest = arr.filter((_, i) => !chosen.has(i));
      yield { subset, rest };
      let p = k - 1;
      while (p >= 0 && idxs[p] === arr.length - k + p) p--;
      if (p < 0) break;
      idxs[p]++;
      for (let q = p + 1; q < k; q++) idxs[q] = idxs[q - 1] + 1;
    }
  }
  function worldSetup(view) {
    const remaining = remainingBySeat(view);
    const unknown = unknownCards(view);
    if (view.hand.length !== remaining[view.seat]) {
      throw new Error(
        `Mao do heroi (${view.hand.length}) inconsistente com a contagem de jogadas (${remaining[view.seat]}).`
      );
    }
    const need = remaining.reduce(
      (sum, r, s) => sum + (s === view.seat ? 0 : r),
      0
    );
    if (need > unknown.length) {
      throw new Error(
        `Cartas desconhecidas insuficientes: precisa de ${need}, ha ${unknown.length}.`
      );
    }
    return { remaining, unknown };
  }
  function planWorlds(view, opts = {}) {
    const mode = opts.mode ?? "montecarlo";
    const exactCap = opts.exactCap ?? 2e4;
    const { remaining, unknown } = worldSetup(view);
    const total = countWorlds(remaining, view.seat, unknown.length);
    if (mode === "exact") {
      if (total > exactCap) {
        throw new Error(
          `Enumeracao exata excede o limite (${total} > ${exactCap}). Aumente exactCap ou use Monte Carlo.`
        );
      }
      return { method: "exact", total };
    }
    if (mode === "auto" && total <= exactCap) return { method: "exact", total };
    return { method: "montecarlo", total };
  }
  function* iterWorlds(view, opts = {}) {
    const { remaining, unknown } = worldSetup(view);
    const { method } = planWorlds(view, opts);
    const seed = opts.seed ?? 1;
    if (method === "exact") {
      const seats = [];
      for (let s = 0; s < view.rules.numPlayers; s++) {
        if (s !== view.seat) seats.push(s);
      }
      const dealt = Array.from(
        { length: view.rules.numPlayers },
        () => []
      );
      yield* enumerate(view, seats, 0, unknown, remaining, dealt);
      return;
    }
    const samples = opts.samples ?? 2e3;
    for (let i = 0; i < samples; i++) {
      const rng = seededRng3(seed + i);
      const shuffled = shuffle(unknown, rng);
      const dealt = dealUnknown(view, remaining, shuffled);
      yield buildWorldHands(view, dealt);
    }
  }
  function* enumerate(view, seats, si, pool, remaining, dealt) {
    if (si === seats.length) {
      yield buildWorldHands(view, dealt);
      return;
    }
    const seat = seats[si];
    for (const combo of combinations(pool, remaining[seat])) {
      dealt[seat] = combo.subset;
      yield* enumerate(view, seats, si + 1, combo.rest, remaining, dealt);
    }
  }

  // src/analysis/doubleDummy.ts
  function ddValue(ctx, hands, results, plays, leader) {
    const { n, rules, vira, teamOfSeat, heroTeam } = ctx;
    if (plays.length === n) {
      const result = resolveVaza(plays, vira, teamOfSeat, rules);
      const newResults = [...results, result];
      const decision = decideHand(newResults, rules);
      if (decision === "cancel") return 0;
      if (decision !== "continue") return decision === heroTeam ? 1 : -1;
      const newLeader = result.winningSeat ?? leader;
      return ddValue(ctx, hands, newResults, [], newLeader);
    }
    const seat = (leader + plays.length) % n;
    const hand = hands[seat];
    const maximizing = teamOfSeat[seat] === heroTeam;
    let best = maximizing ? -Infinity : Infinity;
    const seenStrength = /* @__PURE__ */ new Set();
    for (let i = 0; i < hand.length; i++) {
      const card = hand[i];
      const st = cardStrength(card, vira, rules);
      if (seenStrength.has(st)) continue;
      seenStrength.add(st);
      const newHands = hands.map(
        (h, idx) => idx === seat ? h.filter((_, j) => j !== i) : h
      );
      const val = ddValue(ctx, newHands, results, [...plays, { seat, card }], leader);
      if (maximizing) {
        if (val > best) best = val;
        if (best === 1) break;
      } else {
        if (val < best) best = val;
        if (best === -1) break;
      }
    }
    return best;
  }
  function currentLeader(view) {
    return view.currentVazaPlays.length > 0 ? view.currentVazaPlays[0].seat : view.seat;
  }
  function analyzeDoubleDummy(view, opts = {}) {
    const rules = view.rules;
    const n = rules.numPlayers;
    const leader = currentLeader(view);
    const acting = (leader + view.currentVazaPlays.length) % n;
    if (acting !== view.seat) {
      throw new Error(
        `analyzeDoubleDummy: nao e a vez do heroi (assento a jogar = ${acting}, heroi = ${view.seat}).`
      );
    }
    const { method } = planWorlds(view, opts);
    const ctx = {
      rules,
      vira: view.vira,
      teamOfSeat: view.teamOfSeat,
      heroTeam: view.team,
      n
    };
    const candidates = [];
    const seenStrength = /* @__PURE__ */ new Set();
    for (const card of view.hand) {
      const st = cardStrength(card, view.vira, rules);
      if (seenStrength.has(st)) continue;
      seenStrength.add(st);
      candidates.push(card);
    }
    const acc = candidates.map(() => ({ win: 0, tie: 0, loss: 0 }));
    let samples = 0;
    for (const hands of iterWorlds(view, opts)) {
      samples++;
      for (let ci = 0; ci < candidates.length; ci++) {
        const card = candidates[ci];
        const heroHand = hands[view.seat];
        const cardIdx = heroHand.findIndex((c) => cardsEqual(c, card));
        const newHands = hands.map(
          (h, idx) => idx === view.seat ? h.filter((_, j) => j !== cardIdx) : h
        );
        const plays = [
          ...view.currentVazaPlays.map((p) => ({ ...p })),
          { seat: view.seat, card }
        ];
        const v = ddValue(
          ctx,
          newHands,
          view.completedVazaResults.slice(),
          plays,
          leader
        );
        if (v > 0) acc[ci].win++;
        else if (v < 0) acc[ci].loss++;
        else acc[ci].tie++;
      }
    }
    const denom = samples || 1;
    const cards = candidates.map((card, ci) => {
      const a = acc[ci];
      const winProb = a.win / denom;
      const lossProb = a.loss / denom;
      return {
        card,
        winProb,
        tieProb: a.tie / denom,
        lossProb,
        ev: winProb - lossProb
      };
    });
    cards.sort((x, y) => y.ev - x.ev || y.winProb - x.winProb);
    const best = cards[0];
    return {
      winProb: best.winProb,
      tieProb: best.tieProb,
      lossProb: best.lossProb,
      bestCard: best.card,
      cards,
      samples,
      method
    };
  }

  // src/analysis/rollout.ts
  var RandomPlayer = class {
    constructor(rng) {
      this.rng = rng;
    }
    name = "Random";
    async chooseAction(view) {
      const hand = view.hand;
      const idx = Math.floor(this.rng() * hand.length);
      return { type: "play", card: hand[Math.min(idx, hand.length - 1)] };
    }
    async respondToRaise() {
      return "accept";
    }
    async decideMaoDeOnze() {
      return "play";
    }
  };
  function makePolicyPlayer(policy, rng) {
    if (policy === "random") return new RandomPlayer(rng);
    return getPersonality(policy).create(policy, rng);
  }
  async function playoutWorld(view, hands, player) {
    const rules = view.rules;
    const n = rules.numPlayers;
    const vira = view.vira;
    const manilha = manilhaRank(vira, rules);
    const teamOfSeat = view.teamOfSeat;
    const completedPlays = view.completedVazaPlays.map((v) => v.slice());
    const completedResults = view.completedVazaResults.slice();
    const startVaza = completedPlays.length;
    let leader = view.currentVazaPlays.length > 0 ? view.currentVazaPlays[0].seat : view.seat;
    for (let v = startVaza; v < rules.cardsPerPlayer; v++) {
      const plays = v === startVaza ? view.currentVazaPlays.map((p) => ({ ...p })) : [];
      for (let k = plays.length; k < n; k++) {
        const seat = (leader + k) % n;
        const hand = hands[seat];
        const subView = {
          seat,
          team: teamOfSeat[seat],
          hand,
          vira,
          manilha,
          rules,
          scores: view.scores,
          teamOfSeat,
          completedVazaPlays: completedPlays,
          completedVazaResults: completedResults,
          currentVazaPlays: plays,
          handValue: rules.baseValue,
          blind: false
        };
        const action = await player.chooseAction(subView, false);
        let idx = -1;
        if (action.type === "play") {
          idx = hand.findIndex((c) => cardsEqual(c, action.card));
        }
        if (idx < 0) idx = 0;
        const card = hand[idx];
        hand.splice(idx, 1);
        plays.push({ seat, card });
      }
      const result = resolveVaza(plays, vira, teamOfSeat, rules);
      completedResults.push(result);
      completedPlays.push(plays);
      const decision = decideHand(completedResults, rules);
      if (decision === "cancel") return null;
      if (decision !== "continue") return decision;
      if (result.winningSeat !== null) leader = result.winningSeat;
    }
    return null;
  }

  // src/analysis/singleDummy.ts
  function currentLeader2(view) {
    return view.currentVazaPlays.length > 0 ? view.currentVazaPlays[0].seat : view.seat;
  }
  async function analyzeSingleDummy(view, opts = {}) {
    const rules = view.rules;
    const n = rules.numPlayers;
    const leader = currentLeader2(view);
    const acting = (leader + view.currentVazaPlays.length) % n;
    if (acting !== view.seat) {
      throw new Error(
        `analyzeSingleDummy: nao e a vez do heroi (assento a jogar = ${acting}, heroi = ${view.seat}).`
      );
    }
    const policy = opts.policy ?? "inocente";
    const { method } = planWorlds(view, opts);
    const playerRng = seededRng3((opts.seed ?? 1) + 7);
    const player = makePolicyPlayer(policy, playerRng);
    const heroTeam = view.team;
    const candidates = [];
    const seenStrength = /* @__PURE__ */ new Set();
    for (const card of view.hand) {
      const st = cardStrength(card, view.vira, rules);
      if (seenStrength.has(st)) continue;
      seenStrength.add(st);
      candidates.push(card);
    }
    const acc = candidates.map(() => ({ win: 0, tie: 0, loss: 0 }));
    let samples = 0;
    for (const hands of iterWorlds(view, opts)) {
      samples++;
      for (let ci = 0; ci < candidates.length; ci++) {
        const card = candidates[ci];
        const heroHand = hands[view.seat];
        const cardIdx = heroHand.findIndex((c) => cardsEqual(c, card));
        const worldHands = hands.map(
          (h, idx) => idx === view.seat ? h.filter((_, j) => j !== cardIdx) : h.slice()
        );
        const syntheticPlays = [
          ...view.currentVazaPlays.map((p) => ({ ...p })),
          { seat: view.seat, card }
        ];
        const syntheticView = {
          ...view,
          currentVazaPlays: syntheticPlays
        };
        const winner = await playoutWorld(syntheticView, worldHands, player);
        if (winner === null) acc[ci].tie++;
        else if (winner === heroTeam) acc[ci].win++;
        else acc[ci].loss++;
      }
    }
    const denom = samples || 1;
    const cards = candidates.map((card, ci) => {
      const a = acc[ci];
      const winProb = a.win / denom;
      const lossProb = a.loss / denom;
      return {
        card,
        winProb,
        tieProb: a.tie / denom,
        lossProb,
        ev: winProb - lossProb
      };
    });
    cards.sort((x, y) => y.ev - x.ev || y.winProb - x.winProb);
    const best = cards[0];
    return {
      winProb: best.winProb,
      tieProb: best.tieProb,
      lossProb: best.lossProb,
      bestCard: best.card,
      cards,
      samples,
      method,
      policy
    };
  }

  // src/analysis/winEstimator.ts
  async function estimateWin(view, opts = {}) {
    const policy = opts.policy ?? "inocente";
    const { method } = planWorlds(view, opts);
    const heroTeam = view.team;
    const playerRng = seededRng3((opts.seed ?? 1) + 7);
    const player = makePolicyPlayer(policy, playerRng);
    let win = 0;
    let tie = 0;
    let loss = 0;
    let n = 0;
    for (const hands of iterWorlds(view, opts)) {
      const winner = await playoutWorld(view, hands, player);
      if (winner === null) tie++;
      else if (winner === heroTeam) win++;
      else loss++;
      n++;
    }
    const denom = n || 1;
    return {
      winProb: win / denom,
      tieProb: tie / denom,
      lossProb: loss / denom,
      samples: n,
      method,
      policy
    };
  }
  async function comparePolicies(view, policies, opts = {}) {
    const out = {};
    for (const policy of policies) {
      out[policy] = await estimateWin(view, { ...opts, policy });
    }
    return out;
  }

  // src/analysis/calcApi.ts
  var CALC_POLICIES = [
    "random",
    "inocente",
    "melhorada_1",
    "melhorada_2",
    "melhorada_3",
    "melhorada_4",
    "melhorada_5"
  ];
  var RULES = TRUCO_PAULISTA;
  function alternatingTeams(n) {
    return Array.from({ length: n }, (_, s) => s % 2);
  }
  function buildPlays(scenario, teamOfSeat) {
    const n = RULES.numPlayers;
    let leader = scenario.maoSeat;
    const completedVazaPlays = [];
    const completedVazaResults = [];
    for (const cards of scenario.completedVazas) {
      const plays = cards.map((card, k) => ({
        seat: (leader + k) % n,
        card
      }));
      const result = resolveVaza(plays, scenario.vira, teamOfSeat, RULES);
      completedVazaPlays.push(plays);
      completedVazaResults.push(result);
      leader = result.winningSeat ?? leader;
    }
    const currentVazaPlays = scenario.currentVaza.map((card, k) => ({
      seat: (leader + k) % n,
      card
    }));
    return {
      completedVazaPlays,
      completedVazaResults,
      currentVazaPlays,
      currentLeader: leader
    };
  }
  function validate(scenario) {
    const n = RULES.numPlayers;
    const cpp = RULES.cardsPerPlayer;
    if (scenario.seat < 0 || scenario.seat >= n) {
      throw new Error(`Assento do heroi invalido: ${scenario.seat} (esperado 0..${n - 1}).`);
    }
    if (scenario.maoSeat < 0 || scenario.maoSeat >= n) {
      throw new Error(`Assento da "mao" invalido: ${scenario.maoSeat} (esperado 0..${n - 1}).`);
    }
    if (scenario.completedVazas.length > cpp) {
      throw new Error(`Vazas completas demais: ${scenario.completedVazas.length} (maximo ${cpp}).`);
    }
    scenario.completedVazas.forEach((cards, i) => {
      if (cards.length !== n) {
        throw new Error(`Vaza ${i + 1} incompleta: ${cards.length} cartas (precisa de ${n}).`);
      }
    });
    if (scenario.currentVaza.length >= n) {
      throw new Error(`Vaza atual cheia (${scenario.currentVaza.length}); ela ja estaria completa.`);
    }
    const all = [
      scenario.vira,
      ...scenario.hand,
      ...scenario.completedVazas.flat(),
      ...scenario.currentVaza
    ];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (cardsEqual(all[i], all[j])) {
          throw new Error(`Carta repetida no cenario: ${cardToString(all[i])}.`);
        }
      }
    }
  }
  async function calcScenario(scenario, opts = {}) {
    validate(scenario);
    const n = RULES.numPlayers;
    const teamOfSeat = alternatingTeams(n);
    const { completedVazaPlays, completedVazaResults, currentVazaPlays, currentLeader: currentLeader3 } = buildPlays(scenario, teamOfSeat);
    const view = {
      seat: scenario.seat,
      team: teamOfSeat[scenario.seat],
      hand: scenario.hand,
      vira: scenario.vira,
      manilha: manilhaRank(scenario.vira, RULES),
      rules: RULES,
      scores: new Array(RULES.numTeams).fill(0),
      teamOfSeat,
      completedVazaPlays,
      completedVazaResults,
      currentVazaPlays,
      handValue: RULES.baseValue,
      blind: false
    };
    const acting = (currentLeader3 + currentVazaPlays.length) % n;
    const heroPlayedInCurrent = currentVazaPlays.some((p) => p.seat === scenario.seat);
    const heroPlayed = completedVazaPlays.length + (heroPlayedInCurrent ? 1 : 0);
    const expectedHand = RULES.cardsPerPlayer - heroPlayed;
    if (scenario.hand.length !== expectedHand) {
      throw new Error(
        `Mao do heroi tem ${scenario.hand.length} carta(s), mas o esperado e ${expectedHand} (${RULES.cardsPerPlayer} - ${heroPlayed} ja jogada(s) pelo heroi).`
      );
    }
    const wopts = { samples: opts.samples ?? 3e3, seed: opts.seed ?? 42, mode: "auto" };
    const policies = await comparePolicies(view, CALC_POLICIES, wopts);
    const heroToPlay = acting === scenario.seat;
    let doubleDummy = null;
    let singleDummy = null;
    if (heroToPlay) {
      doubleDummy = analyzeDoubleDummy(view, wopts);
      singleDummy = await analyzeSingleDummy(view, { ...wopts, policy: "melhorada_5" });
    }
    return {
      manilha: view.manilha,
      acting,
      heroToPlay,
      completedResults: completedVazaResults,
      policies,
      doubleDummy,
      singleDummy
    };
  }
  return __toCommonJS(index_exports);
})();
