import axios from 'axios';
import authService from './authService';

// Configuración de la URL base según el entorno
const rawUrl = process.env.NODE_ENV === 'production'
  ? process.env.VITE_BACKEND_URL || ''
  : 'http://127.0.0.1:8000';
const URL = String(rawUrl).replace(/\/+$/, '');

// Crear instancias de Axios con configuraciones comunes
const createApiInstance = (baseURL) => {
  const instance = axios.create({ baseURL });

  instance.interceptors.request.use(config => {
    const token = authService.getCurrentUser();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }, error => Promise.reject(error));

  instance.interceptors.response.use(
    response => response,
    async error => {
      const originalRequest = error.config || {};

      // Enhanced logging for debugging failing requests
      try {
        const method = (originalRequest.method || 'get').toUpperCase();
        const url = `${instance.defaults.baseURL || ''}${originalRequest.url || ''}`;
        console.error('\n[API ERROR] Request failed:', { method, url });
        console.error('[API ERROR] Request headers:', originalRequest.headers || {});
        if (originalRequest.data) console.error('[API ERROR] Request body:', originalRequest.data);
        if (error.response) console.error('[API ERROR] Response status/data:', error.response.status, error.response.data);
      } catch (logErr) {
        console.error('Error while logging failure details', logErr);
      }

      if (error.response && error.response.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const newAccessToken = await authService.refreshToken();
          axios.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
          return instance(originalRequest);
        } catch (err) {
          authService.logout();
          return Promise.reject(err);
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

// Instancias de Axios para diferentes APIs
const tasksApi = createApiInstance(`${URL}/api/v1/tasks`);
const empleadosApi = createApiInstance(`${URL}/api/v1/empleados`);
const eventosApi = createApiInstance(`${URL}/api/v1/tasks`);

export const getAllTasks = () => tasksApi.get('/');
export const getTask = id => tasksApi.get(`/${id}/`);
export const createTask = task => tasksApi.post('/', task);
export const updateTask = (id, task) => tasksApi.put(`/${id}/`, task);
export const deleteTask = id => tasksApi.delete(`/${id}/`);

export const deleteTaskImage = (id, imageField) => tasksApi.delete(`/${id}/delete-image/${imageField}/`);

export const getAllEmpleados = () => empleadosApi.get('/');
export const getEmpleado = id => empleadosApi.get(`/${id}/`);
export const createEmpleado = empleado => empleadosApi.post('/', empleado);
export const updateEmpleado = (id, empleado) => empleadosApi.put(`/${id}/`, empleado);
export const deleteEmpleado = id => empleadosApi.delete(`/${id}/`);

export const getEventos = async taskId => {
  try {
    const response = await eventosApi.get(`/${taskId}/events/`);
    return response.data;
  } catch (error) {
  console.error('Error fetching eventos:', error.response ? error.response.data : error.message || error);
    throw error;
  }
};

export const createEvento = async (taskId, evento) => {
  try {
    const response = await eventosApi.post(`/${taskId}/events/`, evento);
    return response.data;
  } catch (error) {
    console.error('Error creating evento:', error);
    throw error;
  }
};

export const updateEvento = async (taskId, eventId, evento) => {
  try {
    const response = await eventosApi.put(`/${taskId}/events/${eventId}/`, evento);
    return response.data;
  } catch (error) {
    console.error('Error updating evento:', error);
    throw error;
  }
};

export const deleteEvento = async (taskId, eventId) => {
  try {
    const response = await eventosApi.delete(`/${taskId}/events/${eventId}/`);
    return response.data;
  } catch (error) {
    console.error('Error deleting evento:', error);
    throw error;
  }
};

// Funciones de prueba
export const testLogin = async () => {
  try {
    const credentials = { username: 'yourUsername', password: 'yourPassword' };
    const tokens = await authService.login(credentials.username, credentials.password);
    console.log('Login successful:', tokens);
    const userData = await authService.getUserData();
    console.log('User data:', userData);
  } catch (error) {
    console.error('Error during testLogin:', error);
  }
};

export const testCreateEvento = async () => {
  try {
    const taskId = 46;  // Replace with a valid task ID
    const evento = {
      descripcion: 'Evento de prueba',
      empleado: 1  // Replace with a valid employee ID
    };
    const createdEvento = await createEvento(taskId, evento);
    console.log('Evento created:', createdEvento);
  } catch (error) {
    console.error('Error during testCreateEvento:', error);
  }
};
