import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { api } from "@/api/client"
import { AuthProvider, useAuth } from "@/contexts/AuthContext"

import { stubAdapter } from "./stubAdapter"

const USER = { id: 1, name: "Ana Souza", email: "ana@example.com" }

function Probe() {
  const { loading, user, logout } = useAuth()
  return (
    <>
      <p>{loading ? "loading" : (user?.name ?? "no user")}</p>
      <button onClick={logout}>log out</button>
    </>
  )
}

function renderAuth() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>
  )
  return queryClient
}

const originalAdapter = api.defaults.adapter

describe("AuthProvider", () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    api.defaults.adapter = originalAdapter
    localStorage.clear()
  })

  it("logout removes the token, clears the user and empties the query cache", async () => {
    localStorage.setItem("token", "t1")
    api.defaults.adapter = stubAdapter({ "/profile": { status: 200, data: USER } })
    const queryClient = renderAuth()
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument()
    queryClient.setQueryData(["accounts"], [{ id: 1 }])

    await userEvent.click(screen.getByRole("button", { name: "log out" }))

    expect(screen.getByText("no user")).toBeInTheDocument()
    expect(localStorage.getItem("token")).toBeNull()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })

  it("a 401 from a later request logs the user out", async () => {
    localStorage.setItem("token", "t1")
    api.defaults.adapter = stubAdapter({
      "/profile": { status: 200, data: USER },
      "/accounts": { status: 401 },
    })
    renderAuth()
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument()

    await act(() => api.get("/accounts").catch(() => undefined))

    expect(screen.getByText("no user")).toBeInTheDocument()
    expect(localStorage.getItem("token")).toBeNull()
  })

  it("a stored token rejected by /profile ends with no user and no token", async () => {
    localStorage.setItem("token", "expired")
    api.defaults.adapter = stubAdapter({ "/profile": { status: 401 } })
    renderAuth()

    await waitFor(() => expect(screen.getByText("no user")).toBeInTheDocument())
    expect(localStorage.getItem("token")).toBeNull()
  })

  it("with no stored token it is not loading and has no user", () => {
    renderAuth()
    expect(screen.getByText("no user")).toBeInTheDocument()
  })
})
