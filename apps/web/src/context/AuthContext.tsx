import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthResponse, AuthUserDTO, LoginInput, RegisterInput } from "@intern-platform/shared";
import { apiRequest, setAccessToken, setOnTokenRefreshed, ApiError } from "../lib/apiClient";

interface AuthContextValue {
  user: AuthUserDTO | null;
  /** True while the initial silent-refresh check (on page load) is in flight. */
  isInitializing: boolean;
  register: (input: RegisterInput) => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserDTO | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    setOnTokenRefreshed(() => {
      // Access token itself is kept out of React state (lives only in the
      // apiClient module) so it never ends up in a DOM inspector snapshot
      // or gets accidentally serialized; only the derived `user` is state.
    });

    // On first load there is no access token in memory yet, but a refresh
    // cookie may still be valid from a previous session — try it once.
    apiRequest<AuthResponse>("/auth/refresh", { method: "POST", allowRefresh: false })
      .then((res) => {
        setAccessToken(res.accessToken);
        setUser(res.user);
      })
      .catch(() => {
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setIsInitializing(false));

    return () => setOnTokenRefreshed(null);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await apiRequest<AuthResponse>("/auth/register", { method: "POST", body: input });
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const res = await apiRequest<AuthResponse>("/auth/login", { method: "POST", body: input });
    setAccessToken(res.accessToken);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch (err) {
      // Best-effort: even if the network call fails, clear local session state.
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, isInitializing, register, login, logout }),
    [user, isInitializing, register, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
