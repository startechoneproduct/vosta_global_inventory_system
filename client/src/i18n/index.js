import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';


const enModules = import.meta.glob('./locales/en/*.json', { eager: true });
const deModules = import.meta.glob('./locales/de/*.json', { eager: true });

function buildNamespaces(modules) {
  const namespaces = {};
  for (const path in modules) {
    const [, name] = path.match(/\/([^/]+)\.json$/);
    namespaces[name] = modules[path].default;
  }
  return namespaces;
}

i18n.use(initReactI18next).init({
  resources: {
    en: buildNamespaces(enModules),
    de: buildNamespaces(deModules),
  },
  lng: localStorage.getItem('language') || 'en',
  fallbackLng: 'en',
  defaultNS: 'layout',
  interpolation: { escapeValue: false },
});

export default i18n;
