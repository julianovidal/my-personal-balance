import axios from "axios";

export const classifierApi = axios.create({
  baseURL: import.meta.env.VITE_CLASSIFIER_API_URL ?? "http://localhost:8001"
});

classifierApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
