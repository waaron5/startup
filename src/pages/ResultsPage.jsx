import AppLayout from "../components/AppLayout";
import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";

export default function ResultsPage() {
  return (
    <AppLayout
      header={<SiteHeader />}
      mainClassName="flex-1 flex flex-col items-center gap-6 text-center"
    >
      <section className="card w-full max-w-xl">
        <h2 className="text-2xl mb-2">Match Results</h2>
        <p className="text-text-muted">
          Outcome: <strong className="text-text">Win</strong>
        </p>
      </section>

      <section className="card w-full max-w-xl text-left">
        <h3 className="text-xl mb-2">Round Order</h3>
        <ol className="list-decimal list-inside text-text-muted">
          <li>Round 1: Win</li>
          <li>Round 2: Loss</li>
          <li>Round 3: Win</li>
          <li>Round 4: Win</li>
          <li>Round 5: Loss</li>
          <li>Round 6: Win</li>
        </ol>
      </section>

      <section className="card w-full max-w-xl">
        <h3 className="text-xl mb-2">Next</h3>
        <p className="text-text-muted">
          <Link className="hover:text-text" to="/game">
            Play again
          </Link>
          <span className="mx-2 text-text-muted">|</span>
          <Link className="hover:text-text" to="/">
            Back to lobby
          </Link>
        </p>
      </section>
    </AppLayout>
  );
}
