import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import SiteHeader from "../components/SiteHeader";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { useAuth } from "../context/AuthContext";
import useNoScroll from "../hooks/useNoScroll";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from "../lib/roomCode";
import { readJSON, writeJSON } from "../lib/storage";
import { createId, nowIso } from "../lib/time";
import type { GameLobby, GameRole, GameSession, UserRecord } from "../types/domain";

const DEFAULT_GAME_DURATION_SECONDS = 180;
const GAME_ROLES: GameRole[] = ["Infiltrator", "Lookout", "Saboteur", "Engineer"];

type RouteMessageState = {
  message?: string;
};

function selectRoleForUser(userId: string): GameRole {
  const roleSeed = userId
    .split("")
    .reduce((runningTotal, character) => runningTotal + character.charCodeAt(0), 0);

  return GAME_ROLES[roleSeed % GAME_ROLES.length];
}

function buildGameSession(roomCode: string, userId: string, playerName: string): GameSession {
  const timestamp = nowIso();

  return {
    id: createId("game"),
    roomCode,
    userId,
    playerName,
    role: selectRoleForUser(userId),
    phase: "planning",
    startedAt: timestamp,
    durationSeconds: DEFAULT_GAME_DURATION_SECONDS,
    remainingSeconds: DEFAULT_GAME_DURATION_SECONDS,
    turnsPlayed: 0,
    selectedBuildingId: null,
    actionLog: [`Session created at ${timestamp}`],
    score: 0,
    objectiveProgress: 0,
    penalties: 0,
  };
}

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  useNoScroll();

  const routeMessage = (location.state as RouteMessageState | null)?.message ?? "";

  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [infoMessage, setInfoMessage] = useState(routeMessage);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (user?.displayName) {
      setName((currentName) => (currentName ? currentName : user.displayName));
    }
  }, [user]);

  useEffect(() => {
    if (routeMessage) {
      setInfoMessage(routeMessage);
    }
  }, [routeMessage]);

  function clearMessages() {
    setInfoMessage("");
    setErrorMessage("");
  }

  function requireAuthenticatedSession(): UserRecord | null {
    if (isAuthenticated && user) {
      return user;
    }

    navigate("/profile", {
      state: {
        fromPath: "/",
        message: "Please log in before joining or creating a room.",
      },
    });
    return null;
  }

  function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    const currentUser = requireAuthenticatedSession();

    if (!currentUser) {
      return;
    }

    const normalizedCode = normalizeRoomCode(roomCode);

    if (!isValidRoomCode(normalizedCode)) {
      setErrorMessage("Room code must be exactly 4 uppercase letters (A-Z).");
      return;
    }

    const lobbies = readJSON<GameLobby[]>(STORAGE_KEYS.games, []);
    const existingLobby = lobbies.find((candidate) => candidate.roomCode === normalizedCode);

    if (!existingLobby) {
      setErrorMessage("Room code not found in local session storage.");
      return;
    }

    const playerName = name.trim() || currentUser.displayName;

    if (!playerName) {
      setErrorMessage("Enter a player name before joining.");
      return;
    }

    const updatedLobby: GameLobby = {
      ...existingLobby,
      updatedAt: nowIso(),
      players: existingLobby.players.includes(currentUser.id)
        ? existingLobby.players
        : [...existingLobby.players, currentUser.id],
    };

    const nextLobbies = lobbies.map((candidate) =>
      candidate.id === updatedLobby.id ? updatedLobby : candidate
    );

    writeJSON(STORAGE_KEYS.games, nextLobbies);
    writeJSON(
      STORAGE_KEYS.gameSession,
      buildGameSession(normalizedCode, currentUser.id, playerName)
    );
    navigate("/game");
  }

  function handleCreateRoom() {
    clearMessages();

    const currentUser = requireAuthenticatedSession();

    if (!currentUser) {
      return;
    }

    const playerName = name.trim() || currentUser.displayName;

    if (!playerName) {
      setErrorMessage("Enter a player name before creating a room.");
      return;
    }

    const lobbies = readJSON<GameLobby[]>(STORAGE_KEYS.games, []);
    const existingCodes = new Set(lobbies.map((lobby) => lobby.roomCode));
    let newRoomCode: string;

    try {
      newRoomCode = generateRoomCode(existingCodes);
    } catch {
      setErrorMessage("Unable to generate room code. Please try again.");
      return;
    }

    const timestamp = nowIso();
    const newLobby: GameLobby = {
      id: createId("lobby"),
      roomCode: newRoomCode,
      createdAt: timestamp,
      updatedAt: timestamp,
      hostUserId: currentUser.id,
      players: [currentUser.id],
      status: "open",
    };

    writeJSON(STORAGE_KEYS.games, [...lobbies, newLobby]);
    writeJSON(
      STORAGE_KEYS.gameSession,
      buildGameSession(newRoomCode, currentUser.id, playerName)
    );
    setRoomCode(newRoomCode);
    navigate("/game");
  }

  return (
    <AppLayout header={<SiteHeader subtitle />}>
      <div className="flex flex-col items-center gap-2">
        <p className="text-text-muted text-center">
          {isAuthenticated && user
            ? `Signed in as ${user.displayName} (${user.email})`
            : "You are not logged in. Join/Create will redirect you to Profile."}
        </p>
        {infoMessage ? <p className="text-success text-center">{infoMessage}</p> : null}
        {errorMessage ? <p className="text-danger text-center">{errorMessage}</p> : null}
      </div>

      <form className="flex flex-col mt-8 items-center gap-2" onSubmit={handleJoinRoom}>
        <label className="text-lg text-text flex flex-col items-start gap-2 w-80">
          NAME
          <input
            className="input-field w-full"
            name="name"
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            type="text"
            value={name}
          />
        </label>

        <label className="text-lg text-text flex flex-col items-start gap-2 w-80 mt-2">
          ROOM CODE
          <input
            className="input-field w-full"
            name="roomCode"
            onChange={(event) => setRoomCode(normalizeRoomCode(event.target.value))}
            placeholder="'ABCD'"
            type="text"
            value={roomCode}
          />
        </label>

        <button className="btn-primary w-80 py-3 text-lg mt-4 border-white/20" type="submit">
          JOIN ROOM
        </button>

        <button
          className="btn-ghost w-80 py-3 text-lg border border-white/20"
          onClick={handleCreateRoom}
          type="button"
        >
          CREATE ROOM
        </button>
      </form>
    </AppLayout>
  );
}
