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
          <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Accusations</p>
          <div className="flex flex-col gap-1">
            {state.players.map((accuser) => {
              const targetId = accusations[accuser.userId];
              const targetName =
                state.players.find((p) => p.userId === targetId)?.displayName ?? "—";
              return (
                <div
                  className="flex items-center justify-between text-sm py-1"
                  key={accuser.userId}
                >
                  <span className="text-text">{accuser.displayName}</span>
                  <span className="text-text-muted">accused</span>
                  <span
                    className={`font-medium ${
                      targetId === result.quislingId ? "text-danger" : "text-text"
                    }`}
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
          <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Operation History</p>
          <div className="flex flex-col gap-2">
            {result.operationHistory.map((op) => (
              <div className="flex items-center justify-between text-sm" key={op.operationNumber}>
                <span className="text-text-muted">#{op.operationNumber}</span>
                <span className="text-text">{op.buildingLabel}</span>
                <span
                  className={`font-medium text-xs uppercase tracking-wide ${
                    op.outcome === "success"
                      ? "text-success"
                      : op.outcome === "escalated"
                      ? "text-text-muted"
                      : "text-danger"
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
