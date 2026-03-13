import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import SiteHeader from "../components/SiteHeader";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { useAuth } from "../context/AuthContext";
import { useGame } from "../context/GameContext";
import useNoScroll from "../hooks/useNoScroll";
import { createGameSession } from "../lib/gameSession";
import { fetchMissionIntel } from "../lib/missionIntel";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from "../lib/roomCode";
import { readJSON, writeJSON } from "../lib/storage";
import { createId, nowIso } from "../lib/time";
import type { GameLobby, UserRecord } from "../types/domain";

type RouteMessageState = {
  message?: string;
};

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isAuthLoading, user } = useAuth();
  const { setGameSession } = useGame();
  useNoScroll();

  const routeMessage = (location.state as RouteMessageState | null)?.message ?? "";

  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [infoMessage, setInfoMessage] = useState(routeMessage);
  const [errorMessage, setErrorMessage] = useState("");
  const [missionIntel, setMissionIntel] = useState("");
  const [intelError, setIntelError] = useState("");
  const [isIntelLoading, setIsIntelLoading] = useState(true);
  const [intelRequestId, setIntelRequestId] = useState(0);

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

  useEffect(() => {
    let isActive = true;

    async function loadMissionIntel() {
      setIsIntelLoading(true);
      setIntelError("");

      try {
        const intel = await fetchMissionIntel();

        if (!isActive) {
          return;
        }

        setMissionIntel(intel);
      } catch {
        if (!isActive) {
          return;
        }

        setMissionIntel("");
        setIntelError("Unable to load mission intel right now.");
      } finally {
        if (isActive) {
          setIsIntelLoading(false);
        }
      }
    }

    loadMissionIntel();

    return () => {
      isActive = false;
    };
  }, [intelRequestId]);

  function clearMessages() {
    setInfoMessage("");
    setErrorMessage("");
  }

  function requireAuthenticatedSession(): UserRecord | null {
    if (isAuthLoading) {
      setInfoMessage("Checking sign-in session. Please try again in a moment.");
      return null;
    }

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
    setGameSession(
      createGameSession({
        roomCode: normalizedCode,
        userId: currentUser.id,
        playerName,
      })
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
    setGameSession(
      createGameSession({
        roomCode: newRoomCode,
        userId: currentUser.id,
        playerName,
      })
    );
    setRoomCode(newRoomCode);
    navigate("/game");
  }

  return (
    <AppLayout header={<SiteHeader subtitle />}>
      <div className="flex flex-col items-center gap-2">
        <p className="text-text-muted text-center">
          {isAuthLoading
            ? "Checking sign-in status..."
            : isAuthenticated && user
            ? `Signed in as ${user.displayName} (${user.email})`
            : "You are not logged in. Join/Create will redirect you to Profile."}
        </p>
        {infoMessage ? <p className="text-success text-center">{infoMessage}</p> : null}
        {errorMessage ? <p className="text-danger text-center">{errorMessage}</p> : null}
        <div className="w-full max-w-xl text-center mt-2">
          <p className="text-text-muted text-xs uppercase tracking-wide">Mission Intel</p>
          <p className="text-text-muted text-xs">Source: Advice Slip API (third-party)</p>
          {isIntelLoading ? <p className="text-text-muted mt-1">Loading intel...</p> : null}
          {!isIntelLoading && intelError ? <p className="text-danger mt-1">{intelError}</p> : null}
          {!isIntelLoading && !intelError ? <p className="text-text mt-1">{missionIntel}</p> : null}
          <button
            className="btn-ghost mt-2 border border-white/20"
            onClick={() => setIntelRequestId((currentId) => currentId + 1)}
            type="button"
          >
            Refresh Intel
          </button>
        </div>
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
