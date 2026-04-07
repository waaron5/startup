import type { ClientGameState } from "../../types/domain";

type HeistResultPhaseProps = {
  state: ClientGameState;
};

export default function HeistResultPhase({ state }: HeistResultPhaseProps) {
  const heistReveal = state.heistReveal;
  const success = heistReveal?.outcome === "success";
  const cleanCount = heistReveal?.cleanCount ?? 0;
  const sabotageCount = heistReveal?.sabotageCount ?? 0;
  const buildingLabel = state.operationHistory.length > 0
    ? state.operationHistory[state.operationHistory.length - 1].buildingLabel
    : (state.selectedBuildingId ?? "Building");

  return (
    <div className="flex flex-col gap-4 px-4 py-6 max-w-sm mx-auto w-full">
      <div
        className={`card text-center py-8 border-2 ${
          success ? "border-success" : "border-danger"
        }`}
      >
        <p
          className={`text-3xl font-bold tracking-wide ${
            success ? "text-success" : "text-danger"
          }`}
        >
          {success ? "OPERATION SUCCESS" : "SABOTAGED"}
        </p>
        <p className="text-text-muted text-sm mt-2">
          {buildingLabel}
        </p>
      </div>

      <div className="card flex flex-row justify-around py-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-success">{cleanCount}</p>
          <p className="text-xs text-text-muted uppercase tracking-wide mt-1">Clean</p>
        </div>
        <div className="text-center">
          <p className={`text-2xl font-bold ${sabotageCount > 0 ? "text-danger" : "text-text-muted"}`}>
            {sabotageCount}
          </p>
          <p className="text-xs text-text-muted uppercase tracking-wide mt-1">Sabotage</p>
        </div>
      </div>

      <p className="text-center text-text-muted text-sm">Next phase starting...</p>
    </div>
  );
}
