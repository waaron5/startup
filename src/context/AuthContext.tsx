import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { createId, nowIso } from "../lib/time";
import { readJSON, writeJSON } from "../lib/storage";
import type { AuthSession, UserRecord, UserStats } from "../types/domain";

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
  login: (email: string, password: string) => AuthResult;
  register: (input: RegisterInput) => AuthResult;
  logout: () => void;
  updateProfile: (input: ProfileUpdateInput) => AuthResult;
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
    totalScore: 0,
    bestScore: 0,
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

export function AuthProvider({ children }: PropsWithChildren) {
  const [users, setUsers] = useState<UserRecord[]>(() =>
    readJSON<UserRecord[]>(STORAGE_KEYS.users, [])
  );
  const [session, setSession] = useState<AuthSession | null>(() =>
    readJSON<AuthSession | null>(STORAGE_KEYS.session, null)
  );

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

  function login(email: string, password: string): AuthResult {
    const normalizedEmail = normalizeEmail(email);

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return { ok: false, message: "Please provide a valid email address." };
    }

    const existingUser = users.find((candidate) => candidate.email === normalizedEmail);

    if (!existingUser || existingUser.password !== password) {
      return { ok: false, message: "Invalid email or password." };
    }

    const nextSession: AuthSession = {
      userId: existingUser.id,
      email: existingUser.email,
      displayName: existingUser.displayName,
      loggedInAt: nowIso(),
    };

    setSession(nextSession);

    return {
      ok: true,
      message: "Logged in successfully.",
      user: existingUser,
    };
  }

  function register(input: RegisterInput): AuthResult {
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

    const duplicateUser = users.find((candidate) => candidate.email === normalizedEmail);

    if (duplicateUser) {
      return { ok: false, message: "An account with that email already exists." };
    }

    const nextUser: UserRecord = {
      id: createId("usr"),
      email: normalizedEmail,
      password: input.password,
      displayName: normalizeDisplayName(input.displayName, normalizedEmail),
      createdAt: nowIso(),
      stats: createDefaultStats(),
      friends: [],
      history: [],
    };

    setUsers((currentUsers) => [...currentUsers, nextUser]);

    setSession({
      userId: nextUser.id,
      email: nextUser.email,
      displayName: nextUser.displayName,
      loggedInAt: nowIso(),
    });

    return {
      ok: true,
      message: "Account created and logged in.",
      user: nextUser,
    };
  }

  function logout(): void {
    setSession(null);
  }

  function updateProfile(input: ProfileUpdateInput): AuthResult {
    if (!user) {
      return { ok: false, message: "You must be logged in to update your profile." };
    }

    const nextDisplayName = input.displayName?.trim();

    if (!nextDisplayName) {
      return { ok: false, message: "Display name cannot be empty." };
    }

    const updatedUser: UserRecord = {
      ...user,
      displayName: nextDisplayName,
    };

    setUsers((currentUsers) =>
      currentUsers.map((candidate) => (candidate.id === updatedUser.id ? updatedUser : candidate))
    );

    setSession((currentSession) =>
      currentSession
        ? {
            ...currentSession,
            displayName: nextDisplayName,
          }
        : null
    );

    return {
      ok: true,
      message: "Profile updated.",
      user: updatedUser,
    };
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isAuthenticated: Boolean(user && session),
      login,
      register,
      logout,
      updateProfile,
    }),
    [user, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
