import React, { useState } from 'react';
import clsx from 'clsx';

export default function MissionManager({ missions, onStartMission, selectedVehicleId, onSelectVehicle, homePosition }) {
    const [missionType, setMissionType] = useState('follow_ugv');

    const missionTypes = {
        UAV: [
            { id: 'follow_ugv', name: 'Follow UGV' },
            { id: 'auto_land', name: 'Auto Land on UGV' },
            { id: 'land', name: 'Land Here' },
            { id: 'patrol', name: 'Patrol Route' },
            { id: 'rtl', name: 'Return to Home' }
        ],
        UGV: [
            { id: 'follow_uav', name: 'Follow UAV' },
            { id: 'charge_station', name: 'Go to Charge Station' },
            { id: 'patrol_ugv', name: 'Patrol Route' }
        ]
    };

    const handleStart = () => {
        onStartMission(selectedVehicleId, missionType);
    };

    const currentMissions = missions.filter(m => m.vehicleId === selectedVehicleId).slice().reverse();

    return (
        <div className="bg-white/90 backdrop-blur rounded-xl border border-ui-panel-border shadow-sm flex flex-col h-full overflow-hidden">
            <div className="p-3 border-b border-ui-panel-border bg-gray-50/50">
                <h3 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-neon-orange rounded-full"></div>
                    MISSION MANAGER
                </h3>
            </div>

            <div className="p-3 space-y-4 flex-1 overflow-y-auto">
                {/* Vehicle Selector */}
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">VEHICLE</label>
                    <div className="flex bg-gray-100 p-0.5 rounded-lg">
                        {['UAV1', 'UGV1'].map(v => (
                            <button
                                key={v}
                                onClick={() => onSelectVehicle(v)}
                                className={clsx(
                                    "flex-1 py-1 text-xs font-bold rounded transition-all",
                                    selectedVehicleId === v
                                        ? "bg-white shadow text-ui-text-primary"
                                        : "text-gray-400 hover:text-gray-600"
                                )}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mission Type */}
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">MISSION TYPE</label>
                    <select
                        className="w-full border rounded-lg p-2 text-sm bg-white"
                        value={missionType}
                        onChange={(e) => setMissionType(e.target.value)}
                    >
                        <optgroup label="Available Missions">
                            {(selectedVehicleId.startsWith('UAV') ? missionTypes.UAV : missionTypes.UGV).map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </optgroup>
                    </select>
                </div>

                {/* Start Button */}
                <button
                    onClick={handleStart}
                    className="w-full py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white border-b-[5px] border-b-transparent ml-1"></div>
                    START MISSION
                </button>

                <hr className="border-gray-100" />

                {/* Mission List */}
                <div>
                    <label className="text-xs font-bold text-gray-400 block mb-2">MISSION HISTORY</label>
                    <div className="space-y-2">
                        {currentMissions.length === 0 && (
                            <div className="text-center py-4 text-xs text-gray-400 italic">No missions history</div>
                        )}

                        {currentMissions.map(m => (
                            <div key={m.id} className="bg-gray-50 border border-gray-100 rounded p-2 text-xs flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-gray-700">{m.type.replace('_', ' ').toUpperCase()}</div>
                                    <div className="text-[10px] text-gray-400">{new Date(m.startTime).toLocaleTimeString()}</div>
                                </div>
                                <div>
                                    <span className={clsx(
                                        "px-1.5 py-0.5 rounded text-[10px] uppercase font-bold",
                                        m.status === 'running' ? "bg-amber-100 text-amber-600" :
                                            m.status === 'completed' ? "bg-emerald-100 text-emerald-600" :
                                                "bg-gray-200 text-gray-600"
                                    )}>
                                        {m.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
