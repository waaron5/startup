import { useState } from "react";
import type { ClientGameState } from "../../types/domain";
import { useGame } from "../../context/GameContext";
import { isLeader, getRequiredTeamSize } from "../../lib/gameEngine";
import { BUILDINGS_BY_ID } from "../../constants/buildings";
import GameBoard from "./GameBoard";
import PhaseTimer from "./PhaseTimer";

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
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
    setError("");
  }

  async function handlePropose() {
    if (pending) return;
    if (selected.length !== required) {
      setError(`You must select exactly ${required} player${required !== 1 ? "s" : ""}.`);
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

  return (
    <div className="flex flex-col gap-4 px-4 py-6 max-w-5xl mx-auto w-full">
      <div className="text-center">
        <h2 className="text-xl font-bold text-text mb-1">Propose a Team</h2>
        <p className="text-text-muted text-sm">
          Operation {state.operationNumber} — Target:{" "}
          <span className="text-primary font-medium">{buildingLabel}</span>
        </p>
        <p className="text-text-muted text-sm mt-1">
          Team size: <span className="font-bold text-text">{required}</span>
        </p>
      </div>

      {amLeader ? (
        <p className="text-center text-sm text-primary font-medium">
          You are the Leader. Choose {required} player{required !== 1 ? "s" : ""} for the team.
        </p>
      ) : (
        <p className="text-center text-sm text-text-muted">
          Waiting for <span className="text-primary font-medium">{leaderName}</span> to propose a team.
        </p>
      )}

      <PhaseTimer deadline={state.phaseDeadline} />

      {error && <p className="text-danger text-sm text-center">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)] lg:items-start">
        <GameBoard
          className="p-2"
          highlightedBuildingId={state.selectedBuildingId}
          spentBuildingIds={state.spentBuildingIds}
        />

        <div className="flex flex-col gap-4">
          {amLeader ? (
            <div className="card text-center">
              <p className="text-xs uppercase tracking-[0.24em] text-text-muted">
                Team Selection
              </p>
              <p className="mt-2 text-3xl font-bold text-text">
                {selected.length}/{required}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Choose {required} players for the operation.
              </p>
            </div>
          ) : (
            <div className="card text-center">
              <p className="text-xs uppercase tracking-[0.24em] text-text-muted">
                Board Status
              </p>
              <p className="mt-2 text-sm text-text-muted">
                The highlighted building is the active target while the leader assembles a team.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {state.players.map((p) => {
              const isSelected = selected.includes(p.userId);
              return (
                <button
                  className={`card w-full text-left transition-colors ${
                    amLeader ? "cursor-pointer" : "cursor-default opacity-70"
                  } ${
                    isSelected
                      ? "border-primary bg-primary/10 text-text"
                      : "hover:border-primary/50"
                  }`}
                  disabled={!amLeader || pending}
                  key={p.userId}
                  onClick={() => togglePlayer(p.userId)}
                  type="button"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text">{p.displayName}</span>
                    {p.userId === state.leaderId && (
                      <span className="text-xs text-primary uppercase tracking-wide">Leader</span>
                    )}
                    {isSelected && amLeader && (
                      <span className="text-xs text-success font-bold">✓</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {amLeader ? (
            <button
              className="btn-primary w-full"
              disabled={selected.length !== required || pending}
              onClick={handlePropose}
              type="button"
            >
              {pending ? "Proposing..." : "Propose Team"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
