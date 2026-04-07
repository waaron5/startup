import { useState } from "react";
import type { ClientGameState } from "../../types/domain";
import { useGame } from "../../context/GameContext";
import { hasVoted } from "../../lib/gameEngine";
import PhaseTimer from "./PhaseTimer";

type VotePhaseProps = {
  state: ClientGameState;
  myUserId: string;
};

export default function VotePhase({ state, myUserId }: VotePhaseProps) {
  const { submitVote } = useGame();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const alreadyVoted = hasVoted(state, myUserId);
  const voteCount = state.votesSubmitted.length;
  const totalPlayers = state.players.length;

  const teamNames = (state.proposedTeam ?? [])
    .map((id) => state.players.find((p) => p.userId === id)?.displayName ?? id)
    .join(", ");

  async function handleVote(choice: "approve" | "reject") {
    if (pending || alreadyVoted) return;
    setError("");
    setPending(true);
    try {
      await submitVote(choice);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit vote.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6 max-w-sm mx-auto w-full">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text mb-1">Vote on the Team</h2>
        <p className="text-text-muted text-sm">
          Proposed team: <span className="font-medium text-text">{teamNames || "—"}</span>
        </p>
        <p className="text-xs text-text-muted mt-1">
          {voteCount}/{totalPlayers} votes submitted
        </p>
      </div>

      <PhaseTimer deadline={state.phaseDeadline} />

      {error && <p className="text-danger text-sm text-center">{error}</p>}

      {alreadyVoted ? (
        <div className="card text-center py-6">
          <p className="text-text-muted">You have voted. Waiting for others...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            className="btn-primary py-5 text-lg"
            disabled={pending}
            onClick={() => handleVote("approve")}
            type="button"
          >
            APPROVE
          </button>
          <button
            className="btn-danger py-5 text-lg"
            disabled={pending}
            onClick={() => handleVote("reject")}
            type="button"
          >
            REJECT
          </button>
        </div>
      )}
    </div>
  );
}
