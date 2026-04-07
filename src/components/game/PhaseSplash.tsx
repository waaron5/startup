import { useEffect } from "react";
import { GAME_PHASE_LABELS } from "../../constants/gamePhases";
import type { GamePhase } from "../../types/domain";

const SPLASH_HINTS: Partial<Record<GamePhase, string>> = {
  pick_building: "Leader chooses the target",
  propose_team: "Leader picks the crew",
  vote: "Approve or reject",
  submit_heist: "The crew moves in",
  final_accusation: "Find the traitor",
};

type Props = {
  phase: GamePhase;
  onDone: () => void;
};

export default function PhaseSplash({ phase, onDone }: Props) {
  useEffect(() => {
    const id = setTimeout(onDone, 1800);
    return () => clearTimeout(id);
  }, [onDone]);

  const isDanger = phase === "final_accusation";

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center animate-splash ${
        isDanger ? "bg-[#120a10]" : "bg-bg"
      }`}
    >
      <h1
        className={`text-4xl font-bold font-metal uppercase tracking-widest text-center px-6 ${
          isDanger ? "text-danger" : "text-primary"
        }`}
      >
        {GAME_PHASE_LABELS[phase]}
      </h1>
      {SPLASH_HINTS[phase] && (
        <p className="text-text-muted text-sm mt-3 uppercase tracking-wider">
          {SPLASH_HINTS[phase]}
        </p>
      )}
    </div>
  );
}
