import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Attendance() {
  const [records, setRecords] = useState([]);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    checkCurrentStatus();
    fetchRecords();
  }, []);

  const checkCurrentStatus = async () => {
    try {
      const response = await api.get('/attendance/me/status');
      setCurrentStatus(response.data.data);
    } catch (err) {
      console.error('Failed to check status:', err);
    }
  };

  const fetchRecords = async () => {
    try {
      const response = await api.get('/attendance');
      setRecords(response.data.data);
    } catch (err) {
      console.error('Failed to load records:', err);
    }
  };

  const handleClockIn = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/attendance/clock-in');

      setSuccess('Clocked in successfully');
      checkCurrentStatus();
      fetchRecords();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/attendance/clock-out');
      setSuccess(`Clocked out. Hours worked: ${response.data.data.hoursWorked.toFixed(2)}`);
      checkCurrentStatus();
      fetchRecords();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-NG');
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-NG');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
        <p className="text-gray-500 mt-1">Track staff clock-in and clock-out</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="text-center">
          {currentStatus?.clockedIn ? (
            <>
              <p className="text-gray-600 mb-2">Currently clocked in</p>
              <p className="text-3xl font-bold text-green-600 mb-6">
                {formatTime(currentStatus.log.clockIn)}
              </p>
              <button
                onClick={handleClockOut}
                disabled={loading}
                className="px-8 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : '🚪 Clock Out'}
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-600 mb-2">Not clocked in</p>
              <button
                onClick={handleClockIn}
                disabled={loading}
                className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Processing...' : '✅ Clock In'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Attendance Records</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Clock In</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Clock Out</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Hours</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    No attendance records
                  </td>
                </tr>
              ) : (
                records.map(record => (
                  <tr key={record._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {formatDate(record.clockIn)}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {formatTime(record.clockIn)}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {record.clockOut ? formatTime(record.clockOut) : '-'}
                    </td>
                    <td className="px-6 py-3 text-gray-900 font-semibold">
                      {record.hoursWorked ? `${record.hoursWorked.toFixed(2)}h` : '-'}
                    </td>
                    <td className="px-6 py-3">
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full capitalize">
                        {record.status}
                      </span>
                    </td>
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
