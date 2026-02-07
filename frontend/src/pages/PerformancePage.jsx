import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { Play, Pause, Square, Download, Clock, Calendar, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for class merging
function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Custom specialized charts for "Scientific/Light Futuristic" look
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur border border-cyan-500/30 p-2 rounded shadow-lg text-xs">
                <p className="font-bold text-gray-700 mb-1">{new Date(label).toLocaleTimeString()}</p>
                {payload.map((p, index) => (
                    <p key={index} style={{ color: p.color }} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
                        {p.name}: <span className="font-mono font-bold">{Number(p.value).toFixed(2)}</span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export default function PerformancePage() {
    // --- State ---
    const [selectedVehicle, setSelectedVehicle] = useState('UAV1');
    const [mode, setMode] = useState('realtime'); // 'realtime' | 'playback'

    // Playback State
    const [playbackState, setPlaybackState] = useState({
        playing: false,
        speed: 2,
        currentTime: 0,
        duration: 0,
        startTime: 0,
        endTime: 0
    });
    // History data for playback (in memory)
    const historyDataRef = useRef(null);
    const playbackFrameRef = useRef(null);
    const lastPlaybackUpdateRef = useRef(0);

    // Chart Config
    const [timeRange, setTimeRange] = useState(60); // seconds
    const [updateRate, setUpdateRate] = useState(25); // Hz
    const [activeTab, setActiveTab] = useState('attitude'); // 'attitude' | 'rc' | 'motion' | 'altitude'

    // Data Buffers (for Real-time)
    const maxPoints = 1000;
    const [chartData, setChartData] = useState({
        attitude: [],
        rc: [],
        motion: [],
        altitude: []
    });

    // Logs
    const [logs, setLogs] = useState([]);
    const logsEndRef = useRef(null);

    // Refs for intervals
    const updateIntervalRef = useRef(null);
    const updateRateRef = useRef(25); // Keep track in ref for interval usage
    useEffect(() => { updateRateRef.current = updateRate; }, [updateRate]);

    // --- Helpers ---
    const formatTime = (ms) => {
        if (!ms && ms !== 0) return "00:00";
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    // --- Data Fetching Logic ---

    // 1. Real-time Polling
    useEffect(() => {
        if (mode !== 'realtime') return;

        const fetchData = async () => {
            try {
                // Fetch vehicle states
                const res = await fetch('/api/vehicles/states');
                const data = await res.json();

                if (data.success && data.data[selectedVehicle]) {
                    const vehicleData = data.data[selectedVehicle];
                    const now = Date.now();

                    setChartData(prev => {
                        const append = (arr, newItem) => {
                            const newArr = [...arr, newItem];
                            return newArr.slice(-maxPoints); // Keep buffer size limited
                        };

                        return {
                            attitude: append(prev.attitude, {
                                time: now,
                                roll: vehicleData.attitude.rollDeg || 0,
                                pitch: vehicleData.attitude.pitchDeg || 0,
                                yaw: vehicleData.attitude.yawDeg || 0
                            }),
                            rc: append(prev.rc, {
                                time: now,
                                throttle: vehicleData.rc.throttle || 0,
                                roll: vehicleData.rc.roll || 0,
                                pitch: vehicleData.rc.pitch || 0,
                                yaw: vehicleData.rc.yaw || 0
                            }),
                            motion: append(prev.motion, {
                                time: now,
                                groundSpeed: vehicleData.motion.groundSpeed || 0,
                                throttle: vehicleData.rc.throttle || 0
                            }),
                            altitude: selectedVehicle === 'UAV1' ? append(prev.altitude, {
                                time: now,
                                altitude: vehicleData.position.altitude || 0
                            }) : prev.altitude
                        };
                    });
                }

                // Fetch Logs
                const logRes = await fetch('/api/logs');
                const logData = await logRes.json();
                if (logData.success) {
                    setLogs(logData.logs.slice(-100).reverse()); // Keep last 100
                }

            } catch (err) {
                console.error("Polling error:", err);
            }
        };

        // Clear existing interval
        if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);

        // Start new interval based on updateRate
        const intervalMs = 1000 / updateRate;
        updateIntervalRef.current = setInterval(fetchData, intervalMs);

        return () => {
            if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
        };
    }, [mode, selectedVehicle, updateRate]);

    // 2. Playback: Load History
    useEffect(() => {
        if (mode === 'playback') {
            // Reset charts
            setChartData({ attitude: [], rc: [], motion: [], altitude: [] });
            setPlaybackState(prev => ({ ...prev, playing: false, currentTime: 0, duration: 0 }));

            // Fetch history
            const fetchHistory = async () => {
                try {
                    // Mocking or fetching real API
                    // Note: Ensure /api/vehicle/:id/history/full endpoint exists or mock it
                    // For now, let's assume valid response structure, or if 404, we mock data
                    const res = await fetch(`/api/vehicle/${selectedVehicle}/history/full`);
                    const json = await res.json();

                    if (json.success && json.data) {
                        historyDataRef.current = json.data; // { attitude: [], rc: [], ... }
                        // Expecting timestamps in seconds in API response, convert to ms? 
                        // Assuming API returns standard object structure as in performance.js

                        const duration = (json.duration || 0) * 1000;
                        setPlaybackState(prev => ({
                            ...prev,
                            duration: duration,
                            startTime: json.startTime * 1000,
                            endTime: json.endTime * 1000,
                            loaded: true
                        }));
                    } else {
                        // Fallback/Mock if API fails (for demo)
                        console.warn("History API not found, using mock data for demo");
                        // Mock 60 seconds of data
                        const now = Date.now();
                        const mockData = { attitude: [], rc: [], motion: [], altitude: [] };
                        for (let i = 0; i < 600; i++) { // 60s * 10Hz
                            const t = i * 0.1;
                            const ts = i * 100; // ms relative
                            mockData.attitude.push({ timestamp: t, roll: Math.sin(t) * 30, pitch: Math.cos(t) * 20, yaw: t % 360 });
                            mockData.rc.push({ timestamp: t, throttle: 0.5 + Math.sin(t) * 0.2, roll: 0, pitch: 0, yaw: 0 });
                            mockData.motion.push({ timestamp: t, groundSpeed: 5 + Math.random(), throttle: 0.5 });
                            mockData.altitude.push({ timestamp: t, altitude: 10 + Math.sin(t / 10) * 5 });
                        }
                        historyDataRef.current = mockData;
                        setPlaybackState(prev => ({ ...prev, duration: 60000, startTime: now, endTime: now + 60000, loaded: true }));
                    }
                } catch (e) { console.error("History load failed", e); }
            };
            fetchHistory();
        } else {
            // Clear history when leaving playback
            historyDataRef.current = null;
        }
    }, [mode, selectedVehicle]);

    // 3. Playback Loop
    useEffect(() => {
        if (mode !== 'playback' || !playbackState.playing || !historyDataRef.current) {
            if (playbackFrameRef.current) cancelAnimationFrame(playbackFrameRef.current);
            return;
        }

        const loop = () => {
            const now = Date.now();
            const elapsed = now - lastPlaybackUpdateRef.current;

            // Update time
            setPlaybackState(prev => {
                const nextTime = prev.currentTime + elapsed * prev.speed;

                // End check
                if (nextTime >= prev.duration) {
                    return { ...prev, playing: false, currentTime: prev.duration };
                }

                // Update Charts based on currentTime (nextTime)
                updateChartsForPlayback(nextTime);

                return { ...prev, currentTime: nextTime };
            });

            lastPlaybackUpdateRef.current = now;

            if (playbackState.playing) { // Check ref state ideally, but dependency approach works ok here
                playbackFrameRef.current = requestAnimationFrame(loop);
            }
        };

        lastPlaybackUpdateRef.current = Date.now();
        playbackFrameRef.current = requestAnimationFrame(loop);

        return () => {
            if (playbackFrameRef.current) cancelAnimationFrame(playbackFrameRef.current);
        };
    }, [playbackState.playing, playbackState.speed]); // Re-run when play state changes

    const updateChartsForPlayback = (timeMs) => {
        if (!historyDataRef.current) return;
        const timeSec = timeMs / 1000;

        // Filter history data up to current time (simulate growing buffer)
        // Optimization: In a real heavy app, we wouldn't filter every frame.
        // For Recharts, we can just slice a window.

        // Let's just create a "view window" of data
        const windowSize = timeRange; // sec
        const minTime = Math.max(0, timeSec - windowSize);

        const filterData = (arr) => {
            if (!arr) return [];
            return arr.filter(d => d.timestamp >= minTime && d.timestamp <= timeSec).map(d => ({
                ...d, time: playbackState.startTime + d.timestamp * 1000 // Convert back to absolute time for Chart XAxis
            }));
        };

        setChartData({
            attitude: filterData(historyDataRef.current.attitude),
            rc: filterData(historyDataRef.current.rc),
            motion: filterData(historyDataRef.current.motion),
            altitude: filterData(historyDataRef.current.altitude),
        });
    };

    // Auto-scroll logs
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);


    // --- Render ---

    // Common Chart Props
    const commonXAxis = {
        dataKey: "time",
        type: "number",
        domain: mode === 'realtime' ? [Date.now() - timeRange * 1000, Date.now()] : ['auto', 'auto'],
        tickFormatter: (time) => new Date(time).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
        stroke: '#9ca3af',
        fontSize: 10
    };
    const commonProps = { isAnimationActive: false, dot: false, strokeWidth: 2 };

    return (
        <div className="flex flex-col h-full bg-ui-bg p-4 overflow-hidden font-sans">

            {/* Top Control Bar */}
            <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4 shrink-0">
                <div className="flex items-center gap-6">
                    {/* Vehicle Select */}
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-sm font-bold">VEHICLE</span>
                        <div className="flex bg-gray-100 rounded p-1">
                            {['UAV1', 'UGV1'].map(v => (
                                <button key={v}
                                    onClick={() => setSelectedVehicle(v)}
                                    className={cn("px-4 py-1.5 text-xs font-bold rounded transition-colors",
                                        selectedVehicle === v ? "bg-cyan-500 text-white shadow-sm" : "text-gray-500 hover:bg-gray-200"
                                    )}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-sm font-bold">MODE</span>
                        <div className="flex bg-gray-100 rounded p-1">
                            <button onClick={() => setMode('realtime')}
                                className={cn("px-4 py-1.5 text-xs font-bold rounded transition-colors flex items-center gap-1",
                                    mode === 'realtime' ? "bg-cyan-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-200"
                                )}
                            >
                                <Clock size={12} /> REAL-TIME
                            </button>
                            <button onClick={() => setMode('playback')}
                                className={cn("px-4 py-1.5 text-xs font-bold rounded transition-colors flex items-center gap-1",
                                    mode === 'playback' ? "bg-orange-500 text-white shadow-sm" : "text-gray-500 hover:bg-gray-200"
                                )}
                            >
                                <Calendar size={12} /> PLAYBACK
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Side: Playback Controls or Realtime Settings */}
                <div className="flex items-center gap-4">
                    {mode === 'realtime' ? (
                        <>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-xs font-bold">RANGE</span>
                                <select value={timeRange} onChange={(e) => setTimeRange(Number(e.target.value))} className="text-sm border-gray-300 rounded focus:ring-cyan-500">
                                    <option value={30}>30s</option>
                                    <option value={60}>1m</option>
                                    <option value={120}>2m</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-xs font-bold">RATE</span>
                                <select value={updateRate} onChange={(e) => setUpdateRate(Number(e.target.value))} className="text-sm border-gray-300 rounded focus:ring-cyan-500">
                                    <option value={10}>10Hz</option>
                                    <option value={25}>25Hz</option>
                                    <option value={50}>50Hz</option>
                                </select>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center gap-4 bg-gray-50 px-3 py-1 rounded border border-gray-200">
                            <button onClick={() => setPlaybackState(p => ({ ...p, playing: !p.playing }))}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                            >
                                {playbackState.playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                            </button>

                            <button onClick={() => {
                                setPlaybackState(p => ({ ...p, playing: false, currentTime: 0 }));
                                updateChartsForPlayback(0);
                            }} className="text-gray-500 hover:text-red-500">
                                <Square size={14} fill="currentColor" />
                            </button>

                            <div className="flex flex-col w-48">
                                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                                    <span>{formatTime(playbackState.currentTime)}</span>
                                    <span>{formatTime(playbackState.duration)}</span>
                                </div>
                                <input
                                    type="range" min="0" max={playbackState.duration} step="100"
                                    value={playbackState.currentTime}
                                    onChange={(e) => {
                                        const t = Number(e.target.value);
                                        setPlaybackState(p => ({ ...p, currentTime: t, playing: false }));
                                        updateChartsForPlayback(t);
                                    }}
                                    className="h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                />
                            </div>

                            <select
                                value={playbackState.speed}
                                onChange={(e) => setPlaybackState(p => ({ ...p, speed: Number(e.target.value) }))}
                                className="text-xs border-none bg-transparent font-bold text-gray-600 focus:ring-0"
                            >
                                <option value={1}>1x</option>
                                <option value={2}>2x</option>
                                <option value={4}>4x</option>
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
                {/* Left Column: Charts */}
                <div className="col-span-8 flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {/* Feature Tabs */}
                    <div className="flex border-b border-gray-100 px-2 pt-2 gap-1 bg-gray-50/50">
                        {[
                            { id: 'attitude', label: 'ATTITUDE', icon: <i className="fas fa-compass" /> },
                            { id: 'rc', label: 'RC INPUT', icon: <i className="fas fa-gamepad" /> },
                            { id: 'motion', label: 'MOTION', icon: <i className="fas fa-tachometer-alt" /> },
                            { id: 'altitude', label: 'ALTITUDE', icon: <i className="fas fa-mountain" />, hidden: selectedVehicle !== 'UAV1' }
                        ].map(tab => !tab.hidden && (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "px-4 py-2 text-xs font-bold border-t-2 border-x border-transparent rounded-t-md transition-colors",
                                    activeTab === tab.id
                                        ? "bg-white border-t-cyan-500 text-cyan-700 shadow-sm relative top-[1px]"
                                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Chart Valid Area */}
                    <div className="flex-1 p-4 min-h-0 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            {activeTab === 'attitude' && (
                                <LineChart data={chartData.attitude}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis {...commonXAxis} />
                                    <YAxis domain={[-45, 45]} stroke="#9ca3af" fontSize={10} tickCount={7} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend verticalAlign="top" height={36} />
                                    <Line type="monotone" dataKey="roll" stroke="#0088FE" name="Roll (deg)" {...commonProps} />
                                    <Line type="monotone" dataKey="pitch" stroke="#00C49F" name="Pitch (deg)" {...commonProps} />
                                    <Line type="monotone" dataKey="yaw" stroke="#FFBB28" name="Yaw (deg)" {...commonProps} />
                                </LineChart>
                            )}
                            {activeTab === 'rc' && (
                                <LineChart data={chartData.rc}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis {...commonXAxis} />
                                    <YAxis domain={[0, 1]} stroke="#9ca3af" fontSize={10} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend verticalAlign="top" height={36} />
                                    <Line type="monotone" dataKey="throttle" stroke="#FF8042" name="Throttle" {...commonProps} />
                                    <Line type="monotone" dataKey="roll" stroke="#0088FE" name="Roll" {...commonProps} />
                                    <Line type="monotone" dataKey="pitch" stroke="#00C49F" name="Pitch" {...commonProps} />
                                    <Line type="monotone" dataKey="yaw" stroke="#FFBB28" name="Yaw" {...commonProps} />
                                </LineChart>
                            )}
                            {activeTab === 'motion' && (
                                <LineChart data={chartData.motion}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis {...commonXAxis} />
                                    <YAxis orientation="left" stroke="#8884d8" fontSize={10} label={{ value: 'Speed (m/s)', angle: -90, position: 'insideLeft' }} />
                                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" domain={[0, 1]} fontSize={10} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend verticalAlign="top" height={36} />
                                    <Line type="monotone" dataKey="groundSpeed" stroke="#8884d8" name="Ground Speed (m/s)" {...commonProps} />
                                    <Line type="monotone" yAxisId="right" dataKey="throttle" stroke="#82ca9d" name="Throttle %" {...commonProps} />
                                </LineChart>
                            )}
                            {activeTab === 'altitude' && (
                                <AreaChart data={chartData.altitude}>
                                    <defs>
                                        <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis {...commonXAxis} />
                                    <YAxis stroke="#9ca3af" fontSize={10} unit="m" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend verticalAlign="top" height={36} />
                                    <Area type="monotone" dataKey="altitude" stroke="#06b6d4" fillOpacity={1} fill="url(#colorAlt)" name="Altitude (m)" {...commonProps} />
                                </AreaChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Right Column: Logs */}
                <div className="col-span-4 flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <i className="fas fa-list text-gray-400"></i>
                            <span className="text-xs font-bold text-gray-700">SYSTEM LOGS</span>
                        </div>
                        <button className="text-gray-400 hover:text-cyan-600 transition-colors" title="Export CSV">
                            <Download size={14} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto bg-gray-50 p-0 text-xs font-mono">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-100 text-gray-500 sticky top-0 shadow-sm z-10">
                                <tr>
                                    <th className="p-2 font-semibold">TIME</th>
                                    <th className="p-2 font-semibold">UNIT</th>
                                    <th className="p-2 font-semibold">MSG</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="p-4 text-center text-gray-400 italic">No logs available</td>
                                    </tr>
                                ) : (
                                    logs.map((log, i) => (
                                        <tr key={i} className="border-b border-gray-100 hover:bg-white transition-colors">
                                            <td className="p-2 text-gray-500 whitespace-nowrap">
                                                {new Date(log.timestamp * 1000).toLocaleTimeString()}
                                            </td>
                                            <td className="p-2 font-bold text-gray-700">{log.vehicleId}</td>
                                            <td className="p-2 grid items-center gap-1">
                                                <div className="flex items-center gap-1">
                                                    {log.level === 'info' && <Info size={10} className="text-blue-500" />}
                                                    {log.level === 'warning' && <AlertTriangle size={10} className="text-amber-500" />}
                                                    {log.level === 'error' && <AlertCircle size={10} className="text-red-500" />}
                                                    {log.level === 'success' && <CheckCircle size={10} className="text-emerald-500" />}
                                                    <span className={cn(
                                                        log.level === 'error' ? "text-red-600 font-bold" :
                                                            log.level === 'warning' ? "text-amber-600 font-bold" :
                                                                "text-gray-700"
                                                    )}>
                                                        {log.message}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                                <tr ref={logsEndRef} />
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
