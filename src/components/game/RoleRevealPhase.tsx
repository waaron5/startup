import { useState } from "react";
import type { ClientGameState, GameRole } from "../../types/domain";
import { useGame } from "../../context/GameContext";
import PhaseTimer from "./PhaseTimer";

type RoleRevealPhaseProps = {
  state: ClientGameState;
  myRole: GameRole | null;
  myUserId: string;
};

export default function RoleRevealPhase({ state, myRole, myUserId }: RoleRevealPhaseProps) {
  const { submitReady } = useGame();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const isReady = state.readyPlayerIds.includes(myUserId);
  const readyCount = state.readyPlayerIds.length;

  async function handleReady() {
    setError("");
    setSubmitted(true);
    try {
      await submitReady();
    } catch {
      setError("Failed to confirm. Please try again.");
      setSubmitted(false);
    }
  }

  const isQuisling = myRole === "quisling";

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-8 max-w-sm mx-auto w-full">
      <div className={`card w-full text-center p-6 border-2 ${isQuisling ? "border-danger" : "border-success/40"}`}>
        {myRole ? (
          <>
            <p className="text-text-muted text-sm uppercase tracking-widest mb-2">Your Role</p>
            <h2 className={`text-4xl font-bold font-metal mb-3 ${isQuisling ? "text-danger" : "text-success"}`}>
              {isQuisling ? "THE QUISLING" : "CREW"}
            </h2>
            {isQuisling ? (
              <>
                <p className="text-text-muted text-sm mb-1">You are the hidden traitor.</p>
                <p className="text-text-muted text-sm">
                  Trigger <span className="text-danger font-medium">3 Alarms</span> or survive the final accusation to win.
                </p>
                <p className="text-text-muted text-sm mt-2">
                  During heists, you may submit <span className="text-danger font-medium">Sabotage</span>.
                </p>
              </>
            ) : (
              <>
                <p className="text-text-muted text-sm mb-1">You are loyal to the Crew.</p>
                <p className="text-text-muted text-sm">
                  Complete <span className="text-success font-medium">3 successful heists</span>, then correctly identify the Quisling.
                </p>
                <p className="text-text-muted text-sm mt-2">
                  During heists, you may only submit <span className="text-success font-medium">Clean</span>.
                </p>
              </>
            )}
          </>
        ) : (
          <p className="text-text-muted">Loading your role...</p>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 w-full">
        {error && <p className="text-danger text-sm">{error}</p>}

        {isReady ? (
          <p className="text-success text-sm">✓ Confirmed</p>
        ) : (
          <button
            className="btn-primary w-full"
            disabled={!myRole || submitted}
            onClick={handleReady}
            type="button"
          >
            I understand my role
          </button>
        )}

        <p className="text-text-muted text-sm">{readyCount} / 5 players ready</p>
        <p className="text-text-muted text-xs text-center">
          Waiting for everyone to confirm before the game begins.
        </p>
      </div>

      <PhaseTimer deadline={state.phaseDeadline} />
    </div>
  );
}
