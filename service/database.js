const fs = require("node:fs");
const path = require("node:path");
const { MongoClient } = require("mongodb");

const defaultDbName = process.env.MONGODB_DB_NAME || "the_quisling";
const usersCollectionName = process.env.MONGODB_USERS_COLLECTION || "users";
const sessionsCollectionName = process.env.MONGODB_SESSIONS_COLLECTION || "sessions";
const resultsCollectionName = process.env.MONGODB_RESULTS_COLLECTION || "results";

let client;
let db;
let usersCollection;
let sessionsCollection;
let resultsCollection;

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
  if (db && usersCollection && sessionsCollection && resultsCollection) {
    return;
  }

  const connectionString = getConnectionString();

  client = new MongoClient(connectionString);
  await client.connect();

  db = client.db(defaultDbName);
  usersCollection = db.collection(usersCollectionName);
  sessionsCollection = db.collection(sessionsCollectionName);
  resultsCollection = db.collection(resultsCollectionName);

  await Promise.all([
    usersCollection.createIndex({ id: 1 }, { unique: true }),
    usersCollection.createIndex({ email: 1 }, { unique: true }),
    sessionsCollection.createIndex({ token: 1 }, { unique: true }),
    sessionsCollection.createIndex({ userId: 1 }),
    resultsCollection.createIndex({ id: 1 }, { unique: true }),
    resultsCollection.createIndex({ userId: 1, completedAt: -1 }),
  ]);
}

function ensureCollections() {
  if (!usersCollection || !sessionsCollection || !resultsCollection) {
    throw new Error("Database is not initialized. Call initializeDatabase() first.");
  }

  return { usersCollection, sessionsCollection, resultsCollection };
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

module.exports = {
  initializeDatabase,
  createUser,
  findUserByEmail,
  findUserById,
  createSession,
  findSessionByToken,
  deleteSessionByToken,
  upsertResult,
  getResultsByUserId,
  getResultByIdForUser,
};
