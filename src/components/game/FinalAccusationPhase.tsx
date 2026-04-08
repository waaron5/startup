import { useState } from "react";
import type { ClientGameState } from "../../types/domain";
import { useGame } from "../../context/GameContext";
import { hasAccused } from "../../lib/gameEngine";

type FinalAccusationPhaseProps = {
  state: ClientGameState;
  myUserId: string;
};

export default function FinalAccusationPhase({ state, myUserId }: FinalAccusationPhaseProps) {
  const { submitAccusation } = useGame();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  const alreadyAccused = hasAccused(state, myUserId);
  const suspects = state.players.filter((p) => p.userId !== myUserId);
  const confirmingName = state.players.find((p) => p.userId === confirming)?.displayName ?? "";

  async function handleConfirm() {
    if (!confirming || pending || alreadyAccused) return;
    setError("");
    setPending(true);
    try {
      await submitAccusation(confirming);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit accusation.");
      setPending(false);
      setConfirming(null);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 px-4 py-8 max-w-sm mx-auto w-full">
      <div className="text-center animate-pulse-danger rounded-2xl px-6 py-4">
        <p className="text-danger text-xs uppercase tracking-[0.3em] mb-2">3 Heists Complete</p>
        <h2 className="text-3xl font-bold font-metal text-danger tracking-wide">
          WHO IS THE QUISLING?
        </h2>
      </div>

      {error && <p className="text-danger text-sm text-center">{error}</p>}

      {alreadyAccused ? (
        <div className="w-full">
          <p className="text-success text-center font-medium mb-4">✓ Accusation locked</p>
          <div className="flex flex-col gap-1.5">
            {state.players.map((p) => {
              const done = state.accusationVotesSubmitted.includes(p.userId);
              return (
                <div className="flex items-center justify-between px-2 py-1.5" key={p.userId}>
                  <span className="text-text text-sm">{p.displayName}</span>
                  {done ? (
                    <span className="text-success text-sm">✓</span>
                  ) : (
                    <span className="text-text-muted/50 animate-pulse text-sm">•••</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : confirming ? (
        <div className="flex flex-col gap-4 w-full">
          <div className="rounded-xl border border-danger/40 bg-danger/8 px-4 py-5 text-center">
            <p className="text-text-muted text-sm mb-2">You are about to accuse:</p>
            <p className="text-danger font-bold text-2xl">{confirmingName}</p>
            <p className="text-text-muted text-xs mt-2">This cannot be undone.</p>
          </div>
          <button
            className="btn-danger w-full py-4 text-lg font-bold"
            disabled={pending}
            onClick={handleConfirm}
            type="button"
          >
            {pending ? "Sending..." : `Accuse ${confirmingName}`}
          </button>
          <button
            className="btn-ghost w-full py-3 text-sm"
            disabled={pending}
            onClick={() => setConfirming(null)}
            type="button"
          >
            ← Go back
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 w-full">
          {suspects.map((p) => (
            <button
              className="w-full rounded-xl border border-danger/30 bg-danger/5 px-4 py-4 text-left transition-all hover:border-danger hover:bg-danger/10 active:scale-[0.98]"
              disabled={pending}
              key={p.userId}
              onClick={() => setConfirming(p.userId)}
              type="button"
            >
              <span className="font-medium text-text text-lg">{p.displayName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
