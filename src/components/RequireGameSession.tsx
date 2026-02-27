import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { useAuth } from "../context/AuthContext";
import { readJSON } from "../lib/storage";
import type { GameSession } from "../types/domain";

type RequireGameSessionProps = {
  children: ReactNode;
};

export default function RequireGameSession({ children }: RequireGameSessionProps) {
  const { user } = useAuth();
  const location = useLocation();
  const gameSession = readJSON<GameSession | null>(STORAGE_KEYS.gameSession, null);

  if (!gameSession || !user || gameSession.userId !== user.id) {
    return (
      <Navigate
        replace
        state={{
          fromPath: location.pathname,
          message: "Create or join a room before entering the game.",
        }}
        to="/"
      />
    );
  }

  return <>{children}</>;
}
