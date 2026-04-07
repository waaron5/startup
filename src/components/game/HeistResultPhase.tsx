import type { ClientGameState } from "../../types/domain";

type HeistResultPhaseProps = {
  state: ClientGameState;
};

export default function HeistResultPhase({ state }: HeistResultPhaseProps) {
  const heistReveal = state.heistReveal;
  const success = heistReveal?.outcome === "success";
  const cleanCount = heistReveal?.cleanCount ?? 0;
  const sabotageCount = heistReveal?.sabotageCount ?? 0;
  const lastOperation = state.operationHistory.length > 0
    ? state.operationHistory[state.operationHistory.length - 1]
    : null;
  const buildingLabel = lastOperation?.buildingLabel ?? state.selectedBuildingId ?? "Building";

  return (
    <div className="flex flex-col items-center justify-center gap-6 px-4 py-12 max-w-sm mx-auto w-full h-full">
      <div
        className={`w-full text-center py-10 rounded-2xl border-2 animate-result-pop ${
          success ? "border-success bg-success/5" : "border-danger bg-danger/5"
        }`}
      >
        <p
          className={`text-4xl font-bold font-metal tracking-wide ${
            success ? "text-success" : "text-danger"
          }`}
        >
          {success ? "SUCCESS" : "SABOTAGED"}
        </p>
        <p className="text-text-muted text-sm mt-3">{buildingLabel}</p>
      </div>

      <div className="flex gap-8">
        <div className="text-center">
          <p className="text-3xl font-bold text-success">{cleanCount}</p>
          <p className="text-xs text-text-muted uppercase tracking-wide mt-1">Clean</p>
        </div>
        <div className="text-center">
          <p className={`text-3xl font-bold ${sabotageCount > 0 ? "text-danger" : "text-text-muted"}`}>
            {sabotageCount}
          </p>
          <p className="text-xs text-text-muted uppercase tracking-wide mt-1">Sabotage</p>
        </div>
      </div>
    </div>
  );
}
