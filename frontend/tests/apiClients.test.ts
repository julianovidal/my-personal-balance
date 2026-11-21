import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { stubAdapter } from "./stubAdapter"

async function loadApiBaseUrl() {
  const { api } = await import("@/api/client")
  return api.defaults.baseURL
}

async function loadClassifierBaseUrl() {
  const { classifierApi } = await import("@/api/classifierClient")
  return classifierApi.defaults.baseURL
}

describe("API client environment variables", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("VITE_BALANCE_API_URL", undefined)
    vi.stubEnv("VITE_BALANCE_CLASSIFIER_URL", undefined)
    vi.stubEnv("VITE_API_URL", undefined)
    vi.stubEnv("VITE_CLASSIFIER_API_URL", undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("uses VITE_BALANCE_API_URL for the backend client", async () => {
    vi.stubEnv("VITE_BALANCE_API_URL", "http://balance-api.test/api")
    expect(await loadApiBaseUrl()).toBe("http://balance-api.test/api")
  })

  it("ignores the old VITE_API_URL name and uses the backend default", async () => {
    vi.stubEnv("VITE_API_URL", "http://old-api.test/api")
    expect(await loadApiBaseUrl()).toBe("http://localhost:8000/api")
  })

  it("uses VITE_BALANCE_CLASSIFIER_URL for the classifier client", async () => {
    vi.stubEnv("VITE_BALANCE_CLASSIFIER_URL", "http://balance-classifier.test")
    expect(await loadClassifierBaseUrl()).toBe("http://balance-classifier.test")
  })

  it("ignores the old VITE_CLASSIFIER_API_URL name and uses the classifier default", async () => {
    vi.stubEnv("VITE_CLASSIFIER_API_URL", "http://old-classifier.test")
    expect(await loadClassifierBaseUrl()).toBe("http://localhost:8001")
  })
})

describe("unauthorized handling", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  // Import session and client after resetModules so both share one session instance.
  async function setup(client: "api" | "classifier", status: number, url: string) {
    const session = await import("@/api/session")
    const instance =
      client === "api"
        ? (await import("@/api/client")).api
        : (await import("@/api/classifierClient")).classifierApi
    const handler = vi.fn()
    session.setUnauthorizedHandler(handler)
    instance.defaults.adapter = stubAdapter({ [url]: { status } })
    await instance.get(url).catch(() => undefined)
    return handler
  }

  it("calls the handler on a 401 from /profile", async () => {
    expect(await setup("api", 401, "/profile")).toHaveBeenCalledOnce()
  })

  it("does not call the handler on a 401 from /auth/login", async () => {
    expect(await setup("api", 401, "/auth/login")).not.toHaveBeenCalled()
  })

  it("does not call the handler on a 500", async () => {
    expect(await setup("api", 500, "/profile")).not.toHaveBeenCalled()
  })

  it("calls the handler on a 401 from the classifier client", async () => {
    expect(await setup("classifier", 401, "/api/classifier/train")).toHaveBeenCalledOnce()
  })

  it("calls the handler on a 403, which the backend sends when no token is attached", async () => {
    expect(await setup("api", 403, "/profile")).toHaveBeenCalledOnce()
  })
})
