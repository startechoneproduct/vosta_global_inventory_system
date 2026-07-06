import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ============ REQUEST INTERCEPTOR ============
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Attach the currently selected store (relevant only for owners who
    // can switch stores - the backend ignores/rejects it for other roles).
    const activeStoreId = localStorage.getItem('activeStoreId');
    if (activeStoreId) {
      if (config.method === 'get' || config.method === 'delete') {
        config.params = { ...config.params, storeId: config.params?.storeId || activeStoreId };
      } else {
        config.data = { ...(config.data || {}), storeId: config.data?.storeId || activeStoreId };
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ============ RESPONSE INTERCEPTOR ============
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
      return Promise.reject(new Error('Session expired. Please log in again.'));
    }
    if (error.response?.status === 403) {
      return Promise.reject(new Error(error.response?.data?.message || 'You do not have permission to perform this action.'));
    }
    if (error.response?.status === 429) {
      return Promise.reject(new Error('Too many requests. Please try again later.'));
    }
    if (error.response?.status === 500) {
      return Promise.reject(new Error(error.response?.data?.message || 'An error occurred on the server. Please try again.'));
    }
    if (!error.response) {
      return Promise.reject(new Error('Network error. Please check your connection and try again.'));
    }
    return Promise.reject(new Error(error.response?.data?.message || 'An unexpected error occurred.'));
  }
);

export default api;
