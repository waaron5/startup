import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useGame } from "../context/GameContext";
import PhaseTimer from "../components/game/PhaseTimer";
import { GAME_PHASE_LABELS } from "../constants/gamePhases";
import useNoScroll from "../hooks/useNoScroll";
import FinalAccusationPhase from "../components/game/FinalAccusationPhase";
import GameOverPhase from "../components/game/GameOverPhase";
import GameTracker from "../components/game/GameTracker";
import HeistResultPhase from "../components/game/HeistResultPhase";
import PickBuildingPhase from "../components/game/PickBuildingPhase";
import ProposeTeamPhase from "../components/game/ProposeTeamPhase";
import RoleRevealPhase from "../components/game/RoleRevealPhase";
import SubmitHeistPhase from "../components/game/SubmitHeistPhase";
import VotePhase from "../components/game/VotePhase";
import VoteResultPhase from "../components/game/VoteResultPhase";
import PhaseSplash from "../components/game/PhaseSplash";
import type { GamePhase } from "../types/domain";

export default function GamePage() {
  const navigate = useNavigate();
  const { roomCode: roomCodeParam } = useParams<{ roomCode: string }>();
  const { ensurePlayableSession, user } = useAuth();
  const { gameState, myRole, isConnected, setRoomCode } = useGame();
  const [connectError, setConnectError] = useState(false);

  // Register the roomCode from URL into game context on mount
  useEffect(() => {
    let isActive = true;

    async function connectToRoom() {
      if (!roomCodeParam) {
        return;
      }

      const playableUser = await ensurePlayableSession();

      if (playableUser && isActive) {
        setRoomCode(roomCodeParam);
      } else if (!playableUser && isActive) {
        setConnectError(true);
      }
    }

    void connectToRoom();

    return () => {
      isActive = false;
      setRoomCode(null);
    };
  }, [ensurePlayableSession, roomCodeParam, setRoomCode]);

  const myUserId = user?.id ?? "";
  const phaseLabel = gameState ? (GAME_PHASE_LABELS[gameState.phase] ?? gameState.phase) : "";

  useNoScroll();

  const [menuOpen, setMenuOpen] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [splash, setSplash] = useState<GamePhase | null>(null);
  const prevPhaseRef = useRef<GamePhase | null>(null);

  useEffect(() => {
    if (!gameState) return;
    const phase = gameState.phase;
    if (prevPhaseRef.current && prevPhaseRef.current !== phase) {
      const splashPhases: GamePhase[] = ["pick_building", "propose_team", "vote", "submit_heist", "final_accusation"];
      if (splashPhases.includes(phase)) {
        setSplash(phase);
      }
    }
    prevPhaseRef.current = phase;
  }, [gameState?.phase]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  function handlePlayAgain() {
    navigate("/");
  }

  function handleLeaveRoom() {
    setRoomCode(null);
    navigate("/");
  }

  if (!gameState) {
    if (connectError) {
      return (
        <div className="bg-bg text-text min-h-screen flex items-center justify-center p-6">
          <div className="card text-center w-full max-w-sm flex flex-col gap-4">
            <p className="text-danger font-medium">Could not connect to the game.</p>
            <p className="text-text-muted text-sm">Room: {roomCodeParam}</p>
            <button
              className="btn-primary w-full"
              onClick={() => { setConnectError(false); window.location.reload(); }}
              type="button"
            >
              Retry
            </button>
            <button className="btn-ghost w-full text-sm" onClick={() => navigate("/")} type="button">
              Return to Lobby
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-bg text-text min-h-screen flex items-center justify-center p-6">
        <div className="card text-center w-full max-w-sm">
          <p className="text-text-muted text-lg">Connecting to game...</p>
          <p className="text-text-muted text-sm mt-2">Room: {roomCodeParam}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`text-text h-[100dvh] flex flex-col overflow-hidden transition-colors duration-500 ${gameState.phase === "final_accusation" ? "bg-[#0a0f18]" : "bg-bg"}`}>
      {splash && <PhaseSplash phase={splash} onDone={() => setSplash(null)} />}
      {!isConnected && gameState.phase !== "game_over" && (
        <div className="bg-danger/90 text-white text-xs text-center py-1.5 px-4 font-medium tracking-wide animate-pulse shrink-0">
          Reconnecting...
        </div>
      )}
      <nav className="flex items-center justify-between px-4 py-2 bg-panel border-b border-white/10 shrink-0">
        <div className="flex flex-col leading-tight">
          <span className="text-text font-semibold text-sm">{user?.displayName}</span>
          {myRole && (
            <span className={`text-xs font-bold uppercase tracking-widest ${myRole === "quisling" ? "text-danger" : "text-success"}`}>
              {myRole === "quisling" ? "Quisling" : "Crew"}
            </span>
          )}
        </div>
        {gameState.phase !== "game_over" && (
          <span className="text-primary font-bold text-sm uppercase tracking-widest">{phaseLabel}</span>
        )}
        <div className="relative" ref={menuRef}>
          <button
            className="text-text-muted hover:text-text transition-colors p-1"
            onClick={() => setMenuOpen((v) => !v)}
            type="button"
            aria-label="Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-panel border border-white/10 rounded-lg shadow-lg z-50 py-1">
              <button
                className="w-full text-left px-4 py-3 text-sm text-text-muted hover:bg-surface/20 transition-colors"
                onClick={() => { setMenuOpen(false); }}
                type="button"
              >
                <p className="font-medium text-text mb-1">How to Play</p>
                <p className="text-xs leading-relaxed">
                  Complete 3 heists to win. The Quisling secretly sabotages. After 3 successes, vote to identify the traitor.
                </p>
              </button>
              <div className="border-t border-white/10" />
              <button
                className="w-full text-left px-4 py-3 text-sm text-primary hover:bg-surface/20 transition-colors flex items-center gap-2"
                onClick={() => { setTimerPaused((v) => !v); setMenuOpen(false); }}
                type="button"
              >
                {timerPaused ? "▶ Resume Timer" : "⏸ Pause Timer"}
              </button>
              <div className="border-t border-white/10" />
              <button
                className="w-full text-left px-4 py-3 text-sm text-danger hover:bg-surface/20 transition-colors flex items-center gap-2"
                onClick={() => { setMenuOpen(false); handleLeaveRoom(); }}
                type="button"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                Leave Room
              </button>
            </div>
          )}
        </div>
      </nav>

      {gameState.phase !== "game_over" && (
        <GameTracker state={gameState} />
      )}

      <PhaseTimer deadline={gameState.phaseDeadline ?? gameState.gameDeadline} paused={timerPaused} />

      <main className="flex-1 overflow-hidden">
        {gameState.phase === "role_reveal" && (
          <RoleRevealPhase myRole={myRole} myUserId={myUserId} state={gameState} />
        )}
        {gameState.phase === "pick_building" && (
          <PickBuildingPhase myUserId={myUserId} state={gameState} />
        )}
        {gameState.phase === "propose_team" && (
          <ProposeTeamPhase myUserId={myUserId} state={gameState} />
        )}
        {gameState.phase === "vote" && (
          <VotePhase myUserId={myUserId} state={gameState} />
        )}
        {gameState.phase === "vote_result" && (
          <VoteResultPhase state={gameState} />
        )}
        {gameState.phase === "submit_heist" && (
          <SubmitHeistPhase myRole={myRole} myUserId={myUserId} state={gameState} />
        )}
        {gameState.phase === "heist_result" && (
          <HeistResultPhase state={gameState} />
        )}
        {gameState.phase === "final_accusation" && (
          <FinalAccusationPhase myUserId={myUserId} state={gameState} />
        )}
        {gameState.phase === "game_over" && (
          <GameOverPhase myUserId={myUserId} onPlayAgain={handlePlayAgain} state={gameState} />
        )}
        {gameState.phase === "lobby" && (
          <div className="flex items-center justify-center min-h-[50vh]">
            <p className="text-text-muted">Waiting for game to start...</p>
          </div>
        )}
      </main>
    </div>
  );
}
