/**
 * Jogador humano para a interface WEB.
 *
 * A engine (hand/match) e assincrona: ela faz `await player.chooseAction(...)`
 * em cada decisao. Este Player implementa os tres metodos devolvendo uma Promise
 * que so resolve quando a UI sinaliza a escolha do usuario (padrao "deferred").
 * Enquanto o usuario nao clica, a Promise fica pendente e a engine pausa sozinha
 * no `await` — sem precisar mudar nada do core.
 *
 * E o analogo web do HumanCliPlayer (que bloqueia no `ask()` do terminal): aqui,
 * em vez de ler do terminal, entregamos os dados da decisao a um conjunto de
 * "hooks" da UI, que mostra as opcoes e chama o `resolve` no clique.
 */

import {
  Action,
  MaoDeOnzeContext,
  MaoDeOnzeDecision,
  Player,
  PlayerView,
  Proposal,
  RaiseResponse,
} from "./player.js";

/** Resposta do parceiro a uma consulta (sinal/opiniao). `level`: 0 ruim, 1 medio, 2 bom. */
export interface ConsultResult {
  kind: "signal" | "canWin" | "truco";
  level: 0 | 1 | 2;
  text: string;
}

/**
 * Canal de coordenacao com o PARCEIRO (so para humanos). Permite ao humano, na
 * sua vez, "perguntar" coisas ao parceiro: se ele acha que faz a vaza, sua
 * opiniao sobre truco, ou pedir o "sinal" (se tem manilha / 3). As respostas sao
 * calculadas a partir das cartas reais do parceiro (jogo local).
 */
export interface ConsultApi {
  partnerName: string;
  /** "Passe sinal": o parceiro revela se tem manilha / 3. */
  signal(): ConsultResult;
  /** "Voce faz essa?": o parceiro opina se ganha a vaza atual. */
  canWin(): ConsultResult;
  /** "Pedimos/aceitamos truco?": opiniao do parceiro sobre a aposta. */
  trucoAdvice(): ConsultResult;
}

/** Pedido para o usuario jogar uma carta ou pedir/aumentar o truco. */
export interface ActionPrompt {
  view: PlayerView;
  /** Se false, o usuario NAO pode pedir truco (so jogar carta). */
  canRaise: boolean;
  /** Coordenacao com o parceiro (se houver). */
  consult?: ConsultApi;
  /** A UI chama com {type:"play",card} (card deve ser um item de view.hand) ou {type:"raise"}. */
  resolve: (action: Action) => void;
}

/** Pedido para o usuario responder a um truco proposto pelos adversarios. */
export interface RaisePrompt {
  view: PlayerView;
  proposal: Proposal;
  /** Se false, nao pode reaumentar (so aceitar/correr). */
  canCounter: boolean;
  /** Coordenacao com o parceiro (se houver). */
  consult?: ConsultApi;
  resolve: (response: RaiseResponse) => void;
}

/** Pedido para o usuario decidir a "mao de onze" (jogar ou correr). */
export interface MaoOnzePrompt {
  view: PlayerView;
  ctx: MaoDeOnzeContext;
  resolve: (decision: MaoDeOnzeDecision) => void;
}

/** Hooks que a UI registra para receber os pedidos de decisao do humano. */
export interface HumanWebHooks {
  onActionPrompt(prompt: ActionPrompt): void;
  onRaisePrompt(prompt: RaisePrompt): void;
  onMaoOnzePrompt(prompt: MaoOnzePrompt): void;
}

export class HumanWebPlayer implements Player {
  constructor(
    readonly name: string,
    private readonly hooks: HumanWebHooks,
    /** Fornece o canal de coordenacao com o parceiro deste assento (opcional). */
    private readonly consultProvider?: (seat: number) => ConsultApi | undefined,
  ) {}

  chooseAction(view: PlayerView, canRaise: boolean): Promise<Action> {
    const consult = this.consultProvider?.(view.seat);
    return new Promise<Action>((resolve) =>
      this.hooks.onActionPrompt({ view, canRaise, consult, resolve }),
    );
  }

  respondToRaise(
    view: PlayerView,
    proposal: Proposal,
    canCounter: boolean,
  ): Promise<RaiseResponse> {
    const consult = this.consultProvider?.(view.seat);
    return new Promise<RaiseResponse>((resolve) =>
      this.hooks.onRaisePrompt({ view, proposal, canCounter, consult, resolve }),
    );
  }

  decideMaoDeOnze(
    view: PlayerView,
    ctx: MaoDeOnzeContext,
  ): Promise<MaoDeOnzeDecision> {
    return new Promise<MaoDeOnzeDecision>((resolve) =>
      this.hooks.onMaoOnzePrompt({ view, ctx, resolve }),
    );
  }
}
