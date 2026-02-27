import type { GamePhase } from "../types/domain";

export const GAME_PHASES: Record<GamePhase, GamePhase> = {
  planning: "planning",
  action: "action",
  resolution: "resolution",
  complete: "complete",
};

export const GAME_PHASE_HINTS: Record<GamePhase, string> = {
  planning: "Planning: Select a target building.",
  action: "Action: Commit your move for this turn.",
  resolution: "Resolution: Apply outcomes and advance the mission.",
  complete: "Mission complete: Review your results.",
};

export const GAME_PHASE_LABELS: Record<GamePhase, string> = {
  planning: "Planning",
  action: "Action",
  resolution: "Resolution",
  complete: "Complete",
};
