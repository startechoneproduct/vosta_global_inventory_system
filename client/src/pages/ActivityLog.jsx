import { useState, useEffect } from 'react';
import api from '../services/api';

export default function ActivityLog({ user }) {
  const isGm = user?.role === 'owner' || user?.role === 'general_manager';
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const response = await api.get('/activity-log');
        setLogs(response.data.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Activity Log</h1>
        <p className="text-gray-500 mt-1">{isGm ? 'Every product sold, by whoever sold it' : 'Your own product sales activity'}</p>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Product</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Quantity</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
                {isGm && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Sold By</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">No activity recorded yet</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-600">{new Date(log.date).toLocaleString('en-NG')}</td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{log.productName}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{log.quantity}</td>
                    <td className="px-6 py-3">
                      <span className={log.action === 'sold' ? 'badge-green' : 'badge-yellow'}>{log.action}</span>
                    </td>
                    {isGm && <td className="px-6 py-3 text-sm text-gray-600">{log.performedBy?.fullName || log.performedByName}</td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
