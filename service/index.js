const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");

const app = express();
const port = Number(process.env.PORT) || 4000;
const staticDir = path.join(__dirname, "..", "dist");
const indexFile = path.join(staticDir, "index.html");
const authCookieName = "token";
const passwordMinLength = 8;
const bcryptSaltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * In-memory stores are sufficient for this deliverable phase.
 * These will be replaced with persistent storage in a later phase.
 */
const usersById = new Map();
const userIdsByEmail = new Map();
const sessionsByToken = new Map();

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
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}

function getUserFromRequest(req) {
  const token = req.cookies?.[authCookieName];

  if (!token) {
    return null;
  }

  const session = sessionsByToken.get(token);

  if (!session) {
    return null;
  }

  const user = usersById.get(session.userId);

  if (!user) {
    sessionsByToken.delete(token);
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

function requireAuth(req, res, next) {
  const authContext = getUserFromRequest(req);

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

  if (userIdsByEmail.has(email)) {
    res.status(409).json({
      ok: false,
      message: "An account with that email already exists.",
    });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, bcryptSaltRounds);
    const user = {
      id: `usr_${crypto.randomUUID()}`,
      email,
      passwordHash,
      displayName: normalizeDisplayName(req.body?.displayName, email),
      createdAt: nowIso(),
    };

    usersById.set(user.id, user);
    userIdsByEmail.set(user.email, user.id);

    const existingAuth = getUserFromRequest(req);

    if (existingAuth) {
      sessionsByToken.delete(existingAuth.token);
    }

    const token = `sess_${crypto.randomUUID()}`;
    const session = {
      token,
      userId: user.id,
      createdAt: nowIso(),
    };

    sessionsByToken.set(token, session);
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

  const userId = userIdsByEmail.get(email);

  if (!userId) {
    res.status(401).json({
      ok: false,
      message: "Invalid email or password.",
    });
    return;
  }

  const user = usersById.get(userId);

  if (!user) {
    userIdsByEmail.delete(email);
    res.status(401).json({
      ok: false,
      message: "Invalid email or password.",
    });
    return;
  }

  try {
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      res.status(401).json({
        ok: false,
        message: "Invalid email or password.",
      });
      return;
    }

    const existingAuth = getUserFromRequest(req);

    if (existingAuth) {
      sessionsByToken.delete(existingAuth.token);
    }

    const token = `sess_${crypto.randomUUID()}`;
    const session = {
      token,
      userId: user.id,
      createdAt: nowIso(),
    };

    sessionsByToken.set(token, session);
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

app.post("/api/auth/logout", (req, res) => {
  const token = req.cookies?.[authCookieName];

  if (token) {
    sessionsByToken.delete(token);
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

app.listen(port, () => {
  // Keep startup logging concise for local development and deployment logs.
  console.log(`Service listening on http://localhost:${port}`);
});
