export type GameRole = "Infiltrator" | "Lookout" | "Saboteur" | "Engineer";
export type GamePhase = "planning" | "action" | "resolution" | "complete";
export type GameOutcome = "win" | "loss";

export type UserStats = {
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  totalScore: number;
  bestScore: number;
};

export type UserRecord = {
  id: string;
  email: string;
  password: string; // Temporary: frontend-only auth scaffold.
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

export type GameSession = {
  id: string;
  roomCode: string;
  userId: string;
  playerName: string;
  role: GameRole;
  phase: GamePhase;
  startedAt: string;
  durationSeconds: number;
  remainingSeconds: number;
  turnsPlayed: number;
  selectedBuildingId: string | null;
  actionLog: string[];
  score: number;
  objectiveProgress: number;
  penalties: number;
};

export type GameResult = {
  id: string;
  gameId: string;
  userId: string;
  roomCode: string;
  outcome: GameOutcome;
  score: number;
  summary: {
    buildingsHit: string[];
    turnsPlayed: number;
    timeRemaining: number;
  };
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
