import { OPERATION_TEAM_SIZES } from "./gameConfig";
import type { ClientGameState, GamePlayer, GameRole, VoteChoice } from "../types/domain";

export function getRequiredTeamSize(operationNumber: number): number {
  return OPERATION_TEAM_SIZES[operationNumber] ?? 2;
}

export function isLeader(state: ClientGameState, userId: string): boolean {
  return state.leaderId === userId;
}

export function isOnTeam(state: ClientGameState, userId: string): boolean {
  return state.proposedTeam.includes(userId);
}

export function hasVoted(state: ClientGameState, userId: string): boolean {
  return state.votesSubmitted.includes(userId);
}

export function hasSubmittedCard(state: ClientGameState, userId: string): boolean {
  return state.heistCardsSubmitted.includes(userId);
}

export function hasAccused(state: ClientGameState, userId: string): boolean {
  return state.accusationVotesSubmitted.includes(userId);
}

export function getLeaderName(state: ClientGameState): string {
  return state.players.find((p) => p.userId === state.leaderId)?.displayName ?? "Unknown";
}

export function getPlayerName(state: ClientGameState, userId: string): string {
  return state.players.find((p) => p.userId === userId)?.displayName ?? userId;
}

export function getPhaseTimeRemaining(state: ClientGameState): number | null {
  if (!state.phaseDeadline) return null;
  return Math.max(0, state.phaseDeadline - Date.now());
}

export function getVoteLabel(vote: VoteChoice): string {
  return vote === "approve" ? "APPROVE" : "REJECT";
}

export function deriveMyRole(state: ClientGameState, userId: string, myRole: GameRole | null): GameRole | null {
  if (state.phase === "game_over" && state.result) {
    return state.result.quislingId === userId ? "quisling" : "crew";
  }
  return myRole;
}

export function getOtherPlayers(state: ClientGameState, myUserId: string): GamePlayer[] {
  return state.players.filter((p) => p.userId !== myUserId);
}

