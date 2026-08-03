import { createContext, useContext, useEffect, useState } from 'react';
import i18n from '../i18n';
import api from '../services/api';
import { setLiveExchangeRate } from '../utils/formatCurrency';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(localStorage.getItem('language') || 'en');
  const [exchangeRateUpdatedAt, setExchangeRateUpdatedAt] = useState(null);

  const fetchExchangeRate = async () => {
    try {
      const response = await api.get('/exchange-rate');
      const { rate, updatedAt } = response.data.data;
      setLiveExchangeRate(rate);
      
      setExchangeRateUpdatedAt(updatedAt);
    } catch (error) {
      console.error('Failed to fetch live exchange rate, using fallback:', error.message);
    }
  };

  useEffect(() => {
    fetchExchangeRate();
  }, []);

  const setLanguage = (lang) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
    i18n.changeLanguage(lang);
    if (lang === 'de') fetchExchangeRate();
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, exchangeRateUpdatedAt }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
