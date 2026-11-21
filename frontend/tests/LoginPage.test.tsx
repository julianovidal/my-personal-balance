import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { LoginPage } from "@/pages/LoginPage"

import { renderWithProviders } from "./render"

const authState = vi.hoisted(() => ({
  user: null as null | { id: number; name: string; email: string },
  login: vi.fn(),
  register: vi.fn(),
}))

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: authState.user,
    loading: false,
    login: authState.login,
    register: authState.register,
    logout: vi.fn(),
  }),
}))

const config = { headers: {} } as InternalAxiosRequestConfig
const httpError = (status: number, data: unknown = {}) =>
  new AxiosError("x", undefined, config, null, { status, statusText: "", headers: {}, config, data })

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<p>home</p>} />
    </Routes>,
    { route: "/login" }
  )
}

async function fillLogin() {
  await userEvent.type(screen.getByLabelText("Email"), "ana@example.com")
  await userEvent.type(screen.getByLabelText("Password"), "secret")
}

describe("LoginPage", () => {
  beforeEach(() => {
    authState.user = null
    authState.login.mockReset().mockResolvedValue(undefined)
    authState.register.mockReset().mockResolvedValue(undefined)
  })

  it("shows email, password and Log in, without a name field", () => {
    renderLogin()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument()
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument()
  })

  it("logs in and goes to the dashboard", async () => {
    renderLogin()
    await fillLogin()
    await userEvent.click(screen.getByRole("button", { name: "Log in" }))
    expect(authState.login).toHaveBeenCalledWith("ana@example.com", "secret")
    expect(await screen.findByText("home")).toBeInTheDocument()
  })

  it("shows wrong credentials on a 401 and stays on the page", async () => {
    authState.login.mockRejectedValue(httpError(401))
    renderLogin()
    await fillLogin()
    await userEvent.click(screen.getByRole("button", { name: "Log in" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong email or password.")
    expect(screen.queryByText("home")).not.toBeInTheDocument()
  })

  it("shows an unreachable-server message on a network error", async () => {
    authState.login.mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK", config))
    renderLogin()
    await fillLogin()
    await userEvent.click(screen.getByRole("button", { name: "Log in" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Can't reach the server. Check that the backend is running."
    )
  })

  it("toggles to register and back", async () => {
    renderLogin()
    await userEvent.click(screen.getByRole("button", { name: "Need an account? Register" }))
    expect(screen.getByLabelText("Name")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Already have an account? Log in" }))
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument()
  })

  it("registers and goes to the dashboard", async () => {
    renderLogin()
    await userEvent.click(screen.getByRole("button", { name: "Need an account? Register" }))
    await userEvent.type(screen.getByLabelText("Name"), "Ana Souza")
    await fillLogin()
    await userEvent.click(screen.getByRole("button", { name: "Create account" }))
    expect(authState.register).toHaveBeenCalledWith("Ana Souza", "ana@example.com", "secret")
    expect(await screen.findByText("home")).toBeInTheDocument()
  })

  it("shows the backend message for a duplicate email", async () => {
    authState.register.mockRejectedValue(httpError(400, { detail: "Email already registered" }))
    renderLogin()
    await userEvent.click(screen.getByRole("button", { name: "Need an account? Register" }))
    await userEvent.type(screen.getByLabelText("Name"), "Ana Souza")
    await fillLogin()
    await userEvent.click(screen.getByRole("button", { name: "Create account" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Email already registered")
  })

  it("disables the submit button while the request runs", async () => {
    let resolve!: () => void
    authState.login.mockReturnValue(new Promise<void>((r) => (resolve = r)))
    renderLogin()
    await fillLogin()
    await userEvent.click(screen.getByRole("button", { name: "Log in" }))
    expect(screen.getByRole("button", { name: "Log in" })).toBeDisabled()
    resolve()
    expect(await screen.findByText("home")).toBeInTheDocument()
  })

  it("redirects a logged-in user to the dashboard", () => {
    authState.user = { id: 1, name: "Ana Souza", email: "ana@example.com" }
    renderLogin()
    expect(screen.getByText("home")).toBeInTheDocument()
  })
})
