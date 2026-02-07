import React, { useState } from 'react';
import clsx from 'clsx';

export default function WaypointManager({ waypoints, onAddWaypoint, onDeleteWaypoint, onUpdateWaypoint, isAddMode, toggleAddMode, selectedVehicleId, onSelectVehicle }) {
    const [editId, setEditId] = useState(null);
    const [editForm, setEditForm] = useState({ lat: 0, lon: 0, alt: 0 });

    const vehicleWaypoints = waypoints
        .filter(w => w.vehicleId === selectedVehicleId)
        .sort((a, b) => a.order - b.order);

    const handleEdit = (wp) => {
        setEditId(wp.id);
        setEditForm({ lat: wp.lat, lon: wp.lon, alt: wp.alt });
    };

    const handleSave = () => {
        onUpdateWaypoint(editId, editForm);
        setEditId(null);
    };

    return (
        <div className="bg-white/90 backdrop-blur rounded-xl border border-ui-panel-border shadow-sm flex flex-col h-full overflow-hidden">
            <div className="p-3 border-b border-ui-panel-border bg-gray-50/50">
                <h3 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-neon-cyan rounded-full"></div>
                    WAYPOINT MANAGER
                </h3>
            </div>

            <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                {/* Vehicle Selector */}
                <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">TARGET VEHICLE</label>
                    <div className="flex bg-gray-100 p-0.5 rounded-lg">
                        {['UAV1', 'UGV1'].map(v => (
                            <button
                                key={v}
                                onClick={() => onSelectVehicle(v)}
                                className={clsx(
                                    "flex-1 py-1 text-xs font-bold rounded transition-all",
                                    selectedVehicleId === v
                                        ? "bg-white shadow text-ui-text-primary border border-gray-200"
                                        : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Add Button */}
                <button
                    onClick={toggleAddMode}
                    className={clsx(
                        "w-full py-2 rounded text-xs font-bold transition-all border",
                        isAddMode
                            ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse ring-2 ring-amber-200"
                            : "bg-blue-600 text-white border-blue-700 hover:bg-blue-700 shadow-sm"
                    )}
                >
                    {isAddMode ? "CLICK ON MAP TO ADD..." : "+ ADD WAYPOINT"}
                </button>

                {/* List */}
                <div className="space-y-2 mt-2">
                    {vehicleWaypoints.length === 0 && (
                        <div className="text-center py-4 text-xs text-gray-500 italic">No waypoints set</div>
                    )}

                    {vehicleWaypoints.map((wp, idx) => (
                        <div key={wp.id} className="bg-white border border-gray-200 rounded p-2 text-xs hover:border-blue-400 transition-colors group shadow-sm">
                            {editId === wp.id ? (
                                <div className="space-y-2">
                                    <div className="flex gap-1">
                                        <input type="number" step="0.000001" value={editForm.lat} onChange={e => setEditForm({ ...editForm, lat: parseFloat(e.target.value) })} className="w-full border rounded px-1 py-0.5 font-mono text-[10px] text-gray-900 font-bold" />
                                        <input type="number" step="0.000001" value={editForm.lon} onChange={e => setEditForm({ ...editForm, lon: parseFloat(e.target.value) })} className="w-full border rounded px-1 py-0.5 font-mono text-[10px] text-gray-900 font-bold" />
                                    </div>
                                    <div className="flex gap-1 items-center">
                                        <span className="text-gray-600 text-[10px] font-bold">ALT</span>
                                        <input type="number" step="0.1" value={editForm.alt} onChange={e => setEditForm({ ...editForm, alt: parseFloat(e.target.value) })} className="w-16 border rounded px-1 py-0.5 font-mono text-[10px] text-gray-900 font-bold" />
                                        <div className="flex-1 flex justify-end gap-1">
                                            <button onClick={() => setEditId(null)} className="text-gray-600 hover:text-gray-800 px-2 border rounded hover:bg-gray-100">Cancel</button>
                                            <button onClick={handleSave} className="bg-blue-600 text-white px-2 rounded hover:bg-blue-700 font-bold">Save</button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-bold text-gray-800 flex items-center gap-1.5 text-[13px]">
                                            <span className="bg-gray-200 text-gray-700 w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-extrabold">{wp.order}</span>
                                            Waypoint
                                        </div>
                                        <div className="font-mono text-[11px] text-gray-600 mt-1 font-medium">{wp.lat.toFixed(6)}, {wp.lon.toFixed(6)}</div>
                                        <div className="text-[11px] text-gray-600 font-medium mt-0.5">Alt: <span className="text-blue-600 font-bold">{wp.alt}m</span></div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEdit(wp)} className="text-blue-400 hover:text-blue-600 p-1"><i className="fas fa-edit"></i> Edit</button>
                                        <button onClick={() => onDeleteWaypoint(wp.id)} className="text-red-400 hover:text-red-600 p-1"><i className="fas fa-trash"></i></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
