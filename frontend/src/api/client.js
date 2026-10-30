/* CONE — authenticated Rust backend client. */
import axios from 'axios';
import { readSession } from './session.js';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000', timeout: 10000 });
api.interceptors.request.use(config => {
  const token = readSession()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401 && error.config?.headers?.Authorization === `Bearer ${readSession()?.token}` && !/auth\/(login|register)/.test(error.config?.url || '')) {
    window.dispatchEvent(new Event('cone-session-expired'));
  }
  return Promise.reject(error);
});
export const apiGet = async (url, params = {}, options = {}) => (await api.get(url, { ...options, params })).data;
export const apiPost = async (url, data = {}) => (await api.post(url, data)).data;
export const apiPut = async (url, data = {}, options = {}) => (await api.put(url, data, options)).data;
export const apiPatch = async (url, data = {}) => (await api.patch(url, data)).data;
export const apiDelete = async (url, params = {}) => (await api.delete(url, { params })).data;
export const apiError = error => error.response?.data?.detail || error.message || 'Backend unavailable';
export default api;
