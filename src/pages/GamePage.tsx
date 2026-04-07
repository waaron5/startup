import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useGame } from "../context/GameContext";
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

export default function GamePage() {
  const navigate = useNavigate();
  const { roomCode: roomCodeParam } = useParams<{ roomCode: string }>();
  const { ensurePlayableSession, user } = useAuth();
  const { gameState, myRole, setRoomCode } = useGame();

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
      }
    }

    void connectToRoom();

    return () => {
      isActive = false;
      setRoomCode(null);
    };
  }, [ensurePlayableSession, roomCodeParam, setRoomCode]);

  const myUserId = user?.id ?? "";

  function handlePlayAgain() {
    navigate("/");
  }

  if (!gameState) {
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
    <div className="bg-bg text-text min-h-screen flex flex-col">
      {gameState.phase !== "game_over" && (
        <GameTracker state={gameState} />
      )}

      <main className="flex-1">
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
