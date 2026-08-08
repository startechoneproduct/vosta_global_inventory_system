import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { useStore } from '../../context/StoreContext';
import { useLanguage } from '../../context/LanguageContext';
import Icon from '../ui/Icons'; 

function menuItemsForRole(role, storeType, t) {
  const isGm = role === 'owner' || role === 'general_manager';
  const isFarm = storeType === 'farm';

  if (isGm) {
    const items = [
      { path: '/dashboard', label: t('nav.dashboard'), icon: 'dashboard' },
      { path: '/products', label: t('nav.products'), icon: 'product' },
      { path: '/sales', label: t('nav.sales'), icon: 'sales' },
      { path: '/inventory', label: t('nav.inventory'), icon: 'inventory' },
      { path: '/inventory-movement', label: t('nav.inventoryMovement'), icon: 'movement' },
      { path: '/expenses', label: t('nav.expenses'), icon: 'expenses' },
      { path: '/returns', label: t('nav.returns'), icon: 'returns' },
      { path: '/customers', label: t('nav.customers'), icon: 'customers' },
      { path: '/activity-log', label: t('nav.activityLog'), icon: 'activityLog' },
      { path: '/equipment', label: t('nav.equipment'), icon: 'equipment' },
      { path: '/staff', label: t('nav.staff'), icon: 'staff' },
    ];

    if (!isFarm) {
      items.splice(9, 0, { path: '/driver-tracking', label: t('nav.driverTracking'), icon: 'truck' });
      items.splice(9, 0, { path: '/production', label: t('nav.production'), icon: 'inventory' });
    } else {
      items.splice(9, 0, { path: '/vaccination', label: t('nav.vaccination'), icon: 'vaccination' });
    }

    return items
  }

  if (role === 'manager' || role === 'supervisor') {
    const items = [
      { path: '/dashboard', label: t('nav.dashboard'), icon: 'dashboard' },
      { path: '/products', label: t('nav.products'), icon: 'product' },
      { path: '/sales', label: t('nav.sales'), icon: 'sales' },
      { path: '/returns', label: t('nav.returns'), icon: 'returns' },
      { path: '/expenses', label: t('nav.expenses'), icon: 'expenses' },
      { path: '/inventory', label: t('nav.inventory'), icon: 'inventory' },
      { path: '/activity-log', label: t('nav.myActivityLog'), icon: 'activityLog' },
    ];
    if (!isFarm) {
      items.splice(5, 0, { path: '/production', label: t('nav.production'), icon: 'inventory' });
    } else {
      items.splice(5, 0, { path: '/vaccination', label: t('nav.vaccination'), icon: 'vaccination' });
      items.push({ path: '/customers', label: t('nav.customers'), icon: 'customers' });
    }
    return items;
  }

  if (role === 'accountant') {
    const items = [
      { path: '/dashboard', label: t('nav.dashboard'), icon: 'dashboard' },
      { path: '/products', label: t('nav.products'), icon: 'product' },
      { path: '/sales', label: t('nav.sales'), icon: 'sales' },
      { path: '/inventory', label: t('nav.inventory'), icon: 'inventory' },
      { path: '/expenses', label: t('nav.expenses'), icon: 'expenses' },
    ];
    if (!isFarm) {
      items.splice(4, 0, { path: '/production', label: t('nav.production'), icon: 'inventory' });
    } else {
      items.splice(4, 0, { path: '/vaccination', label: t('nav.vaccination'), icon: 'vaccination' });
      items.push({ path: '/customers', label: t('nav.customers'), icon: 'customers' });
    }
    return items;
  }

  if (role === 'driver') {
    return [
      { path: '/dashboard', label: t('nav.dashboard'), icon: 'dashboard' },
      { path: '/customers', label: t('nav.myCustomers'), icon: 'customers' },
      { path: '/driver-tracking', label: t('nav.myLocation'), icon: 'mapPin' },
      { path: '/returns', label: t('nav.returns'), icon: 'returns' },
    ];
  }

  return [{ path: '/dashboard', label: t('nav.dashboard'), icon: 'dashboard' }];
}

