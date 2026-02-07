import React, { useState } from 'react';
import MapView from '../components/MapView';
import WaypointManager from '../components/WaypointManager';
import MissionManager from '../components/MissionManager';

export default function MapPage({ vehicles }) {
    const [is3D, setIs3D] = useState(true);
    const [orbitMode, setOrbitMode] = useState(false);
    const [activeTab, setActiveTab] = useState('waypoint');
    const [selectedVehicleId, setSelectedVehicleId] = useState('UAV1');
    const [isPanelOpen, setIsPanelOpen] = useState(true); // Panel State

    // Local State
    const [waypoints, setWaypoints] = useState([]);
    const [missions, setMissions] = useState([]);
    const [isAddMode, setIsAddMode] = useState(false);

    // Actions
    const handleSelectVehicle = (id) => setSelectedVehicleId(id);
    const toggleAddMode = () => setIsAddMode(!isAddMode);

    // Map Interactions
    const handleMapClick = (e) => {
        if (isAddMode) {
            const key = Date.now();
            const { lng, lat } = e.lngLat;
            const newWaypoint = {
                id: key,
                vehicleId: selectedVehicleId,
                lat, lon: lng, alt: 10.0,
                order: waypoints.filter(w => w.vehicleId === selectedVehicleId).length + 1
            };
            setWaypoints([...waypoints, newWaypoint]);
            setIsAddMode(false);
        }
    };

    const handleDeleteWaypoint = (id) => setWaypoints(waypoints.filter(w => w.id !== id));
    const handleUpdateWaypoint = (id, u) => setWaypoints(waypoints.map(w => w.id === id ? { ...w, ...u } : w));
    const handleStartMission = (vid, type) => {
        const m = { id: Date.now(), vehicleId: vid, type, status: 'running', startTime: new Date().toISOString() };
        setMissions([...missions, m]);
    };

    return (
        <div className="w-full h-full relative flex">
            {/* Collapsible Left Sidebar Overlay */}
            <div className={`absolute top-4 left-4 bottom-4 z-20 flex flex-col transition-all duration-300 ease-in-out ${isPanelOpen ? 'w-80' : 'w-10'}`}>

                {/* Toggle Button */}
                <button
                    onClick={() => setIsPanelOpen(!isPanelOpen)}
                    className={`absolute top-1/2 -translate-y-1/2 w-6 h-12 bg-white rounded-r-md shadow-md border-y border-r border-gray-200 flex items-center justify-center text-gray-400 hover:text-cyan-600 z-30 transition-all duration-300 ${isPanelOpen ? '-right-6' : 'left-0 rounded-l-md border-l'}`}
                    style={{ left: isPanelOpen ? 'auto' : '0' }}
                >
                    <i className={`fas fa-chevron-${isPanelOpen ? 'left' : 'right'}`}></i>
                </button>

                {isPanelOpen ? (
                    <div className="flex flex-col h-full gap-2 w-full">
                        {/* Tab Switcher */}
                        <div className="flex bg-white/90 backdrop-blur rounded-lg p-1 shadow border border-ui-panel-border shrink-0">
                            <button onClick={() => setActiveTab('waypoint')} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${activeTab === 'waypoint' ? 'bg-cyan-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>WAYPOINTS</button>
                            <button onClick={() => setActiveTab('mission')} className={`flex-1 py-1.5 text-xs font-bold rounded transition-colors ${activeTab === 'mission' ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>MISSIONS</button>
                        </div>

                        {/* Manager Content */}
                        <div className="flex-1 overflow-hidden bg-white/90 backdrop-blur rounded-lg shadow border border-ui-panel-border">
                            {activeTab === 'waypoint' ? (
                                <WaypointManager
                                    waypoints={waypoints}
                                    onAddWaypoint={() => { }}
                                    onDeleteWaypoint={handleDeleteWaypoint}
                                    onUpdateWaypoint={handleUpdateWaypoint}
                                    isAddMode={isAddMode}
                                    toggleAddMode={toggleAddMode}
                                    selectedVehicleId={selectedVehicleId}
                                    onSelectVehicle={handleSelectVehicle}
                                />
                            ) : (
                                <MissionManager
                                    missions={missions}
                                    onStartMission={handleStartMission}
                                    selectedVehicleId={selectedVehicleId}
                                    onSelectVehicle={handleSelectVehicle}
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    /* Floating Icon Mode (No background bar) */
                    <div className="absolute top-4 left-0 pointer-events-auto">
                        <button
                            onClick={() => setIsPanelOpen(true)}
                            className="w-10 h-10 bg-white/90 backdrop-blur rounded-lg shadow-lg border border-gray-200 flex items-center justify-center text-cyan-600 hover:bg-cyan-50 hover:scale-105 transition-all"
                            title="Open Mission Manager"
                        >
                            <i className="fas fa-map-marked-alt text-lg"></i>
                        </button>
                    </div>
                )}
            </div>

            {/* Map */}
            <div className="flex-1 h-full relative">
                <MapView
                    vehicles={Object.values(vehicles)}
                    is3D={is3D}
                    onToggle3D={setIs3D}
                    orbitMode={orbitMode}
                    onToggleOrbit={setOrbitMode}
                    onClick={handleMapClick}
                    cursor={isAddMode ? 'crosshair' : 'grab'}
                    waypoints={waypoints}
                    missions={missions}
                />
            </div>
        </div>
    );
}
