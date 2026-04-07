import { useState } from "react";
import type { ClientGameState } from "../../types/domain";
import { useGame } from "../../context/GameContext";
import { hasAccused } from "../../lib/gameEngine";
import PhaseTimer from "./PhaseTimer";

type FinalAccusationPhaseProps = {
  state: ClientGameState;
  myUserId: string;
};

export default function FinalAccusationPhase({ state, myUserId }: FinalAccusationPhaseProps) {
  const { submitAccusation } = useGame();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const alreadyAccused = hasAccused(state, myUserId);
  const accusedCount = state.accusationVotesSubmitted.length;
  const totalPlayers = state.players.length;

  const suspects = state.players.filter((p) => p.userId !== myUserId);

  async function handleAccuse(suspectId: string) {
    if (pending || alreadyAccused) return;
    setError("");
    setPending(true);
    try {
      await submitAccusation(suspectId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit accusation.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6 max-w-sm mx-auto w-full">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text mb-1">Final Accusation</h2>
        <p className="text-text-muted text-sm">
          3 successful heists. Who is the Quisling?
        </p>
        <p className="text-xs text-text-muted mt-1">
          {accusedCount}/{totalPlayers} accusations submitted
        </p>
      </div>

      <PhaseTimer deadline={state.phaseDeadline} />

      {error && <p className="text-danger text-sm text-center">{error}</p>}

      {alreadyAccused ? (
        <div className="card text-center py-6">
          <p className="text-text-muted">Accusation submitted. Waiting for others...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-muted mb-1 text-center">
            Tap a player to accuse them:
          </p>
          {suspects.map((p) => (
            <button
              className="card w-full text-left cursor-pointer hover:border-danger/70 transition-colors"
              disabled={pending}
              key={p.userId}
              onClick={() => handleAccuse(p.userId)}
              type="button"
            >
              <span className="font-medium text-text">{p.displayName}</span>
            </button>
          ))}
          <p className="text-xs text-text-muted text-center mt-2 italic">
            The player with the most accusations is revealed. Ties go to the Quisling.
          </p>
        </div>
      )}
    </div>
  );
}
