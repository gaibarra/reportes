import axios from 'axios';

const API_URL = process.env.VITE_BACKEND_URL || 'https://rerportes.click';

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

const refreshToken = async () => {
  const refresh = localStorage.getItem('refreshToken');
  try {
    const response = await api.post('/api/token/refresh/', { refresh });

    if (response.status === 200) {
      const { access } = response.data;
      localStorage.setItem('accessToken', access);
      return access;
    }
    throw new Error('Failed to refresh token');
  } catch (error) {
    console.error('Error refreshing token:', error);
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
    const originalRequest = error.config;
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const newToken = await refreshToken();
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
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
