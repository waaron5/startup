import { useState } from "react";
import type { ClientGameState } from "../../types/domain";
import { useGame } from "../../context/GameContext";
import { hasVoted } from "../../lib/gameEngine";
import { BUILDINGS_BY_ID } from "../../constants/buildings";

type VotePhaseProps = {
  state: ClientGameState;
  myUserId: string;
};

export default function VotePhase({ state, myUserId }: VotePhaseProps) {
  const { submitVote } = useGame();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const alreadyVoted = hasVoted(state, myUserId);
  const buildingLabel =
    BUILDINGS_BY_ID[state.selectedBuildingId ?? ""]?.label ?? "Unknown";

  const teamNames = (state.proposedTeam ?? [])
    .map((id) => state.players.find((p) => p.userId === id)?.displayName ?? id);

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
    <div className="flex flex-col items-center gap-6 px-4 py-8 max-w-sm mx-auto w-full">
      <div className="text-center">
        <p className="text-text-muted text-sm uppercase tracking-wider mb-3">Team for</p>
        <p className="text-primary font-bold text-xl">{buildingLabel}</p>
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          {teamNames.map((name) => (
            <span className="bg-panel border border-white/10 rounded-lg px-3 py-1.5 text-text font-medium text-sm" key={name}>
              {name}
            </span>
          ))}
        </div>
      </div>

      {error && <p className="text-danger text-sm text-center">{error}</p>}

      {alreadyVoted ? (
        <div className="w-full">
          <p className="text-success text-center font-medium mb-4">✓ Vote locked in</p>
          <div className="flex flex-col gap-1.5">
            {state.players.map((p) => {
              const voted = state.votesSubmitted.includes(p.userId);
              return (
                <div className="flex items-center justify-between px-2 py-1.5" key={p.userId}>
                  <span className="text-text text-sm">{p.displayName}</span>
                  {voted ? (
                    <span className="text-success text-sm">✓</span>
                  ) : (
                    <span className="text-text-muted/50 animate-pulse text-sm">•••</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full">
          <button
            className="btn-primary w-full py-5 text-xl font-bold"
            disabled={pending}
            onClick={() => handleVote("approve")}
            type="button"
          >
            {pending ? "Sending..." : "APPROVE"}
          </button>
          <button
            className="btn-danger w-full py-5 text-xl font-bold"
            disabled={pending}
            onClick={() => handleVote("reject")}
            type="button"
          >
            {pending ? "Sending..." : "REJECT"}
          </button>
        </div>
      )}
    </div>
  );
}
