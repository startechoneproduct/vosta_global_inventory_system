import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const StoreContext = createContext(null);

export function StoreProvider({ user, children }) {
  const [stores, setStores] = useState([]);
  const [activeStoreId, setActiveStoreId] = useState(user?.storeId || null);
  const [canSwitch, setCanSwitch] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStores = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/stores');
      setStores(response.data.data || []);
      setCanSwitch(!!response.data.canSwitch);

      // Restore previously selected store (owner only) or default to user's store
      const saved = localStorage.getItem('activeStoreId');
      if (response.data.canSwitch && saved && response.data.data.some((s) => s._id === saved)) {
        setActiveStoreId(saved);
      } else if (response.data.data.length > 0) {
        setActiveStoreId(response.data.data[0]._id);
      }
    } catch (err) {
      console.error('Failed to load stores:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  const switchStore = (storeId) => {
    setActiveStoreId(storeId);
    localStorage.setItem('activeStoreId', storeId);
    // Simplest reliable way to make every page re-fetch with the new store
    window.location.reload();
  };

  const activeStore = stores.find((s) => s._id === activeStoreId) || null;

  return (
    <StoreContext.Provider value={{ stores, activeStoreId, activeStore, canSwitch, switchStore, loading }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}
