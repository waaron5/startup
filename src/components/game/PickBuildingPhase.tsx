import { useState } from "react";
import type { ClientGameState } from "../../types/domain";
import { useGame } from "../../context/GameContext";
import { isLeader } from "../../lib/gameEngine";
import { BUILDINGS, BUILDINGS_BY_ID } from "../../constants/buildings";
import GameBoard from "./GameBoard";
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
  const pendingLabel = pending ? BUILDINGS_BY_ID[pending]?.label ?? pending : null;

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

      <GameBoard
        clickableBuildingIds={availableBuildings.map((building) => building.id)}
        className="p-2"
        disabled={!amLeader || pending !== null}
        onSelect={handleSelect}
        selectedBuildingId={pending}
        spentBuildingIds={state.spentBuildingIds}
      />

      <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] uppercase tracking-[0.24em] text-text-muted">
        <span className="rounded-full border border-[#9edcff] bg-[#18445b] px-3 py-1 text-[#eef8ff]">
          Clickable
        </span>
        <span className="rounded-full border border-[#fff4d3] bg-[#f2c97d] px-3 py-1 text-[#0f2430]">
          Selected
        </span>
        <span className="rounded-full border border-[#53697a] bg-[#173041] px-3 py-1 text-[#8ca2b2]">
          Spent
        </span>
      </div>

      <div className="text-center text-sm text-text-muted">
        {amLeader ? (
          pendingLabel ? (
            <p>
              Locking in <span className="text-text font-medium">{pendingLabel}</span>...
            </p>
          ) : (
            <p>Tap a glowing location on the board to choose the next target.</p>
          )
        ) : (
          <p>Track spent districts on the board while the leader chooses the next target.</p>
        )}
      </div>
    </div>
  );
}
