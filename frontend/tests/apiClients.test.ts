import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadApiBaseUrl() {
  const { api } = await import("@/api/client");
  return api.defaults.baseURL;
}

async function loadClassifierBaseUrl() {
  const { classifierApi } = await import("@/api/classifierClient");
  return classifierApi.defaults.baseURL;
}

describe("API client environment variables", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_BALANCE_API_URL", undefined);
    vi.stubEnv("VITE_BALANCE_CLASSIFIER_URL", undefined);
    vi.stubEnv("VITE_API_URL", undefined);
    vi.stubEnv("VITE_CLASSIFIER_API_URL", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses VITE_BALANCE_API_URL for the backend client", async () => {
    vi.stubEnv("VITE_BALANCE_API_URL", "http://balance-api.test/api");

    expect(await loadApiBaseUrl()).toBe("http://balance-api.test/api");
  });

  it("ignores the old VITE_API_URL name and uses the backend default", async () => {
    vi.stubEnv("VITE_API_URL", "http://old-api.test/api");

    expect(await loadApiBaseUrl()).toBe("http://localhost:8000/api");
  });

  it("uses VITE_BALANCE_CLASSIFIER_URL for the classifier client", async () => {
    vi.stubEnv("VITE_BALANCE_CLASSIFIER_URL", "http://balance-classifier.test");

    expect(await loadClassifierBaseUrl()).toBe("http://balance-classifier.test");
  });

  it("ignores the old VITE_CLASSIFIER_API_URL name and uses the classifier default", async () => {
    vi.stubEnv("VITE_CLASSIFIER_API_URL", "http://old-classifier.test");

    expect(await loadClassifierBaseUrl()).toBe("http://localhost:8001");
  });
});
