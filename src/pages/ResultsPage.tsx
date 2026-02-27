import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import AppLayout from "../components/AppLayout";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { useAuth } from "../context/AuthContext";
import { useGame } from "../context/GameContext";
import { createGameSession } from "../lib/gameSession";
import { readJSON, writeJSON } from "../lib/storage";
import { createId, nowIso } from "../lib/time";
import type { GameLobby, GameResult } from "../types/domain";

export default function ResultsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { setGameSession } = useGame();
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedResultId = searchParams.get("resultId");
  const savedResults = readJSON<GameResult[]>(STORAGE_KEYS.results, []);

  const userResults = useMemo(
    () =>
      user
        ? savedResults
            .filter((result) => result.userId === user.id)
            .sort(
              (resultA, resultB) =>
                new Date(resultB.completedAt).getTime() - new Date(resultA.completedAt).getTime()
            )
        : [],
    [savedResults, user]
  );

  const result = useMemo(() => {
    if (!userResults.length) {
      return null;
    }

    if (selectedResultId) {
      return userResults.find((candidate) => candidate.id === selectedResultId) ?? userResults[0];
    }

    return userResults[0];
  }, [selectedResultId, userResults]);

  function handlePlayAgain() {
    setMessage("");
    setErrorMessage("");

    if (!user || !result) {
      setErrorMessage("No user/result context available to replay this match.");
      return;
    }

    const lobbies = readJSON<GameLobby[]>(STORAGE_KEYS.games, []);
    const timestamp = nowIso();
    const existingLobby = lobbies.find((lobby) => lobby.roomCode === result.roomCode);

    let nextLobbies: GameLobby[];

    if (existingLobby) {
      const replayLobby: GameLobby = {
        ...existingLobby,
        status: "open",
        updatedAt: timestamp,
        players: existingLobby.players.includes(user.id)
          ? existingLobby.players
          : [...existingLobby.players, user.id],
      };

      nextLobbies = lobbies.map((lobby) => (lobby.id === replayLobby.id ? replayLobby : lobby));
    } else {
      const replayLobby: GameLobby = {
        id: createId("lobby"),
        roomCode: result.roomCode,
        createdAt: timestamp,
        updatedAt: timestamp,
        hostUserId: user.id,
        players: [user.id],
        status: "open",
      };

      nextLobbies = [replayLobby, ...lobbies];
    }

    writeJSON(STORAGE_KEYS.games, nextLobbies);
    setGameSession(
      createGameSession({
        roomCode: result.roomCode,
        userId: user.id,
        playerName: user.displayName,
        actionLogPrefix: "Replay session created",
      })
    );

    setMessage(`Replay session created for room ${result.roomCode}.`);
    navigate("/game");
  }

  if (!result || !user) {
    return (
      <AppLayout
        header={<SiteHeader />}
        mainClassName="flex-1 flex flex-col items-center gap-6 text-center"
      >
        <section className="card w-full max-w-xl">
          <h2 className="text-2xl mb-2">No match results yet</h2>
          <p className="text-text-muted">Complete a game to generate results.</p>
          <div className="mt-4">
            <Link className="btn-primary" to="/">
              Back to lobby
            </Link>
          </div>
        </section>
      </AppLayout>
    );
  }

  const outcomeClass = result.outcome === "win" ? "text-success" : "text-danger";
  const completedAtLabel = new Date(result.completedAt).toLocaleString();

  return (
    <AppLayout
      header={<SiteHeader />}
      mainClassName="flex-1 flex flex-col items-center gap-6 text-center"
    >
      <section className="card w-full max-w-xl">
        <h2 className="text-2xl mb-2">Match Results</h2>
        <p className="text-text-muted">
          Outcome: <strong className={outcomeClass}>{result.outcome.toUpperCase()}</strong>
        </p>
        <p className="text-text-muted mt-1">Score: {result.score}</p>
        <p className="text-text-muted mt-1">Room code: {result.roomCode}</p>
        <p className="text-text-muted mt-1">Completed: {completedAtLabel}</p>
      </section>

      <section className="card w-full max-w-xl text-left">
        <h3 className="text-xl mb-2">Mission Breakdown</h3>
        <p className="text-text-muted">Turns played: {result.summary.turnsPlayed}</p>
        <p className="text-text-muted mb-3">Time remaining: {result.summary.timeRemaining}s</p>
        <h4 className="text-lg">Buildings Hit</h4>
        {result.summary.buildingsHit.length ? (
          <ol className="list-decimal list-inside text-text-muted">
            {result.summary.buildingsHit.map((building, index) => (
              <li key={`${building}-${index}`}>{building}</li>
            ))}
          </ol>
        ) : (
          <p className="text-text-muted">No building captures were recorded for this match.</p>
        )}
      </section>

      <section className="card w-full max-w-xl">
        <h3 className="text-xl mb-2">Next</h3>
        {message ? <p className="text-success mb-2">{message}</p> : null}
        {errorMessage ? <p className="text-danger mb-2">{errorMessage}</p> : null}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          <button className="btn-primary" onClick={handlePlayAgain} type="button">
            Play again
          </button>
          <Link className="btn-ghost border border-white/20" to="/">
            Back to lobby
          </Link>
          <Link className="btn-ghost border border-white/20" to="/profile">
            View profile
          </Link>
        </div>
      </section>
    </AppLayout>
  );
}
