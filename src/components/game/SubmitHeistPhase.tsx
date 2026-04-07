import { useState } from "react";
import type { ClientGameState } from "../../types/domain";
import { useGame } from "../../context/GameContext";
import { isOnTeam, hasSubmittedCard } from "../../lib/gameEngine";
import { BUILDINGS_BY_ID } from "../../constants/buildings";

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
  const buildingLabel = BUILDINGS_BY_ID[state.selectedBuildingId ?? ""]?.label ?? "—";

  const teamMembers = (state.proposedTeam ?? []).map((id) => ({
    userId: id,
    name: state.players.find((p) => p.userId === id)?.displayName ?? id,
    done: state.heistCardsSubmitted.includes(id),
  }));

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
    <div className="flex flex-col items-center gap-6 px-4 py-8 max-w-sm mx-auto w-full">
      <div className="text-center">
        <p className="text-text-muted text-xs uppercase tracking-widest">Operation {state.operationNumber}</p>
        <p className="text-primary font-bold text-xl mt-1">{buildingLabel}</p>
        <p className="text-text-muted text-xs mt-2">{submittedCount}/{teamSize} cards played</p>
      </div>

      {error && <p className="text-danger text-sm text-center">{error}</p>}

      {onTeam ? (
        submitted ? (
          <div className="w-full text-center">
            <p className="text-success font-medium text-lg">✓ Card played</p>
            <div className="flex flex-col gap-1.5 mt-6">
              {teamMembers.map((m) => (
                <div className="flex items-center justify-between px-2 py-1.5" key={m.userId}>
                  <span className="text-text text-sm">{m.name}</span>
                  {m.done ? (
                    <span className="text-success text-sm">✓</span>
                  ) : (
                    <span className="text-text-muted/50 animate-pulse text-sm">•••</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 w-full">
            <button
              className="btn-primary w-full py-5 text-xl font-bold"
              disabled={pending}
              onClick={() => handleCard("clean")}
              type="button"
            >
              CLEAN
            </button>
            {myRole === "quisling" && (
              <button
                className="btn-danger w-full py-5 text-xl font-bold"
                disabled={pending}
                onClick={() => handleCard("sabotage")}
                type="button"
              >
                SABOTAGE
              </button>
            )}
          </div>
        )
      ) : (
        <div className="w-full text-center">
          <p className="text-text-muted text-lg mb-4">Heist in progress</p>
          <div className="flex flex-wrap justify-center gap-2">
            {teamMembers.map((m) => (
              <span className="bg-panel border border-white/10 rounded-lg px-3 py-1.5 text-text text-sm" key={m.userId}>
                {m.name}
              </span>
            ))}
          </div>
          <div className="flex gap-1.5 justify-center mt-6">
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      )}
    </div>
  );
}
