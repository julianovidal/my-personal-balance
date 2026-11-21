import axios, { type AxiosError } from "axios"

import { isAuthRequest, isUnauthorizedStatus, notifyUnauthorized } from "@/api/session"

const token = localStorage.getItem("token")

export const api = axios.create({
  baseURL: import.meta.env.VITE_BALANCE_API_URL ?? "http://localhost:8000/api",
  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
})

api.interceptors.response.use(undefined, (error: AxiosError) => {
  if (isUnauthorizedStatus(error.response?.status) && !isAuthRequest(error.config?.url)) {
    notifyUnauthorized()
  }
  return Promise.reject(error)
})

export function setAuthToken(nextToken: string | null) {
  if (nextToken) {
    api.defaults.headers.Authorization = `Bearer ${nextToken}`
    localStorage.setItem("token", nextToken)
  } else {
    delete api.defaults.headers.Authorization
    localStorage.removeItem("token")
  }
}
