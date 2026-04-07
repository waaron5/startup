const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const http = require("node:http");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const { Server } = require("socket.io");
const database = require("./database");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});
const port = Number(process.env.PORT) || 4000;
const staticDir = path.join(__dirname, "..", "dist");
const indexFile = path.join(staticDir, "index.html");
const authCookieName = "token";
const passwordMinLength = 8;
const bcryptSaltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.disable("x-powered-by");
app.use(express.json());
app.use(cookieParser());

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDisplayName(displayName, email) {
  const trimmedName = String(displayName || "").trim();

  if (trimmedName) {
    return trimmedName;
  }

  const fallback = email.split("@")[0];
  return fallback || "Player";
}

function toPublicUser(user) {
  const stats = user.stats && typeof user.stats === "object" ? user.stats : {};

  return {
    id: user.id,
    email: user.email,
    isGuest: Boolean(user.isGuest),
    displayName: user.displayName,
    createdAt: user.createdAt,
    stats: {
      gamesPlayed: Number(stats.gamesPlayed || 0),
      wins: Number(stats.wins || 0),
      losses: Number(stats.losses || 0),
      winRate: Number(stats.winRate || 0),
    },
  };
}

function toPublicResult(result) {
  return {
    id: result.id,
    roomCode: result.roomCode,
    userId: result.userId,
    outcome: result.outcome,
    winner: result.winner || null,
    quislingId: result.quislingId || null,
    quislingDisplayName: result.quislingDisplayName || null,
    operationHistory: Array.isArray(result.operationHistory) ? result.operationHistory : [],
    completedAt: result.completedAt,
  };
}

function parseResultInput(payload, userId) {
  const id = String(payload?.id || "").trim();
  const roomCode = String(payload?.roomCode || "").trim().toUpperCase();
  const outcome = payload?.outcome;
  const completedAt = String(payload?.completedAt || "").trim();
  const winner = payload?.winner;
  const quislingId = String(payload?.quislingId || "").trim();
  const quislingDisplayName = String(payload?.quislingDisplayName || "").trim();
  const operationHistory = Array.isArray(payload?.operationHistory) ? payload.operationHistory : [];

  if (!id || !roomCode || !completedAt) {
    return null;
  }

  if (!(outcome === "win" || outcome === "loss")) {
    return null;
  }

  if (!(winner === "crew" || winner === "quisling")) {
    return null;
  }

  return {
    id,
    roomCode,
    userId,
    outcome,
    winner,
    quislingId,
    quislingDisplayName,
    operationHistory,
    completedAt,
  };
}

function normalizeRoomCode(value) {
  return String(value || "").trim().toUpperCase();
}

function toPublicLobby(lobby, playerDetails) {
  return {
    id: lobby.id,
    roomCode: lobby.roomCode,
    createdAt: lobby.createdAt,
    updatedAt: lobby.updatedAt,
    hostUserId: lobby.hostUserId,
    players: Array.isArray(lobby.players) ? lobby.players : [],
    playerDetails: playerDetails || [],
    status: lobby.status,
  };
}

async function enrichLobbyPlayerDetails(lobby) {
  const playerIds = Array.isArray(lobby.players) ? lobby.players : [];
  const details = [];
  for (const id of playerIds) {
    const user = await database.findUserById(id);
    details.push({ id, displayName: user ? user.displayName : id });
  }
  return details;
}

function parseLobbyStatus(value) {
  const nextStatus = String(value || "").trim();
  if (nextStatus === "open" || nextStatus === "in_progress" || nextStatus === "complete") {
    return nextStatus;
  }

  return null;
}

async function getUserFromRequest(req) {
  const token = req.cookies?.[authCookieName];

  if (!token) {
    return null;
  }

  const session = await database.findSessionByToken(token);

  if (!session) {
    return null;
  }

  const user = await database.findUserById(session.userId);

  if (!user) {
    await database.deleteSessionByToken(token);
    return null;
  }

  return { token, session, user };
}

function createGuestUser() {
  const suffix = crypto.randomUUID();
  const label = suffix.slice(0, 4).toUpperCase();

  return {
    id: `guest_${suffix}`,
    email: `guest-${suffix}@guest.thequisling.local`,
    isGuest: true,
    displayName: `Guest ${label}`,
    createdAt: nowIso(),
    stats: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
    },
    friends: [],
    history: [],
  };
}

function createSessionForUser(userId) {
  return {
    token: `sess_${crypto.randomUUID()}`,
    userId,
    createdAt: nowIso(),
  };
}

