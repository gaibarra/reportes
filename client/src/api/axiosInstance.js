import axios from 'axios';
import authService from './authService'; // Asegúrate de que esto esté correctamente importado

// const API_URL = process.env.VITE_BACKEND_URL || 'https://rerportes.click';
const API_URL = process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

// Ensure no trailing slash to avoid double-slash in requests
const BASE_URL = String(API_URL).replace(/\/+$/, '');

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para añadir el token a las cabeceras
axiosInstance.interceptors.request.use(
  config => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Interceptor para manejar la renovación de tokens
axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const newToken = await authService.refreshToken();
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return axiosInstance(originalRequest);
      } catch (e) {
        console.error('No se pudo renovar el token', e);
        authService.logout();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
