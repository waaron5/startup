import { useState } from "react";
import type { ClientGameState } from "../../types/domain";
import { useGame } from "../../context/GameContext";
import { isOnTeam, hasSubmittedCard } from "../../lib/gameEngine";
import { BUILDINGS_BY_ID } from "../../constants/buildings";
import PhaseTimer from "./PhaseTimer";

type SubmitHeistPhaseProps = {
  state: ClientGameState;
  myUserId: string;
  myRole: "crew" | "quisling" | null;
};

export default function SubmitHeistPhase({ state, myUserId, myRole }: SubmitHeistPhaseProps) {
  const { submitHeistCard } = useGame();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const onTeam = isOnTeam(state, myUserId);
  const submitted = hasSubmittedCard(state, myUserId);
  const submittedCount = state.heistCardsSubmitted.length;
  const teamSize = (state.proposedTeam ?? []).length;

  const teamNames = (state.proposedTeam ?? [])
    .map((id) => state.players.find((p) => p.userId === id)?.displayName ?? id);

  async function handleCard(card: "clean" | "sabotage") {
    if (pending || submitted) return;
    setError("");
    setPending(true);
    try {
      await submitHeistCard(card);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit card.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6 max-w-sm mx-auto w-full">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text mb-1">Heist in Progress</h2>
        <p className="text-text-muted text-sm">
          Operation {state.operationNumber} — Target:{" "}
          <span className="font-medium text-text">{BUILDINGS_BY_ID[state.selectedBuildingId ?? ""]?.label ?? state.selectedBuildingId ?? "—"}</span>
        </p>
        <p className="text-xs text-text-muted mt-1">
          {submittedCount}/{teamSize} cards submitted
        </p>
      </div>

      <PhaseTimer deadline={state.phaseDeadline} />

      {error && <p className="text-danger text-sm text-center">{error}</p>}

      {onTeam ? (
        submitted ? (
          <div className="card text-center py-6">
            <p className="text-text-muted">Card submitted. Waiting for others...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm text-text-muted mb-2">
              Choose a card to play anonymously:
            </p>
            <button
              className="btn-primary py-5 text-lg"
              disabled={pending}
              onClick={() => handleCard("clean")}
              type="button"
            >
              CLEAN
            </button>
            {myRole === "quisling" && (
              <button
                className="btn-danger py-5 text-lg"
                disabled={pending}
                onClick={() => handleCard("sabotage")}
                type="button"
              >
                SABOTAGE
              </button>
            )}
            {myRole === "crew" && (
              <p className="text-center text-xs text-text-muted italic">
                Crew members may only play CLEAN cards.
              </p>
            )}
          </div>
        )
      ) : (
        <div className="card text-center py-6">
          <p className="text-text-muted mb-3">The heist team is operating:</p>
          <div className="flex flex-col gap-1">
            {teamNames.map((name) => (
              <span className="text-text font-medium" key={name}>
                {name}
              </span>
            ))}
          </div>
          <p className="text-text-muted text-sm mt-4">Waiting for results...</p>
        </div>
      )}
    </div>
  );
}
