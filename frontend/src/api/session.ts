// Connects the axios clients to AuthProvider without importing React.
type UnauthorizedHandler = () => void

let unauthorizedHandler: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler
}

export function notifyUnauthorized() {
  unauthorizedHandler?.()
}

/** Login and register answer 401 for wrong credentials; that is not a session expiry. */
export function isAuthRequest(url?: string) {
  return (url ?? "").startsWith("/auth/")
}

/**
 * 401 means the token was rejected. 403 is what FastAPI's HTTPBearer (0.116)
 * sends when no token is attached. Both mean "not logged in".
 */
export function isUnauthorizedStatus(status?: number) {
  return status === 401 || status === 403
}
