import { useState } from "react";
import type { ClientGameState } from "../../types/domain";
import { useGame } from "../../context/GameContext";
import { BUILDINGS_BY_ID } from "../../constants/buildings";
import { hasVoted } from "../../lib/gameEngine";
import GameBoard from "./GameBoard";
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
  const buildingLabel =
    BUILDINGS_BY_ID[state.selectedBuildingId ?? ""]?.label ?? state.selectedBuildingId ?? "Unknown";

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
    <div className="flex flex-col gap-4 px-4 py-6 max-w-5xl mx-auto w-full">
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)] lg:items-start">
        <GameBoard
          className="p-2"
          highlightedBuildingId={state.selectedBuildingId}
          spentBuildingIds={state.spentBuildingIds}
        />

        <div className="flex flex-col gap-4">
          <div className="card text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-text-muted">
              Active Target
            </p>
            <p className="mt-2 text-2xl font-bold text-text">{buildingLabel}</p>
            <p className="mt-1 text-sm text-text-muted">
              Approve if you trust this crew to hit the highlighted location.
            </p>
          </div>

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
      </div>
    </div>
  );
}
