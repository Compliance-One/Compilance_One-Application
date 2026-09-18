/**
 * Member 1 — API Layer
 * mobile/src/api/client.ts
 *
 * Base Axios instance for all backend communication.
 * - Injects JWT from Zustand store on every request
 * - 401 response → clears session → would redirect to login
 * - Timeout: 15s (generous for poor connectivity)
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAppStore } from '../store/useAppStore';

// Set this to your backend URL (dev: docker or local IP for device)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 3_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor — inject JWT ─────────────────────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAppStore.getState().jwtToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response interceptor — handle 401 ────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid → clear session
      useAppStore.getState().clearSession();
      // Navigation to login will happen via the root layout
      // listening to the jwtToken becoming null in Zustand
      console.warn('[API] 401 received — session cleared');
    }
    return Promise.reject(error);
  },
);

export default apiClient;
