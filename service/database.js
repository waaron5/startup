const fs = require("node:fs");
const path = require("node:path");
const { MongoClient } = require("mongodb");

const defaultDbName = process.env.MONGODB_DB_NAME || "the_quisling";
const usersCollectionName = process.env.MONGODB_USERS_COLLECTION || "users";
const sessionsCollectionName = process.env.MONGODB_SESSIONS_COLLECTION || "sessions";
const resultsCollectionName = process.env.MONGODB_RESULTS_COLLECTION || "results";
const lobbiesCollectionName = process.env.MONGODB_LOBBIES_COLLECTION || "lobbies";

let client;
let db;
let usersCollection;
let sessionsCollection;
let resultsCollection;
let lobbiesCollection;

function escapeMongoUriPart(value) {
  return encodeURIComponent(String(value));
}

function getConnectionStringFromConfigFile() {
  const configPath = path.join(__dirname, "..", "dbConfig.json");

  if (!fs.existsSync(configPath)) {
    return null;
  }

  const rawConfig = fs.readFileSync(configPath, "utf8");
  const config = JSON.parse(rawConfig);

  if (!config.hostname || !config.userName || !config.password) {
    return null;
  }

  return `mongodb+srv://${escapeMongoUriPart(config.userName)}:${escapeMongoUriPart(config.password)}@${config.hostname}`;
}

function getConnectionString() {
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }

  if (process.env.MONGODB_HOSTNAME && process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD) {
    return `mongodb+srv://${escapeMongoUriPart(process.env.MONGODB_USERNAME)}:${escapeMongoUriPart(process.env.MONGODB_PASSWORD)}@${process.env.MONGODB_HOSTNAME}`;
  }

  const configConnectionString = getConnectionStringFromConfigFile();

  if (configConnectionString) {
    return configConnectionString;
  }

  throw new Error(
    "Missing MongoDB configuration. Set MONGODB_URI or MONGODB_HOSTNAME/MONGODB_USERNAME/MONGODB_PASSWORD, or provide dbConfig.json at project root."
  );
}

async function initializeDatabase() {
  if (db && usersCollection && sessionsCollection && resultsCollection && lobbiesCollection) {
    return;
  }

  const connectionString = getConnectionString();

  client = new MongoClient(connectionString);
  await client.connect();

  db = client.db(defaultDbName);
  usersCollection = db.collection(usersCollectionName);
  sessionsCollection = db.collection(sessionsCollectionName);
  resultsCollection = db.collection(resultsCollectionName);
  lobbiesCollection = db.collection(lobbiesCollectionName);

  await Promise.all([
    usersCollection.createIndex({ id: 1 }, { unique: true }),
    usersCollection.createIndex({ email: 1 }, { unique: true }),
    sessionsCollection.createIndex({ token: 1 }, { unique: true }),
    sessionsCollection.createIndex({ userId: 1 }),
    resultsCollection.createIndex({ id: 1 }, { unique: true }),
    resultsCollection.createIndex({ userId: 1, completedAt: -1 }),
    lobbiesCollection.createIndex({ id: 1 }, { unique: true }),
    lobbiesCollection.createIndex({ roomCode: 1 }, { unique: true }),
    lobbiesCollection.createIndex({ players: 1 }),
  ]);
}

function ensureCollections() {
  if (!usersCollection || !sessionsCollection || !resultsCollection || !lobbiesCollection) {
    throw new Error("Database is not initialized. Call initializeDatabase() first.");
  }

  return { usersCollection, sessionsCollection, resultsCollection, lobbiesCollection };
}

async function createUser(user) {
  const collections = ensureCollections();
  await collections.usersCollection.insertOne(user);
  return user;
}

async function findUserByEmail(email) {
  const collections = ensureCollections();
  return collections.usersCollection.findOne({ email });
}

async function findUserById(id) {
  const collections = ensureCollections();
  return collections.usersCollection.findOne({ id });
}

async function updateUserById(userId, updates) {
  const collections = ensureCollections();

  await collections.usersCollection.updateOne(
    { id: userId },
    {
      $set: updates,
    }
  );

  return collections.usersCollection.findOne({ id: userId });
}

async function createSession(session) {
  const collections = ensureCollections();
  await collections.sessionsCollection.insertOne(session);
  return session;
}

async function findSessionByToken(token) {
  const collections = ensureCollections();
  return collections.sessionsCollection.findOne({ token });
}

async function deleteSessionByToken(token) {
  const collections = ensureCollections();
  await collections.sessionsCollection.deleteOne({ token });
}

async function upsertResult(result) {
  const collections = ensureCollections();

  await collections.resultsCollection.updateOne(
    { id: result.id },
    {
      $set: result,
    },
    { upsert: true }
  );

  return result;
}

