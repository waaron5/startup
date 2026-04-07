import type { ClientGameState } from "../../types/domain";
import { BUILDINGS_BY_ID } from "../../constants/buildings";

type GameTrackerProps = {
  state: ClientGameState;
};

export default function GameTracker({ state }: GameTrackerProps) {
  const targetBuilding = state.selectedBuildingId
    ? (BUILDINGS_BY_ID[state.selectedBuildingId]?.label ?? state.selectedBuildingId)
    : null;

  function Track({ label, value, max, danger }: { label: string; value: number; max: number; danger?: boolean }) {
    const pips = Array.from({ length: max }, (_, i) => i < value);
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-text-muted uppercase tracking-wide">{label}</span>
        <div className="flex gap-1">
          {pips.map((filled, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-sm border ${
                filled
                  ? danger
                    ? "bg-danger border-danger"
                    : "bg-success border-success"
                  : "bg-surface/30 border-white/20"
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-panel border-b border-white/10 px-3 py-1.5 shrink-0">
      <div className="flex justify-around">
        <Track label="Successes" value={state.successes} max={3} />
        <Track label="Alarm" value={state.alarm} max={3} danger />
        <Track label="Rejected" value={state.rejectedPlans} max={3} danger />
      </div>

      {(targetBuilding || state.proposedTeam.length > 0) && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-text-muted mt-1">
          {targetBuilding && (
            <span>
              Target: <span className="text-text font-medium">{targetBuilding}</span>
            </span>
          )}
          {state.proposedTeam.length > 0 && (
            <span>
              Team:{" "}
              <span className="text-text font-medium">
                {state.proposedTeam
                  .map((uid) => state.players.find((p) => p.userId === uid)?.displayName ?? uid)
                  .join(", ")}
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
