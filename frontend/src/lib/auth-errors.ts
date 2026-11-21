import { isAxiosError } from "axios"

export const NETWORK_ERROR_MESSAGE = "Can't reach the server. Check that the backend is running."
export const WRONG_CREDENTIALS_MESSAGE = "Wrong email or password."
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Try again."

export function getAuthErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) return GENERIC_ERROR_MESSAGE
  // No response means the request never got an answer: server down or blocked by CORS.
  if (!error.response) return NETWORK_ERROR_MESSAGE
  if (error.response.status === 401) return WRONG_CREDENTIALS_MESSAGE
  const detail = (error.response.data as { detail?: unknown } | undefined)?.detail
  return typeof detail === "string" ? detail : GENERIC_ERROR_MESSAGE
}

/** For non-auth requests: a 401 here is handled by the session, so only detail matters. */
export function getApiErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) return GENERIC_ERROR_MESSAGE
  if (!error.response) return NETWORK_ERROR_MESSAGE
  const detail = (error.response.data as { detail?: unknown } | undefined)?.detail
  return typeof detail === "string" ? detail : GENERIC_ERROR_MESSAGE
}
