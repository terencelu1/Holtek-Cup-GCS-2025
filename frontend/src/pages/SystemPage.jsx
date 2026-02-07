import React, { useState, useEffect } from 'react';
import { Settings, Signal, Server, Activity, Battery, History, Save, Wifi, Radio } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Configuration
const REFRESH_RATE_HZ = 1;

// --- Components ---

// Refactored StatusCard: Cleaner, Less Color Heavy
const StatusCard = ({ title, icon, accentColor = "bg-cyan-500", children, className }) => (
    <div className={cn("bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col shrink-0", className)}>
        <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-50 bg-white">
            <div className={cn("w-1 h-4 rounded-full", accentColor)}></div>
            <div className="text-gray-400">
                {React.cloneElement(icon, { size: 16 })}
            </div>
            <span className="text-xs font-bold text-gray-700 tracking-wider uppercase">{title}</span>
        </div>
        <div className="flex-1 p-4">
            {children}
        </div>
    </div>
);

const HealthGauge = ({ score }) => {
    const radius = 36;
    const stroke = 5;
    const normalizedScore = Math.min(100, Math.max(0, score));
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;

    let color = 'text-gray-400';
    if (score >= 80) color = 'text-cyan-500';
    else if (score >= 60) color = 'text-amber-400';
    else color = 'text-rose-400';

    return (
        <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="transform -rotate-90 w-full h-full">
                <circle
                    cx="48" cy="48" r={radius}
                    stroke="currentColor" strokeWidth={stroke} fill="transparent"
                    className="text-gray-50"
                />
                <circle
                    cx="48" cy="48" r={radius}
                    stroke="currentColor" strokeWidth={stroke} fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className={cn("transition-all duration-1000 ease-out drop-shadow-sm", color)}
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className={cn("text-2xl font-bold font-mono tracking-tight", color)}>{score}</span>
                <span className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">Score</span>
            </div>
        </div>
    );
};

