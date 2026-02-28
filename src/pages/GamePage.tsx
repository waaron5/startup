import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import StorageRecoveryBanner from "../components/StorageRecoveryBanner";
import TopNav from "../components/TopNav";
import townMap from "../assets/images/town-map.png";
import { BUILDINGS } from "../constants/buildings";
import { GAME_PHASE_LABELS, GAME_PHASES } from "../constants/gamePhases";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { useAuth } from "../context/AuthContext";
import { useGame } from "../context/GameContext";
import useNoScroll from "../hooks/useNoScroll";
import useGameTimer from "../hooks/useGameTimer";
import {
  beginActionPhase,
  commitAction,
  computeOutcome,
  finalizeSession,
  getPhaseHint,
  getTimeProgressPercent,
  resolveTurn,
  selectBuilding,
  withRemainingSeconds,
} from "../lib/gameEngine";
import { GAME_RULES } from "../lib/gameConfig";
import { readJSON, writeJSON } from "../lib/storage";
import { createId, formatClock, nowIso } from "../lib/time";
import type { GameLobby, GameOutcome, GameResult } from "../types/domain";

export default function GamePage() {
  const navigate = useNavigate();
  const { user, recordGameResult } = useAuth();
  const { gameSession, setGameSession, clearGameSession } = useGame();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const hasSavedResult = useRef(false);
  useNoScroll();

  const handleTimerTick = useCallback((nextSeconds: number) => {
    setGameSession((currentSession) => {
      if (!currentSession || currentSession.phase === GAME_PHASES.complete) {
        return currentSession;
      }

      return withRemainingSeconds(currentSession, nextSeconds);
    });
  }, []);

  const handleTimerExpire = useCallback(() => {
    setGameSession((currentSession) => {
      if (!currentSession || currentSession.phase === GAME_PHASES.complete) {
        return currentSession;
      }

      const timedOutSession = withRemainingSeconds(currentSession, 0);
      return finalizeSession(timedOutSession, "loss", "Time expired before mission completion.");
    });
  }, []);

  useGameTimer({
    isRunning: Boolean(gameSession) && gameSession?.phase !== GAME_PHASES.complete && !isHelpOpen,
    remainingSeconds: gameSession?.remainingSeconds ?? 0,
    onTick: handleTimerTick,
    onExpire: handleTimerExpire,
  });

  useEffect(() => {
    if (!gameSession || gameSession.phase === GAME_PHASES.complete) {
      return;
    }

    const outcome = computeOutcome(gameSession);

    if (!outcome) {
      return;
    }

    setGameSession((currentSession) => {
      if (!currentSession || currentSession.phase === GAME_PHASES.complete) {
        return currentSession;
      }

      return finalizeSession(
        currentSession,
        outcome,
        outcome === "win"
          ? "Objective reached before mission fail conditions."
          : "Mission fail condition reached."
      );
    });
  }, [gameSession]);

  useEffect(() => {
    if (!gameSession || gameSession.phase !== GAME_PHASES.complete || hasSavedResult.current) {
      return;
    }

    hasSavedResult.current = true;

    const outcome: GameOutcome =
      gameSession.objectiveProgress >= GAME_RULES.winObjectiveProgress ? "win" : "loss";

    const buildingMatches = gameSession.actionLog.flatMap((entry) => {
      const match = entry.match(/^Turn \d+: (.+?) yielded/);
      return match?.[1] ? [match[1]] : [];
    });

    const result: GameResult = {
      id: createId("result"),
      gameId: gameSession.id,
      userId: gameSession.userId,
      roomCode: gameSession.roomCode,
      outcome,
      score: gameSession.score,
      summary: {
        buildingsHit: buildingMatches,
        turnsPlayed: gameSession.turnsPlayed,
        timeRemaining: gameSession.remainingSeconds,
      },
      completedAt: nowIso(),
    };

    recordGameResult(result);

    const lobbies = readJSON<GameLobby[]>(STORAGE_KEYS.games, []);
    const updatedLobbies = lobbies.map((lobby) =>
      lobby.roomCode === gameSession.roomCode
        ? {
            ...lobby,
            status: "complete" as const,
            updatedAt: nowIso(),
          }
        : lobby
    );
    writeJSON(STORAGE_KEYS.games, updatedLobbies);
    clearGameSession();

    navigate("/results");
  }, [clearGameSession, gameSession, navigate, recordGameResult]);

  const selectedBuilding = useMemo(
    () => BUILDINGS.find((building) => building.id === gameSession?.selectedBuildingId) ?? null,
    [gameSession?.selectedBuildingId]
  );

  if (!gameSession || !user || gameSession.userId !== user.id) {
    return (
      <div className="bg-bg text-text min-h-screen flex items-center justify-center p-6">
        <div className="card w-full max-w-xl text-center">
          <h2 className="text-2xl">No active game session</h2>
          <p className="text-text-muted mt-3">Create or join a room to start a mission.</p>
          <button
            className="btn-primary mt-6"
            onClick={() => navigate("/")}
            type="button"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  const timeProgressPercent = getTimeProgressPercent(gameSession);
  const phaseHint = getPhaseHint(gameSession.phase);
  const canSelectBuilding = gameSession.phase === GAME_PHASES.planning;
  const canLockTarget =
    gameSession.phase === GAME_PHASES.planning && Boolean(gameSession.selectedBuildingId);
  const canCommitAction =
    gameSession.phase === GAME_PHASES.action && Boolean(gameSession.selectedBuildingId);
  const canResolveTurn =
    gameSession.phase === GAME_PHASES.resolution && Boolean(gameSession.selectedBuildingId);

  function handleSelectBuilding(buildingId: string) {
    if (!canSelectBuilding) {
      setStatusMessage("You can only select buildings during the planning phase.");
      return;
    }

    setStatusMessage("");
    setGameSession((currentSession) =>
      currentSession ? selectBuilding(currentSession, buildingId) : currentSession
    );
  }

  function handleLockTarget() {
    setStatusMessage("");
    setGameSession((currentSession) =>
      currentSession ? beginActionPhase(currentSession) : currentSession
    );
  }

  function handleCommitAction() {
    setStatusMessage("");
    setGameSession((currentSession) =>
      currentSession ? commitAction(currentSession) : currentSession
    );
  }

  function handleResolveTurn() {
    setStatusMessage("");
    setGameSession((currentSession) =>
      currentSession ? resolveTurn(currentSession) : currentSession
    );
  }

  function handleLeaveRoom() {
    const confirmed = window.confirm("Leave this room and abandon the active mission?");

    if (!confirmed) {
      return;
    }

    const lobbies = readJSON<GameLobby[]>(STORAGE_KEYS.games, []);
    const nextLobbies = lobbies
      .map((lobby) => {
        if (lobby.roomCode !== gameSession.roomCode) {
          return lobby;
        }

        return {
          ...lobby,
          updatedAt: nowIso(),
          players: lobby.players.filter((playerId) => playerId !== user.id),
        };
      })
      .filter((lobby) => lobby.players.length > 0);

    writeJSON(STORAGE_KEYS.games, nextLobbies);
    clearGameSession();
    navigate("/", {
      state: {
        message: `You left room ${gameSession.roomCode}.`,
      },
    });
  }

  return (
    <div className="bg-bg text-text h-[100dvh] overflow-hidden flex flex-col items-center">
      <nav className="w-full px-3 pt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs sm:text-sm text-text-muted">
        <div className="hidden md:block">
          <TopNav />
        </div>
        <button
          className="hover:text-text"
          onClick={() => setIsHelpOpen(true)}
          type="button"
        >
          How to play
        </button>
        <span className="text-text">Room code: {gameSession.roomCode}</span>
        <button className="hover:text-text" id="leave-link" onClick={handleLeaveRoom} type="button">
          Leave room
        </button>
      </nav>

      <StorageRecoveryBanner />

      <dialog className="card max-w-lg w-[90vw]" id="how-to-play" open={isHelpOpen}>
        <form className="flex justify-end" method="dialog">
          <button
            className="btn-ghost border border-white/20"
            aria-label="Close"
            onClick={() => setIsHelpOpen(false)}
            type="button"
          >
            Close
          </button>
        </form>
        <h2 className="text-2xl">How to play</h2>
        <ul className="text-text-muted mt-3 list-disc list-inside text-left">
          <li>Select one building during Planning.</li>
          <li>Lock and commit your action in sequence.</li>
          <li>Resolve each turn before selecting a new building.</li>
          <li>Reach 100 objective progress before penalties or time run out.</li>
        </ul>
      </dialog>

      <header className="w-full px-3 mt-1 mb-2 text-center" id="game-header">
        <div className="w-full max-w-xl mx-auto">
          <div className="flex justify-between text-sm text-text-muted mb-2">
            <span>Mission Timer</span>
            <span>{formatClock(gameSession.remainingSeconds)}</span>
          </div>
          <div className="h-4 w-full rounded-full bg-surface/40 border border-white/20 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${timeProgressPercent}%` }}
            />
          </div>
        </div>
      </header>

      <main
        className="flex-1 min-h-0 w-full flex flex-col items-center gap-2 sm:gap-3 px-3 pb-2 sm:px-4 sm:pb-3"
        id="game-main"
      >
        <section className="w-full max-w-5xl card !p-3 sm:!p-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
            <div>
              <p className="text-text-muted text-xs sm:text-sm">Phase</p>
              <p className="text-sm sm:text-lg">{GAME_PHASE_LABELS[gameSession.phase]}</p>
            </div>
            <div>
              <p className="text-text-muted text-xs sm:text-sm">Objective Progress</p>
              <p className="text-sm sm:text-lg">
                {gameSession.objectiveProgress}/{GAME_RULES.winObjectiveProgress}
              </p>
            </div>
            <div>
              <p className="text-text-muted text-xs sm:text-sm">Risk</p>
              <p className="text-sm sm:text-lg">
                {gameSession.penalties}/{GAME_RULES.maxPenalties} penalties
              </p>
            </div>
          </div>
          <div className="mt-2 text-center text-xs sm:text-sm text-text-muted">
            Turns: {gameSession.turnsPlayed}/{GAME_RULES.maxTurns}
          </div>
        </section>

        <section className="w-full max-w-5xl card !p-3 sm:!p-4 flex flex-col flex-1 min-h-0">
          <div className="relative mx-auto w-full max-w-[min(84vw,36dvh)] sm:max-w-[min(68vw,46dvh)] md:max-w-[min(62vw,54dvh)] lg:max-w-[min(56vw,60dvh)]">
            <img
              alt="town map"
              className="w-full rounded-lg border border-white/10"
              src={townMap}
              width="1000"
            />

            {BUILDINGS.map((building) => {
              const isSelected = building.id === gameSession.selectedBuildingId;

              return (
                <button
                  key={building.id}
                  aria-label={`Select ${building.label}`}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 px-1.5 py-1 text-[11px] leading-none rounded border transition-colors ${
                    isSelected
                      ? "bg-primary text-text border-primary-hover"
                      : "bg-panel/90 text-text-muted border-white/20 hover:text-text"
                  } ${!canSelectBuilding ? "opacity-70 cursor-not-allowed" : ""}`}
                  onClick={() => handleSelectBuilding(building.id)}
                  style={{ left: `${building.xPct}%`, top: `${building.yPct}%` }}
                  type="button"
                >
                  {building.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <p className="text-text-muted text-center text-xs sm:text-sm">
              {selectedBuilding
                ? `Selected target: ${selectedBuilding.label} (difficulty ${selectedBuilding.difficulty})`
                : "Select a target to begin your turn."}
            </p>

            <div className="flex flex-wrap gap-2 justify-center">
              <button
                className="btn-primary text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2"
                disabled={!canLockTarget}
                onClick={handleLockTarget}
                type="button"
              >
                Lock Target
              </button>
              <button
                className="btn-primary text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2"
                disabled={!canCommitAction}
                onClick={handleCommitAction}
                type="button"
              >
                Execute Action
              </button>
              <button
                className="btn-primary text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2"
                disabled={!canResolveTurn}
                onClick={handleResolveTurn}
                type="button"
              >
                Resolve Turn
              </button>
            </div>

            {statusMessage ? <p className="text-danger text-xs sm:text-sm text-center">{statusMessage}</p> : null}
          </div>
        </section>

        <section className="w-full max-w-5xl card !p-3 sm:!p-4">
          <h3 className="text-sm sm:text-xl mb-1 sm:mb-2 text-center">Action Log</h3>
          <ul className="text-text-muted text-xs sm:text-sm max-h-20 sm:max-h-40 overflow-y-auto space-y-1 pr-1">
            {gameSession.actionLog.slice(-8).map((entry, index) => (
              <li key={`${entry}-${index}`}>{entry}</li>
            ))}
          </ul>
        </section>
      </main>

      <footer
        className="w-full text-text-muted flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-xs"
        id="game-footer"
      >
        <div className="player flex items-center gap-2">
          <span id="player-name">{gameSession.playerName}</span>
          <span id="player-role">{gameSession.role}</span>
        </div>

        <div aria-live="polite" className="status text-center w-full sm:w-auto" id="phase-hint">
          {phaseHint}
        </div>

        <div className="hidden sm:block">Aaron Wood</div>
        <a className="hidden sm:block hover:text-text" href="https://github.com/waaron5/startup.git">
          GitHub
        </a>
      </footer>
    </div>
  );
}
