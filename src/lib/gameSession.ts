import { GAME_RULES } from "./gameConfig";
import { createId, nowIso } from "./time";
import type { GameRole, GameSession } from "../types/domain";

const GAME_ROLES: GameRole[] = ["Infiltrator", "Lookout", "Saboteur", "Engineer"];

function selectRoleForUser(userId: string): GameRole {
  const roleSeed = userId
    .split("")
    .reduce((runningTotal, character) => runningTotal + character.charCodeAt(0), 0);

  return GAME_ROLES[roleSeed % GAME_ROLES.length];
}

type CreateGameSessionInput = {
  roomCode: string;
  userId: string;
  playerName: string;
  actionLogPrefix?: string;
};

export function createGameSession({
  roomCode,
  userId,
  playerName,
  actionLogPrefix = "Session created",
}: CreateGameSessionInput): GameSession {
  const timestamp = nowIso();

  return {
    id: createId("game"),
    roomCode,
    userId,
    playerName,
    role: selectRoleForUser(userId),
    phase: "planning",
    startedAt: timestamp,
    durationSeconds: GAME_RULES.durationSeconds,
    remainingSeconds: GAME_RULES.durationSeconds,
    turnsPlayed: 0,
    selectedBuildingId: null,
    actionLog: [`${actionLogPrefix} at ${timestamp}`],
    score: 0,
    objectiveProgress: 0,
    penalties: 0,
  };
}
