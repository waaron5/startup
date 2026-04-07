export const OPERATION_TEAM_SIZES: Record<number, number> = {
  1: 2,
  2: 3,
  3: 2,
  4: 3,
  5: 3,
};

export const GAME_CONFIG = {
  playersRequired: 5,
  successWin: 3,
  alarmWin: 3,
  maxRejectedPlans: 3,
  maxOperations: 5,
} as const;

export const PHASE_TIMERS_SECONDS = {
  pick_building: 20,
  propose_team: 20,
  vote: 15,
  submit_heist: 15,
  final_accusation: 20,
} as const;
