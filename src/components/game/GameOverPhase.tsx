import type { ClientGameState } from "../../types/domain";

type GameOverPhaseProps = {
  state: ClientGameState;
  myUserId: string;
  onPlayAgain: () => void;
};

export default function GameOverPhase({ state, myUserId, onPlayAgain }: GameOverPhaseProps) {
  const result = state.result;
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-text-muted">Loading result...</p>
      </div>
    );
  }

  const crewWon = result.winner === "crew";
  const iAmQuisling = result.quislingId === myUserId;
  const iAmDetained = result.detainedUserId === myUserId;

  const accusations = state.accusationReveal ?? {};

  return (
    <div className="flex flex-col gap-5 px-4 py-6 max-w-sm mx-auto w-full">
      {/* Winner banner */}
      <div
        className={`card text-center py-8 border-2 ${
          crewWon ? "border-success" : "border-danger"
        }`}
      >
        <p
          className={`text-3xl font-bold tracking-wide ${
            crewWon ? "text-success" : "text-danger"
          }`}
        >
          {crewWon ? "CREW WINS" : "QUISLING WINS"}
        </p>
        {iAmQuisling && (
          <p className="text-text-muted text-sm mt-2 italic">You were the Quisling.</p>
        )}
        {!iAmQuisling && (
          <p className="text-text-muted text-sm mt-2 italic">
            {crewWon ? "The Quisling was caught!" : "The Quisling escaped."}
          </p>
        )}
      </div>

      {/* Quisling reveal */}
      <div className="card">
        <p className="text-xs text-text-muted uppercase tracking-wide mb-2">The Quisling</p>
        <div className="flex items-center justify-between">
          <span className="font-bold text-danger text-lg">{result.quislingDisplayName}</span>
          {iAmQuisling && (
            <span className="text-xs text-danger uppercase tracking-wide">You</span>
          )}
        </div>
        {result.detainedUserId && (
          <p className="text-text-muted text-sm mt-2">
            Detained:{" "}
            <span className={`font-medium ${iAmDetained ? "text-danger" : "text-text"}`}>
              {result.detainedDisplayName}
              {iAmDetained ? " (You)" : ""}
            </span>
          </p>
        )}
      </div>

      {/* Accusation breakdown */}
      {Object.keys(accusations).length > 0 && (
        <div className="card">
          <p className="text-xs text-text-muted uppercase tracking-wide mb-3">Final Accusations</p>
          <div className="flex flex-col divide-y divide-white/5">
            {state.players.map((accuser) => {
              const targetId = accusations[accuser.userId];
              const targetName =
                state.players.find((p) => p.userId === targetId)?.displayName ?? "—";
              const accusedQuisling = targetId === result.quislingId;
              return (
                <div
                  className="flex items-center justify-between text-sm py-2"
                  key={accuser.userId}
                >
                  <span className="text-text font-medium">{accuser.displayName}</span>
                  <span className="text-text-muted text-xs">accused</span>
                  <span
                    className={`font-medium ${accusedQuisling ? "text-success" : "text-danger"}`}
                  >
                    {targetName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Operation history */}
      {result.operationHistory.length > 0 && (
        <div className="card">
          <p className="text-xs text-text-muted uppercase tracking-wide mb-3">Operation Log</p>
          <div className="flex flex-col divide-y divide-white/5">
            {result.operationHistory.map((op, i) => (
              <div
                className={`flex items-center justify-between text-sm py-2 ${i % 2 === 0 ? "bg-white/[0.02] -mx-2 px-2 rounded" : ""}`}
                key={op.operationNumber}
              >
                <span className="text-text-muted text-xs w-6">#{op.operationNumber}</span>
                <span className="text-text flex-1 px-3">{op.buildingLabel}</span>
                <span
                  className={`font-medium text-xs uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                    op.outcome === "success"
                      ? "text-success border-success/30 bg-success/5"
                      : op.outcome === "escalated"
                      ? "text-text-muted border-white/10"
                      : "text-danger border-danger/30 bg-danger/5"
                  }`}
                >
                  {op.outcome}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn-primary w-full" onClick={onPlayAgain} type="button">
        Return to Lobby
      </button>
    </div>
  );
}
