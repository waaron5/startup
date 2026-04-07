import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../context/AuthContext";
import {
  createLobbyInService,
  fetchLobbyByRoomCode,
  joinLobbyInService,
  startGameInService,
} from "../lib/api";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from "../lib/roomCode";
import type { GameLobby } from "../types/domain";

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [activeLobby, setActiveLobby] = useState<GameLobby | null>(null);
  const [lobbyUsers, setLobbyUsers] = useState<{ id: string; displayName: string }[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isHost = !!activeLobby && activeLobby.hostUserId === user?.id;

  // Poll lobby for player count and status
  useEffect(() => {
    if (!activeLobby) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    async function pollLobby() {
      if (!activeLobby) return;
      try {
        const res = await fetchLobbyByRoomCode(activeLobby.roomCode);
        if (res.lobby) {
          setActiveLobby(res.lobby);
          if (res.lobby.status === "in_progress") {
            navigate(`/game/${activeLobby.roomCode}`);
          }
        }
      } catch {
        // silent — keep polling
      }
    }

    pollRef.current = setInterval(pollLobby, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeLobby, navigate]);

  async function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!user) {
      setErrorMessage("You must be signed in to join a game.");
      return;
    }

    const code = normalizeRoomCode(roomCodeInput);
    if (!isValidRoomCode(code)) {
      setErrorMessage("Room code must be exactly 4 uppercase letters (A-Z).");
      return;
    }

    try {
      const res = await joinLobbyInService(code);
      if (res.lobby) {
        setActiveLobby(res.lobby);
      } else {
        setErrorMessage("Could not join room.");
      }
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to join room.");
    }
  }

  async function handleCreateRoom() {
    setErrorMessage("");

    if (!user) {
      setErrorMessage("You must be signed in to create a game.");
      return;
    }

    let newRoomCode: string;
    try {
      newRoomCode = generateRoomCode(new Set());
    } catch {
      setErrorMessage("Unable to generate a room code. Please try again.");
      return;
    }

    try {
      const res = await createLobbyInService(newRoomCode);
      if (res.lobby) {
        setActiveLobby(res.lobby);
      } else {
        setErrorMessage("Failed to create room.");
      }
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to create room.");
    }
  }

  async function handleStartGame() {
    if (!activeLobby || isStarting) return;
    setErrorMessage("");
    setIsStarting(true);
    try {
      await startGameInService(activeLobby.roomCode);
      navigate(`/game/${activeLobby.roomCode}`);
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Failed to start game.");
      setIsStarting(false);
    }
  }

  function handleLeaveRoom() {
    if (pollRef.current) clearInterval(pollRef.current);
    setActiveLobby(null);
    setLobbyUsers([]);
    setRoomCodeInput("");
    setErrorMessage("");
  }

  // Lobby view
  if (activeLobby) {
    const playerCount = activeLobby.players.length;
    const readyToStart = isHost && playerCount === 5;
    return (
      <AppLayout header={<SiteHeader />} mainClassName="flex-1 flex flex-col items-center gap-4 pt-6">
        <h2 className="text-2xl font-bold text-text">Room: {activeLobby.roomCode}</h2>
        <p className="text-text-muted text-sm">Share this code with your crew.</p>

        <div className="card w-full max-w-sm">
          <p className="text-xs text-text-muted uppercase tracking-wide mb-3">
            Players ({playerCount}/5)
          </p>
          {activeLobby.players.map((id) => (
            <div className="flex items-center gap-2 py-1" key={id}>
              <span className="w-2 h-2 rounded-full bg-success inline-block" />
              <span className="text-text text-sm">
                {lobbyUsers.find((u) => u.id === id)?.displayName ?? id}
                {id === activeLobby.hostUserId ? " (Host)" : ""}
                {id === user?.id ? " (You)" : ""}
              </span>
            </div>
          ))}
          {playerCount < 5 && (
            <p className="text-text-muted text-xs mt-3 italic">
              Waiting for {5 - playerCount} more player{5 - playerCount !== 1 ? "s" : ""}...
            </p>
          )}
        </div>

        {errorMessage && <p className="text-danger text-sm text-center">{errorMessage}</p>}

        {isHost ? (
          <button
            className="btn-primary w-full max-w-sm py-3 text-lg"
            disabled={!readyToStart || isStarting}
            onClick={handleStartGame}
            type="button"
          >
            {isStarting ? "Starting..." : readyToStart ? "Start Game" : `Waiting for players (${playerCount}/5)`}
          </button>
        ) : (
          <div className="card w-full max-w-sm text-center py-4">
            <p className="text-text-muted">Waiting for the host to start the game...</p>
          </div>
        )}

        <button
          className="btn-ghost w-full max-w-sm border border-white/20"
          onClick={handleLeaveRoom}
          type="button"
        >
          Leave Room
        </button>
      </AppLayout>
    );
  }

  // Initial view
  return (
    <AppLayout header={<SiteHeader />} mainClassName="flex-1 flex flex-col">
      <div className="flex flex-col items-center gap-2">
        {user ? (
          <p className="text-text-muted text-center text-sm">
            Signed in as <span className="text-text">{user.displayName}</span>
          </p>
        ) : null}
        {errorMessage ? <p className="text-danger text-center">{errorMessage}</p> : null}
      </div>

      <form className="flex flex-col mt-8 items-center gap-2" onSubmit={handleJoinRoom}>
        <label className="text-lg text-text flex flex-col items-start gap-2 w-80">
          ROOM CODE
          <input
            className="input-field w-full"
            name="roomCode"
            onChange={(event) => setRoomCodeInput(normalizeRoomCode(event.target.value))}
            placeholder="ABCD"
            type="text"
            value={roomCodeInput}
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
    </AppLayout>
  );
}