function setAuthCookie(res, token) {
  res.cookie(authCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(authCookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

async function requireAuth(req, res, next) {
  const authContext = await getUserFromRequest(req);

  if (!authContext) {
    res.status(401).json({
      ok: false,
      message: "Authentication required.",
    });
    return;
  }

  req.auth = authContext;
  next();
}

// ─── Game Config ─────────────────────────────────────────────────────────────

const OPERATION_TEAM_SIZES = { 1: 2, 2: 3, 3: 2, 4: 3, 5: 3 };
const PLAYERS_REQUIRED = 5;
const SUCCESS_WIN = 3;
const ALARM_WIN = 3;
const MAX_REJECTED_PLANS = 3;
const MAX_OPERATIONS = 5;
const RESULT_DISPLAY_MS = 3000;
const PHASE_TIMERS_MS = {
  pick_building: 20000,
  propose_team: 20000,
  vote: 15000,
  submit_heist: 15000,
  final_accusation: 20000,
};
const DEV_BOT_ID_PREFIX = "devbot_";

// In-memory map to avoid duplicate scheduled timeouts: key = `${roomCode}:${phase}`
const scheduledTimeouts = new Map();

// ─── Game Helpers ─────────────────────────────────────────────────────────────

function getBuildingLabel(buildingId) {
  const labels = {
    "bank-vault": "Bank Vault",
    watchtower: "Watchtower",
    archives: "Archives",
    armory: "Armory",
    docks: "Docks",
    "radio-tower": "Radio Tower",
  };
  return labels[buildingId] ?? buildingId;
}

function buildClientState(game) {
  const isGameOver = game.phase === "game_over";
  return {
    roomCode: game.roomCode,
    phase: game.phase,
    players: game.players,
    leaderId: game.leaderId,
    operationNumber: game.operationNumber,
    proposedTeam: game.proposedTeam || [],
    votesSubmitted: Object.keys(game.votes || {}),
    heistCardsSubmitted: Object.keys(game.heistCards || {}),
    accusationVotesSubmitted: Object.keys(game.accusationVotes || {}),
    successes: game.successes,
    alarm: game.alarm,
    rejectedPlans: game.rejectedPlans,
    spentBuildingIds: game.spentBuildingIds || [],
    selectedBuildingId: game.selectedBuildingId || null,
    phaseDeadline: game.phaseDeadline || null,
    operationHistory: game.operationHistory || [],
    readyPlayerIds: game.readyPlayerIds || [],
    voteReveal: game.voteReveal || null,
    heistReveal: game.heistReveal || null,
    accusationReveal: isGameOver ? (game.accusationVotes || {}) : null,
    result: isGameOver ? game.result : null,
  };
}

function isDevelopmentMode() {
  return process.env.NODE_ENV !== "production";
}

function isDevBotUserId(userId) {
  return String(userId || "").startsWith(DEV_BOT_ID_PREFIX);
}

function getDevBotPlayerIds(game) {
  return (game.players || [])
    .map((player) => player.userId)
    .filter((userId) => isDevBotUserId(userId));
}

function createDevBotUser(roomCode, index) {
  const suffix = crypto.randomUUID();

  return {
    id: `${DEV_BOT_ID_PREFIX}${suffix}`,
    email: `devbot-${roomCode.toLowerCase()}-${index}-${suffix}@guest.thequisling.local`,
    isGuest: true,
    isDevBot: true,
    displayName: `Dev Bot ${index}`,
    createdAt: nowIso(),
    stats: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
    },
    friends: [],
    history: [],
  };
}

function getNextLeaderId(players, currentLeaderId) {
  const idx = players.findIndex((p) => p.userId === currentLeaderId);
  return players[(idx + 1) % players.length].userId;
}

function buildOperationRecord(game, outcome, cleanCount, sabotageCount) {
  return {
    operationNumber: game.operationNumber,
    buildingId: game.selectedBuildingId || "",
    buildingLabel: getBuildingLabel(game.selectedBuildingId || ""),
    teamUserIds: game.proposedTeam || [],
    outcome,
    cleanCount,
    sabotageCount,
  };
}

function applyGameOver(game, winner) {
  const quislingPlayer = game.players.find((p) => p.userId === game.quislingId);
  return {
    ...game,
    phase: "game_over",
    phaseDeadline: null,
    pendingNextPhase: null,
    result: {
      winner,
      quislingId: game.quislingId,
      quislingDisplayName: quislingPlayer ? quislingPlayer.displayName : "Unknown",
      detainedUserId: game.detainedUserId || "",
      detainedDisplayName: game.detainedDisplayName || "",
      operationHistory: game.operationHistory || [],
    },
  };
}

function advanceToNextOperation(game) {
  if (game.alarm >= ALARM_WIN) {
    return applyGameOver(game, "quisling");
  }

  if (game.successes >= SUCCESS_WIN) {
    return {
      ...game,
      phase: "final_accusation",
      accusationVotes: {},
      phaseDeadline: Date.now() + PHASE_TIMERS_MS.final_accusation,
      selectedBuildingId: null,
      proposedTeam: [],
      votes: {},
      heistCards: {},
      heistReveal: null,
      voteReveal: null,
      pendingNextPhase: null,
      rejectedPlans: 0,
    };
  }

  const nextOpNumber = game.operationNumber + 1;

  if (nextOpNumber > MAX_OPERATIONS) {
    return applyGameOver(game, "quisling");
  }

  const nextLeaderId = getNextLeaderId(game.players, game.leaderId);

  return {
    ...game,
    phase: "pick_building",
    operationNumber: nextOpNumber,
    leaderId: nextLeaderId,
    selectedBuildingId: null,
    proposedTeam: [],
    votes: {},
    heistCards: {},
    heistReveal: null,
    voteReveal: null,
    rejectedPlans: 0,
    pendingNextPhase: null,
    phaseDeadline: Date.now() + PHASE_TIMERS_MS.pick_building,
  };
}

function applyForcedEscalation(game) {
  let nextGame = {
    ...game,
    alarm: game.alarm + 1,
    rejectedPlans: 0,
    voteReveal: null,
    pendingNextPhase: null,
  };

  if (game.selectedBuildingId && !nextGame.spentBuildingIds.includes(game.selectedBuildingId)) {
    nextGame.spentBuildingIds = [...nextGame.spentBuildingIds, game.selectedBuildingId];
    nextGame.operationHistory = [...nextGame.operationHistory, buildOperationRecord(game, "escalated", 0, 0)];
  }

  return advanceToNextOperation(nextGame);
}

function resolveVotes(game) {
  const votes = game.votes;
  const approveCount = Object.values(votes).filter((v) => v === "approve").length;
  const passed = approveCount >= 3;

  let nextRejectedPlans = game.rejectedPlans;
  let nextLeaderId = game.leaderId;
  let pendingNextPhase;

  if (passed) {
    pendingNextPhase = "submit_heist";
  } else {
    nextRejectedPlans = game.rejectedPlans + 1;
    if (nextRejectedPlans >= MAX_REJECTED_PLANS) {
      pendingNextPhase = "forced_escalation";
    } else {
      pendingNextPhase = "propose_team";
      nextLeaderId = getNextLeaderId(game.players, game.leaderId);
    }
  }

  return {
    ...game,
    votes,
    voteReveal: { ...votes },
    phase: "vote_result",
    phaseDeadline: Date.now() + RESULT_DISPLAY_MS,
    pendingNextPhase,
    rejectedPlans: nextRejectedPlans,
    leaderId: nextLeaderId,
  };
}

function applyAccusationTally(game) {
  const accusationVotes = game.accusationVotes || {};
  const tally = {};

  for (const targetId of Object.values(accusationVotes)) {
    tally[targetId] = (tally[targetId] || 0) + 1;
  }

  if (Object.keys(tally).length === 0) {
    return applyGameOver(game, "quisling");
  }

  const maxVotes = Math.max(...Object.values(tally));
  const topCandidates = Object.keys(tally).filter((id) => tally[id] === maxVotes);

  // Tie → quisling wins
  if (topCandidates.length > 1) {
    return applyGameOver(game, "quisling");
  }

  const detainedId = topCandidates[0];
  const detainedPlayer = game.players.find((p) => p.userId === detainedId);
  const winner = detainedId === game.quislingId ? "crew" : "quisling";

  return {
    ...applyGameOver(game, winner),
    detainedUserId: detainedId,
    detainedDisplayName: detainedPlayer ? detainedPlayer.displayName : "Unknown",
    result: {
      winner,
      quislingId: game.quislingId,
      quislingDisplayName: game.players.find((p) => p.userId === game.quislingId)?.displayName ?? "Unknown",
      detainedUserId: detainedId,
      detainedDisplayName: detainedPlayer ? detainedPlayer.displayName : "Unknown",
      operationHistory: game.operationHistory || [],
    },
  };
}

// Lazy timeout: applied in GET when phaseDeadline is past; returns updated game or null if no change
async function applyLazyTimeout(game) {
  if (!game.phaseDeadline || game.phaseDeadline > Date.now()) {
    return null;
  }

  const now = Date.now();

  switch (game.phase) {
    case "pick_building": {
      let next = { ...game, rejectedPlans: game.rejectedPlans + 1 };
      if (next.rejectedPlans >= MAX_REJECTED_PLANS) {
        return applyForcedEscalation(next);
      }
      next.leaderId = getNextLeaderId(game.players, game.leaderId);
      return {
        ...next,
        phase: "pick_building",
        selectedBuildingId: null,
        phaseDeadline: now + PHASE_TIMERS_MS.pick_building,
      };
    }

    case "propose_team": {
      let next = { ...game, rejectedPlans: game.rejectedPlans + 1 };
      if (next.rejectedPlans >= MAX_REJECTED_PLANS) {
        return applyForcedEscalation(next);
      }
      next.leaderId = getNextLeaderId(game.players, game.leaderId);
      return {
        ...next,
        phase: "propose_team",
        proposedTeam: [],
        phaseDeadline: now + PHASE_TIMERS_MS.propose_team,
      };
    }

    case "vote": {
      const votes = { ...game.votes };
      for (const p of game.players) {
        if (!votes[p.userId]) votes[p.userId] = "reject";
      }
      return resolveVotes({ ...game, votes });
    }

    case "submit_heist": {
      const cleanCount = Object.values(game.heistCards || {}).filter((c) => c === "clean").length;
      const sabotageCount = Object.values(game.heistCards || {}).filter((c) => c === "sabotage").length;
      let next = {
        ...game,
        alarm: game.alarm + 1,
        spentBuildingIds: game.selectedBuildingId
          ? [...(game.spentBuildingIds || []), game.selectedBuildingId]
          : game.spentBuildingIds || [],
        operationHistory: [
          ...(game.operationHistory || []),
          buildOperationRecord(game, "alarm", cleanCount, sabotageCount),
        ],
        heistReveal: { cleanCount, sabotageCount, outcome: "alarm" },
        phase: "heist_result",
        phaseDeadline: Date.now() + RESULT_DISPLAY_MS,
        pendingNextPhase: "next_operation",
      };
      return next;
    }

    case "final_accusation": {
      return applyAccusationTally(game);
    }

    case "vote_result": {
      if (game.pendingNextPhase === "submit_heist") {
        return { ...game, phase: "submit_heist", heistCards: {}, phaseDeadline: now + PHASE_TIMERS_MS.submit_heist, voteReveal: null, pendingNextPhase: null };
      }
      if (game.pendingNextPhase === "propose_team") {
        return { ...game, phase: "propose_team", proposedTeam: [], phaseDeadline: now + PHASE_TIMERS_MS.propose_team, voteReveal: null, pendingNextPhase: null };
      }
      if (game.pendingNextPhase === "forced_escalation") {
        return applyForcedEscalation(game);
      }
      return null;
    }

    case "heist_result": {
      const next = advanceToNextOperation(game);
      return { ...next, heistReveal: null, pendingNextPhase: null };
    }

    default:
      return null;
  }
}

// Server-side scheduled timeouts (fires independently of client requests)
function schedulePhaseTimeout(roomCode, phase, delayMs) {
  const key = `${roomCode}:${phase}`;
  clearTimeout(scheduledTimeouts.get(key));

  const timeoutId = setTimeout(async () => {
    scheduledTimeouts.delete(key);
    try {
      const game = await database.getGameByRoomCode(roomCode);
      if (!game || game.phase !== phase) return;
      await handleServerPhaseTimeout(game, roomCode);
    } catch (err) {
      console.error(`Phase timeout error for ${roomCode}:${phase}:`, err);
    }
  }, delayMs);

  scheduledTimeouts.set(key, timeoutId);
}

async function handleServerPhaseTimeout(game, roomCode) {
  const now = Date.now();

  if (game.phase === "pick_building") {
    let next = { ...game, rejectedPlans: game.rejectedPlans + 1 };
    if (next.rejectedPlans >= MAX_REJECTED_PLANS) {
      next = applyForcedEscalation(next);
    } else {
      next.leaderId = getNextLeaderId(game.players, game.leaderId);
      next = { ...next, phase: "pick_building", selectedBuildingId: null, phaseDeadline: now + PHASE_TIMERS_MS.pick_building };
      schedulePhaseTimeout(roomCode, "pick_building", PHASE_TIMERS_MS.pick_building);
    }
    await database.updateGameByRoomCode(roomCode, next);
    io.to(roomCode).emit("game:state", buildClientState(next));
    scheduleNextPhaseTimeout(next, roomCode);
    return;
  }

  if (game.phase === "propose_team") {
    let next = { ...game, rejectedPlans: game.rejectedPlans + 1 };
    if (next.rejectedPlans >= MAX_REJECTED_PLANS) {
      next = applyForcedEscalation(next);
    } else {
      next.leaderId = getNextLeaderId(game.players, game.leaderId);
      next = { ...next, phase: "propose_team", proposedTeam: [], phaseDeadline: now + PHASE_TIMERS_MS.propose_team };
      schedulePhaseTimeout(roomCode, "propose_team", PHASE_TIMERS_MS.propose_team);
    }
    await database.updateGameByRoomCode(roomCode, next);
    io.to(roomCode).emit("game:state", buildClientState(next));
    scheduleNextPhaseTimeout(next, roomCode);
    return;
  }

  if (game.phase === "vote") {
    const votes = { ...game.votes };
    for (const p of game.players) {
      if (!votes[p.userId]) votes[p.userId] = "reject";
    }
    const next = resolveVotes({ ...game, votes });
    await database.updateGameByRoomCode(roomCode, next);
    io.to(roomCode).emit("game:state", buildClientState(next));
    setTimeout(() => advanceFromVoteResult(roomCode), RESULT_DISPLAY_MS);
    return;
  }

  if (game.phase === "submit_heist") {
    const cleanCount = Object.values(game.heistCards || {}).filter((c) => c === "clean").length;
    const sabotageCount = Object.values(game.heistCards || {}).filter((c) => c === "sabotage").length;
    const next = {
      ...game,
      alarm: game.alarm + 1,
      spentBuildingIds: game.selectedBuildingId ? [...(game.spentBuildingIds || []), game.selectedBuildingId] : game.spentBuildingIds || [],
      operationHistory: [...(game.operationHistory || []), buildOperationRecord(game, "alarm", cleanCount, sabotageCount)],
      heistReveal: { cleanCount, sabotageCount, outcome: "alarm" },
      phase: "heist_result",
      phaseDeadline: Date.now() + RESULT_DISPLAY_MS,
      pendingNextPhase: "next_operation",
    };
    await database.updateGameByRoomCode(roomCode, next);
    io.to(roomCode).emit("game:state", buildClientState(next));
    setTimeout(() => advanceFromHeistResult(roomCode), RESULT_DISPLAY_MS);
    return;
  }

  if (game.phase === "final_accusation") {
    const next = applyAccusationTally(game);
    await database.updateGameByRoomCode(roomCode, next);
    io.to(roomCode).emit("game:state", buildClientState(next));
    return;
  }
}

async function advanceFromVoteResult(roomCode) {
  try {
    const game = await database.getGameByRoomCode(roomCode);
    if (!game || game.phase !== "vote_result") return;
    const now = Date.now();
    let next;

    if (game.pendingNextPhase === "submit_heist") {
      next = { ...game, phase: "submit_heist", heistCards: {}, phaseDeadline: now + PHASE_TIMERS_MS.submit_heist, voteReveal: null, pendingNextPhase: null };
      schedulePhaseTimeout(roomCode, "submit_heist", PHASE_TIMERS_MS.submit_heist);
    } else if (game.pendingNextPhase === "propose_team") {
      next = { ...game, phase: "propose_team", proposedTeam: [], phaseDeadline: now + PHASE_TIMERS_MS.propose_team, voteReveal: null, pendingNextPhase: null };
      schedulePhaseTimeout(roomCode, "propose_team", PHASE_TIMERS_MS.propose_team);
    } else if (game.pendingNextPhase === "forced_escalation") {
      next = applyForcedEscalation(game);
      scheduleNextPhaseTimeout(next, roomCode);
    } else {
      return;
    }

    if (next.phase === "submit_heist") {
      next = await applyDevBotHeistCards(roomCode, next);
    }

    await database.updateGameByRoomCode(roomCode, next);
    io.to(roomCode).emit("game:state", buildClientState(next));

    if (next.phase === "heist_result") {
      setTimeout(() => advanceFromHeistResult(roomCode), RESULT_DISPLAY_MS);
    }
  } catch (err) {
    console.error(`advanceFromVoteResult error for ${roomCode}:`, err);
  }
}

async function advanceFromHeistResult(roomCode) {
  try {
    const game = await database.getGameByRoomCode(roomCode);
    if (!game || game.phase !== "heist_result") return;
    const next = { ...advanceToNextOperation(game), heistReveal: null, pendingNextPhase: null };
    scheduleNextPhaseTimeout(next, roomCode);
    await database.updateGameByRoomCode(roomCode, next);
    io.to(roomCode).emit("game:state", buildClientState(next));
  } catch (err) {
    console.error(`advanceFromHeistResult error for ${roomCode}:`, err);
  }
}

function scheduleNextPhaseTimeout(game, roomCode) {
  if (!game.phaseDeadline) return;
  const delay = Math.max(0, game.phaseDeadline - Date.now());
  if (["pick_building", "propose_team", "vote", "submit_heist", "final_accusation"].includes(game.phase)) {
    schedulePhaseTimeout(roomCode, game.phase, delay);
  }
}

async function applyDevBotVotes(roomCode, game) {
  if (!isDevelopmentMode() || game.phase !== "vote") {
    return game;
  }

  let next = game;

  for (const botUserId of getDevBotPlayerIds(next)) {
    if (next.votes?.[botUserId]) {
      continue;
    }

    const updated = await database.atomicSetGameField(
      roomCode,
      "vote",
      "votes",
      botUserId,
      "approve"
    );

    if (updated) {
      next = updated;
    }
  }

  if (Object.keys(next.votes || {}).length >= next.players.length) {
    next = resolveVotes(next);
  }

  return next;
}

async function applyDevBotHeistCards(roomCode, game) {
  if (!isDevelopmentMode() || game.phase !== "submit_heist") {
    return game;
  }

  let next = game;
  const botTeamMembers = (next.proposedTeam || []).filter((userId) => isDevBotUserId(userId));

  for (const botUserId of botTeamMembers) {
    if (next.heistCards?.[botUserId]) {
      continue;
    }

    const updated = await database.atomicSetGameField(
      roomCode,
      "submit_heist",
      "heistCards",
      botUserId,
      "clean"
    );

    if (updated) {
      next = updated;
    }
  }

  const nextCards = next.heistCards || {};

  if (Object.keys(nextCards).length >= (next.proposedTeam || []).length) {
    const cleanCount = Object.values(nextCards).filter((card) => card === "clean").length;
    const sabotageCount = Object.values(nextCards).filter((card) => card === "sabotage").length;
    const outcome = sabotageCount > 0 ? "alarm" : "success";

    next = {
      ...next,
      alarm: outcome === "alarm" ? next.alarm + 1 : next.alarm,
      successes: outcome === "success" ? next.successes + 1 : next.successes,
      spentBuildingIds: next.selectedBuildingId
        ? [...(next.spentBuildingIds || []), next.selectedBuildingId]
        : next.spentBuildingIds || [],
      operationHistory: [
        ...(next.operationHistory || []),
        buildOperationRecord(next, outcome, cleanCount, sabotageCount),
      ],
      heistReveal: { cleanCount, sabotageCount, outcome },
      phase: "heist_result",
      phaseDeadline: Date.now() + RESULT_DISPLAY_MS,
      pendingNextPhase: "next_operation",
    };
  }

  return next;
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const pair of cookieHeader.split(";")) {
    const [name, ...rest] = pair.trim().split("=");
    if (name) cookies[name.trim()] = rest.join("=").trim();
  }
  return cookies;
}

async function authenticateSocket(socket) {
  const cookies = parseCookies(socket.handshake?.headers?.cookie);
  const token = cookies[authCookieName];
  if (!token) return null;
  const session = await database.findSessionByToken(token);
  if (!session) return null;
  const user = await database.findUserById(session.userId);
  return user || null;
}

io.on("connection", (socket) => {
  socket.on("game:join", async ({ roomCode }) => {
    if (!roomCode) return;

    const user = await authenticateSocket(socket);
    if (!user) return;

    try {
      let game = await database.getGameByRoomCode(roomCode);
      if (!game) return;

      // Verify user is a participant
      const inGame = game.players.some((p) => p.userId === user.id);
      if (!inGame) return;

      socket.join(roomCode);

      const advanced = await applyLazyTimeout(game);
      if (advanced) {
        const { _id, ...updates } = advanced;
        await database.updateGameByRoomCode(roomCode, updates);
        io.to(roomCode).emit("game:state", buildClientState(advanced));
        scheduleNextPhaseTimeout(advanced, roomCode);
      } else {
        socket.emit("game:state", buildClientState(game));
      }
    } catch {
      // Non-fatal: client will fetch via REST
    }
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "the-quisling",
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/auth/register", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!emailRegex.test(email)) {
    res.status(400).json({
      ok: false,
      message: "Please provide a valid email address.",
    });
    return;
  }

  if (password.length < passwordMinLength) {
    res.status(400).json({
      ok: false,
      message: `Password must be at least ${passwordMinLength} characters.`,
    });
    return;
  }

  try {
    const existingUser = await database.findUserByEmail(email);

    if (existingUser) {
      res.status(409).json({
        ok: false,
        message: "An account with that email already exists.",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, bcryptSaltRounds);
    const user = {
      id: `usr_${crypto.randomUUID()}`,
      email,
      passwordHash,
      displayName: normalizeDisplayName(req.body?.displayName, email),
      createdAt: nowIso(),
      stats: {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
      },
      friends: [],
      history: [],
    };

    await database.createUser(user);

    const existingAuth = await getUserFromRequest(req);

    if (existingAuth) {
      await database.deleteSessionByToken(existingAuth.token);
    }

    const session = createSessionForUser(user.id);

    await database.createSession(session);
    setAuthCookie(res, session.token);

    res.status(201).json({
      ok: true,
      message: "Account created and logged in.",
      user: toPublicUser(user),
      session: {
        loggedInAt: session.createdAt,
      },
    });
  } catch {
    res.status(500).json({
      ok: false,
      message: "Failed to register account.",
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!emailRegex.test(email)) {
    res.status(400).json({
      ok: false,
      message: "Please provide a valid email address.",
    });
    return;
  }

  try {
    const user = await database.findUserByEmail(email);

    if (!user) {
      res.status(401).json({
        ok: false,
        message: "Invalid email or password.",
      });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      res.status(401).json({
        ok: false,
        message: "Invalid email or password.",
      });
      return;
    }

    const existingAuth = await getUserFromRequest(req);

    if (existingAuth) {
      await database.deleteSessionByToken(existingAuth.token);
    }

    const session = createSessionForUser(user.id);

    await database.createSession(session);
    setAuthCookie(res, session.token);

    res.status(200).json({
      ok: true,
      message: "Logged in successfully.",
      user: toPublicUser(user),
      session: {
        loggedInAt: session.createdAt,
      },
    });
  } catch {
    res.status(500).json({
      ok: false,
      message: "Failed to log in.",
    });
  }
});

app.post("/api/auth/guest", async (req, res) => {
  try {
    const existingAuth = await getUserFromRequest(req);

    if (existingAuth) {
      res.status(200).json({
        ok: true,
        message: existingAuth.user.isGuest ? "Guest session ready." : "Signed in successfully.",
        user: toPublicUser(existingAuth.user),
        session: {
          loggedInAt: existingAuth.session.createdAt,
        },
      });
      return;
    }

    const guestUser = createGuestUser();
    await database.createUser(guestUser);

    const session = createSessionForUser(guestUser.id);
    await database.createSession(session);
    setAuthCookie(res, session.token);

    res.status(201).json({
      ok: true,
      message: "Guest session ready.",
      user: toPublicUser(guestUser),
      session: {
        loggedInAt: session.createdAt,
      },
    });
  } catch (error) {
    console.error("POST /api/auth/guest error:", error);
    res.status(500).json({
      ok: false,
      message: "Failed to create a guest session.",
    });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  const token = req.cookies?.[authCookieName];

  if (token) {
    await database.deleteSessionByToken(token);
  }

  clearAuthCookie(res);

  res.status(200).json({
    ok: true,
    message: "Logged out.",
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const { user, session } = req.auth;

  res.status(200).json({
    ok: true,
    user: toPublicUser(user),
    session: {
      loggedInAt: session.createdAt,
    },
  });
});

app.get("/api/protected", requireAuth, (req, res) => {
  const { user } = req.auth;

  res.status(200).json({
    ok: true,
    message: `Welcome ${user.displayName}, this is a restricted endpoint.`,
    data: {
      grantedAt: nowIso(),
      userId: user.id,
      email: user.email,
    },
  });
});

app.patch("/api/profile", requireAuth, async (req, res) => {
  const nextDisplayName = String(req.body?.displayName || "").trim();

  if (!nextDisplayName) {
    res.status(400).json({
      ok: false,
      message: "Display name cannot be empty.",
    });
    return;
  }

  try {
    const updatedUser = await database.updateUserById(req.auth.user.id, {
      displayName: nextDisplayName,
    });

    if (!updatedUser) {
      res.status(404).json({
        ok: false,
        message: "User not found.",
      });
      return;
    }

    res.status(200).json({
      ok: true,
      message: "Profile updated.",
      user: toPublicUser(updatedUser),
    });
  } catch {
    res.status(500).json({
      ok: false,
      message: "Failed to update profile.",
    });
  }
});

app.get("/api/results", requireAuth, async (req, res) => {
  try {
    const { user } = req.auth;
    const results = await database.getResultsByUserId(user.id);

    res.status(200).json({
      ok: true,
      results: results.map(toPublicResult),
    });
  } catch {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch results.",
    });
  }
});

app.get("/api/results/:resultId", requireAuth, async (req, res) => {
  const { user } = req.auth;

  try {
    const result = await database.getResultByIdForUser(req.params.resultId, user.id);

    if (!result) {
      res.status(404).json({
        ok: false,
        message: "Result not found.",
      });
      return;
    }

    res.status(200).json({
      ok: true,
      result: toPublicResult(result),
    });
  } catch {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch result.",
    });
  }
});

app.post("/api/results", requireAuth, async (req, res) => {
  const { user } = req.auth;
  const parsedResult = parseResultInput(req.body, user.id);

  if (!parsedResult) {
    res.status(400).json({
      ok: false,
      message: "Invalid result payload.",
    });
    return;
  }

  try {
    const existingResult = await database.getResultByIdForUser(parsedResult.id, user.id);
    const savedResult = await database.upsertResult(parsedResult);

    if (!existingResult) {
      await database.applyResultToUserProfile(user.id, savedResult);
    }

    res.status(201).json({
      ok: true,
      message: "Result saved.",
      result: toPublicResult(savedResult),
    });
  } catch {
    res.status(500).json({
      ok: false,
      message: "Failed to save result.",
    });
  }
});

app.get("/api/lobbies/:roomCode", requireAuth, async (req, res) => {
  const roomCode = normalizeRoomCode(req.params.roomCode);

  if (!/^[A-Z]{4}$/.test(roomCode)) {
    res.status(400).json({
      ok: false,
      message: "Room code must be 4 letters.",
    });
    return;
  }

  try {
    const lobby = await database.getLobbyByRoomCode(roomCode);

    if (!lobby) {
      res.status(404).json({
        ok: false,
        message: "Lobby not found.",
      });
      return;
    }

    res.status(200).json({
      ok: true,
      lobby: toPublicLobby(lobby, await enrichLobbyPlayerDetails(lobby)),
    });
  } catch {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch lobby.",
    });
  }
});

app.post("/api/lobbies", requireAuth, async (req, res) => {
  const { user } = req.auth;
  const roomCode = normalizeRoomCode(req.body?.roomCode);

  if (!/^[A-Z]{4}$/.test(roomCode)) {
    res.status(400).json({
      ok: false,
      message: "Room code must be 4 letters.",
    });
    return;
  }

  try {
    const existingLobby = await database.getLobbyByRoomCode(roomCode);

    if (existingLobby) {
      res.status(409).json({
        ok: false,
        message: "Room code already exists.",
      });
      return;
    }

    const timestamp = nowIso();
    const lobby = {
      id: `lobby_${crypto.randomUUID()}`,
      roomCode,
      createdAt: timestamp,
      updatedAt: timestamp,
      hostUserId: user.id,
      players: [user.id],
      status: "open",
    };

    await database.createLobby(lobby);

    res.status(201).json({
      ok: true,
      lobby: toPublicLobby(lobby, await enrichLobbyPlayerDetails(lobby)),
    });
  } catch {
    res.status(500).json({
      ok: false,
      message: "Failed to create lobby.",
    });
  }
});

app.post("/api/lobbies/:roomCode/join", requireAuth, async (req, res) => {
  const { user } = req.auth;
  const roomCode = normalizeRoomCode(req.params.roomCode);

  if (!/^[A-Z]{4}$/.test(roomCode)) {
    res.status(400).json({
      ok: false,
      message: "Room code must be 4 letters.",
    });
    return;
  }

  try {
    const lobby = await database.joinLobbyByRoomCode(roomCode, user.id, nowIso());

    if (!lobby) {
      res.status(404).json({
        ok: false,
        message: "Lobby not found.",
      });
      return;
    }

    res.status(200).json({
      ok: true,
      lobby: toPublicLobby(lobby, await enrichLobbyPlayerDetails(lobby)),
    });
  } catch {
    res.status(500).json({
      ok: false,
      message: "Failed to join lobby.",
    });
  }
});

app.post("/api/lobbies/:roomCode/leave", requireAuth, async (req, res) => {
  const { user } = req.auth;
  const roomCode = normalizeRoomCode(req.params.roomCode);

  if (!/^[A-Z]{4}$/.test(roomCode)) {
    res.status(400).json({
      ok: false,
      message: "Room code must be 4 letters.",
    });
    return;
  }

  try {
    const lobby = await database.leaveLobbyByRoomCode(roomCode, user.id, nowIso());

    res.status(200).json({
      ok: true,
      lobby: lobby ? toPublicLobby(lobby, await enrichLobbyPlayerDetails(lobby)) : null,
    });
  } catch {
    res.status(500).json({
      ok: false,
      message: "Failed to leave lobby.",
    });
  }
});

app.post("/api/lobbies/:roomCode/status", requireAuth, async (req, res) => {
  const roomCode = normalizeRoomCode(req.params.roomCode);
  const status = parseLobbyStatus(req.body?.status);

  if (!/^[A-Z]{4}$/.test(roomCode)) {
    res.status(400).json({
      ok: false,
      message: "Room code must be 4 letters.",
    });
    return;
  }

  if (!status) {
    res.status(400).json({
      ok: false,
      message: "Invalid lobby status.",
    });
    return;
  }

  try {
    const lobby = await database.setLobbyStatusByRoomCode(roomCode, status, nowIso());

    if (!lobby) {
      res.status(404).json({
        ok: false,
        message: "Lobby not found.",
      });
      return;
    }

    res.status(200).json({
      ok: true,
      lobby: toPublicLobby(lobby, await enrichLobbyPlayerDetails(lobby)),
    });
  } catch {
    res.status(500).json({
      ok: false,
      message: "Failed to update lobby status.",
    });
  }
});

app.post("/api/lobbies/:roomCode/reopen", requireAuth, async (req, res) => {
  const { user } = req.auth;
  const roomCode = normalizeRoomCode(req.params.roomCode);

  if (!/^[A-Z]{4}$/.test(roomCode)) {
    res.status(400).json({
      ok: false,
      message: "Room code must be 4 letters.",
    });
    return;
  }

  try {
    const timestamp = nowIso();
    const createdLobby = {
      id: `lobby_${crypto.randomUUID()}`,
      roomCode,
      createdAt: timestamp,
      updatedAt: timestamp,
      hostUserId: user.id,
      players: [user.id],
      status: "open",
    };

    const lobby = await database.reopenLobbyByRoomCode(roomCode, user.id, createdLobby);

    res.status(200).json({
      ok: true,
      lobby: toPublicLobby(lobby, await enrichLobbyPlayerDetails(lobby)),
    });
  } catch {
    res.status(500).json({
      ok: false,
      message: "Failed to reopen lobby.",
    });
  }
});

app.post("/api/lobbies/:roomCode/dev-fill", requireAuth, async (req, res) => {
  if (!isDevelopmentMode()) {
    res.status(404).json({
      ok: false,
      message: "Route not found.",
    });
    return;
  }

  const { user } = req.auth;
  const roomCode = normalizeRoomCode(req.params.roomCode);

  if (!/^[A-Z]{4}$/.test(roomCode)) {
    res.status(400).json({
      ok: false,
      message: "Room code must be 4 letters.",
    });
    return;
  }

  try {
    let lobby = await database.getLobbyByRoomCode(roomCode);

    if (!lobby) {
      res.status(404).json({
        ok: false,
        message: "Lobby not found.",
      });
      return;
    }

    if (lobby.hostUserId !== user.id) {
      res.status(403).json({
        ok: false,
        message: "Only the host can use dev fill.",
      });
      return;
    }

    if (lobby.status !== "open") {
      res.status(400).json({
        ok: false,
        message: "Dev fill is only available before the game starts.",
      });
      return;
    }

    let botIndex = 1;

    while ((lobby.players || []).length < PLAYERS_REQUIRED) {
      const nextBot = createDevBotUser(roomCode, botIndex);
      botIndex += 1;
      await database.createUser(nextBot);
      lobby = await database.joinLobbyByRoomCode(roomCode, nextBot.id, nowIso());
    }

    res.status(200).json({
      ok: true,
      lobby: toPublicLobby(lobby, await enrichLobbyPlayerDetails(lobby)),
    });
  } catch (error) {
    console.error("POST /api/lobbies/:roomCode/dev-fill error:", error);
    res.status(500).json({
      ok: false,
      message: "Failed to fill lobby with dev players.",
    });
  }
});

// ─── Game Endpoints ───────────────────────────────────────────────────────────

// POST /api/games — Host starts the game for a lobby
app.post("/api/games", requireAuth, async (req, res) => {
  const { user } = req.auth;
  const roomCode = normalizeRoomCode(req.body?.roomCode);

  if (!/^[A-Z]{4}$/.test(roomCode)) {
    res.status(400).json({ ok: false, message: "Room code must be 4 letters." });
    return;
  }

  try {
    const lobby = await database.getLobbyByRoomCode(roomCode);

    if (!lobby) {
      res.status(404).json({ ok: false, message: "Lobby not found." });
      return;
    }

    if (lobby.hostUserId !== user.id) {
      res.status(403).json({ ok: false, message: "Only the host can start the game." });
      return;
    }

    const playerIds = Array.isArray(lobby.players) ? lobby.players : [];

    if (playerIds.length !== PLAYERS_REQUIRED) {
      res.status(400).json({ ok: false, message: `Exactly ${PLAYERS_REQUIRED} players are required to start.` });
      return;
    }

    // Check if a game already exists for this room
    const existingGame = await database.getGameByRoomCode(roomCode);
    if (existingGame && existingGame.phase !== "game_over") {
      res.status(409).json({ ok: false, message: "A game is already in progress for this room." });
      return;
    }

    // Fetch player display names
    const players = [];
    for (const uid of playerIds) {
      const u = await database.findUserById(uid);
      players.push({ userId: uid, displayName: u ? u.displayName : uid });
    }

    // Assign roles: 1 quisling, 4 crew — randomly
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const quislingId = shuffled[0].userId;

    const devBotIds = players
      .map((player) => player.userId)
      .filter((playerId) => isDevBotUserId(playerId));

    // Keep the host in control when testing with dev bots.
    const leaderId = devBotIds.length > 0
      ? user.id
      : players[Math.floor(Math.random() * players.length)].userId;

    const gameDoc = {
      roomCode,
      phase: "role_reveal",
      players,
      quislingId,
      leaderId,
      operationNumber: 1,
      proposedTeam: [],
      votes: {},
      heistCards: {},
      accusationVotes: {},
      successes: 0,
      alarm: 0,
      rejectedPlans: 0,
      spentBuildingIds: [],
      selectedBuildingId: null,
      phaseDeadline: null,
      operationHistory: [],
      readyPlayerIds: devBotIds,
      voteReveal: null,
      heistReveal: null,
      pendingNextPhase: null,
      detainedUserId: null,
      detainedDisplayName: null,
      result: null,
      createdAt: nowIso(),
    };

    if (existingGame) {
      await database.updateGameByRoomCode(roomCode, gameDoc);
    } else {
      await database.createGame(gameDoc);
    }

    await database.setLobbyStatusByRoomCode(roomCode, "in_progress", nowIso());

    // Broadcast public state to room
    io.to(roomCode).emit("game:state", buildClientState(gameDoc));

    res.status(201).json({ ok: true, gameState: buildClientState(gameDoc) });
  } catch (err) {
    console.error("POST /api/games error:", err);
    res.status(500).json({ ok: false, message: "Failed to start game." });
  }
});

// GET /api/games/:roomCode — Fetch current game state (applies lazy timeout)
app.get("/api/games/:roomCode", requireAuth, async (req, res) => {
  const roomCode = normalizeRoomCode(req.params.roomCode);

  try {
    let game = await database.getGameByRoomCode(roomCode);

    if (!game) {
      res.status(404).json({ ok: false, message: "Game not found." });
      return;
    }

    // Lazy timeout: if deadline has passed, advance phase
    const advanced = await applyLazyTimeout(game);
    if (advanced) {
      await database.updateGameByRoomCode(roomCode, advanced);
      io.to(roomCode).emit("game:state", buildClientState(advanced));
      scheduleNextPhaseTimeout(advanced, roomCode);
      game = advanced;
    }

    res.status(200).json({ ok: true, gameState: buildClientState(game) });
  } catch (err) {
    console.error("GET /api/games/:roomCode error:", err);
    res.status(500).json({ ok: false, message: "Failed to fetch game state." });
  }
});

// GET /api/games/:roomCode/myrole — Returns this player's private role
app.get("/api/games/:roomCode/myrole", requireAuth, async (req, res) => {
  const { user } = req.auth;
  const roomCode = normalizeRoomCode(req.params.roomCode);

  try {
    const game = await database.getGameByRoomCode(roomCode);

    if (!game) {
      res.status(404).json({ ok: false, message: "Game not found." });
      return;
    }

    const inGame = game.players.some((p) => p.userId === user.id);
    if (!inGame) {
      res.status(403).json({ ok: false, message: "You are not in this game." });
      return;
    }

    const role = game.quislingId === user.id ? "quisling" : "crew";
    res.status(200).json({ ok: true, role });
  } catch (err) {
    console.error("GET /api/games/:roomCode/myrole error:", err);
    res.status(500).json({ ok: false, message: "Failed to fetch role." });
  }
});

// POST /api/games/:roomCode/ready — Player confirms they've seen their role
app.post("/api/games/:roomCode/ready", requireAuth, async (req, res) => {
  const { user } = req.auth;
  const roomCode = normalizeRoomCode(req.params.roomCode);

  try {
    // Atomically add user to readyPlayerIds
    const updated = await database.atomicAddToGameSet(roomCode, "role_reveal", "readyPlayerIds", user.id);

    if (!updated) {
      // Either game doesn't exist, wrong phase, or already ready
      const game = await database.getGameByRoomCode(roomCode);
      if (!game) {
        res.status(404).json({ ok: false, message: "Game not found." });
        return;
      }
      // Already ready — return current state
      res.status(200).json({ ok: true, gameState: buildClientState(game) });
      return;
    }

    let next = updated;

    if ((next.readyPlayerIds || []).length >= PLAYERS_REQUIRED) {
      next = {
        ...next,
        phase: "pick_building",
        phaseDeadline: Date.now() + PHASE_TIMERS_MS.pick_building,
      };
      await database.updateGameByRoomCode(roomCode, next);
      schedulePhaseTimeout(roomCode, "pick_building", PHASE_TIMERS_MS.pick_building);
    }

    io.to(roomCode).emit("game:state", buildClientState(next));

    res.status(200).json({ ok: true, gameState: buildClientState(next) });
  } catch (err) {
    console.error("POST /api/games/:roomCode/ready error:", err);
    res.status(500).json({ ok: false, message: "Failed to submit ready." });
  }
});

// POST /api/games/:roomCode/select-building — Leader picks target building
app.post("/api/games/:roomCode/select-building", requireAuth, async (req, res) => {
  const { user } = req.auth;
  const roomCode = normalizeRoomCode(req.params.roomCode);
  const buildingId = String(req.body?.buildingId || "").trim();

  try {
    const game = await database.getGameByRoomCode(roomCode);

    if (!game) {
      res.status(404).json({ ok: false, message: "Game not found." });
      return;
    }

    if (game.phase !== "pick_building") {
      res.status(400).json({ ok: false, message: "Game is not in the pick building phase." });
      return;
    }

    if (game.leaderId !== user.id) {
      res.status(403).json({ ok: false, message: "Only the current leader can select a building." });
      return;
    }

    const validBuildingIds = ["bank-vault", "watchtower", "archives", "armory", "docks", "radio-tower"];

    if (!validBuildingIds.includes(buildingId)) {
      res.status(400).json({ ok: false, message: "Invalid building." });
      return;
    }

    if ((game.spentBuildingIds || []).includes(buildingId)) {
      res.status(400).json({ ok: false, message: "That building has already been used." });
      return;
    }

    const next = {
      ...game,
      selectedBuildingId: buildingId,
      phase: "propose_team",
      proposedTeam: [],
      phaseDeadline: Date.now() + PHASE_TIMERS_MS.propose_team,
    };

    schedulePhaseTimeout(roomCode, "propose_team", PHASE_TIMERS_MS.propose_team);
    await database.updateGameByRoomCode(roomCode, next);
    io.to(roomCode).emit("game:state", buildClientState(next));

    res.status(200).json({ ok: true, gameState: buildClientState(next) });
  } catch (err) {
    console.error("POST /api/games/:roomCode/select-building error:", err);
    res.status(500).json({ ok: false, message: "Failed to select building." });
  }
});

// POST /api/games/:roomCode/propose-team — Leader proposes a team
app.post("/api/games/:roomCode/propose-team", requireAuth, async (req, res) => {
  const { user } = req.auth;
  const roomCode = normalizeRoomCode(req.params.roomCode);
  const teamUserIds = req.body?.teamUserIds;

  try {
    const game = await database.getGameByRoomCode(roomCode);

    if (!game) {
      res.status(404).json({ ok: false, message: "Game not found." });
      return;
    }

    if (game.phase !== "propose_team") {
      res.status(400).json({ ok: false, message: "Game is not in the propose team phase." });
      return;
    }

    if (game.leaderId !== user.id) {
      res.status(403).json({ ok: false, message: "Only the current leader can propose a team." });
      return;
    }

    if (!Array.isArray(teamUserIds)) {
      res.status(400).json({ ok: false, message: "teamUserIds must be an array." });
      return;
    }

    const required = OPERATION_TEAM_SIZES[game.operationNumber];
    if (teamUserIds.length !== required) {
      res.status(400).json({ ok: false, message: `Operation ${game.operationNumber} requires exactly ${required} players.` });
      return;
    }

    const playerIds = game.players.map((p) => p.userId);
    const allValid = teamUserIds.every((id) => playerIds.includes(id));
    if (!allValid) {
      res.status(400).json({ ok: false, message: "All team members must be in the game." });
      return;
    }

    const uniqueIds = new Set(teamUserIds);
    if (uniqueIds.size !== teamUserIds.length) {
      res.status(400).json({ ok: false, message: "Team members must be unique." });
      return;
    }

    const next = {
      ...game,
      proposedTeam: teamUserIds,
      votes: {},
      phase: "vote",
      phaseDeadline: Date.now() + PHASE_TIMERS_MS.vote,
    };

    schedulePhaseTimeout(roomCode, "vote", PHASE_TIMERS_MS.vote);
    let finalState = await applyDevBotVotes(roomCode, next);
    await database.updateGameByRoomCode(roomCode, finalState);
    io.to(roomCode).emit("game:state", buildClientState(finalState));

    if (finalState.phase === "vote_result") {
      setTimeout(() => advanceFromVoteResult(roomCode), RESULT_DISPLAY_MS);
    }

    res.status(200).json({ ok: true, gameState: buildClientState(finalState) });
  } catch (err) {
    console.error("POST /api/games/:roomCode/propose-team error:", err);
    res.status(500).json({ ok: false, message: "Failed to propose team." });
  }
});

// POST /api/games/:roomCode/vote — Player votes approve or reject
app.post("/api/games/:roomCode/vote", requireAuth, async (req, res) => {
  const { user } = req.auth;
  const roomCode = normalizeRoomCode(req.params.roomCode);
  const choice = req.body?.choice;

  if (choice !== "approve" && choice !== "reject") {
    res.status(400).json({ ok: false, message: "Vote must be 'approve' or 'reject'." });
    return;
  }

  try {
    // Atomically set this player's vote only if they haven't voted yet
    const updated = await database.atomicSetGameField(roomCode, "vote", "votes", user.id, choice);

    if (!updated) {
      const game = await database.getGameByRoomCode(roomCode);
      if (!game) {
        res.status(404).json({ ok: false, message: "Game not found." });
        return;
      }
      if (game.phase !== "vote") {
        res.status(400).json({ ok: false, message: "Game is not in the voting phase." });
        return;
      }
      if (game.votes && game.votes[user.id]) {
        res.status(400).json({ ok: false, message: "You have already voted." });
        return;
      }
      const inGame = game.players.some((p) => p.userId === user.id);
      if (!inGame) {
        res.status(403).json({ ok: false, message: "You are not in this game." });
        return;
      }
      res.status(400).json({ ok: false, message: "Could not submit vote." });
      return;
    }

    let next = await applyDevBotVotes(roomCode, updated);

    // If all players have voted, resolve
    if (next.phase === "vote_result" || Object.keys(next.votes || {}).length >= next.players.length) {
      if (next.phase !== "vote_result") {
        next = resolveVotes(next);
      }
      await database.updateGameByRoomCode(roomCode, next);
      io.to(roomCode).emit("game:state", buildClientState(next));
      setTimeout(() => advanceFromVoteResult(roomCode), RESULT_DISPLAY_MS);
    } else {
      io.to(roomCode).emit("game:state", buildClientState(next));
    }

    res.status(200).json({ ok: true, gameState: buildClientState(next) });
  } catch (err) {
    console.error("POST /api/games/:roomCode/vote error:", err);
    res.status(500).json({ ok: false, message: "Failed to submit vote." });
  }
});

// POST /api/games/:roomCode/submit-card — Team member submits heist card
app.post("/api/games/:roomCode/submit-card", requireAuth, async (req, res) => {
  const { user } = req.auth;
  const roomCode = normalizeRoomCode(req.params.roomCode);
  const card = req.body?.card;

  if (card !== "clean" && card !== "sabotage") {
    res.status(400).json({ ok: false, message: "Card must be 'clean' or 'sabotage'." });
    return;
  }

  try {
    // Pre-validate: need to check role enforcement before atomic write
    const preGame = await database.getGameByRoomCode(roomCode);

    if (!preGame) {
      res.status(404).json({ ok: false, message: "Game not found." });
      return;
    }

    if (preGame.phase !== "submit_heist") {
      res.status(400).json({ ok: false, message: "Game is not in the heist phase." });
      return;
    }

    if (!(preGame.proposedTeam || []).includes(user.id)) {
      res.status(403).json({ ok: false, message: "You are not on the heist team." });
      return;
    }

    // Role enforcement: only the Quisling can submit sabotage
    if (card === "sabotage" && preGame.quislingId !== user.id) {
      res.status(403).json({ ok: false, message: "Only the Quisling can submit sabotage." });
      return;
    }

    // Atomically set this player's heist card
    const updated = await database.atomicSetGameField(roomCode, "submit_heist", "heistCards", user.id, card);

    if (!updated) {
      res.status(400).json({ ok: false, message: "You have already submitted your card." });
      return;
    }

    let next = updated;

    // If all team members have submitted, resolve the heist
    const nextCards = next.heistCards || {};
    if (Object.keys(nextCards).length >= (next.proposedTeam || []).length) {
      const cleanCount = Object.values(nextCards).filter((c) => c === "clean").length;
      const sabotageCount = Object.values(nextCards).filter((c) => c === "sabotage").length;
      const outcome = sabotageCount > 0 ? "alarm" : "success";

      next = {
        ...next,
        alarm: outcome === "alarm" ? next.alarm + 1 : next.alarm,
        successes: outcome === "success" ? next.successes + 1 : next.successes,
        spentBuildingIds: next.selectedBuildingId
          ? [...(next.spentBuildingIds || []), next.selectedBuildingId]
          : next.spentBuildingIds || [],
        operationHistory: [...(next.operationHistory || []), buildOperationRecord(next, outcome, cleanCount, sabotageCount)],
        heistReveal: { cleanCount, sabotageCount, outcome },
        phase: "heist_result",
        phaseDeadline: Date.now() + RESULT_DISPLAY_MS,
        pendingNextPhase: "next_operation",
      };

      await database.updateGameByRoomCode(roomCode, next);
      io.to(roomCode).emit("game:state", buildClientState(next));
      setTimeout(() => advanceFromHeistResult(roomCode), RESULT_DISPLAY_MS);
    } else {
      io.to(roomCode).emit("game:state", buildClientState(next));
    }

    res.status(200).json({ ok: true, gameState: buildClientState(next) });
  } catch (err) {
    console.error("POST /api/games/:roomCode/submit-card error:", err);
    res.status(500).json({ ok: false, message: "Failed to submit heist card." });
  }
});

// POST /api/games/:roomCode/accuse — Player submits final accusation vote
app.post("/api/games/:roomCode/accuse", requireAuth, async (req, res) => {
  const { user } = req.auth;
  const roomCode = normalizeRoomCode(req.params.roomCode);
  const targetUserId = String(req.body?.targetUserId || "").trim();

  try {
    // Pre-validate target is in game
    const preGame = await database.getGameByRoomCode(roomCode);

    if (!preGame) {
      res.status(404).json({ ok: false, message: "Game not found." });
      return;
    }

    if (preGame.phase !== "final_accusation") {
      res.status(400).json({ ok: false, message: "Game is not in the final accusation phase." });
      return;
    }

    const inGame = preGame.players.some((p) => p.userId === user.id);
    if (!inGame) {
      res.status(403).json({ ok: false, message: "You are not in this game." });
      return;
    }

    const targetInGame = preGame.players.some((p) => p.userId === targetUserId);
    if (!targetInGame) {
      res.status(400).json({ ok: false, message: "Accusation target is not in the game." });
      return;
    }

    // Atomically set this player's accusation vote
    const updated = await database.atomicSetGameField(roomCode, "final_accusation", "accusationVotes", user.id, targetUserId);

    if (!updated) {
      res.status(400).json({ ok: false, message: "You have already submitted your accusation." });
      return;
    }

    let next = updated;

    // If all players have accused, tally
    if (Object.keys(next.accusationVotes || {}).length >= next.players.length) {
      next = applyAccusationTally(next);
      await database.updateGameByRoomCode(roomCode, next);
    }

    io.to(roomCode).emit("game:state", buildClientState(next));

    res.status(200).json({ ok: true, gameState: buildClientState(next) });
  } catch (err) {
    console.error("POST /api/games/:roomCode/accuse error:", err);
    res.status(500).json({ ok: false, message: "Failed to submit accusation." });
  }
});

app.use((error, _req, res, next) => {
  if (!error) {
    next();
    return;
  }

  const isInvalidJson =
    error instanceof SyntaxError &&
    Object.prototype.hasOwnProperty.call(error, "status") &&
    error.status === 400 &&
    Object.prototype.hasOwnProperty.call(error, "body");

  if (isInvalidJson) {
    res.status(400).json({
      ok: false,
      message: "Request body must be valid JSON.",
    });
    return;
  }

  console.error("Unhandled service error:", error);
  res.status(500).json({
    ok: false,
    message: "Internal server error.",
  });
});

app.use(express.static(staticDir, { index: false }));

app.get(/^(?!\/api).*/, (_req, res) => {
  if (!fs.existsSync(indexFile)) {
    res
      .status(503)
      .send("Frontend build not found. Run `npm run build` before starting the service.");
    return;
  }

  res.sendFile(indexFile);
});

app.use("/api", (_req, res) => {
  res.status(404).json({
    ok: false,
    message: "API route not found.",
  });
});

async function startServer() {
  await database.initializeDatabase();

  httpServer.listen(port, () => {
    // Keep startup logging concise for local development and deployment logs.
    console.log(`Service listening on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to initialize service:", error);
  process.exit(1);
});
