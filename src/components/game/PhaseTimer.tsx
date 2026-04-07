import { useEffect, useState } from "react";

type PhaseTimerProps = {
  deadline: number | null;
  paused?: boolean;
};

export default function PhaseTimer({ deadline, paused = false }: PhaseTimerProps) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [frozenAt, setFrozenAt] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      setRemaining(null);
      setFrozenAt(null);
      return;
    }

    if (paused) {
      setRemaining((prev) => {
        if (frozenAt === null && prev !== null) setFrozenAt(prev);
        return frozenAt ?? prev;
      });
      return;
    }

    setFrozenAt(null);

    function tick() {
      const ms = Math.max(0, deadline! - Date.now());
      setRemaining(Math.ceil(ms / 1000));
    }

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadline, paused, frozenAt]);

  if (remaining === null) return null;

  const display = frozenAt ?? remaining;
  const isUrgent = display <= 15;

  return (
    <div className="shrink-0 flex items-center justify-center py-1">
      <span
        className={`text-lg font-bold tabular-nums ${
          paused ? "text-primary animate-pulse" : isUrgent ? "text-danger" : "text-text-muted"
        }`}
      >
        {paused ? `⏸ ${display}s` : `${display}s`}
      </span>
    </div>
  );
}