async function getResultsByUserId(userId) {
  const collections = ensureCollections();

  return collections.resultsCollection
    .find({ userId })
    .sort({ completedAt: -1 })
    .toArray();
}

async function getResultByIdForUser(resultId, userId) {
  const collections = ensureCollections();

  return collections.resultsCollection.findOne({ id: resultId, userId });
}

function createDefaultStats() {
  return {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalScore: 0,
    bestScore: 0,
  };
}

async function applyResultToUserProfile(userId, result) {
  const collections = ensureCollections();
  const user = await collections.usersCollection.findOne({ id: userId });

  if (!user) {
    return null;
  }

  const history = Array.isArray(user.history) ? user.history : [];

  if (history.includes(result.id)) {
    return user;
  }

  const currentStats = user.stats && typeof user.stats === "object" ? user.stats : createDefaultStats();
  const gamesPlayed = Number(currentStats.gamesPlayed || 0) + 1;
  const wins = Number(currentStats.wins || 0) + (result.outcome === "win" ? 1 : 0);
  const losses = Number(currentStats.losses || 0) + (result.outcome === "loss" ? 1 : 0);
  const totalScore = Number(currentStats.totalScore || 0) + Number(result.score || 0);
  const bestScore = Math.max(Number(currentStats.bestScore || 0), Number(result.score || 0));
  const winRate = gamesPlayed ? Math.round((wins / gamesPlayed) * 100) : 0;

  const nextStats = {
    gamesPlayed,
    wins,
    losses,
    winRate,
    totalScore,
    bestScore,
  };

  await collections.usersCollection.updateOne(
    { id: userId },
    {
      $set: {
        stats: nextStats,
      },
      $push: {
        history: {
          $each: [result.id],
          $position: 0,
        },
      },
    }
  );

  return collections.usersCollection.findOne({ id: userId });
}

async function getLobbyByRoomCode(roomCode) {
  const collections = ensureCollections();
  return collections.lobbiesCollection.findOne({ roomCode });
}

async function createLobby(lobby) {
  const collections = ensureCollections();
  await collections.lobbiesCollection.insertOne(lobby);
  return lobby;
}

async function joinLobbyByRoomCode(roomCode, userId, updatedAt) {
  const collections = ensureCollections();

  const result = await collections.lobbiesCollection.findOneAndUpdate(
    { roomCode },
    {
      $addToSet: { players: userId },
      $set: { updatedAt },
    },
    {
      returnDocument: "after",
    }
  );

  return result;
}

async function setLobbyStatusByRoomCode(roomCode, status, updatedAt) {
  const collections = ensureCollections();

  return collections.lobbiesCollection.findOneAndUpdate(
    { roomCode },
    {
      $set: {
        status,
        updatedAt,
      },
    },
    {
      returnDocument: "after",
    }
  );
}

async function reopenLobbyByRoomCode(roomCode, userId, newLobby) {
  const collections = ensureCollections();

  const existingLobby = await collections.lobbiesCollection.findOne({ roomCode });

  if (!existingLobby) {
    await collections.lobbiesCollection.insertOne(newLobby);
    return newLobby;
  }

  return collections.lobbiesCollection.findOneAndUpdate(
    { roomCode },
    {
      $set: {
        status: "open",
        updatedAt: newLobby.updatedAt,
      },
      $addToSet: {
        players: userId,
      },
    },
    {
      returnDocument: "after",
    }
  );
}

async function leaveLobbyByRoomCode(roomCode, userId, updatedAt) {
  const collections = ensureCollections();

  const updatedLobby = await collections.lobbiesCollection.findOneAndUpdate(
    { roomCode },
    {
      $pull: {
        players: userId,
      },
      $set: {
        updatedAt,
      },
    },
    {
      returnDocument: "after",
    }
  );

  if (!updatedLobby) {
    return null;
  }

  if (Array.isArray(updatedLobby.players) && updatedLobby.players.length === 0) {
    await collections.lobbiesCollection.deleteOne({ roomCode });
    return null;
  }

  return updatedLobby;
}

module.exports = {
  initializeDatabase,
  createUser,
  findUserByEmail,
  findUserById,
  updateUserById,
  createSession,
  findSessionByToken,
  deleteSessionByToken,
  upsertResult,
  getResultsByUserId,
  getResultByIdForUser,
  applyResultToUserProfile,
  getLobbyByRoomCode,
  createLobby,
  joinLobbyByRoomCode,
  setLobbyStatusByRoomCode,
  reopenLobbyByRoomCode,
  leaveLobbyByRoomCode,
};
