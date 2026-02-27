import { useEffect } from "react";

type UseGameTimerOptions = {
  isRunning: boolean;
  remainingSeconds: number;
  onTick: (nextSeconds: number) => void;
  onExpire?: () => void;
};

export default function useGameTimer({
  isRunning,
  remainingSeconds,
  onTick,
  onExpire,
}: UseGameTimerOptions) {
  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const nextSeconds = Math.max(0, remainingSeconds - 1);
      onTick(nextSeconds);
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isRunning, remainingSeconds, onTick]);

  useEffect(() => {
    if (remainingSeconds === 0) {
      onExpire?.();
    }
  }, [remainingSeconds, onExpire]);
}
