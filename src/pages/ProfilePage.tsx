import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import SiteHeader from "../components/SiteHeader";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { useAuth } from "../context/AuthContext";
import { fetchResultsFromService } from "../lib/api";
import { readJSON } from "../lib/storage";
import type { GameResult } from "../types/domain";

type RouteMessageState = {
  message?: string;
};

export default function ProfilePage() {
  const { isAuthenticated, isAuthLoading, user, login, logout, register, updateProfile } =
    useAuth();
  const location = useLocation();
  const routeMessage = (location.state as RouteMessageState | null)?.message ?? "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationDisplayName, setRegistrationDisplayName] = useState("");
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteResults, setRemoteResults] = useState<GameResult[] | null>(null);

  const savedResults = remoteResults ?? readJSON<GameResult[]>(STORAGE_KEYS.results, []);

  const userResults = user
    ? savedResults
        .filter((result) => result.userId === user.id)
        .sort(
          (resultA, resultB) =>
            new Date(resultB.completedAt).getTime() - new Date(resultA.completedAt).getTime()
        )
    : [];

  useEffect(() => {
    if (!user) {
      setProfileDisplayName("");
      return;
    }

    setProfileDisplayName(user.displayName);
  }, [user]);

  const stats = (() => {
    if (!userResults.length) {
      return user?.stats ?? {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalScore: 0,
        bestScore: 0,
      };
    }

    const gamesPlayed = userResults.length;
    const wins = userResults.filter((result) => result.outcome === "win").length;
    const losses = gamesPlayed - wins;
    const totalScore = userResults.reduce((sum, result) => sum + result.score, 0);
    const bestScore = userResults.reduce((best, result) => Math.max(best, result.score), 0);

    return {
      gamesPlayed,
      wins,
      losses,
      winRate: gamesPlayed ? Math.round((wins / gamesPlayed) * 100) : 0,
      totalScore,
      bestScore,
    };
  })();

  const recentResults = userResults.slice(0, 5);

  useEffect(() => {
    let isActive = true;

    async function loadResults() {
      if (!isAuthenticated) {
        setRemoteResults(null);
        return;
      }

      try {
        const response = await fetchResultsFromService();

        if (!isActive) {
          return;
        }

        setRemoteResults(response.results);
      } catch {
        if (!isActive) {
          return;
        }

        setRemoteResults(null);
      }
    }

    void loadResults();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated]);

  function clearMessages() {
    setStatusMessage("");
    setErrorMessage("");
  }

  async function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    setIsSubmitting(true);

    const result = await login(email, password);

    if (result.ok) {
      setStatusMessage(result.message);
      setPassword("");
      setIsSubmitting(false);
      return;
    }

    setErrorMessage(result.message);
    setIsSubmitting(false);
  }

  async function handleCreateAccount() {
    clearMessages();
    setIsSubmitting(true);

    const result = await register({
      email,
      password,
      displayName: registrationDisplayName,
    });

    if (result.ok) {
      setStatusMessage(result.message);
      setPassword("");
      setRegistrationDisplayName("");
      setIsSubmitting(false);
      return;
    }

    setErrorMessage(result.message);
    setIsSubmitting(false);
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    setIsSubmitting(true);

    const result = await updateProfile({
      displayName: profileDisplayName,
    });

    if (!result.ok) {
      setErrorMessage(result.message);
      setIsSubmitting(false);
      return;
    }

    setStatusMessage(result.message);
    setIsSubmitting(false);
  }

  async function handleLogout() {
    setIsSubmitting(true);
    await logout();
    setPassword("");
    setStatusMessage("Logged out.");
    setErrorMessage("");
    setIsSubmitting(false);
  }

  return (
    <AppLayout header={<SiteHeader />} mainClassName="flex-1 flex flex-col items-center gap-6">
      <section className="card w-full max-w-xl">
        <h2 className="text-2xl mb-4 text-center">Account</h2>
        {!isAuthenticated && routeMessage ? (
          <p className="text-center text-text-muted mb-4">{routeMessage}</p>
        ) : null}
        {isAuthLoading ? (
          <p className="text-center text-text-muted mb-4">Checking your sign-in session...</p>
        ) : null}
        {statusMessage ? <p className="text-center text-success mb-4">{statusMessage}</p> : null}
        {errorMessage ? <p className="text-center text-danger mb-4">{errorMessage}</p> : null}

        {!isAuthenticated ? (
          <form className="flex flex-col gap-4 items-center" onSubmit={handleAccountSubmit}>
            <label className="text-lg text-text flex flex-col items-start gap-2 w-80">
              Email
              <input
                className="input-field w-full"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting || isAuthLoading}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label className="text-lg text-text flex flex-col items-start gap-2 w-80">
              Password
              <input
                className="input-field w-full"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting || isAuthLoading}
                placeholder="minimum 8 characters"
                required
                type="password"
                value={password}
              />
            </label>
            <label className="text-lg text-text flex flex-col items-start gap-2 w-80">
              Display Name (for new accounts)
              <input
                className="input-field w-full"
                name="displayName"
                onChange={(event) => setRegistrationDisplayName(event.target.value)}
                disabled={isSubmitting || isAuthLoading}
                placeholder="optional for login"
                type="text"
                value={registrationDisplayName}
              />
            </label>
            <div className="flex flex-col gap-3 w-80">
              <button
                className="btn-primary w-full py-3 text-lg"
                disabled={isSubmitting || isAuthLoading}
                type="submit"
              >
                Log In
              </button>
              <button
                className="btn-ghost w-full py-3 text-lg border border-white/20"
                disabled={isSubmitting || isAuthLoading}
                onClick={handleCreateAccount}
                type="button"
              >
                Create Account
              </button>
            </div>
            <p className="text-text-muted text-sm text-center max-w-sm">
              Authentication is handled by the backend service and persisted with a secure
              HTTP-only session cookie.
            </p>
          </form>
        ) : (
          <form className="flex flex-col gap-4 items-center" onSubmit={handleProfileSubmit}>
            <label className="text-lg text-text flex flex-col items-start gap-2 w-80">
              Email
              <input className="input-field w-full opacity-80" readOnly type="email" value={user.email} />
            </label>
            <label className="text-lg text-text flex flex-col items-start gap-2 w-80">
              Display Name
              <input
                className="input-field w-full"
                name="displayName"
                onChange={(event) => setProfileDisplayName(event.target.value)}
                disabled={isSubmitting}
                required
                type="text"
                value={profileDisplayName}
              />
            </label>
            <div className="flex flex-col gap-3 w-80">
              <button className="btn-primary w-full py-3 text-lg" disabled={isSubmitting} type="submit">
                Save Profile
              </button>
              <button
                className="btn-ghost w-full py-3 text-lg border border-white/20"
                disabled={isSubmitting}
                onClick={handleLogout}
                type="button"
              >
                Log Out
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="card w-full max-w-xl text-center">
        <h2 className="text-2xl mb-2">Profile Stats</h2>
        <ul className="text-text-muted">
          <li>Games played: {stats.gamesPlayed}</li>
          <li>Wins: {stats.wins}</li>
          <li>Losses: {stats.losses}</li>
          <li>Win percentage: {stats.winRate}%</li>
          <li>Total score: {stats.totalScore}</li>
          <li>Best score: {stats.bestScore}</li>
        </ul>
      </section>

      <section className="card w-full max-w-xl text-center">
        <h2 className="text-2xl mb-2">Friends</h2>
        {user?.friends.length ? (
          <ul className="text-text-muted">
            {user.friends.map((friend) => (
              <li key={friend}>{friend}</li>
            ))}
          </ul>
        ) : (
          <p className="text-text-muted">No friends added yet.</p>
        )}
      </section>

      <section className="card w-full max-w-xl text-center">
        <h2 className="text-2xl mb-2">Recent Matches</h2>
        {recentResults.length ? (
          <ul className="text-text-muted space-y-2">
            {recentResults.map((result) => (
              <li key={result.id} className="border border-white/10 rounded-md p-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <span>
                    {result.outcome.toUpperCase()} | Score {result.score} | Room {result.roomCode}
                  </span>
                  <Link
                    className="hover:text-text"
                    to={`/results?resultId=${encodeURIComponent(result.id)}`}
                  >
                    View
                  </Link>
                </div>
                <div className="text-sm">
                  {new Date(result.completedAt).toLocaleString()} | Turns {result.summary.turnsPlayed}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-muted">No matches saved yet.</p>
        )}
      </section>
    </AppLayout>
  );
}
