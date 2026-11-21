import axios, { type AxiosError } from "axios"

import { isAuthRequest, isUnauthorizedStatus, notifyUnauthorized } from "@/api/session"

export const classifierApi = axios.create({
  baseURL: import.meta.env.VITE_BALANCE_CLASSIFIER_URL ?? "http://localhost:8001",
})

classifierApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

classifierApi.interceptors.response.use(undefined, (error: AxiosError) => {
  if (isUnauthorizedStatus(error.response?.status) && !isAuthRequest(error.config?.url)) {
    notifyUnauthorized()
  }
  return Promise.reject(error)
})
