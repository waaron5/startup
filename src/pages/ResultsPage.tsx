import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";
import { fetchResultsFromService } from "../lib/api";
import type { GameResult } from "../types/domain";

export default function ResultsPage() {
  const { user } = useAuth();
  const [results, setResults] = useState<GameResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user) {
        setResults([]);
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetchResultsFromService();
        if (active) setResults(res.results);
      } catch {
        if (active) setError("Could not load results.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [user]);

  const sorted = results
    ? [...results].sort(
        (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      )
    : [];

  return (
    <AppLayout header={<SiteHeader />} mainClassName="flex-1 flex flex-col">
      <h2 className="text-2xl font-bold text-text text-center mb-4">Match History</h2>

      {!user && (
        <p className="text-text-muted text-center">Sign in to see your results.</p>
      )}

      {isLoading && <p className="text-text-muted text-center">Loading...</p>}
      {error && <p className="text-danger text-center">{error}</p>}

      {!isLoading && sorted.length === 0 && !error && user && (
        <p className="text-text-muted text-center">No games played yet.</p>
      )}

      <div className="flex flex-col gap-3 max-w-sm mx-auto w-full">
        {sorted.map((result) => (
          <div className="card" key={result.id}>
            <div className="flex items-center justify-between mb-2">
              <span className={`font-bold text-lg ${result.outcome === "win" ? "text-success" : "text-danger"}`}>
                {result.outcome === "win" ? "WIN" : "LOSS"}
              </span>
              <span className="text-xs text-text-muted">
                {new Date(result.completedAt).toLocaleDateString()}
              </span>
            </div>
            <p className="text-text-muted text-sm">
              Room: <span className="text-text font-mono">{result.roomCode}</span>
            </p>
            <p className="text-text-muted text-sm">
              Winner: <span className={`font-medium ${result.winner === "crew" ? "text-success" : "text-danger"}`}>
                {result.winner === "crew" ? "Crew" : "Quisling"}
              </span>
            </p>
            <p className="text-text-muted text-sm">
              Quisling: <span className="text-text">{result.quislingDisplayName}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="text-center mt-6">
        <Link className="btn-ghost border border-white/20 px-4 py-2" to="/">
          Back to Home
        </Link>
      </div>
    </AppLayout>
  );
}

