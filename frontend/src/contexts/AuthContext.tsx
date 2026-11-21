import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { api, setAuthToken } from "@/api/client"
import { setUnauthorizedHandler } from "@/api/session"
import type { User } from "@/types"

type AuthContextType = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  // Only wait for /profile when there is a stored token to check.
  const [loading, setLoading] = useState(() => localStorage.getItem("token") !== null)

  const logout = useCallback(() => {
    setAuthToken(null)
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  // Declared before the profile load so the handler is set before that request starts.
  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) return

    setAuthToken(token)
    api
      .get<User>("/profile")
      .then((res) => setUser(res.data))
      .catch(() => setAuthToken(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const { data } = await api.post<{ access_token: string }>("/auth/login", { email, password })
    setAuthToken(data.access_token)
    const profile = await api.get<User>("/profile")
    setUser(profile.data)
  }

  const register = async (name: string, email: string, password: string) => {
    await api.post("/auth/register", { name, email, password })
    await login(email, password)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
