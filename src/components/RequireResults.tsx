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
  const selectedResultId = new URLSearchParams(location.search).get("resultId");
  const visibleResults = user
    ? savedResults.filter((result) => result.userId === user.id)
    : savedResults;

  const hasVisibleResult = selectedResultId
    ? visibleResults.some((result) => result.id === selectedResultId)
    : visibleResults.length > 0;

  if (isLoading) {
    return null;
  }

  if (!hasVisibleResult) {
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
