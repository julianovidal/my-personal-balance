import { AxiosError, type InternalAxiosRequestConfig } from "axios"
import { describe, expect, it } from "vitest"

import {
  GENERIC_ERROR_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  WRONG_CREDENTIALS_MESSAGE,
  getAuthErrorMessage,
} from "@/lib/auth-errors"

const config = { headers: {} } as InternalAxiosRequestConfig

function httpError(status: number, data: unknown = {}) {
  return new AxiosError("x", undefined, config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data,
  })
}

describe("getAuthErrorMessage", () => {
  it("reports an unreachable server when there is no response", () => {
    expect(getAuthErrorMessage(new AxiosError("Network Error", "ERR_NETWORK", config))).toBe(
      NETWORK_ERROR_MESSAGE
    )
  })

  it("reports wrong credentials on a 401", () => {
    expect(getAuthErrorMessage(httpError(401))).toBe(WRONG_CREDENTIALS_MESSAGE)
  })

  it("shows the backend detail on other statuses", () => {
    expect(getAuthErrorMessage(httpError(400, { detail: "Email already registered" }))).toBe(
      "Email already registered"
    )
  })

  it("falls back when detail is not a string", () => {
    expect(getAuthErrorMessage(httpError(422, { detail: [{ msg: "bad" }] }))).toBe(
      GENERIC_ERROR_MESSAGE
    )
  })

  it("falls back for non-axios errors", () => {
    expect(getAuthErrorMessage(new Error("boom"))).toBe(GENERIC_ERROR_MESSAGE)
  })
})
