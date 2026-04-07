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

function toPublicLobby(lobby) {
  return {
    id: lobby.id,
    roomCode: lobby.roomCode,
    createdAt: lobby.createdAt,
    updatedAt: lobby.updatedAt,
    hostUserId: lobby.hostUserId,
    players: Array.isArray(lobby.players) ? lobby.players : [],
    status: lobby.status,
  };
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
      next.leaderId = getNextLeaderId(game.players, game.leaderId);
      if (next.rejectedPlans >= MAX_REJECTED_PLANS) {
        return applyForcedEscalation(next);
      }
      return {
        ...next,
        phase: "pick_building",
        selectedBuildingId: null,
        phaseDeadline: now + PHASE_TIMERS_MS.pick_building,
      };
    }

    case "propose_team": {
      let next = { ...game, rejectedPlans: game.rejectedPlans + 1 };
      next.leaderId = getNextLeaderId(game.players, game.leaderId);
      if (next.rejectedPlans >= MAX_REJECTED_PLANS) {
        return applyForcedEscalation(next);
      }
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
        phaseDeadline: null,
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
    next.leaderId = getNextLeaderId(game.players, game.leaderId);
    if (next.rejectedPlans >= MAX_REJECTED_PLANS) {
      next = applyForcedEscalation(next);
    } else {
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
    next.leaderId = getNextLeaderId(game.players, game.leaderId);
    if (next.rejectedPlans >= MAX_REJECTED_PLANS) {
      next = applyForcedEscalation(next);
    } else {
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
      phaseDeadline: null,
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

    await database.updateGameByRoomCode(roomCode, next);
    io.to(roomCode).emit("game:state", buildClientState(next));
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

// ─── Socket.IO ────────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  socket.on("game:join", async ({ roomCode }) => {
    if (!roomCode) return;
    socket.join(roomCode);
    try {
      const game = await database.getGameByRoomCode(roomCode);
      if (game) {
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

    const token = `sess_${crypto.randomUUID()}`;
    const session = {
      token,
      userId: user.id,
      createdAt: nowIso(),
    };

    await database.createSession(session);
    setAuthCookie(res, token);

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

    const token = `sess_${crypto.randomUUID()}`;
    const session = {
      token,
      userId: user.id,
      createdAt: nowIso(),
    };

    await database.createSession(session);
    setAuthCookie(res, token);

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
      lobby: toPublicLobby(lobby),
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
      lobby: toPublicLobby(lobby),
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
      lobby: toPublicLobby(lobby),
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
      lobby: lobby ? toPublicLobby(lobby) : null,
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
      lobby: toPublicLobby(lobby),
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
      lobby: toPublicLobby(lobby),
    });
  } catch {
    res.status(500).json({
      ok: false,
      message: "Failed to reopen lobby.",
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

    // Random first leader
    const leaderId = players[Math.floor(Math.random() * players.length)].userId;

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
      readyPlayerIds: [],
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
    const game = await database.getGameByRoomCode(roomCode);

    if (!game) {
      res.status(404).json({ ok: false, message: "Game not found." });
      return;
    }

    if (game.phase !== "role_reveal") {
      res.status(400).json({ ok: false, message: "Game is not in the role reveal phase." });
      return;
    }

    const readyIds = Array.isArray(game.readyPlayerIds) ? game.readyPlayerIds : [];

    if (readyIds.includes(user.id)) {
      res.status(200).json({ ok: true, gameState: buildClientState(game) });
      return;
    }

    const nextReadyIds = [...readyIds, user.id];
    let next = { ...game, readyPlayerIds: nextReadyIds };

    if (nextReadyIds.length >= PLAYERS_REQUIRED) {
      next = {
        ...next,
        phase: "pick_building",
        phaseDeadline: Date.now() + PHASE_TIMERS_MS.pick_building,
      };
      schedulePhaseTimeout(roomCode, "pick_building", PHASE_TIMERS_MS.pick_building);
    }

    await database.updateGameByRoomCode(roomCode, next);
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
    await database.updateGameByRoomCode(roomCode, next);
    io.to(roomCode).emit("game:state", buildClientState(next));

    res.status(200).json({ ok: true, gameState: buildClientState(next) });
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
    const game = await database.getGameByRoomCode(roomCode);

    if (!game) {
      res.status(404).json({ ok: false, message: "Game not found." });
      return;
    }

    if (game.phase !== "vote") {
      res.status(400).json({ ok: false, message: "Game is not in the voting phase." });
      return;
    }

    const inGame = game.players.some((p) => p.userId === user.id);
    if (!inGame) {
      res.status(403).json({ ok: false, message: "You are not in this game." });
      return;
    }

    if (game.votes && game.votes[user.id]) {
      res.status(400).json({ ok: false, message: "You have already voted." });
      return;
    }

    const nextVotes = { ...(game.votes || {}), [user.id]: choice };
    let next = { ...game, votes: nextVotes };

    // If all players have voted, resolve
    if (Object.keys(nextVotes).length >= game.players.length) {
      next = resolveVotes(next);
      await database.updateGameByRoomCode(roomCode, next);
      io.to(roomCode).emit("game:state", buildClientState(next));
      setTimeout(() => advanceFromVoteResult(roomCode), RESULT_DISPLAY_MS);
    } else {
      await database.updateGameByRoomCode(roomCode, next);
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
    const game = await database.getGameByRoomCode(roomCode);

    if (!game) {
      res.status(404).json({ ok: false, message: "Game not found." });
      return;
    }

    if (game.phase !== "submit_heist") {
      res.status(400).json({ ok: false, message: "Game is not in the heist phase." });
      return;
    }

    if (!(game.proposedTeam || []).includes(user.id)) {
      res.status(403).json({ ok: false, message: "You are not on the heist team." });
      return;
    }

    if (game.heistCards && game.heistCards[user.id]) {
      res.status(400).json({ ok: false, message: "You have already submitted your card." });
      return;
    }

    // Role enforcement: only the Quisling can submit sabotage
    if (card === "sabotage" && game.quislingId !== user.id) {
      res.status(403).json({ ok: false, message: "Only the Quisling can submit sabotage." });
      return;
    }

    const nextCards = { ...(game.heistCards || {}), [user.id]: card };
    let next = { ...game, heistCards: nextCards };

    // If all team members have submitted, resolve the heist
    if (Object.keys(nextCards).length >= (game.proposedTeam || []).length) {
      const cleanCount = Object.values(nextCards).filter((c) => c === "clean").length;
      const sabotageCount = Object.values(nextCards).filter((c) => c === "sabotage").length;
      const outcome = sabotageCount > 0 ? "alarm" : "success";

      next = {
        ...next,
        alarm: outcome === "alarm" ? next.alarm + 1 : next.alarm,
        successes: outcome === "success" ? next.successes + 1 : next.successes,
        spentBuildingIds: game.selectedBuildingId
          ? [...(next.spentBuildingIds || []), game.selectedBuildingId]
          : next.spentBuildingIds || [],
        operationHistory: [...(next.operationHistory || []), buildOperationRecord(next, outcome, cleanCount, sabotageCount)],
        heistReveal: { cleanCount, sabotageCount, outcome },
        phase: "heist_result",
        phaseDeadline: null,
        pendingNextPhase: "next_operation",
      };

      await database.updateGameByRoomCode(roomCode, next);
      io.to(roomCode).emit("game:state", buildClientState(next));
      setTimeout(() => advanceFromHeistResult(roomCode), RESULT_DISPLAY_MS);
    } else {
      await database.updateGameByRoomCode(roomCode, next);
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
    const game = await database.getGameByRoomCode(roomCode);

    if (!game) {
      res.status(404).json({ ok: false, message: "Game not found." });
      return;
    }

    if (game.phase !== "final_accusation") {
      res.status(400).json({ ok: false, message: "Game is not in the final accusation phase." });
      return;
    }

    const inGame = game.players.some((p) => p.userId === user.id);
    if (!inGame) {
      res.status(403).json({ ok: false, message: "You are not in this game." });
      return;
    }

    const targetInGame = game.players.some((p) => p.userId === targetUserId);
    if (!targetInGame) {
      res.status(400).json({ ok: false, message: "Accusation target is not in the game." });
      return;
    }

    if (game.accusationVotes && game.accusationVotes[user.id]) {
      res.status(400).json({ ok: false, message: "You have already submitted your accusation." });
      return;
    }

    const nextVotes = { ...(game.accusationVotes || {}), [user.id]: targetUserId };
    let next = { ...game, accusationVotes: nextVotes };

    // If all players have accused, tally
    if (Object.keys(nextVotes).length >= game.players.length) {
      next = applyAccusationTally(next);
    }

    await database.updateGameByRoomCode(roomCode, next);
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
    console.log(`Service listening on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to initialize service:", error);
  process.exit(1);
});
