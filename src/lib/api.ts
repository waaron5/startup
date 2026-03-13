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
