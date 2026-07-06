import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Equipment() {
  const [equipment, setEquipment] = useState([]);
  const [form, setForm] = useState({ name: '', type: '', serialNumber: '', serviceIntervalDays: 90, notes: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEquipment();
  }, []);

  const fetchEquipment = async () => {
    try {
      const response = await api.get('/equipment');
      setEquipment(response.data.data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!form.name) {
        setError('Equipment name is required');
        setLoading(false);
        return;
      }
      await api.post('/equipment', { ...form, serviceIntervalDays: Number(form.serviceIntervalDays) });
      setSuccess('Equipment added');
      setForm({ name: '', type: '', serialNumber: '', serviceIntervalDays: 90, notes: '' });
      fetchEquipment();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markServiced = async (id) => {
    try {
      await api.put(`/equipment/${id}/service`);
      fetchEquipment();
    } catch (err) {
      setError(err.message);
    }
  };

  const statusBadge = (status) => {
    if (status === 'operational') return 'badge-green';
    if (status === 'due_for_service') return 'badge-yellow';
    return 'badge-red';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Equipment</h1>
        <p className="text-gray-500 mt-1">Track factory equipment and maintenance schedules</p>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{success}</div>}

      <form onSubmit={handleAdd} className="bg-white rounded-lg border border-gray-200 p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className="input-field" placeholder="Equipment name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input-field" placeholder="Type (e.g. Filling Machine)" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
        <input className="input-field" placeholder="Serial number" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
        <input
          type="number"
          className="input-field"
          placeholder="Service interval (days)"
          value={form.serviceIntervalDays}
          onChange={(e) => setForm({ ...form, serviceIntervalDays: e.target.value })}
        />
        <input className="input-field sm:col-span-2" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button type="submit" disabled={loading} className="btn-primary sm:col-span-2">Add Equipment</button>
      </form>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Equipment</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Last Serviced</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Next Due</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900"></th>
            </tr>
          </thead>
          <tbody>
            {equipment.length === 0 ? (
              <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-500">No equipment recorded yet</td></tr>
            ) : (
              equipment.map((eq) => (
                <tr key={eq._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{eq.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{eq.type || '-'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{eq.lastServiceDate ? new Date(eq.lastServiceDate).toLocaleDateString('en-NG') : '-'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{eq.nextServiceDue ? new Date(eq.nextServiceDue).toLocaleDateString('en-NG') : '-'}</td>
                  <td className="px-6 py-3"><span className={statusBadge(eq.status)}>{eq.status.replace(/_/g, ' ')}</span></td>
                  <td className="px-6 py-3">
                    <button onClick={() => markServiced(eq._id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      Mark Serviced
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
