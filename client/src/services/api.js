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
      } else if (!config.data || typeof config.data === 'object') {
        // On a token-refresh retry, axios has already serialized config.data
        // into a JSON string by the time this interceptor runs again -
        // spreading a string here would shred it into character-indexed
        // properties instead of merging fields, so only merge into objects.
        config.data = { ...(config.data || {}), storeId: config.data?.storeId || activeStoreId };
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ============ RESPONSE INTERCEPTOR ============
// Access tokens are short-lived (3 min) - on a 401 we try one silent
// refresh via the httpOnly refresh cookie before giving up and sending
// the user back to /login. Concurrent 401s share a single refresh call.
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original?._retry && !original?.url?.includes('/auth/')) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise || api.post('/auth/refresh');
        const { data } = await refreshPromise;
        refreshPromise = null;
        localStorage.setItem('accessToken', data.data.accessToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch (refreshError) {
        refreshPromise = null;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('activeStoreId');
        window.location.href = '/login';
        return Promise.reject(new Error('Session expired. Please log in again.'));
      }
    }
    if (error.response?.status === 401 && !original?.url?.includes('/auth/login') && !original?.url?.includes('/auth/change-password')) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('activeStoreId');
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
