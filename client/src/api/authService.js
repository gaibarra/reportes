import axios from 'axios';

// const API_URL = process.env.VITE_BACKEND_URL || 'https://rerportes.click';
const API_URL = process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'
const BASE_URL = String(API_URL).replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Agrega un interceptor para añadir el token a las cabeceras
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

const login = async (username, password) => {
  try {
  const response = await api.post('/api/token/', { username, password });

    if (response.status !== 200) {
      throw new Error(`La solicitud falló con el código de estado ${response.status}`);
    }

    const { access, refresh } = response.data;

    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
    
    return { access, refresh };
  } catch (error) {
    if (error.response) {
      console.error('Error durante el inicio de sesión:', error.response.data);
      throw new Error(error.response.data.detail || 'Inicio de sesión fallido');
    } else if (error.request) {
      console.error('No se recibió respuesta:', error.request);
      throw new Error('No hay respuesta del servidor');
    } else {
      console.error('Error al configurar la solicitud:', error.message);
      throw new Error('Error al configurar la solicitud');
    }
  }
};

const getRefreshToken = () => localStorage.getItem('refreshToken');

const refreshToken = async () => {
  const refresh = getRefreshToken();
  if (!refresh) {
    const err = new Error('No refresh token available');
    console.warn('refreshToken: no refresh token found in storage');
    logout();
    throw err;
  }

  try {
    // Use axios directly to avoid hitting interceptors on `api` which could cause recursion
  const url = `${BASE_URL}/api/token/refresh/`;
  console.debug('Attempting token refresh; refresh token present:', !!refresh, 'length:', refresh ? refresh.length : 0);
  const response = await axios.post(url, { refresh }, { headers: { 'Content-Type': 'application/json' } });
  console.debug('Refresh response status:', response.status);

    if (response.status === 200 && response.data && response.data.access) {
      const { access } = response.data;
      localStorage.setItem('accessToken', access);
      return access;
    }

    // If server responds but no access token provided, treat as failure
    throw new Error('Failed to refresh token: no access token in response');
  } catch (error) {
    console.error('Error refreshing token:', error.response ? error.response.data : error.message || error);
    logout();
    throw error;
  }
};

const getUserData = async () => {
  try {
    const token = getCurrentUser();
    const response = await api.get('/api/v1/user/', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (response.status === 200) {
      return response.data;
    }
    throw new Error('Failed to fetch user data');
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
};

const getCurrentUser = () => {
  return localStorage.getItem('accessToken');
};

const logout = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  try {
    // notify the UI that a logout occurred (e.g., token refresh failed)
    window.dispatchEvent(new CustomEvent('auth:logout'));
  } catch (e) {
    console.warn('Could not dispatch auth:logout event', e);
  }
};

export default {
  login,
  refreshToken,
  getUserData,
  getCurrentUser,
  logout,
};

// Agrega interceptores para manejar la renovación automática del token
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config || {};

    // Don't try to refresh if the failing request was the refresh endpoint itself
    const url = originalRequest.url || '';
    if (url.includes('/api/token/refresh/') || url.includes('/api/token/')) {
      return Promise.reject(error);
    }

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const newToken = await refreshToken();
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (e) {
        console.error('No se pudo renovar el token', e);
        logout();
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);