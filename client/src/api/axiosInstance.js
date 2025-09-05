import axios from 'axios';

const API_URL = (process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
axiosInstance.interceptors.request.use(
  config => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  error => Promise.reject(error)
);

// Handle 401 and refresh flow
axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // require inside to avoid circular import at module evaluation time
        const { refreshToken, logout } = require('./authService');
        const newToken = await refreshToken();
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(originalRequest);
      } catch (e) {
        console.error('Token refresh failed', e);
        try { require('./authService').logout(); } catch(_) {}
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
