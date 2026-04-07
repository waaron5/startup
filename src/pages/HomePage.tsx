import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import SiteHeader from "../components/SiteHeader";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { useAuth } from "../context/AuthContext";
import { useGame } from "../context/GameContext";
import useNoScroll from "../hooks/useNoScroll";
import { createGameSession } from "../lib/gameSession";
import {
  createLobbyInService,
  fetchLobbyByRoomCode,
  joinLobbyInService,
} from "../lib/api";
import { fetchMissionIntel } from "../lib/missionIntel";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from "../lib/roomCode";
import { readJSON, writeJSON } from "../lib/storage";
import { createId, nowIso } from "../lib/time";
import type { GameLobby } from "../types/domain";

type RouteMessageState = {
  message?: string;
};

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
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
  }, []);

  function clearMessages() {
    setInfoMessage("");
    setErrorMessage("");
  }

  function buildParticipantIdentity() {
    const playerName = name.trim() || user?.displayName || "";

    if (!playerName) {
      setErrorMessage("Enter a player name before joining or creating a room.");
      return null;
    }

    return {
      userId: user?.id ?? createId("guest"),
      playerName,
    };
  }

  async function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    const participant = buildParticipantIdentity();

    if (!participant) {
      return;
    }

    const normalizedCode = normalizeRoomCode(roomCode);

    if (!isValidRoomCode(normalizedCode)) {
      setErrorMessage("Room code must be exactly 4 uppercase letters (A-Z).");
      return;
    }

    let existingLobby: GameLobby | null;

    try {
      const fetched = await fetchLobbyByRoomCode(normalizedCode);
      existingLobby = fetched.lobby;
    } catch {
      const lobbies = readJSON<GameLobby[]>(STORAGE_KEYS.games, []);
      existingLobby = lobbies.find((candidate) => candidate.roomCode === normalizedCode) ?? null;
    }

    if (!existingLobby) {
      setErrorMessage("Room code not found.");
      return;
    }

    try {
      const joined = await joinLobbyInService(normalizedCode);

      if (joined.lobby) {
        const lobbies = readJSON<GameLobby[]>(STORAGE_KEYS.games, []);
        const nextLobbies = lobbies.some((candidate) => candidate.id === joined.lobby?.id)
          ? lobbies.map((candidate) => (candidate.id === joined.lobby?.id ? joined.lobby : candidate))
          : [...lobbies, joined.lobby];

        writeJSON(STORAGE_KEYS.games, nextLobbies);
      }
    } catch {
      const lobbies = readJSON<GameLobby[]>(STORAGE_KEYS.games, []);
      const updatedLobby: GameLobby = {
        ...existingLobby,
        updatedAt: nowIso(),
        players: existingLobby.players.includes(participant.userId)
          ? existingLobby.players
          : [...existingLobby.players, participant.userId],
      };

      const nextLobbies = lobbies.map((candidate) =>
        candidate.id === updatedLobby.id ? updatedLobby : candidate
      );

      writeJSON(STORAGE_KEYS.games, nextLobbies);
    }

    setGameSession(
      createGameSession({
        roomCode: normalizedCode,
        userId: participant.userId,
        playerName: participant.playerName,
      })
    );
    navigate("/game");
  }

  async function handleCreateRoom() {
    clearMessages();

    const participant = buildParticipantIdentity();

    if (!participant) {
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

    try {
      const created = await createLobbyInService(newRoomCode);

      if (created.lobby) {
        writeJSON(STORAGE_KEYS.games, [...lobbies, created.lobby]);
      }
    } catch {
      const timestamp = nowIso();
      const newLobby: GameLobby = {
        id: createId("lobby"),
        roomCode: newRoomCode,
        createdAt: timestamp,
        updatedAt: timestamp,
        hostUserId: participant.userId,
        players: [participant.userId],
        status: "open",
      };

      writeJSON(STORAGE_KEYS.games, [...lobbies, newLobby]);
    }

    setGameSession(
      createGameSession({
        roomCode: newRoomCode,
        userId: participant.userId,
        playerName: participant.playerName,
      })
    );
    setRoomCode(newRoomCode);
    navigate("/game");
  }

  return (
    <AppLayout header={<SiteHeader />} mainClassName="flex-1 flex flex-col">
      <div className="flex flex-col items-center gap-2">
        {user ? (
          <p className="text-text-muted text-center">
            Signed in as {user.displayName} ({user.email})
          </p>
        ) : null}
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

      <p className="mx-auto mt-6 max-w-2xl px-4 text-center text-text-muted">
        <em>
          Collaborate to pull off daring heists against a corrupt regime, but remember:
          <br />
          one player is not who they claim to be.
        </em>
      </p>

      <div className="mt-auto w-full max-w-xl self-center pb-4 pt-6 text-center">
        <p className="text-text-muted text-xs uppercase tracking-wide">Mission Intel</p>
        <p className="text-text-muted text-xs">Source: Advice Slip API (third-party)</p>
        {isIntelLoading ? <p className="text-text-muted mt-1">Loading intel...</p> : null}
        {!isIntelLoading && intelError ? <p className="text-danger mt-1">{intelError}</p> : null}
        {!isIntelLoading && !intelError ? <p className="text-text mt-1">{missionIntel}</p> : null}
      </div>
    </AppLayout>
  );
}
