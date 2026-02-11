import AppLayout from "../components/AppLayout";
import SiteHeader from "../components/SiteHeader";

export default function ProfilePage() {
  function handleAccountSubmit(event) {
    event.preventDefault();
  }

  return (
    <AppLayout header={<SiteHeader />} mainClassName="flex-1 flex flex-col items-center gap-6">
      <section className="card w-full max-w-xl">
        <h2 className="text-2xl mb-4 text-center">Account</h2>
        <form className="flex flex-col gap-4 items-center" onSubmit={handleAccountSubmit}>
          <label className="text-lg text-text flex flex-col items-start gap-2 w-80">
            Email
            <input
              className="input-field w-full"
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </label>
          <label className="text-lg text-text flex flex-col items-start gap-2 w-80">
            Password
            <input
              className="input-field w-full"
              name="password"
              placeholder="********"
              required
              type="password"
            />
          </label>
          <div className="flex flex-col gap-3 w-80">
            <button className="btn-primary w-full py-3 text-lg" type="submit">
              Log In
            </button>
            <button className="btn-ghost w-full py-3 text-lg border border-white/20" type="submit">
              Create Account
            </button>
          </div>
        </form>
      </section>

      <section className="card w-full max-w-xl text-center">
        <h2 className="text-2xl mb-2">Profile Stats</h2>
        <ul className="text-text-muted">
          <li>Wins: 18</li>
          <li>Losses: 12</li>
          <li>Win percentage: 60%</li>
        </ul>
      </section>

      <section className="card w-full max-w-xl text-center">
        <h2 className="text-2xl mb-2">Friends</h2>
        <ul className="text-text-muted">
          <li>...</li>
          <li>...</li>
          <li>...</li>
        </ul>
      </section>
    </AppLayout>
  );
}
