import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { io, type Socket } from "socket.io-client";
import {
  fetchGameState,
  fetchMyRole,
  proposeTeamInService,
  selectBuildingInService,
  submitAccusationInService,
  submitHeistCardInService,
  submitReadyInService,
  submitVoteInService,
} from "../lib/api";
import type { ClientGameState, GameRole } from "../types/domain";

type GameContextValue = {
  gameState: ClientGameState | null;
  myRole: GameRole | null;
  roomCode: string | null;
  isConnected: boolean;
  setRoomCode: (code: string | null) => void;
  submitReady: () => Promise<void>;
  selectBuilding: (buildingId: string) => Promise<void>;
  proposeTeam: (userIds: string[]) => Promise<void>;
  submitVote: (choice: "approve" | "reject") => Promise<void>;
  submitHeistCard: (card: "clean" | "sabotage") => Promise<void>;
  submitAccusation: (targetUserId: string) => Promise<void>;
};

const GameContext = createContext<GameContextValue | undefined>(undefined);

export function GameProvider({ children }: PropsWithChildren) {
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [myRole, setMyRole] = useState<GameRole | null>(null);
  const [roomCode, setRoomCodeState] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const currentRoomRef = useRef<string | null>(null);

  const setRoomCode = useCallback((code: string | null) => {
    setRoomCodeState(code);
  }, []);

  // Load role from server when roomCode changes
  useEffect(() => {
    if (!roomCode) {
      setMyRole(null);
      setGameState(null);
      return;
    }

    let active = true;

    async function loadRole() {
      try {
        const res = await fetchMyRole(roomCode!);
        if (active) setMyRole(res.role);
      } catch {
        // Role not available yet (game not started) — will retry when game starts
      }
    }

    async function loadState() {
      try {
        const res = await fetchGameState(roomCode!);
        if (active) setGameState(res.gameState);
      } catch {
        // Game may not exist yet
      }
    }

    void loadRole();
    void loadState();

    return () => {
      active = false;
    };
  }, [roomCode]);

  // Reload role when game phase changes and myRole is still missing
  useEffect(() => {
    if (!roomCode || !gameState) return;
    if ((gameState.phase === "role_reveal" || gameState.phase === "pick_building") && !myRole) {
      fetchMyRole(roomCode)
        .then((res) => setMyRole(res.role))
        .catch(() => {});
    }
  }, [gameState?.phase, myRole, roomCode]);

  // Poll for role every 2s during role_reveal if it hasn't loaded yet
  useEffect(() => {
    if (myRole || !roomCode || gameState?.phase !== "role_reveal") return;
    let active = true;
    const interval = setInterval(() => {
      fetchMyRole(roomCode)
        .then((res) => { if (active) setMyRole(res.role); })
        .catch(() => {});
    }, 2000);
    return () => { active = false; clearInterval(interval); };
  }, [myRole, roomCode, gameState?.phase]);

  // Socket.IO connection — maintained while roomCode is set
  useEffect(() => {
    if (!roomCode) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        currentRoomRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Reuse existing socket if we already joined this room
    if (socketRef.current && currentRoomRef.current === roomCode) {
      return;
    }

    // Disconnect previous socket if switching rooms
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io({ path: "/socket.io", transports: ["websocket", "polling"] });
    socketRef.current = socket;
    currentRoomRef.current = roomCode;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("game:join", { roomCode });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("game:state", (state: ClientGameState) => {
      setGameState(state);
      // If game just started (role_reveal) and we don't have a role yet, fetch it
      if (state.phase === "role_reveal" || state.phase === "pick_building") {
        fetchMyRole(roomCode)
          .then((res) => setMyRole(res.role))
          .catch(() => {});
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      currentRoomRef.current = null;
      setIsConnected(false);
    };
  }, [roomCode]);

  const submitReady = useCallback(async () => {
    if (!roomCode) return;
    const res = await submitReadyInService(roomCode);
    setGameState(res.gameState);
  }, [roomCode]);

  const selectBuilding = useCallback(async (buildingId: string) => {
    if (!roomCode) return;
    const res = await selectBuildingInService(roomCode, buildingId);
    setGameState(res.gameState);
  }, [roomCode]);

  const proposeTeam = useCallback(async (userIds: string[]) => {
    if (!roomCode) return;
    const res = await proposeTeamInService(roomCode, userIds);
    setGameState(res.gameState);
  }, [roomCode]);

  const submitVote = useCallback(async (choice: "approve" | "reject") => {
    if (!roomCode) return;
    const res = await submitVoteInService(roomCode, choice);
    setGameState(res.gameState);
  }, [roomCode]);

  const submitHeistCard = useCallback(async (card: "clean" | "sabotage") => {
    if (!roomCode) return;
    const res = await submitHeistCardInService(roomCode, card);
    setGameState(res.gameState);
  }, [roomCode]);

  const submitAccusation = useCallback(async (targetUserId: string) => {
    if (!roomCode) return;
    const res = await submitAccusationInService(roomCode, targetUserId);
    setGameState(res.gameState);
  }, [roomCode]);

  const value = useMemo<GameContextValue>(
    () => ({
      gameState,
      myRole,
      roomCode,
      isConnected,
      setRoomCode,
      submitReady,
      selectBuilding,
      proposeTeam,
      submitVote,
      submitHeistCard,
      submitAccusation,
    }),
    [gameState, myRole, roomCode, isConnected, setRoomCode, submitReady, selectBuilding, proposeTeam, submitVote, submitHeistCard, submitAccusation]
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
