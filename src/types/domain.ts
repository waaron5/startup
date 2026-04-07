export type GameRole = "crew" | "quisling";

export type GamePhase =
  | "lobby"
  | "role_reveal"
  | "pick_building"
  | "propose_team"
  | "vote"
  | "vote_result"
  | "submit_heist"
  | "heist_result"
  | "final_accusation"
  | "game_over";

export type HeistCard = "clean" | "sabotage";
export type VoteChoice = "approve" | "reject";
export type GameWinner = "crew" | "quisling";
export type OperationOutcome = "success" | "alarm" | "escalated";

export type UserStats = {
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
};

export type UserRecord = {
  id: string;
  email: string;
  password: string;
  displayName: string;
  createdAt: string;
  stats: UserStats;
  friends: string[];
  history: string[];
};

export type AuthSession = {
  userId: string;
  email: string;
  displayName: string;
  loggedInAt: string;
};

export type GamePlayer = {
  userId: string;
  displayName: string;
};

export type OperationRecord = {
  operationNumber: number;
  buildingId: string;
  buildingLabel: string;
  teamUserIds: string[];
  outcome: OperationOutcome;
  cleanCount: number;
  sabotageCount: number;
};

export type GameResultSummary = {
  winner: GameWinner;
  quislingId: string;
  quislingDisplayName: string;
  detainedUserId: string;
  detainedDisplayName: string;
  operationHistory: OperationRecord[];
};

export type ClientGameState = {
  roomCode: string;
  phase: GamePhase;
  players: GamePlayer[];
  leaderId: string;
  operationNumber: number;
  proposedTeam: string[];
  votesSubmitted: string[];
  heistCardsSubmitted: string[];
  accusationVotesSubmitted: string[];
  successes: number;
  alarm: number;
  rejectedPlans: number;
  spentBuildingIds: string[];
  selectedBuildingId: string | null;
  phaseDeadline: number | null;
  operationHistory: OperationRecord[];
  readyPlayerIds: string[];
  voteReveal: Record<string, VoteChoice> | null;
  heistReveal: { cleanCount: number; sabotageCount: number; outcome: OperationOutcome } | null;
  accusationReveal: Record<string, string> | null;
  result: GameResultSummary | null;
};

export type GameResult = {
  id: string;
  roomCode: string;
  userId: string;
  outcome: "win" | "loss";
  winner: GameWinner;
  quislingId: string;
  quislingDisplayName: string;
  operationHistory: OperationRecord[];
  completedAt: string;
};

export type GameLobbyStatus = "open" | "in_progress" | "complete";

export type GameLobby = {
  id: string;
  roomCode: string;
  createdAt: string;
  updatedAt: string;
  hostUserId: string;
  players: string[];
  status: GameLobbyStatus;
};
