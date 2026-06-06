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

/** Pedido para o usuario jogar uma carta ou pedir/aumentar o truco. */
export interface ActionPrompt {
  view: PlayerView;
  /** Se false, o usuario NAO pode pedir truco (so jogar carta). */
  canRaise: boolean;
  /** A UI chama com {type:"play",card} (card deve ser um item de view.hand) ou {type:"raise"}. */
  resolve: (action: Action) => void;
}

/** Pedido para o usuario responder a um truco proposto pelos adversarios. */
export interface RaisePrompt {
  view: PlayerView;
  proposal: Proposal;
  /** Se false, nao pode reaumentar (so aceitar/correr). */
  canCounter: boolean;
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
  ) {}

  chooseAction(view: PlayerView, canRaise: boolean): Promise<Action> {
    return new Promise<Action>((resolve) =>
      this.hooks.onActionPrompt({ view, canRaise, resolve }),
    );
  }

  respondToRaise(
    view: PlayerView,
    proposal: Proposal,
    canCounter: boolean,
  ): Promise<RaiseResponse> {
    return new Promise<RaiseResponse>((resolve) =>
      this.hooks.onRaisePrompt({ view, proposal, canCounter, resolve }),
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
