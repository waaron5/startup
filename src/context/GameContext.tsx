import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from "react";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { hydrateGameSession } from "../lib/gameEngine";
import { readJSON, writeJSON } from "../lib/storage";
import type { GameSession } from "../types/domain";

type GameContextValue = {
  gameSession: GameSession | null;
  setGameSession: Dispatch<SetStateAction<GameSession | null>>;
  clearGameSession: () => void;
};

const GameContext = createContext<GameContextValue | undefined>(undefined);

export function GameProvider({ children }: PropsWithChildren) {
  const [gameSession, setGameSession] = useState<GameSession | null>(() => {
    const storedSession = readJSON<GameSession | null>(STORAGE_KEYS.gameSession, null);
    return storedSession ? hydrateGameSession(storedSession) : null;
  });

  useEffect(() => {
    writeJSON(STORAGE_KEYS.gameSession, gameSession);
  }, [gameSession]);

  const value = useMemo<GameContextValue>(
    () => ({
      gameSession,
      setGameSession,
      clearGameSession: () => setGameSession(null),
    }),
    [gameSession]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);

  if (!context) {
    throw new Error("useGame must be used within a GameProvider.");
  }

  return context;
}
