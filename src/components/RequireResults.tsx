import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { useAuth } from "../context/AuthContext";
import { readJSON } from "../lib/storage";
import type { GameResult } from "../types/domain";

type RequireResultsProps = {
  children: ReactNode;
};

export default function RequireResults({ children }: RequireResultsProps) {
  const { user } = useAuth();
  const location = useLocation();
  const savedResults = readJSON<GameResult[]>(STORAGE_KEYS.results, []);

  const hasResultForUser = Boolean(
    user && savedResults.some((result) => result.userId === user.id)
  );

  if (!hasResultForUser) {
    return (
      <Navigate
        replace
        state={{
          fromPath: location.pathname,
          message: "Complete a match before viewing results.",
        }}
        to="/"
      />
    );
  }

  return <>{children}</>;
}
