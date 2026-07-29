import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiFetch } from "../lib/queryClient";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar?: string | null;
  bio?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const data = await apiFetch<User>("/api/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiFetch<User>("/api/auth/login", "POST", { email, password });
    setUser(data);
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await apiFetch<User>("/api/auth/register", "POST", { name, email, password });
    setUser(data);
  };

  const logout = async () => {
    await apiFetch("/api/auth/logout", "POST");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
