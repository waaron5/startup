const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const database = require("./database");

const app = express();
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
      totalScore: Number(stats.totalScore || 0),
      bestScore: Number(stats.bestScore || 0),
    },
    friends: Array.isArray(user.friends) ? user.friends : [],
    history: Array.isArray(user.history) ? user.history : [],
  };
}

function toPublicResult(result) {
  return {
    id: result.id,
    gameId: result.gameId,
    userId: result.userId,
    roomCode: result.roomCode,
    outcome: result.outcome,
    score: result.score,
    summary: {
      buildingsHit: Array.isArray(result.summary?.buildingsHit) ? result.summary.buildingsHit : [],
      turnsPlayed: Number(result.summary?.turnsPlayed) || 0,
      timeRemaining: Number(result.summary?.timeRemaining) || 0,
    },
    completedAt: result.completedAt,
  };
}

function parseResultInput(payload, userId) {
  const id = String(payload?.id || "").trim();
  const gameId = String(payload?.gameId || "").trim();
  const roomCode = String(payload?.roomCode || "").trim().toUpperCase();
  const outcome = payload?.outcome;
  const score = Number(payload?.score);
  const completedAt = String(payload?.completedAt || "").trim();
  const summary = payload?.summary || {};
  const buildingsHit = Array.isArray(summary.buildingsHit)
    ? summary.buildingsHit.map((entry) => String(entry))
    : [];
  const turnsPlayed = Number(summary.turnsPlayed);
  const timeRemaining = Number(summary.timeRemaining);

  if (!id || !gameId || !roomCode || !completedAt) {
    return null;
  }

  if (!(outcome === "win" || outcome === "loss")) {
    return null;
  }

  if (!Number.isFinite(score) || !Number.isFinite(turnsPlayed) || !Number.isFinite(timeRemaining)) {
    return null;
  }

  return {
    id,
    gameId,
    userId,
    roomCode,
    outcome,
    score,
    summary: {
      buildingsHit,
      turnsPlayed,
      timeRemaining,
    },
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
        totalScore: 0,
        bestScore: 0,
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

  app.listen(port, () => {
    // Keep startup logging concise for local development and deployment logs.
    console.log(`Service listening on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to initialize service:", error);
  process.exit(1);
});
