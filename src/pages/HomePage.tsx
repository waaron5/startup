import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import SiteHeader from "../components/SiteHeader";
import useNoScroll from "../hooks/useNoScroll";

export default function HomePage() {
  const navigate = useNavigate();
  useNoScroll();

  function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate("/game");
  }

  function handleCreateRoom() {
    navigate("/game");
  }

  return (
    <AppLayout header={<SiteHeader subtitle />}>
      <form
        className="flex flex-col mt-8 items-center gap-2"
        onSubmit={handleJoinRoom}
      >
        <label className="text-lg text-text flex flex-col items-start gap-2 w-80">
          NAME
          <input
            className="input-field w-full"
            name="name"
            placeholder="Your name"
            required
            type="text"
          />
        </label>

        <label className="text-lg text-text flex flex-col items-start gap-2 w-80 mt-2">
          ROOM CODE
          <input
            className="input-field w-full"
            name="roomCode"
            placeholder="'ABCD'"
            type="text"
          />
        </label>

        <button
          className="btn-primary w-80 py-3 text-lg mt-4 border-white/20"
          type="submit"
        >
          JOIN ROOM
        </button>

        <button
          className="btn-ghost w-80 py-3 text-lg border border-white/20"
          onClick={handleCreateRoom}
          type="button"
        >
          CREATE ROOM
        </button>
      </form>
    </AppLayout>
  );
}
