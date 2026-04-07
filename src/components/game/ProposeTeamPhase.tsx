import { useState } from "react";
import type { ClientGameState } from "../../types/domain";
import { useGame } from "../../context/GameContext";
import { isLeader, getRequiredTeamSize } from "../../lib/gameEngine";
import { BUILDINGS_BY_ID } from "../../constants/buildings";

type ProposeTeamPhaseProps = {
  state: ClientGameState;
  myUserId: string;
};

export default function ProposeTeamPhase({ state, myUserId }: ProposeTeamPhaseProps) {
  const { proposeTeam } = useGame();
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const amLeader = isLeader(state, myUserId);
  const required = getRequiredTeamSize(state.operationNumber);
  const leaderName = state.players.find((p) => p.userId === state.leaderId)?.displayName ?? "Leader";
  const buildingLabel = (state.selectedBuildingId ? BUILDINGS_BY_ID[state.selectedBuildingId]?.label : null) ?? "Unknown";

  function togglePlayer(userId: string) {
    if (!amLeader || pending) return;
    setSelected((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : prev.length < required
        ? [...prev, userId]
        : prev
    );
    setError("");
  }

  async function handlePropose() {
    if (pending) return;
    if (selected.length !== required) {
      setError(`Select exactly ${required} crew members.`);
      return;
    }
    setError("");
    setPending(true);
    try {
      await proposeTeam(selected);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to propose team.");
      setPending(false);
    }
  }

  if (!amLeader) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 max-w-sm mx-auto w-full text-center">
        <p className="text-text-muted text-lg">
          <span className="text-text font-bold">{leaderName}</span> is picking the crew
        </p>
        <div className="flex flex-col gap-1 text-sm text-text-muted">
          <span>Target: <span className="text-primary font-medium">{buildingLabel}</span></span>
          <span>Team size: <span className="text-text font-medium">{required}</span></span>
        </div>
        <div className="flex gap-1.5 mt-4">
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6 max-w-sm mx-auto w-full">
      <div className="text-center">
        <p className="text-text-muted text-sm">
          Target: <span className="text-primary font-medium">{buildingLabel}</span>
        </p>
        <p className="text-3xl font-bold text-text mt-2">
          {selected.length} / {required}
        </p>
        <p className="text-text-muted text-xs mt-1">crew members selected</p>
      </div>

      {error && <p className="text-danger text-sm text-center">{error}</p>}

      <div className="flex flex-col gap-2">
        {state.players.map((p) => {
          const isSelected = selected.includes(p.userId);
          return (
            <button
              className={`w-full rounded-xl border px-4 py-4 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/15 text-text"
                  : "border-white/10 bg-panel text-text hover:border-primary/40"
              }`}
              disabled={pending}
              key={p.userId}
              onClick={() => togglePlayer(p.userId)}
              type="button"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{p.displayName}</span>
                {isSelected && <span className="text-primary font-bold text-lg">✓</span>}
              </div>
            </button>
          );
        })}
      </div>

      <button
        className="btn-primary w-full py-4 text-lg mt-2"
        disabled={selected.length !== required || pending}
        onClick={handlePropose}
        type="button"
      >
        {pending ? "Sending..." : "Lock In Team"}
      </button>
    </div>
  );
}
