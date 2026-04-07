import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { STORAGE_KEYS } from "../constants/storageKeys";
import {
  ApiRequestError,
  fetchCurrentUser,
  fetchResultsFromService,
  loginWithService,
  logoutFromService,
  registerWithService,
  saveResultToService,
  type ServiceAuthResponse,
  updateProfileInService,
  type ServiceUser,
} from "../lib/api";
import { readJSON, updateJSON, writeJSON } from "../lib/storage";
import type { AuthSession, GameResult, UserRecord, UserStats } from "../types/domain";

type AuthResult =
  | {
      ok: true;
      message: string;
      user: UserRecord;
    }
  | {
      ok: false;
      message: string;
    };

type RegisterInput = {
  email: string;
  password: string;
  displayName: string;
};

type ProfileUpdateInput = {
  displayName?: string;
};

type AuthContextValue = {
  user: UserRecord | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  quickLogin: (input: RegisterInput) => Promise<AuthResult>;
  register: (input: RegisterInput) => Promise<AuthResult>;
  logout: () => Promise<void>;
  updateProfile: (input: ProfileUpdateInput) => Promise<AuthResult>;
  recordGameResult: (result: GameResult) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;

function createDefaultStats(): UserStats {
  return {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDisplayName(displayName: string, fallbackEmail: string): string {
  const trimmedName = displayName.trim();

  if (trimmedName) {
    return trimmedName;
  }

  const [emailPrefix = "Player"] = fallbackEmail.split("@");
  return emailPrefix;
}

function createUserRecordFromService(
  serviceUser: ServiceUser,
  existingUser?: UserRecord
): UserRecord {
  return {
    id: serviceUser.id,
    email: serviceUser.email,
    password: existingUser?.password ?? "",
    displayName: normalizeDisplayName(serviceUser.displayName, serviceUser.email),
    createdAt: serviceUser.createdAt,
    stats: serviceUser.stats ?? existingUser?.stats ?? createDefaultStats(),
    friends: (serviceUser as { friends?: string[] }).friends ?? existingUser?.friends ?? [],
    history: (serviceUser as { history?: string[] }).history ?? existingUser?.history ?? [],
  };
}

function upsertUserRecord(currentUsers: UserRecord[], nextUser: UserRecord): UserRecord[] {
  const matchIndex = currentUsers.findIndex((candidate) => candidate.id === nextUser.id);

  if (matchIndex === -1) {
    return [...currentUsers, nextUser];
  }

  const nextUsers = [...currentUsers];
  nextUsers[matchIndex] = nextUser;
  return nextUsers;
}

function toAuthErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [users, setUsers] = useState<UserRecord[]>(() =>
    readJSON<UserRecord[]>(STORAGE_KEYS.users, [])
  );
  const [session, setSession] = useState<AuthSession | null>(() =>
    readJSON<AuthSession | null>(STORAGE_KEYS.session, null)
  );
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    writeJSON(STORAGE_KEYS.users, users);
  }, [users]);

  useEffect(() => {
    writeJSON(STORAGE_KEYS.session, session);
  }, [session]);

  const user = useMemo(() => {
    if (!session) {
      return null;
    }

    return users.find((candidate) => candidate.id === session.userId) ?? null;
  }, [users, session]);

  useEffect(() => {
    if (session && !user) {
      setSession(null);
      return;
    }

    if (session && user && session.displayName !== user.displayName) {
      setSession((currentSession) =>
        currentSession
          ? {
              ...currentSession,
              displayName: user.displayName,
            }
          : null
      );
    }
  }, [session, user]);

  function syncUserFromService(serviceUser: ServiceUser): UserRecord {
    const existingUser = users.find((candidate) => candidate.id === serviceUser.id);
    const userRecord = createUserRecordFromService(serviceUser, existingUser);

    setUsers((currentUsers) => {
      const currentUser = currentUsers.find((candidate) => candidate.id === serviceUser.id);
      const nextUser = createUserRecordFromService(serviceUser, currentUser);
      return upsertUserRecord(currentUsers, nextUser);
    });

    return userRecord;
  }

  function setSessionFromUser(userRecord: UserRecord, loggedInAt: string) {
    setSession({
      userId: userRecord.id,
      email: userRecord.email,
      displayName: userRecord.displayName,
      loggedInAt,
    });
  }

  function completeAuth(response: ServiceAuthResponse, fallbackMessage: string): AuthResult {
    const syncedUser = syncUserFromService(response.user);
    setSessionFromUser(syncedUser, response.session.loggedInAt);

    return {
      ok: true,
      message: response.message ?? fallbackMessage,
      user: syncedUser,
    };
  }

  useEffect(() => {
    let isActive = true;

    async function hydrateAuthFromService() {
      try {
        const response = await fetchCurrentUser();

        if (!isActive) {
          return;
        }

        const syncedUser = syncUserFromService(response.user);
        setSessionFromUser(syncedUser, response.session.loggedInAt);
      } catch {
        if (!isActive) {
          return;
        }

        setSession(null);
      } finally {
        if (isActive) {
          setIsAuthLoading(false);
        }
      }
    }

    hydrateAuthFromService();

    return () => {
      isActive = false;
    };
  }, []);

  async function login(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = normalizeEmail(email);

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return { ok: false, message: "Please provide a valid email address." };
    }

    try {
      const response = await loginWithService({
        email: normalizedEmail,
        password,
      });

      return completeAuth(response, "Logged in successfully.");
    } catch (error: unknown) {
      return {
        ok: false,
        message: toAuthErrorMessage(error, "Unable to log in."),
      };
    }
  }

  async function quickLogin(input: RegisterInput): Promise<AuthResult> {
    const normalizedEmail = normalizeEmail(input.email);

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return { ok: false, message: "Please provide a valid email address." };
    }

    if (input.password.length < PASSWORD_MIN_LENGTH) {
      return {
        ok: false,
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      };
    }

    const normalizedDisplayName = normalizeDisplayName(input.displayName, normalizedEmail);

    try {
      const response = await loginWithService({
        email: normalizedEmail,
        password: input.password,
      });

      return completeAuth(response, "Logged in successfully.");
    } catch (error: unknown) {
      if (!(error instanceof ApiRequestError) || error.status !== 401) {
        return {
          ok: false,
          message: toAuthErrorMessage(error, "Unable to log in."),
        };
      }
    }

    try {
      const response = await registerWithService({
        email: normalizedEmail,
        password: input.password,
        displayName: normalizedDisplayName,
      });

      return completeAuth(response, "Account created and logged in.");
    } catch (error: unknown) {
      if (error instanceof ApiRequestError && error.status === 409) {
        try {
          const response = await loginWithService({
            email: normalizedEmail,
            password: input.password,
          });

          return completeAuth(response, "Logged in successfully.");
        } catch (retryError: unknown) {
          return {
            ok: false,
            message: toAuthErrorMessage(retryError, "Unable to log in."),
          };
        }
      }

      return {
        ok: false,
        message: toAuthErrorMessage(error, "Unable to create account."),
      };
    }
  }

  async function register(input: RegisterInput): Promise<AuthResult> {
    const normalizedEmail = normalizeEmail(input.email);

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return { ok: false, message: "Please provide a valid email address." };
    }

    if (input.password.length < PASSWORD_MIN_LENGTH) {
      return {
        ok: false,
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      };
    }

    try {
      const response = await registerWithService({
        email: normalizedEmail,
        password: input.password,
        displayName: normalizeDisplayName(input.displayName, normalizedEmail),
      });

      return completeAuth(response, "Account created and logged in.");
    } catch (error: unknown) {
      return {
        ok: false,
        message: toAuthErrorMessage(error, "Unable to create account."),
      };
    }
  }

  async function logout(): Promise<void> {
    try {
      await logoutFromService();
    } catch {
      // Clear local auth state even if the network request fails.
    } finally {
      setSession(null);
    }
  }

  async function updateProfile(input: ProfileUpdateInput): Promise<AuthResult> {
    if (!user) {
      return { ok: false, message: "You must be logged in to update your profile." };
    }

    const nextDisplayName = input.displayName?.trim();

    if (!nextDisplayName) {
      return { ok: false, message: "Display name cannot be empty." };
    }

    try {
      const response = await updateProfileInService({
        displayName: nextDisplayName,
      });

      const syncedUser = syncUserFromService(response.user);

      setSession((currentSession) =>
        currentSession
          ? {
              ...currentSession,
              displayName: syncedUser.displayName,
            }
          : null
      );

      return {
        ok: true,
        message: response.message ?? "Profile updated.",
        user: syncedUser,
      };
    } catch (error: unknown) {
      return {
        ok: false,
        message: toAuthErrorMessage(error, "Unable to update profile."),
      };
    }
  }

  function recordGameResult(result: GameResult): void {
    updateJSON<GameResult[]>(STORAGE_KEYS.results, [], (currentResults) => {
      if (currentResults.some((existingResult) => existingResult.id === result.id)) {
        return currentResults;
      }

      return [result, ...currentResults];
    });

    if (!session) {
      return;
    }

    void saveResultToService(result)
      .then(() => fetchCurrentUser())
      .then((response) => {
        const syncedUser = syncUserFromService(response.user);
        setSessionFromUser(syncedUser, response.session.loggedInAt);
      })
      .catch(() => {
        // Local persistence remains as a fallback when the network is unavailable.
      });

    void fetchResultsFromService()
      .then((response) => {
        writeJSON(STORAGE_KEYS.results, response.results);
      })
      .catch(() => {
        // Ignore sync errors and keep local state.
      });
  }

  const value: AuthContextValue = {
    user,
    session,
    isAuthenticated: Boolean(user && session),
    isAuthLoading,
    login,
    quickLogin,
    register,
    logout,
    updateProfile,
    recordGameResult,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
