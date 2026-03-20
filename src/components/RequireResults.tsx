import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { useAuth } from "../context/AuthContext";
import { fetchResultsFromService } from "../lib/api";
import { readJSON } from "../lib/storage";
import type { GameResult } from "../types/domain";

type RequireResultsProps = {
  children: ReactNode;
};

export default function RequireResults({ children }: RequireResultsProps) {
  const { user } = useAuth();
  const location = useLocation();
  const localResults = readJSON<GameResult[]>(STORAGE_KEYS.results, []);
  const [remoteResults, setRemoteResults] = useState<GameResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadResults() {
      if (!user) {
        setRemoteResults(null);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetchResultsFromService();

        if (!isActive) {
          return;
        }

        setRemoteResults(response.results);
      } catch {
        if (!isActive) {
          return;
        }

        setRemoteResults(null);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadResults();

    return () => {
      isActive = false;
    };
  }, [user]);

  const savedResults = remoteResults ?? localResults;

  const hasResultForUser = Boolean(
    user && savedResults.some((result) => result.userId === user.id)
  );

  if (isLoading) {
    return null;
  }

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
