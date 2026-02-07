import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import AttitudeIndicator from '../components/AttitudeIndicator';
import LidarDisplay from '../components/LidarDisplay';
import clsx from 'clsx';

export default function Dashboard({ vehicles, selectedVehicleId: globalSelectedId }) {
    // State for local selections
    const [selectedAttitudeVehicle, setSelectedAttitudeVehicle] = useState('UAV1');
    const [selectedChartVehicle, setSelectedChartVehicle] = useState('UAV1');
    const [chartTimeRange, setChartTimeRange] = useState(60); // seconds
    const [chartData, setChartData] = useState([]);

    const [messages, setMessages] = useState([]);

    // Data buffering for charts
    useEffect(() => {
        const vehicle = vehicles[selectedChartVehicle];
        if (!vehicle) return;

        const now = new Date();
        const newDataPoint = {
            time: now.toLocaleTimeString(),
            timestamp: now.getTime(),
            roll: vehicle.attitude?.rollDeg || 0,
            pitch: vehicle.attitude?.pitchDeg || 0,
            speed: vehicle.motion?.groundSpeed || 0
        };

        setChartData(prev => {
            // Keep only last N seconds based on chartTimeRange
            const cutoff = now.getTime() - (chartTimeRange * 1000);
            const filtered = prev.filter(p => p.timestamp > cutoff);
            return [...filtered, newDataPoint];
        });

    }, [vehicles, selectedChartVehicle, chartTimeRange]);

    // Message polling (Mock + API)
    useEffect(() => {
        const fetchMessages = async () => {
            try {
                // Try fetching from real API if it exists, otherwise mock
                // const res = await fetch('/api/messages'); ...
                // For now, let's just keep it empty or mock if needed.
                // Assuming backend might push messages via socket in future?
                // Legacy code polled /api/messages.
            } catch (e) { }
        };
        fetchMessages();
    }, []);

    const StatusCard = ({ vehicleId, label, color }) => {
        const v = vehicles[vehicleId] || {};
        const isUAV = v.type === 'uav';

        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                    <div className="font-bold text-gray-700 flex items-center gap-2">
                        <span className={clsx("badge px-2 py-0.5 rounded text-white text-xs", color === 'blue' ? "bg-blue-600" : "bg-emerald-600")}>
                            {label}
                        </span>
                        {vehicleId}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono">20 Hz</div>
                </div>
                <div className="p-3 space-y-3">
                    {/* Status Block */}
                    <div>
                        <div className="text-xs font-bold text-gray-400 mb-1 flex items-center gap-1"><i className="fas fa-info-circle"></i> 狀態</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex flex-col bg-gray-50 p-1.5 rounded">
                                <span className="text-gray-400 text-[10px]">Arm</span>
                                <span className={clsx("font-bold", v.armed ? "text-red-500" : "text-gray-600")}>{v.armed ? "ARMED" : "DISARMED"}</span>
                            </div>
                            <div className="flex flex-col bg-gray-50 p-1.5 rounded">
                                <span className="text-gray-400 text-[10px]">Mode</span>
                                <span className="font-bold text-blue-600">{v.mode || 'UNKNOWN'}</span>
                            </div>
                            <div className="flex flex-col bg-gray-50 p-1.5 rounded col-span-2">
                                <span className="text-gray-400 text-[10px]">GPS</span>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-gray-700">{v.gps?.fix || 0}D | {v.gps?.satellites || 0} 星</span>
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map(i => <div key={i} className={clsx("w-1 h-1.5 rounded-sm", i <= (Math.min(v.gps?.satellites, 15) / 3) ? "bg-green-500" : "bg-gray-200")}></div>)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Battery Block */}
                    <div>
                        <div className="text-xs font-bold text-gray-400 mb-1 flex items-center gap-1"><i className="fas fa-battery-half"></i> 電池</div>
                        <div className="bg-gray-50 p-2 rounded">
                            <div className="flex justify-between text-xs font-bold mb-1">
                                <span>{(v.battery?.voltage || 0).toFixed(1)}V</span>
                                <span className={v.battery?.percent < 20 ? "text-red-500" : "text-green-500"}>{v.battery?.percent || 0}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div className={clsx("h-1.5 rounded-full", v.battery?.percent < 20 ? "bg-red-500" : "bg-green-500")} style={{ width: `${v.battery?.percent}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* Position Block */}
                    <div>
                        <div className="text-xs font-bold text-gray-400 mb-1 flex items-center gap-1"><i className="fas fa-map-marker-alt"></i> 位置</div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs font-mono text-gray-600 bg-gray-50 p-2 rounded">
                            <div className="flex justify-between"><span>緯度:</span> <span className="font-bold text-gray-800">{(v.position?.lat || 0).toFixed(6)}°</span></div>
                            <div className="flex justify-between"><span>經度:</span> <span className="font-bold text-gray-800">{(v.position?.lon || 0).toFixed(6)}°</span></div>
                            {isUAV && <div className="flex justify-between"><span>高度:</span> <span className="font-bold text-blue-600">{(v.position?.altitude || 0).toFixed(1)} m</span></div>}
                            <div className="flex justify-between"><span>速度:</span> <span className="font-bold text-gray-800">{(v.motion?.groundSpeed || 0).toFixed(1)} m/s</span></div>
                        </div>
                    </div>

                    <div className="text-center text-[10px] text-green-600 bg-green-50 py-0.5 rounded border border-green-100 font-bold">
                        ✓ 數據正常
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 h-full overflow-y-auto bg-gray-100">
            <div className="grid grid-cols-12 gap-4">

                {/* Column 1: Vehicle Stats (3 cols) */}
                <div className="col-span-12 md:col-span-3 flex flex-col gap-4">
                    <StatusCard vehicleId="UAV1" label="UAV" color="blue" />
                    <StatusCard vehicleId="UGV1" label="UGV" color="green" />
                </div>

                {/* Column 2: Center (Attitude, Mission, Lidar) (5 cols) */}
                <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
                    {/* Attitude Indicator */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                            <h6 className="text-xs font-bold text-gray-700 m-0"><i className="fas fa-compass"></i> 姿態指示器</h6>
                            <select
                                className="text-xs border rounded p-1 bg-white"
                                value={selectedAttitudeVehicle}
                                onChange={(e) => setSelectedAttitudeVehicle(e.target.value)}
                            >
                                <option value="UAV1">UAV1</option>
                                <option value="UGV1">UGV1</option>
                            </select>
                        </div>
                        <div className="h-64 relative bg-gray-900">
                            <AttitudeIndicator
                                roll={vehicles[selectedAttitudeVehicle]?.attitude?.rollDeg || 0}
                                pitch={vehicles[selectedAttitudeVehicle]?.attitude?.pitchDeg || 0}
                                yaw={vehicles[selectedAttitudeVehicle]?.attitude?.yawDeg || 0}
                            />
                        </div>
                        {/* Status Text Block (Consistent with Legacy) */}
                        <div className="bg-white border-t border-gray-100 p-3">
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                <div>
                                    <div className="text-gray-400 mb-1">Roll</div>
                                    <div className="font-bold text-gray-800">{(vehicles[selectedAttitudeVehicle]?.attitude?.rollDeg || 0).toFixed(1)}°</div>
                                </div>
                                <div>
                                    <div className="text-gray-400 mb-1">Pitch</div>
                                    <div className="font-bold text-gray-800">{(vehicles[selectedAttitudeVehicle]?.attitude?.pitchDeg || 0).toFixed(1)}°</div>
                                </div>
                                <div>
                                    <div className="text-gray-400 mb-1">Yaw</div>
                                    <div className="font-bold text-gray-800">{(vehicles[selectedAttitudeVehicle]?.attitude?.yawDeg || 0).toFixed(1)}°</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mission Status */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                            <h6 className="text-xs font-bold text-gray-700 m-0"><i className="fas fa-tasks"></i> 任務狀態</h6>
                        </div>
                        <div className="p-3 space-y-2">
                            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                                <span className="text-sm font-bold text-gray-600"><i className="fas fa-plane text-blue-500 w-5"></i> UAV:</span>
                                <span className={clsx("badge px-2 py-0.5 rounded text-white text-xs",
                                    vehicles['UAV1']?.mode === 'RTL' ? "bg-amber-500" : "bg-gray-400"
                                )}>
                                    {vehicles['UAV1']?.mode || 'UNKNOWN'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-600"><i className="fas fa-car text-emerald-500 w-5"></i> UGV:</span>
                                <span className="badge bg-gray-400 px-2 py-0.5 rounded text-white text-xs">
                                    {vehicles['UGV1']?.mode || 'UNKNOWN'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* LIDAR */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex-1 min-h-[250px] flex flex-col">
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                            <h6 className="text-xs font-bold text-gray-700 m-0"><i className="fas fa-radar"></i> UGV LIDAR 顯示</h6>
                        </div>
                        <div className="p-0 flex-1 bg-black relative">
                            <LidarDisplay />
                        </div>
                    </div>
                </div>

                {/* Column 3: Cameras & Messages (4 cols) */}
                <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
                    {/* Cameras */}
                    {['UAV', 'UGV'].map(type => (
                        <div key={type} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                                <h6 className="text-xs font-bold text-gray-700 m-0"><i className="fas fa-camera"></i> {type} 鏡頭畫面</h6>
                            </div>
                            <div className="aspect-video bg-black relative flex items-center justify-center group">
                                <img
                                    src={`http://172.20.10.${type === 'UAV' ? '5' : '10'}:8000/video_feed`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                    alt={`${type} Stream`}
                                />
                                <div className="absolute inset-0 bg-neutral-900 hidden flex-col items-center justify-center text-gray-500">
                                    <i className="fas fa-video-slash text-2xl mb-2"></i>
                                    <span className="text-xs">NO SIGNAL</span>
                                </div>

                                {/* Overlay */}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-[10px] text-white font-mono flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span>BAT: {vehicles[`${type}1`]?.battery?.percent || 0}%</span>
                                    <span>MODE: {vehicles[`${type}1`]?.mode || '--'}</span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Message Center */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex-1">
                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                            <h6 className="text-xs font-bold text-gray-700 m-0"><i className="fas fa-comments"></i> 訊息中心</h6>
                            <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setMessages([])}>清除</button>
                        </div>
                        <div className="h-48 overflow-y-auto p-2 space-y-2 bg-gray-50">
                            {messages.length === 0 && <div className="text-center text-xs text-gray-400 py-4">暫無訊息</div>}
                            {messages.map((msg, i) => (
                                <div key={i} className="text-xs p-2 bg-white border border-gray-100 rounded shadow-sm">
                                    <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
                                        <span>{msg.source}</span>
                                        <span>{msg.time}</span>
                                    </div>
                                    <div className="text-gray-700">{msg.text}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bottom: Charts (12 cols) */}
                <div className="col-span-12">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-4">
                                <h6 className="text-sm font-bold text-gray-700 m-0"><i className="fas fa-chart-line"></i> 性能圖表</h6>
                                <select
                                    className="text-xs border rounded p-1 bg-gray-50"
                                    value={selectedChartVehicle}
                                    onChange={e => { setSelectedChartVehicle(e.target.value); setChartData([]); }}
                                >
                                    <option value="UAV1">UAV1</option>
                                    <option value="UGV1">UGV1</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <span>時間範圍:</span>
                                <select
                                    className="border rounded p-1 bg-gray-50"
                                    value={chartTimeRange}
                                    onChange={e => setChartTimeRange(Number(e.target.value))}
                                >
                                    <option value={30}>30秒</option>
                                    <option value={60}>1分鐘</option>
                                    <option value={120}>2分鐘</option>
                                </select>
                                <span className="ml-2">更新頻率: 25 Hz</span>
                            </div>
                        </div>

                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={30} />
                                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} label={{ value: '角度 (deg)', angle: -90, position: 'insideLeft' }} />
                                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} label={{ value: '速度 (m/s)', angle: 90, position: 'insideRight' }} />
                                    <Tooltip contentStyle={{ fontSize: '12px' }} />
                                    <Legend />
                                    <Line yAxisId="left" type="monotone" dataKey="roll" stroke="#8884d8" dot={false} strokeWidth={2} isAnimationActive={false} />
                                    <Line yAxisId="left" type="monotone" dataKey="pitch" stroke="#82ca9d" dot={false} strokeWidth={2} isAnimationActive={false} />
                                    <Line yAxisId="right" type="monotone" dataKey="speed" stroke="#ff7300" dot={false} strokeWidth={2} isAnimationActive={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
