import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from './services/api';
import { StoreProvider } from './context/StoreContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Inventory from './pages/Inventory';
import Expenses from './pages/Expenses';
import Attendance from './pages/Attendance';
import ActivityLog from './pages/ActivityLog';
import Customers from './pages/Customers';
import Equipment from './pages/Equipment';
import DriverTracking from './pages/DriverTracking';
import Returns from './pages/Returns';
import StaffManagement from './pages/StaffManagement';
import Products from './pages/Products';

// Layout
import MainLayout from './components/Layout/MainLayout';

function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const response = await api.get('/auth/me');
          setUser(response.data.data);
          setIsAuthenticated(true);
        } catch (error) {
          localStorage.removeItem('accessToken');
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <StoreProvider user={user}>
      <MainLayout user={user}>{children({ user })}</MainLayout>
    </StoreProvider>
  );
}

// Simple role-gate: hides GM-only pages from other roles even if they
// navigate directly to the URL.
function RequireRole({ user, allow, children }) {
  const isGm = user?.role === 'owner' || user?.role === 'general_manager';
  const allowed = allow.includes(user?.role) || (allow.includes('gm') && isGm);
  if (!allowed) return <Navigate to="/dashboard" replace />;
  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/dashboard" element={<ProtectedRoute>{({ user }) => <Dashboard user={user} />}</ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute>{({ user }) => <Sales user={user} />}</ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute>{({ user }) => <Products user={user} />}</ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute>{({ user }) => <Inventory user={user} />}</ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute>{({ user }) => <Expenses user={user} />}</ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute>{() => <Attendance />}</ProtectedRoute>} />
        <Route path="/activity-log" element={<ProtectedRoute>{({ user }) => <ActivityLog user={user} />}</ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute>{({ user }) => <Customers user={user} />}</ProtectedRoute>} />
        <Route path="/returns" element={<ProtectedRoute>{({ user }) => <Returns user={user} />}</ProtectedRoute>} />
        

        <Route
          path="/equipment"
          element={
            <ProtectedRoute>
              {({ user }) => (
                <RequireRole user={user} allow={['gm']}>
                  <Equipment user={user} />
                </RequireRole>
              )}
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver-tracking"
          element={<ProtectedRoute>{({ user }) => <DriverTracking user={user} />}</ProtectedRoute>}
        />
        <Route
          path="/staff"
          element={
            <ProtectedRoute>
              {({ user }) => (
                <RequireRole user={user} allow={['gm']}>
                  <StaffManagement user={user} />
                </RequireRole>
              )}
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
