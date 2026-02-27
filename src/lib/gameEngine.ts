import { BUILDINGS_BY_ID } from "../constants/buildings";
import { GAME_PHASE_HINTS, GAME_PHASES } from "../constants/gamePhases";
import { GAME_RULES, ROLE_PENALTY_REDUCTION, ROLE_PROGRESS_MULTIPLIER } from "./gameConfig";
import type { GameOutcome, GameSession } from "../types/domain";

type TurnResolution = {
  progressGain: number;
  penaltyGain: number;
  scoreDelta: number;
};

export function hydrateGameSession(session: GameSession): GameSession {
  return {
    ...session,
    turnsPlayed: session.turnsPlayed ?? 0,
    remainingSeconds: Math.max(0, session.remainingSeconds),
    phase: session.phase ?? GAME_PHASES.planning,
  };
}

export function getPhaseHint(phase: GameSession["phase"]): string {
  return GAME_PHASE_HINTS[phase];
}

export function getTimeProgressPercent(session: GameSession): number {
  if (session.durationSeconds <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, (session.remainingSeconds / session.durationSeconds) * 100));
}

export function selectBuilding(session: GameSession, buildingId: string): GameSession {
  if (session.phase === GAME_PHASES.complete) {
    return session;
  }

  if (!BUILDINGS_BY_ID[buildingId]) {
    return session;
  }

  return {
    ...session,
    selectedBuildingId: buildingId,
  };
}

export function beginActionPhase(session: GameSession): GameSession {
  if (session.phase !== GAME_PHASES.planning || !session.selectedBuildingId) {
    return session;
  }

  return {
    ...session,
    phase: GAME_PHASES.action,
    actionLog: [
      ...session.actionLog,
      `Target locked: ${BUILDINGS_BY_ID[session.selectedBuildingId].label}.`,
    ],
  };
}

export function commitAction(session: GameSession): GameSession {
  if (session.phase !== GAME_PHASES.action || !session.selectedBuildingId) {
    return session;
  }

  return {
    ...session,
    phase: GAME_PHASES.resolution,
    actionLog: [...session.actionLog, "Action executed. Resolving outcome..."],
  };
}

function resolveBuildingImpact(session: GameSession): TurnResolution | null {
  if (!session.selectedBuildingId) {
    return null;
  }

  const building = BUILDINGS_BY_ID[session.selectedBuildingId];

  if (!building) {
    return null;
  }

  const progressMultiplier = ROLE_PROGRESS_MULTIPLIER[session.role];
  const rawProgress = building.rewardPoints * progressMultiplier - building.difficulty * 1.3;
  const progressGain = Math.max(5, Math.round(rawProgress));

  const rawPenalty = building.difficulty >= 8 ? 1 : 0;
  const rolePenaltyReduction = ROLE_PENALTY_REDUCTION[session.role];
  const penaltyGain = Math.max(0, rawPenalty - rolePenaltyReduction);

  const scoreDelta = progressGain * 2 - penaltyGain * building.penaltyPoints * 3;

  return {
    progressGain,
    penaltyGain,
    scoreDelta,
  };
}

export function resolveTurn(session: GameSession): GameSession {
  if (session.phase !== GAME_PHASES.resolution || !session.selectedBuildingId) {
    return session;
  }

  const selectedBuilding = BUILDINGS_BY_ID[session.selectedBuildingId];
  const impact = resolveBuildingImpact(session);

  if (!selectedBuilding || !impact) {
    return session;
  }

  const nextSession: GameSession = {
    ...session,
    phase: GAME_PHASES.planning,
    turnsPlayed: session.turnsPlayed + 1,
    objectiveProgress: Math.min(
      GAME_RULES.winObjectiveProgress,
      session.objectiveProgress + impact.progressGain
    ),
    penalties: session.penalties + impact.penaltyGain,
    score: session.score + impact.scoreDelta,
    selectedBuildingId: null,
    actionLog: [
      ...session.actionLog,
      `Turn ${session.turnsPlayed + 1}: ${selectedBuilding.label} yielded +${impact.progressGain} progress, +${impact.scoreDelta} score, +${impact.penaltyGain} penalties.`,
    ],
  };

  const outcome = computeOutcome(nextSession);

  if (!outcome) {
    return nextSession;
  }

  return finalizeSession(
    nextSession,
    outcome,
    outcome === "win"
      ? "Objective completed before the deadline."
      : "Mission failed before objective completion."
  );
}

export function withRemainingSeconds(session: GameSession, remainingSeconds: number): GameSession {
  const clampedSeconds = Math.max(0, remainingSeconds);
  return {
    ...session,
    remainingSeconds: clampedSeconds,
  };
}

export function computeOutcome(session: GameSession): GameOutcome | null {
  if (session.objectiveProgress >= GAME_RULES.winObjectiveProgress) {
    return "win";
  }

  if (session.penalties >= GAME_RULES.maxPenalties) {
    return "loss";
  }

  if (session.remainingSeconds <= 0) {
    return "loss";
  }

  if (session.turnsPlayed >= GAME_RULES.maxTurns) {
    return "loss";
  }

  return null;
}

export function finalizeSession(
  session: GameSession,
  outcome: GameOutcome,
  reasonMessage: string
): GameSession {
  if (session.phase === GAME_PHASES.complete) {
    return session;
  }

  return {
    ...session,
    phase: GAME_PHASES.complete,
    actionLog: [...session.actionLog, `Result: ${outcome.toUpperCase()} - ${reasonMessage}`],
  };
}
