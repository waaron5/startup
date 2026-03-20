import type { GameResult } from "../types/domain";
import type { GameLobby } from "../types/domain";
import type { UserStats } from "../types/domain";

export class ApiRequestError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.payload = payload;
  }
}

export type ServiceUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  stats: UserStats;
  friends: string[];
  history: string[];
};

export type ServiceAuthResponse = {
  ok: true;
  message?: string;
  user: ServiceUser;
  session: {
    loggedInAt: string;
  };
};

type ServiceMessageResponse = {
  ok: boolean;
  message: string;
};

type ServiceResultsResponse = {
  ok: true;
  results: GameResult[];
};

type ServiceResultResponse = {
  ok: true;
  message?: string;
  result: GameResult;
};

type ServiceProfileResponse = {
  ok: true;
  message?: string;
  user: ServiceUser;
};

type ServiceLobbyResponse = {
  ok: true;
  lobby: GameLobby | null;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

function readMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : null;
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiRequestError(0, "Unable to reach the service.", null);
  }

  const rawBody = await response.text();
  let payload: unknown = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      payload = rawBody;
    }
  }

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      readMessage(payload) ?? `Request failed (${response.status}).`,
      payload
    );
  }

  return payload as T;
}

export function registerWithService(input: {
  email: string;
  password: string;
  displayName: string;
}) {
  return requestJson<ServiceAuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function loginWithService(input: {
  email: string;
  password: string;
}) {
  return requestJson<ServiceAuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logoutFromService() {
  return requestJson<ServiceMessageResponse>("/api/auth/logout", {
    method: "POST",
  });
}

export function fetchCurrentUser() {
  return requestJson<ServiceAuthResponse>("/api/auth/me");
}

export function fetchResultsFromService() {
  return requestJson<ServiceResultsResponse>("/api/results");
}

export function fetchResultByIdFromService(resultId: string) {
  return requestJson<ServiceResultResponse>(`/api/results/${encodeURIComponent(resultId)}`);
}

export function saveResultToService(result: GameResult) {
  return requestJson<ServiceResultResponse>("/api/results", {
    method: "POST",
    body: JSON.stringify(result),
  });
}

export function fetchLobbyByRoomCode(roomCode: string) {
  return requestJson<ServiceLobbyResponse>(`/api/lobbies/${encodeURIComponent(roomCode)}`);
}

export function createLobbyInService(roomCode: string) {
  return requestJson<ServiceLobbyResponse>("/api/lobbies", {
    method: "POST",
    body: JSON.stringify({ roomCode }),
  });
}

export function joinLobbyInService(roomCode: string) {
  return requestJson<ServiceLobbyResponse>(`/api/lobbies/${encodeURIComponent(roomCode)}/join`, {
    method: "POST",
  });
}

export function leaveLobbyInService(roomCode: string) {
  return requestJson<ServiceLobbyResponse>(`/api/lobbies/${encodeURIComponent(roomCode)}/leave`, {
    method: "POST",
  });
}

export function updateLobbyStatusInService(roomCode: string, status: GameLobby["status"]) {
  return requestJson<ServiceLobbyResponse>(`/api/lobbies/${encodeURIComponent(roomCode)}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export function reopenLobbyInService(roomCode: string) {
  return requestJson<ServiceLobbyResponse>(`/api/lobbies/${encodeURIComponent(roomCode)}/reopen`, {
    method: "POST",
  });
}

export function updateProfileInService(input: { displayName: string }) {
  return requestJson<ServiceProfileResponse>("/api/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
