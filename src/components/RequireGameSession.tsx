import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useGame } from "../context/GameContext";

type RequireGameSessionProps = {
  children: ReactNode;
};

export default function RequireGameSession({ children }: RequireGameSessionProps) {
  const { user } = useAuth();
  const { gameSession } = useGame();
  const location = useLocation();

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
