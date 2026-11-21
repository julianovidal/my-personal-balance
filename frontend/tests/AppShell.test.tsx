import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AppRoutes } from "@/App"

import { renderWithProviders } from "./render"

const authState = vi.hoisted(() => ({
  user: null as null | { id: number; name: string; email: string },
  logout: vi.fn(),
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: authState.user,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: authState.logout,
  }),
}))

describe("App shell", () => {
  beforeEach(() => {
    authState.user = { id: 1, name: "Ana Souza", email: "ana@example.com" }
    authState.logout.mockReset()
    document.cookie = "sidebar_state=; max-age=0; path=/"
  })

  it("shows the Dashboard title and the four navigation links", () => {
    renderWithProviders(<AppRoutes />)
    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument()
    const nav = screen.getByRole("navigation", { name: "Main" })
    const links = within(nav).getAllByRole("link")
    expect(links.map((link) => link.textContent)).toEqual([
      "Dashboard",
      "Accounts",
      "Transactions",
      "Classifier",
    ])
  })

  it("changes the header title when a sidebar link is clicked", async () => {
    renderWithProviders(<AppRoutes />)
    const nav = screen.getByRole("navigation", { name: "Main" })
    await userEvent.click(within(nav).getByRole("link", { name: "Accounts" }))
    expect(screen.getByRole("heading", { level: 1, name: "Accounts" })).toBeInTheDocument()
  })

  it("user menu shows the user and leads to Profile", async () => {
    renderWithProviders(<AppRoutes />)
    await userEvent.click(screen.getByRole("button", { name: /Ana Souza/ }))
    const menu = await screen.findByRole("menu")
    expect(within(menu).getByText("ana@example.com")).toBeInTheDocument()
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Profile" }))
    expect(screen.getByRole("heading", { level: 1, name: "Profile" })).toBeInTheDocument()
  })

  it("user menu Log out calls logout", async () => {
    renderWithProviders(<AppRoutes />)
    await userEvent.click(screen.getByRole("button", { name: /Ana Souza/ }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Log out" }))
    expect(authState.logout).toHaveBeenCalledOnce()
  })

  it("redirects to login when there is no user", () => {
    authState.user = null
    renderWithProviders(<AppRoutes />, { route: "/accounts" })
    expect(screen.getByRole("heading", { level: 1, name: "Log in" })).toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument()
  })

  it("starts collapsed when the sidebar cookie says so", () => {
    document.cookie = "sidebar_state=false; path=/"
    const { container } = renderWithProviders(<AppRoutes />)
    expect(container.querySelector('[data-slot="sidebar"][data-state="collapsed"]')).not.toBeNull()
  })
})
