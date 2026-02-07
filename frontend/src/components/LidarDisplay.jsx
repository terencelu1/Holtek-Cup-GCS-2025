import React, { useEffect, useRef, useState } from 'react';

export default function LidarDisplay() {
    const canvasRef = useRef(null);
    const [stats, setStats] = useState({ count: 0, min: 0, max: 0 });
    const [connected, setConnected] = useState(false);

    // Lidar settings matches legacy overview.js
    const WS_URL = 'ws://172.20.10.10:8765';
    const SCALE = 15; // px/m

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let ws = null;
        let animationFrameId;

        const connect = () => {
            console.log('[LIDAR] Connecting to', WS_URL);
            ws = new WebSocket(WS_URL);

            ws.onopen = () => setConnected(true);
            ws.onclose = () => {
                setConnected(false);
                setTimeout(connect, 5000);
            };
            ws.onerror = (e) => console.error('[LIDAR] Error:', e);
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type !== 'status' && data.type !== 'error') {
                        drawLidar(data);
                    }
                } catch (e) {
                    // console.error(e);
                }
            };
        };

        const drawLidar = (data) => {
            if (!ctx || !canvas) return;

            // Clear
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Grid
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;

            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 1;

            // Concentric circles (1m, 2m, 3m...)
            for (let r = 1; r <= 10; r++) {
                ctx.beginPath();
                ctx.arc(cx, cy, r * SCALE, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Axes
            ctx.beginPath();
            ctx.moveTo(0, cy);
            ctx.lineTo(canvas.width, cy);
            ctx.moveTo(cx, 0);
            ctx.lineTo(cx, canvas.height);
            ctx.stroke();

            // Points
            const ranges = data.ranges || data.data || [];
            const angleMin = data.angle_min || data.angleMin || 0;
            const angleInc = data.angle_increment || data.angleIncrement || 0;
            const rangeMax = data.range_max || data.rangeMax || 16.0;

            let validPoints = 0;
            let minDist = Infinity;
            let maxDist = 0;

            ctx.fillStyle = '#00ff00';

            ranges.forEach((range, i) => {
                if (!isFinite(range) || range <= 0 || range > rangeMax) return;

                validPoints++;
                if (range < minDist) minDist = range;
                if (range > maxDist) maxDist = range;

                const angle = angleMin + i * angleInc;
                // Transform polar to cartesian (Legacy: flipY=true, rotationOffset=0)
                // x = r * cos(theta), y = r * sin(theta)
                // Screen coords: x screen = cx + x, y screen = cy - y (flipY)

                const x = range * Math.cos(angle);
                const y = range * Math.sin(angle);

                const sx = cx + x * SCALE;
                const sy = cy - y * SCALE; // Flip Y for screen coords

                ctx.fillRect(sx, sy, 2, 2);
            });

            if (minDist === Infinity) minDist = 0;

            setStats({
                count: validPoints,
                min: minDist,
                max: maxDist
            });
        };

        connect();

        const handleResize = () => {
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight;
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial size

        return () => {
            if (ws) ws.close();
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="flex flex-col h-full bg-black rounded-lg overflow-hidden border border-gray-800">
            <div className="bg-gray-900 px-3 py-2 flex justify-between items-center border-b border-gray-800">
                <span className="text-xs font-bold text-gray-400 uppercase flex items-center gap-2">
                    <i className="fas fa-radar text-neon-green"></i> UGV LIDAR
                </span>
                <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${connected ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                    {connected ? 'CONNECTED' : 'DISCONNECTED'}
                </div>
            </div>
            <div className="flex-1 relative min-h-[200px]">
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

                <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px] font-mono text-gray-500 bg-black/50 p-1 rounded backdrop-blur-sm">
                    <div>PTS: <span className="text-white">{stats.count}</span></div>
                    <div>MIN: <span className="text-white">{stats.min.toFixed(2)}m</span></div>
                    <div>MAX: <span className="text-white">{stats.max.toFixed(2)}m</span></div>
                </div>
            </div>
        </div>
    );
}
