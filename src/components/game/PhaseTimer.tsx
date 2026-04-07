import { useEffect, useState } from "react";

type PhaseTimerProps = {
  deadline: number | null;
};

export default function PhaseTimer({ deadline }: PhaseTimerProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      setRemaining(null);
      return;
    }

    function tick() {
      const ms = Math.max(0, deadline! - Date.now());
      setRemaining(Math.ceil(ms / 1000));
    }

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadline]);

  if (remaining === null) return null;

  const isUrgent = remaining <= 5;

  return (
    <div
      className={`flex items-center justify-center gap-1 text-sm font-medium ${
        isUrgent ? "text-danger" : "text-text-muted"
      }`}
    >
      <span>{isUrgent ? "⚠" : "⏱"}</span>
      <span>{remaining}s</span>
    </div>
  );
}
