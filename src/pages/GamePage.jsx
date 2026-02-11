import { useState } from "react";
import { Link } from "react-router-dom";
import TopNav from "../components/TopNav";

export default function GamePage() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <div className="bg-bg text-text min-h-screen flex flex-col items-center">
      <nav className="flex flex-row items-center justify-center gap-6 text-text-muted mt-6">
        <TopNav />
        <button
          className="hover:text-text"
          onClick={() => setIsHelpOpen(true)}
          type="button"
        >
          How to play
        </button>
        <span className="text-text">Room code: ABCD</span>
        <Link className="hover:text-text" id="leave-link" to="/">
          Leave room
        </Link>
      </nav>

      <dialog id="how-to-play" open={isHelpOpen}>
        <form method="dialog">
          <button
            aria-label="Close"
            onClick={() => setIsHelpOpen(false)}
            type="button"
          >
            x
          </button>
        </form>
        <h2>How to play</h2>
        <p>*instructions*</p>
      </dialog>

      <header
        className="flex flex-col justify-center items-center mt-8 mb-8 text-center"
        id="game-header"
      >
        <div id="timer">
          <div id="time-bar"></div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center" id="game-main">
        <section className="map-section" id="map">
          <div className="flex items-center justify-center">
            <img
              alt="town map"
              className="map-image"
              src="/images/town-map.png"
              width="700"
            />
          </div>
        </section>
      </main>

      <footer
        className="mt-auto text-text-muted flex flex-col items-center gap-2 pb-4"
        id="game-footer"
      >
        <div className="player flex items-center gap-3">
          <span id="player-name">name</span>
          <span id="player-role">role</span>
        </div>

        <div aria-live="polite" className="status text-center" id="phase-hint">
          current phase/action the game (real-time comms)
        </div>

        <div>Aaron Wood</div>
        <a className="hover:text-text" href="https://github.com/waaron5/startup.git">
          GitHub
        </a>
      </footer>
    </div>
  );
}
