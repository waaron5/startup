import type { ClientGameState } from "../../types/domain";
import { GAME_CONFIG } from "../../lib/gameConfig";

type VoteResultPhaseProps = {
  state: ClientGameState;
};

export default function VoteResultPhase({ state }: VoteResultPhaseProps) {
  const votes = state.voteReveal ?? {};
  const approveCount = Object.values(votes).filter((v) => v === "approve").length;
  const passed = approveCount >= 3;
  const rejectedCount = state.rejectedPlans ?? 0;
  const forcedEscalation = !passed && rejectedCount >= GAME_CONFIG.maxRejectedPlans;

  function getVoteLabel(choice: string | undefined) {
    if (choice === "approve") return { label: "APPROVE", cls: "text-success font-bold" };
    if (choice === "reject") return { label: "REJECT", cls: "text-danger font-bold" };
    return { label: "—", cls: "text-text-muted" };
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6 max-w-sm mx-auto w-full">
      <div
        className={`card text-center py-8 border-2 animate-result-pop ${
          passed ? "border-success" : "border-danger"
        }`}
      >
        <p
          className={`text-3xl font-bold font-metal tracking-wide ${
            passed ? "text-success" : "text-danger"
          }`}
        >
          {passed ? "PLAN PASSED" : "PLAN REJECTED"}
        </p>
        {!passed && (
          <p className="text-text-muted text-sm mt-2">
            Rejected Plans: {rejectedCount} / 3
          </p>
        )}
        {forcedEscalation && (
          <p className="text-danger text-sm mt-2 font-medium">
            ⚠ 3 plans rejected — operation lost. Alarm +1.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-text-muted uppercase tracking-wide">Votes</p>
        {state.players.map((p) => {
          const { label, cls } = getVoteLabel(votes[p.userId]);
          return (
            <div className="card flex items-center justify-between py-2" key={p.userId}>
              <span className="text-text">{p.displayName}</span>
              <span className={cls}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
