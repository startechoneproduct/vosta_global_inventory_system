import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useStore } from '../../context/StoreContext';
import Icon from '../ui/Icons'; // adjust path to wherever your Icon.jsx lives

function menuItemsForRole(role, storeType) {
  const isGm = role === 'owner' || role === 'general_manager';
  const isFarm = storeType === 'farm';

  if (isGm) {
    const items = [
      { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { path: '/products', label: 'Products', icon: 'product' },
      { path: '/sales', label: 'Sales', icon: 'sales' },
      { path: '/inventory', label: 'Inventory', icon: 'inventory' },
      { path: '/expenses', label: 'Expenses', icon: 'expenses' },
      { path: '/returns', label: 'Returns', icon: 'returns' },
      { path: '/customers', label: 'Customers', icon: 'customers' },
      { path: '/activity-log', label: 'Activity Log', icon: 'activityLog' },
      { path: '/equipment', label: 'Equipment', icon: 'equipment' },
      { path: '/staff', label: 'Staff', icon: 'staff' },
      { path: '/attendance', label: 'Attendance', icon: 'attendance' },
    ];

    if (!isFarm) {
      items.splice(9, 0, { path: '/driver-tracking', label: 'Driver Tracking', icon: 'truck' });
    }

    return items
  }

  if (role === 'manager' || role === 'supervisor') {
    return [
      { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { path: '/sales', label: 'Sales', icon: 'sales' },
      { path: '/returns', label: 'Returns', icon: 'returns' },
      { path: '/expenses', label: 'Expenses', icon: 'expenses' },
      { path: '/inventory', label: 'Inventory', icon: 'inventory' },
      { path: '/activity-log', label: 'My Activity Log', icon: 'activityLog' },
      { path: '/attendance', label: 'Attendance', icon: 'attendance' },
    ];
  }

  if (role === 'accountant') {
    return [
      { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { path: '/sales', label: 'Sales', icon: 'sales' },
      { path: '/inventory', label: 'Inventory', icon: 'inventory' },
      { path: '/expenses', label: 'Expenses', icon: 'expenses' },
      { path: '/attendance', label: 'Attendance', icon: 'attendance' },
    ];
  }

  if (role === 'driver') {
    return [
      { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { path: '/customers', label: 'My Customers', icon: 'customers' },
      { path: '/driver-tracking', label: 'My Location', icon: 'mapPin' },
      { path: '/returns', label: 'Returns', icon: 'returns' },
      { path: '/attendance', label: 'Attendance', icon: 'attendance' },
    ];
  }

  return [{ path: '/dashboard', label: 'Dashboard', icon: 'dashboard' }];
}

function StoreSwitcher() {
  const { stores, activeStoreId, canSwitch, switchStore } = useStore();
  if (!canSwitch || stores.length <= 1) return null;

  return (
    <select
      value={activeStoreId || ''}
      onChange={(e) => switchStore(e.target.value)}
      className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-700 font-medium"
      title="Switch store"
    >
      {stores.map((s) => (
        <option key={s._id} value={s._id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

export default function MainLayout({ children, user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeStore } = useStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
  const menuItems = menuItemsForRole(user?.role, activeStore?.type);

  return (
    <div className="flex h-screen bg-gray-50">
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col`}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-lg font-bold text-gray-900">Stacey</h1>
                <p className="text-xs text-gray-500">POS System</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive(item.path) ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
              }`}
              title={item.label}
            >
              <Icon name={item.icon} className="h-5 w-5 flex-shrink-0" />
              {sidebarOpen && <span className="text-sm">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center py-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-all"
          >
            <Icon name={sidebarOpen ? 'chevronLeft' : 'chevronRight'} className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-gray-600 hover:text-gray-900">
              <Icon name="menu" className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          </div>

          <div className="flex items-center gap-4">
            <StoreSwitcher />

            <button className="relative text-gray-600 hover:text-gray-900 transition-colors" title="Notifications">
              <Icon name="bell" className="w-6 h-6" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-all"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {user?.fullName?.[0] || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900">{user?.fullName || 'User'}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ') || 'user'}</p>
                </div>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Icon name="settings" className="w-4 h-4" /> Profile Settings
                  </button>
                  <button
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Icon name="lock" className="w-4 h-4" /> Change Password
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 font-medium"
                  >
                    <Icon name="logOut" className="w-4 h-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}