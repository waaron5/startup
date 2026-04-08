import { useState } from "react";
import type { ClientGameState } from "../../types/domain";
import { useGame } from "../../context/GameContext";
import { isLeader } from "../../lib/gameEngine";
import { BUILDINGS, BUILDINGS_BY_ID } from "../../constants/buildings";
import GameBoard from "./GameBoard";

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
    <div className="relative h-full w-full">
      <GameBoard
        clickableBuildingIds={availableBuildings.map((building) => building.id)}
        className="absolute inset-0"
        disabled={!amLeader || pending !== null}
        onSelect={handleSelect}
        selectedBuildingId={pending}
        spentBuildingIds={state.spentBuildingIds}
      />
      {!amLeader && (
        <p className="absolute top-2 left-0 right-0 z-10 text-center text-text-muted text-sm">
          <span className="text-text font-medium">{leaderName}</span> is picking the target
        </p>
      )}
      {error && (
        <p className="absolute bottom-2 left-0 right-0 z-10 text-danger text-sm text-center px-4">{error}</p>
      )}
    </div>
  );
}
