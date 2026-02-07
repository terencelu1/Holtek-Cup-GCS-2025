import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MapPage from './pages/MapPage';
import PerformancePage from './pages/PerformancePage';
import SystemPage from './pages/SystemPage';

// 連接到 Flask 後端
const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:5001' : window.location.origin;

function App() {
  const [vehicles, setVehicles] = useState({
    'UAV1': {
      vehicleId: 'UAV1',
      type: 'uav',
      attitude: { rollDeg: 0, pitchDeg: 0, yawDeg: 0 },
      position: { lat: 23.024087, lon: 120.224649, altitude: 0 },
      battery: { percent: 100 },
      mode: 'DISARMED',
      motion: { groundSpeed: 0 }
    },
    'UGV1': {
      vehicleId: 'UGV1',
      type: 'ugv',
      attitude: { rollDeg: 0, pitchDeg: 0, yawDeg: 0 },
      position: { lat: 23.024000, lon: 120.224600, altitude: 0 },
      battery: { percent: 100 },
      mode: 'HOLD',
      motion: { groundSpeed: 0 }
    }
  });

  const [connected, setConnected] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('UAV1');

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true
    });

    socket.on('connect', () => {
      console.log('Connected to GCS Backend');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected');
      setConnected(false);
    });

    socket.on('telemetry_data', (data) => {
      if (data && data.vehicleId) {
        setVehicles(prev => ({
          ...prev,
          [data.vehicleId]: data.state
        }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <BrowserRouter>
      <Layout
        connected={connected}
        activeVehicleId={selectedVehicleId}
        onSelectVehicle={setSelectedVehicleId}
        vehicles={vehicles}
      >
        <Routes>
          <Route path="/" element={<Dashboard vehicles={vehicles} selectedVehicleId={selectedVehicleId} />} />
          <Route path="/map" element={<MapPage vehicles={vehicles} />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="*" element={
            <div className="flex items-center justify-center h-full text-2xl font-bold text-gray-500">
              404 - No Route Matched. Current Path: {window.location.pathname}
            </div>
          } />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