export default function SystemPage() {
    // --- State ---
    const [vehicles, setVehicles] = useState(['UAV1', 'UGV1']);
    const [vehicleStates, setVehicleStates] = useState({});
    const [companionStatus, setCompanionStatus] = useState({ cpu: 0, memory: 0, temperature: 0, uptime: 0 });
    const [chargingHistory, setChargingHistory] = useState([]);

    // Settings State
    const [settings, setSettings] = useState({
        updateRate: 10,
        bufferSize: 300,
        enableImu: false
    });

    // --- Data Fetching ---
    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Vehicles List
                const vRes = await fetch('/api/vehicles');
                const vData = await vRes.json();
                if (vData.success) {
                    // Update if needed
                }

                // 2. Vehicle States
                const sRes = await fetch('/api/vehicles/states');
                const sData = await sRes.json();
                if (sData.success) {
                    setVehicleStates(sData.data);
                }

                // 3. Companion Status
                const cRes = await fetch('/api/companion/status');
                const cData = await cRes.json();
                if (cData.success) {
                    setCompanionStatus(cData.status);
                }

                // 4. Charging History
                const hRes = await fetch('/api/charging/history');
                const hData = await hRes.json();
                if (hData.success) {
                    setChargingHistory(hData.history || []);
                }

            } catch (e) { console.error("System poll failed", e); }
        };

        fetchData();
        const interval = setInterval(fetchData, 1000 / REFRESH_RATE_HZ);
        return () => clearInterval(interval);
    }, []);

    // --- Helpers ---
    const formatDuration = (sec) => {
        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return `${d}d ${h}h ${m}m`;
    };

    const calculateHealthScore = (state) => {
        if (!state) return 0;
        let score = 100;
        if ((state.linkHealth?.heartbeatHz || 0) < 10) score -= 10;
        if ((state.linkHealth?.latencyMs || 0) > 100) score -= 10;
        if ((state.battery?.percent || 0) < 30) score -= 10;
        if ((state.systemHealth?.cpu || 0) > 80) score -= 10;
        return Math.max(0, score);
    };

    const getHealthDetails = (state) => {
        if (!state) return "N/A";
        const issues = [];
        if ((state.linkHealth?.heartbeatHz || 0) < 10) issues.push("Weak Signal");
        if ((state.battery?.percent || 0) < 30) issues.push("Low Battery");
        if (issues.length === 0) return "Normal";
        return issues.join(", ");
    };

    const handleSaveSettings = async () => {
        try {
            await fetch('/api/system/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playbackBuffer: settings.bufferSize })
            });
            // Consider avoiding alerts for a "Pro" feel, used console for now or a toast if available
            console.log("Settings Saved");
        } catch (e) { console.error("Save failed"); }
    };

    return (
        <div className="flex h-full flex-col bg-gray-50/50 p-6 overflow-y-auto font-sans gap-6">

            {/* Row 1: Settings */}
            <StatusCard title="System Configuration" icon={<Settings />} accentColor="bg-slate-400" className="opacity-90 hover:opacity-100">
                <div className="flex flex-wrap items-end gap-8 text-sm text-gray-600">
                    <div className="flex flex-col gap-1.5 min-w-[120px]">
                        <label className="text-gray-400 font-bold text-[10px] tracking-wider uppercase">Update Rate</label>
                        <div className="relative">
                            <select
                                value={settings.updateRate}
                                onChange={(e) => setSettings({ ...settings, updateRate: Number(e.target.value) })}
                                className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-xs py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-400 transition-all font-medium"
                            >
                                <option value={5}>5 Hz</option>
                                <option value={10}>10 Hz</option>
                                <option value={20}>20 Hz</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <i className="fas fa-chevron-down text-[10px]"></i>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5 min-w-[120px]">
                        <label className="text-gray-400 font-bold text-[10px] tracking-wider uppercase">Buffer Size</label>
                        <div className="relative flex items-center">
                            <input
                                type="number" min="60" max="3600" step="60"
                                value={settings.bufferSize}
                                onChange={(e) => setSettings({ ...settings, bufferSize: Number(e.target.value) })}
                                className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-xs py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-cyan-400 transition-all font-mono font-medium"
                            />
                            <span className="absolute right-3 text-[10px] text-gray-400 font-bold">SEC</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 mb-2 px-2 py-1 bg-gray-50 rounded-lg border border-gray-100 hover:border-cyan-200 transition-colors cursor-pointer" onClick={() => setSettings({ ...settings, enableImu: !settings.enableImu })}>
                        <div className={cn("w-4 h-4 rounded border flex items-center justify-center transition-colors", settings.enableImu ? "bg-cyan-500 border-cyan-500" : "bg-white border-gray-300")}>
                            {settings.enableImu && <i className="fas fa-check text-[10px] text-white"></i>}
                        </div>
                        <label className="text-gray-600 text-xs font-bold cursor-pointer select-none">High-Freq IMU</label>
                    </div>
                    <div className="flex-1 text-right">
                        <button
                            onClick={handleSaveSettings}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-gray-800 text-white text-xs font-bold rounded-lg hover:bg-gray-700 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-all duration-200"
                        >
                            <Save size={14} /> <span>SAVE CHANGES</span>
                        </button>
                    </div>
                </div>
            </StatusCard>

            {/* Row 2: Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Connection Health */}
                <StatusCard title="Network Status" icon={<Signal />} accentColor="bg-cyan-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {vehicles.map(vid => {
                            const state = vehicleStates[vid] || {};
                            const link = state.linkHealth || {};
                            const isHealthy = (link.heartbeatHz || 0) > 10;
                            return (
                                <div key={vid} className="border border-gray-100 rounded-xl bg-gray-50/50 p-4 hover:border-cyan-100 transition-colors">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-white shadow-sm text-gray-400", vid.includes('UAV') ? 'text-cyan-500' : 'text-amber-500')}>
                                            <i className={cn("fas", vid.includes('UAV') ? 'fa-plane' : 'fa-car')}></i>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-700 text-sm leading-tight">{vid}</h4>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isHealthy ? "bg-emerald-400" : "bg-rose-400")}></div>
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">{isHealthy ? "Connected" : "No Signal"}</span>
                                            </div>
                                        </div>
                                        <div className="ml-auto text-[10px] font-mono text-gray-400 bg-white px-2 py-1 rounded border border-gray-100 shadow-sm">
                                            {link.linkType || 'UDP'}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-2 text-xs">
                                        <div className="flex flex-col">
                                            <span className="text-gray-400 text-[10px] font-bold uppercase">Rate</span>
                                            <span className="font-mono font-bold text-gray-700">{(link.heartbeatHz || 0).toFixed(1)} Hz</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-gray-400 text-[10px] font-bold uppercase">Ping</span>
                                            <span className="font-mono font-bold text-gray-700">{(link.latencyMs || 0)} ms</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </StatusCard>

                {/* Companion Status */}
                <StatusCard title="Compute Module" icon={<Server />} accentColor="bg-indigo-400">
                    <div className="grid grid-cols-4 gap-4 h-full content-center">
                        {[
                            { label: "CPU", value: companionStatus.cpu.toFixed(0) + "%", color: "bg-indigo-500", track: "bg-indigo-100" },
                            { label: "RAM", value: companionStatus.memory.toFixed(0) + "%", color: "bg-purple-500", track: "bg-purple-100" },
                            { label: "TEMP", value: companionStatus.temperature.toFixed(0) + "°C", color: "bg-rose-500", track: "bg-rose-100" }, // Temp doesn't need bar but okay
                            { label: "Time", value: formatDuration(companionStatus.uptime), textOnly: true }
                        ].map((item, idx) => (
                            <div key={idx} className="flex flex-col items-center p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                                <span className="text-gray-400 text-[10px] font-bold uppercase mb-2 tracking-wide">{item.label}</span>
                                {item.textOnly ? (
                                    <div className="text-xs font-bold font-mono text-gray-600 text-center leading-tight mt-1">{item.value}</div>
                                ) : (
                                    <>
                                        <div className="text-xl font-bold font-mono text-gray-700 mb-2">{item.value}</div>
                                        {/* Minimal Circle / Bar could go here, omitting for cleanliness */}
                                        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                                            <div className={cn("h-full rounded-full transition-all duration-500", item.color)} style={{ width: item.value }}></div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </StatusCard>

                {/* System Health */}
                <StatusCard title="Health Overview" icon={<Activity />} accentColor="bg-emerald-400">
                    <div className="flex justify-around items-center h-full py-4">
                        {vehicles.map(vid => {
                            const score = calculateHealthScore(vehicleStates[vid]);
                            return (
                                <div key={vid} className="flex flex-col items-center gap-3">
                                    <HealthGauge score={score} />
                                    <div className="text-center">
                                        <h6 className="text-sm font-bold text-gray-600 mb-1">{vid}</h6>
                                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                            score > 90 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                                        )}>
                                            {score > 90 ? "Excellent" : "Atten. Req."}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </StatusCard>

                {/* Charging Status */}
                <StatusCard title="Power Management" icon={<Battery />} accentColor="bg-amber-400">
                    <div className="flex flex-col gap-5 py-2">
                        {vehicles.map(vid => {
                            const batt = vehicleStates[vid]?.battery || { voltage: 0, percent: 0 };
                            const isCharging = vehicleStates[vid]?.chargeStatus?.charging;
                            return (
                                <div key={vid} className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-600">{vid}</span>
                                            {isCharging && <span className="text-[10px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded animate-pulse">CHARGING</span>}
                                        </div>
                                        <span className="font-mono font-bold text-gray-700">{(batt.voltage || 0).toFixed(2)} V</span>
                                    </div>
                                    <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full rounded-full transition-all duration-500",
                                                batt.percent > 50 ? "bg-emerald-400" : batt.percent > 20 ? "bg-amber-400" : "bg-rose-400"
                                            )}
                                            style={{ width: `${batt.percent}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase">
                                        <span>Soc</span>
                                        <span>{batt.percent.toFixed(0)}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </StatusCard>
            </div>

            {/* Row 4: History Table */}
            <StatusCard title="Charging Log" icon={<History />} accentColor="bg-gray-400" className="flex-1 min-h-[300px]">
                <div className="overflow-hidden border border-gray-100 rounded-lg h-full">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-gray-400 font-bold uppercase text-[10px] tracking-wider border-b border-gray-100">
                            <tr>
                                <th className="p-4 font-medium">Vehicle</th>
                                <th className="p-4 font-medium">Start</th>
                                <th className="p-4 font-medium">End</th>
                                <th className="p-4 font-medium">Start %</th>
                                <th className="p-4 font-medium">End %</th>
                                <th className="p-4 font-medium text-right">Duration</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 bg-white">
                            {chargingHistory.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-6 text-center text-gray-300 italic">No records found</td>
                                </tr>
                            ) : (
                                chargingHistory.map((rec, i) => (
                                    <tr key={i} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="p-4 font-bold text-gray-600 group-hover:text-cyan-600 transition-colors">{rec.vehicleId}</td>
                                        <td className="p-4 text-gray-500 font-mono">{new Date(rec.startTime * 1000).toLocaleString([], { hour12: false })}</td>
                                        <td className="p-4 text-gray-500 font-mono">{rec.endTime ? new Date(rec.endTime * 1000).toLocaleString([], { hour12: false }) : 'Charging...'}</td>
                                        <td className="p-4 font-mono text-gray-600">{rec.startSOC.toFixed(1)}%</td>
                                        <td className="p-4 font-mono text-gray-600">{rec.endSOC ? rec.endSOC.toFixed(1) + '%' : '-'}</td>
                                        <td className="p-4 font-mono text-gray-600 text-right">{rec.duration ? formatDuration(rec.duration) : '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </StatusCard>

        </div>
    );
}

