import axios from "axios";

const token = localStorage.getItem("token");

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
  headers: token ? { Authorization: `Bearer ${token}` } : undefined
});

export function setAuthToken(nextToken: string | null) {
  if (nextToken) {
    api.defaults.headers.Authorization = `Bearer ${nextToken}`;
    localStorage.setItem("token", nextToken);
  } else {
    delete api.defaults.headers.Authorization;
    localStorage.removeItem("token");
  }
}
