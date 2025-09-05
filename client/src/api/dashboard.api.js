import axios from 'axios';
import authService from './authService';

const rawUrl = process.env.NODE_ENV === 'production'
  ? import.meta.env.VITE_BACKEND_URL
  : 'http://127.0.0.1:8000';
const URL = String(rawUrl).replace(/\/+$/, '');

const createInstance = () => {
  const instance = axios.create({ baseURL: `${URL}/api/v1` });
  instance.interceptors.request.use(config => {
    const token = authService.getCurrentUser();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  return instance;
};

const api = createInstance();

export const getDashboardOverview = () => api.get('/dashboard/overview/');
export const getTaskTimeline = (taskId) => api.get(`/tasks/${taskId}/timeline/`);
