import { useEffect, useState, type FormEvent } from "react";
import AppLayout from "../components/AppLayout";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { isAuthenticated, user, login, logout, register, updateProfile } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationDisplayName, setRegistrationDisplayName] = useState("");
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!user) {
      setProfileDisplayName("");
      return;
    }

    setProfileDisplayName(user.displayName);
  }, [user]);

  const stats = user?.stats ?? {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalScore: 0,
    bestScore: 0,
  };

  function clearMessages() {
    setStatusMessage("");
    setErrorMessage("");
  }

  function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    const result = login(email, password);

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setStatusMessage(result.message);
    setPassword("");
  }

  function handleCreateAccount() {
    clearMessages();

    const result = register({
      email,
      password,
      displayName: registrationDisplayName,
    });

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setStatusMessage(result.message);
    setPassword("");
    setRegistrationDisplayName("");
  }

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    const result = updateProfile({
      displayName: profileDisplayName,
    });

    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }

    setStatusMessage(result.message);
  }

  function handleLogout() {
    logout();
    setPassword("");
    setStatusMessage("Logged out.");
    setErrorMessage("");
  }

  return (
    <AppLayout header={<SiteHeader />} mainClassName="flex-1 flex flex-col items-center gap-6">
      <section className="card w-full max-w-xl">
        <h2 className="text-2xl mb-4 text-center">Account</h2>
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
                placeholder="optional for login"
                type="text"
                value={registrationDisplayName}
              />
            </label>
            <div className="flex flex-col gap-3 w-80">
              <button className="btn-primary w-full py-3 text-lg" type="submit">
                Log In
              </button>
              <button
                className="btn-ghost w-full py-3 text-lg border border-white/20"
                onClick={handleCreateAccount}
                type="button"
              >
                Create Account
              </button>
            </div>
            <p className="text-text-muted text-sm text-center max-w-sm">
              Frontend scaffold mode: credentials are stored in local browser storage until backend
              auth is implemented.
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
                required
                type="text"
                value={profileDisplayName}
              />
            </label>
            <div className="flex flex-col gap-3 w-80">
              <button className="btn-primary w-full py-3 text-lg" type="submit">
                Save Profile
              </button>
              <button
                className="btn-ghost w-full py-3 text-lg border border-white/20"
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
        {user?.history.length ? (
          <ul className="text-text-muted">
            {user.history.slice(0, 5).map((matchId) => (
              <li key={matchId}>{matchId}</li>
            ))}
          </ul>
        ) : (
          <p className="text-text-muted">No matches saved yet.</p>
        )}
      </section>
    </AppLayout>
  );
}
