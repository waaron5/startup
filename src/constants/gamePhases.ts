import type { GamePhase } from "../types/domain";

export const GAME_PHASES = {
  lobby: "lobby",
  role_reveal: "role_reveal",
  pick_building: "pick_building",
  propose_team: "propose_team",
  vote: "vote",
  vote_result: "vote_result",
  submit_heist: "submit_heist",
  heist_result: "heist_result",
  final_accusation: "final_accusation",
  game_over: "game_over",
} as const satisfies Record<GamePhase, GamePhase>;

export const GAME_PHASE_LABELS: Record<GamePhase, string> = {
  lobby: "Lobby",
  role_reveal: "Your Role",
  pick_building: "Pick Target",
  propose_team: "Propose Team",
  vote: "Vote on Plan",
  vote_result: "Vote Result",
  submit_heist: "Run the Heist",
  heist_result: "Heist Outcome",
  final_accusation: "Final Accusation",
  game_over: "Game Over",
};
