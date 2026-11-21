import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios"

type Reply = { status: number; data?: unknown }

/** Axios adapter that answers by URL, without any network. */
export function stubAdapter(routes: Record<string, Reply>): AxiosAdapter {
  return async (config: InternalAxiosRequestConfig) => {
    const reply = routes[config.url ?? ""] ?? { status: 404, data: {} }
    const response = {
      status: reply.status,
      statusText: "",
      headers: {},
      config,
      data: reply.data ?? {},
    }
    if (reply.status >= 200 && reply.status < 300) return response
    throw new AxiosError("stub", undefined, config, null, response)
  }
}
