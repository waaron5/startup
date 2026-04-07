import type { ClientGameState } from "../../types/domain";
import { getLeaderName } from "../../lib/gameEngine";
import { BUILDINGS_BY_ID } from "../../constants/buildings";
import { GAME_PHASE_LABELS } from "../../constants/gamePhases";

type GameTrackerProps = {
  state: ClientGameState;
};

export default function GameTracker({ state }: GameTrackerProps) {
  const leaderName = getLeaderName(state);
  const targetBuilding = state.selectedBuildingId
    ? (BUILDINGS_BY_ID[state.selectedBuildingId]?.label ?? state.selectedBuildingId)
    : null;
  const phaseLabel = GAME_PHASE_LABELS[state.phase] ?? state.phase;

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
    <div className="w-full bg-panel border-b border-white/10 px-3 py-2">
      {/* Tracks row */}
      <div className="flex justify-around mb-2">
        <Track label="Successes" value={state.successes} max={3} />
        <Track label="Alarm" value={state.alarm} max={3} danger />
        <Track label="Rejected" value={state.rejectedPlans} max={3} danger />
      </div>

      {/* Info row */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-text-muted">
        <span>
          <span className="text-text font-medium">Op {state.operationNumber}</span>
          {" · "}
          <span className="text-primary">{phaseLabel}</span>
        </span>
        <span>
          Leader: <span className="text-text font-medium">{leaderName}</span>
        </span>
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
    </div>
  );
}