function StoreSwitcher({ t }) {
  const { stores, activeStoreId, canSwitch, switchStore } = useStore();
  if (!canSwitch || stores.length <= 1) return null;

  return (
    <select
      value={activeStoreId || ''}
      onChange={(e) => switchStore(e.target.value)}
      className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 font-medium"
      title={t('switchStore')}
    >
      {stores.map((s) => (
        <option key={s._id} value={s._id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

function LanguageSwitcher({ t }) {
  const { language, setLanguage } = useLanguage();
  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value)}
      className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 font-medium"
      title={t('language')}
    >
      <option value="en">English</option>
      <option value="de">Deutsch</option>
    </select>
  );
}

export default function MainLayout({ children, user }) {
  const { t } = useTranslation('layout');
  const location = useLocation();
  const navigate = useNavigate();
  const { activeStore } = useStore();
  // Desktop (lg+): collapses the sidebar to icon-only width.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Mobile/tablet (<lg): sidebar is off-canvas; this toggles it as an overlay.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('activeStoreId');
      navigate('/login');
    }
  };

  const isActive = (path) => location.pathname === path;
  const menuItems = menuItemsForRole(user?.role, activeStore?.type, t);
  const currentPageTitle = menuItems.find((item) => item.path === location.pathname)?.label || t('nav.dashboard');

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          {sidebarOpen && (
            <div>
              <h1 className="text-lg font-bold text-gray-900">{activeStore?.name || t('brand')}</h1>
              <p className="text-xs text-gray-500">
                {activeStore?.type === 'farm'
                  ? t('storeTypeFarm')
                  : activeStore?.type === 'fountain'
                  ? t('storeTypeFountain')
                  : t('brand')}
              </p>
            </div>
          )}
        </div>
        <button onClick={() => setMobileSidebarOpen(false)} className="lg:hidden text-gray-500 hover:text-gray-700">
          <Icon name="x" className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setMobileSidebarOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              isActive(item.path) ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
            }`}
            title={item.label}
          >
            <Icon name={item.icon} className="h-5 w-5 flex-shrink-0" />
            {(sidebarOpen || mobileSidebarOpen) && <span className="text-sm lg:inline">{item.label}</span>}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-200 hidden lg:block">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-full flex items-center justify-center py-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-all"
        >
          <Icon name={sidebarOpen ? 'chevronLeft' : 'chevronRight'} className="h-4 w-4" />
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile/tablet off-canvas sidebar + backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar (push layout, collapsible) */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} hidden lg:flex bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex-col flex-shrink-0`}
      >
        {sidebarContent}
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button onClick={() => setMobileSidebarOpen(true)} className="lg:hidden text-gray-600 hover:text-gray-900 flex-shrink-0">
              <Icon name="menu" className="w-6 h-6" />
            </button>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{currentPageTitle}</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <div className="hidden md:block">
              <StoreSwitcher t={t} />
            </div>
            <div className="hidden md:block">
              <LanguageSwitcher t={t} />
            </div>

            <button className="relative text-gray-600 hover:text-gray-900 transition-colors" title={t('notifications')}>
              <Icon name="bell" className="w-6 h-6" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-100 transition-all"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {user?.fullName?.[0] || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900">{user?.fullName || 'User'}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ') || 'user'}</p>
                </div>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 sm:w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100 md:hidden space-y-2">
                    <StoreSwitcher t={t} />
                    <LanguageSwitcher t={t} />
                  </div>
                  <button
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Icon name="settings" className="w-4 h-4" /> {t('profileSettings')}
                  </button>
                  <button
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Icon name="lock" className="w-4 h-4" /> {t('changePassword')}
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 font-medium"
                  >
                    <Icon name="logOut" className="w-4 h-4" /> {t('signOut')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
