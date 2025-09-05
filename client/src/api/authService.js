import axios from 'axios';
import axiosInstance from './axiosInstance';

// Base API URL without trailing slash
const API_URL = (process.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

// Internal state for refresh scheduling and concurrent refresh handling
let _refreshPromise = null;
let _refreshTimeoutId = null;

function _decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch (e) {
    return null;
  }
}

function scheduleTokenRefresh() {
  // Clear previous schedule
  if (_refreshTimeoutId) {
    clearTimeout(_refreshTimeoutId);
    _refreshTimeoutId = null;
  }
  const access = localStorage.getItem('accessToken');
  if (!access) return;
  const payload = _decodeJwt(access);
  if (!payload || !payload.exp) return;
  const expiresAt = payload.exp * 1000; // ms
  const now = Date.now();
  // schedule refresh 60s before expiry, or at 50% of remaining time if very short
  const msUntil = Math.max(1000, expiresAt - now - 60000);
  // If token already expired or near-expired, refresh immediately
  if (expiresAt - now <= 5000) {
    _refreshTimeoutId = setTimeout(() => {
      refreshToken().catch(() => {});
    }, 0);
    return;
  }
  _refreshTimeoutId = setTimeout(() => {
    refreshToken().catch(() => {});
  }, msUntil);
}

function cancelScheduledRefresh() {
  if (_refreshTimeoutId) {
    clearTimeout(_refreshTimeoutId);
    _refreshTimeoutId = null;
  }
}

/**
 * Log in user and store tokens
 */
export const login = async (username, password) => {
  const { data } = await axios.post(`${API_URL}/api/token/`, { username, password });
  const { access, refresh } = data;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
  // Schedule automatic refresh based on token exp
  try { scheduleTokenRefresh(); } catch (e) { console.debug('scheduleTokenRefresh failed at login', e); }
  return data;
};

/**
 * Log out user and clear tokens
 */
export const logout = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  cancelScheduledRefresh();
  window.dispatchEvent(new CustomEvent('auth:logout'));
};

/**
 * Refresh access token using refresh token
 */
export const refreshToken = async () => {
  const refresh = localStorage.getItem('refreshToken');
  if (!refresh) {
    logout();
    throw new Error('No refresh token available');
  }
  // coalesce concurrent refresh attempts
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const { data } = await axios.post(
        `${API_URL}/api/token/refresh/`,
        { refresh },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const { access } = data;
      localStorage.setItem('accessToken', access);
      // reschedule next refresh
  try { scheduleTokenRefresh(); } catch (e) { console.debug('scheduleTokenRefresh failed after refresh', e); }
      return access;
    } catch (err) {
      // give one last chance and then logout gracefully
      console.error('Refresh token request failed', err);
      logout();
      throw err;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
};

/**
 * Get current access token
 */
export const getCurrentUser = () => localStorage.getItem('accessToken');

/**
 * Fetch user data
 */
export const getUserData = async () => {
  const { data } = await axiosInstance.get('/api/v1/user/');
  return data;
};

export default {
  login,
  logout,
  refreshToken,
  getCurrentUser,
  getUserData,
  scheduleTokenRefresh,
  cancelScheduledRefresh,
};