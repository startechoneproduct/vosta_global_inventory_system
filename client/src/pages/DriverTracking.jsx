import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../services/api';
import { useStore } from '../context/StoreContext';

function DriverSelfView() {
  const [coords, setCoords] = useState(null); // kept only in memory, never rendered as text
  const [currentAddress, setCurrentAddress] = useState('');
  const [targets, setTargets] = useState([{ label: '', address: '' }]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState(false);
  const [locating, setLocating] = useState(false);

  const getBrowserLocation = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => reject(err)
      );
    });

  const sendPing = async () => {
    setError('');
    setLocating(true);
    try {
      const position = await getBrowserLocation();
      setCoords(position);

      const response = await api.post('/driver-location/ping', position);
      setCurrentAddress(response.data.data.address);
      setStatus(`Location updated at ${new Date().toLocaleTimeString('en-NG')}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    let interval;
    if (tracking) {
      sendPing();
      interval = setInterval(sendPing, 60000); // every 60s while tracking is on
    }
    return () => clearInterval(interval);
    
  }, [tracking]);

  const addTargetRow = () => setTargets([...targets, { label: '', address: '' }]);
  const updateTarget = (i, field, value) => {
    const copy = [...targets];
    copy[i][field] = value;
    setTargets(copy);
  };

  const saveTargets = async () => {
    setError('');
    setStatus('');
    try {
      const valid = targets.filter((t) => t.address.trim()).map((t) => ({
        label: t.label,
        address: t.address,
      }));
      if (valid.length === 0) {
        setError('Add at least one delivery address');
        return;
      }
      const response = await api.post('/driver-location/targets', { targetLocations: valid });
      
      setTargets(
        response.data.data.targetLocations.map((t) => ({ label: t.label, address: t.address }))
      );
      setStatus('Target locations saved');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {status && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{status}</div>}

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">My Current Location</h2>
        <div className="flex gap-3 flex-wrap">
          <button onClick={sendPing} disabled={locating} className="btn-primary">
            {locating ? 'Locating...' : '📍 Send Location Update'}
          </button>
          <button
            onClick={() => setTracking((t) => !t)}
            className={tracking ? 'btn-danger' : 'btn-secondary'}
          >
            {tracking ? 'Stop Auto-Tracking' : 'Start Auto-Tracking'}
          </button>
        </div>
        {currentAddress && (
          <p className="text-sm text-gray-700">
            <span className="text-gray-400">Current location: </span>
            {currentAddress}
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Targeted Delivery Locations for Today</h2>
        <p className="text-xs text-gray-400">Type an address - no need to look up coordinates.</p>
        {targets.map((t, i) => (
          <div key={i} className="flex gap-3">
            <input
              className="input-field w-40"
              placeholder="Nickname (optional)"
              value={t.label}
              onChange={(e) => updateTarget(i, 'label', e.target.value)}
            />
            <input
              className="input-field flex-1"
              placeholder="Address (e.g. Wuse Market, Abuja)"
              value={t.address}
              onChange={(e) => updateTarget(i, 'address', e.target.value)}
            />
          </div>
        ))}
        <div className="flex gap-3">
          <button onClick={addTargetRow} className="text-blue-600 border border-blue-200 rounded-lg px-4 py-2 hover:bg-blue-50">
            + Add Location
          </button>
          <button onClick={saveTargets} className="btn-primary">Save Targets</button>
        </div>
      </div>
    </div>
  );
}

function LeadershipDriverMap() {
  const [drivers, setDrivers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const response = await api.get('/driver-location/live');
        setDrivers(response.data.data);
      } catch (err) {
        setError(err.message);
      }
    };
    fetchLive();
    const interval = setInterval(fetchLive, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Driver</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Current Location</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Targets Today</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Last Update</th>
            </tr>
          </thead>
          <tbody>
            {drivers.length === 0 ? (
              <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No driver location data yet</td></tr>
            ) : (
              drivers.map((d) => (
                <tr key={d.driverId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{d.driverName}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 max-w-xs">
                    {d.address ? (
                      <a
                        href={`https://www.google.com/maps?q=${encodeURIComponent(d.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                        title={d.address}
                      >
                        {d.address}
                      </a>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {d.targetLocations.map((t) => t.label).join(', ') || '-'}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{d.lastUpdated ? new Date(d.lastUpdated).toLocaleTimeString('en-NG') : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DriverTracking({ user }) {
  const isGm = user?.role === 'owner' || user?.role === 'general_manager';
  const { activeStore } = useStore();

  
  if (activeStore?.type === 'farm') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Driver Tracking</h1>
        <p className="text-gray-500 mt-1">{isGm ? 'Real-time location of all drivers' : 'Report your location and delivery targets'}</p>
      </div>

      {isGm ? <LeadershipDriverMap /> : <DriverSelfView />}
    </div>
  );
}