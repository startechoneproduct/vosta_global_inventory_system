import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/ui/Icons';
import api from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState();
  const [password, setPassword] = useState();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', {
        email: email.trim(),
        password,
      });

      localStorage.setItem('accessToken', response.data.data.accessToken);
      navigate('/dashboard');
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Login failed. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4 sm:p-0">
      <div className="hidden lg:flex lg:absolute lg:left-0 lg:top-0 lg:h-full lg:w-1/2 lg:bg-gradient-to-b lg:from-blue-600 lg:to-blue-800 lg:flex-col lg:items-center lg:justify-center">
        <div className="max-w-md">
          <h1 className="text-5xl font-bold text-white mb-6">Stacey POS</h1>
          <p className="text-xl text-blue-100 mb-8 leading-relaxed">
            Manage your Stacey Fountain and Stacey Farm operations with ease. Inventory, sales, and reporting all in one place.
          </p>
          <div className="space-y-4 text-blue-100">
            <div className="flex items-start gap-3">
              <Icon name="inventory" className="mt-1 h-6 w-6 flex-none" />
              <span>Real-time inventory tracking</span>
            </div>
            <div className="flex items-start gap-3">
              <Icon name="dashboard" className="mt-1 h-6 w-6 flex-none" />
              <span>Multi-location management</span>
            </div>
            <div className="flex items-start gap-3">
              <Icon name="sales" className="mt-1 h-6 w-6 flex-none" />
              <span>Comprehensive reporting</span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-md lg:ml-auto lg:mr-16">
        <div className="lg:hidden mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Icon name="sales" className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Stacey POS</h1>
          </div>
          <p className="text-gray-500 mt-2">Point of Sale Management System</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-gray-500 text-sm mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="********"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-xs mt-6">
          (c) 2026 Stacey Enterprises. All rights reserved.
        </p>
      </div>
    </div>
  );
}
