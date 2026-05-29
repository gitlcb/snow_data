import axios from "axios";

/** Admin 后台前端用的 axios 客户端（带 cookie session） */
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: { total: number; page: number; limit: number };
}
