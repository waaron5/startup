import { useState } from "react";
import type { ClientGameState } from "../../types/domain";
import { useGame } from "../../context/GameContext";
import { isLeader } from "../../lib/gameEngine";
import { BUILDINGS } from "../../constants/buildings";
import PhaseTimer from "./PhaseTimer";

type PickBuildingPhaseProps = {
  state: ClientGameState;
  myUserId: string;
};

export default function PickBuildingPhase({ state, myUserId }: PickBuildingPhaseProps) {
  const { selectBuilding } = useGame();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  const amLeader = isLeader(state, myUserId);
  const leaderName = state.players.find((p) => p.userId === state.leaderId)?.displayName ?? "Leader";

  const availableBuildings = BUILDINGS.filter((b) => !state.spentBuildingIds.includes(b.id));
  const spentBuildings = BUILDINGS.filter((b) => state.spentBuildingIds.includes(b.id));

  async function handleSelect(buildingId: string) {
    if (pending) return;
    setError("");
    setPending(buildingId);
    try {
      await selectBuilding(buildingId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to select building.");
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6 max-w-sm mx-auto w-full">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text mb-1">Pick a Target Building</h2>
        {amLeader ? (
          <p className="text-text-muted text-sm">You are the Leader. Choose the target for Operation {state.operationNumber}.</p>
        ) : (
          <p className="text-text-muted text-sm">
            Waiting for <span className="text-primary font-medium">{leaderName}</span> to choose a building.
          </p>
        )}
      </div>

      <PhaseTimer deadline={state.phaseDeadline} />

      {error && <p className="text-danger text-sm text-center">{error}</p>}

      <div className="flex flex-col gap-2">
        <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Available</p>
        {availableBuildings.map((b) => (
          <button
            className={`card w-full text-left transition-colors ${
              amLeader
                ? "hover:border-primary cursor-pointer"
                : "opacity-70 cursor-default"
            } ${pending === b.id ? "border-primary opacity-80" : ""}`}
            disabled={!amLeader || pending !== null}
            key={b.id}
            onClick={() => amLeader && handleSelect(b.id)}
            type="button"
          >
            <span className="font-medium text-text">{b.label}</span>
          </button>
        ))}

        {spentBuildings.length > 0 && (
          <>
            <p className="text-xs text-text-muted uppercase tracking-wide mt-2 mb-1">Spent</p>
            {spentBuildings.map((b) => (
              <div className="card w-full opacity-40 line-through text-text-muted" key={b.id}>
                {b.label}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
