import type { GameRole } from "../types/domain";

export const GAME_RULES = {
  durationSeconds: 180,
  maxTurns: 8,
  maxPenalties: 3,
  winObjectiveProgress: 100,
} as const;

export const ROLE_PROGRESS_MULTIPLIER: Record<GameRole, number> = {
  Infiltrator: 1.2,
  Lookout: 1.1,
  Saboteur: 0.95,
  Engineer: 1.05,
};

export const ROLE_PENALTY_REDUCTION: Record<GameRole, number> = {
  Infiltrator: 0,
  Lookout: 1,
  Saboteur: 0,
  Engineer: 1,
};
