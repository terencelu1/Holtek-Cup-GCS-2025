import React, { useRef, useEffect } from 'react';

export default function AttitudeIndicator({ roll = 0, pitch = 0, yaw = 0 }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const draw = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;

            // Handle HiDPI
            const dpr = window.devicePixelRatio || 1;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;

            const centerX = width / 2;
            const centerY = height / 2;

            // Reduced radius to allow space for outer ring text
            // Text is at radius + 25. So radius Max = min(w,h)/2 - 35. 
            // Using 45 to be safe and consistent.
            const radius = Math.min(centerX, centerY) - 45;

            // Clear
            ctx.clearRect(0, 0, width, height);

            ctx.save();
            ctx.translate(centerX, centerY);

            // --- Draw Background ---
            // Sky
            ctx.fillStyle = '#87CEEB';
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();
            // Ground (initial circle, clipped later)
            ctx.fillStyle = '#8B4513';
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();

            // --- Draw Horizon ---
            ctx.save();
            ctx.rotate(roll * Math.PI / 180);
            const pitchOffset = (pitch * radius) / 90;

            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.clip();

            // Redraw Sky/Ground with correct horizon
            ctx.fillStyle = '#87CEEB';
            ctx.fillRect(-radius, -radius, radius * 2, radius + pitchOffset);
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(-radius, pitchOffset, radius * 2, radius * 2);

            // Horizon Line
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-radius, pitchOffset);
            ctx.lineTo(radius, pitchOffset);
            ctx.stroke();
            ctx.restore();

            // --- Draw Pitch Ladder ---
            ctx.save();
            ctx.rotate(roll * Math.PI / 180);
            ctx.translate(0, pitchOffset); // Move with horizon

            ctx.strokeStyle = '#FFFFFF';
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 2;

            // Re-clip to radius to hide lines outside circle
            ctx.beginPath();
            ctx.arc(0, -pitchOffset, radius, 0, Math.PI * 2); // Counter translate clip
            ctx.clip();

            for (let angle = -90; angle <= 90; angle += 10) {
                if (angle === 0) continue;
                const y = -(angle * radius) / 90;
                const lineLength = angle % 30 === 0 ? 60 : 40;

                ctx.beginPath();
                ctx.moveTo(-lineLength / 2, y);
                ctx.lineTo(lineLength / 2, y);
                ctx.stroke();

                if (angle % 30 === 0) {
                    ctx.fillText(Math.abs(angle).toString(), 0, y);
                }
            }
            ctx.restore();

            // --- Draw Roll Indicator ---
            ctx.save();
            // Roll Scale
            ctx.strokeStyle = '#FFFFFF';
            ctx.fillStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            const rollMarks = [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60];
            rollMarks.forEach(angle => {
                const rad = (angle * Math.PI) / 180;
                const innerR = radius - 15;
                const outerR = radius - (angle % 30 === 0 ? 25 : 20);

                const x1 = Math.sin(rad) * innerR;
                const y1 = -Math.cos(rad) * innerR;
                const x2 = Math.sin(rad) * outerR;
                const y2 = -Math.cos(rad) * outerR;

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            });

            // Sky Pointer (Rotates with roll)
            ctx.save();
            ctx.rotate(roll * Math.PI / 180);
            ctx.fillStyle = '#FFD700'; // Gold
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, -radius + 5);
            ctx.lineTo(-8, -radius + 20);
            ctx.lineTo(8, -radius + 20);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // Fixed Top Triangle (Reference)
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, -radius + 5);
            ctx.lineTo(-6, -radius + 15);
            ctx.lineTo(6, -radius + 15);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore(); // End Roll Indicator

            // --- Draw Vehicle Symbol (Fixed Center) ---
            ctx.strokeStyle = '#FFD700'; // Gold
            ctx.lineWidth = 3;
            // Center Dot
            ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fillStyle = '#FFD700'; ctx.fill();
            // Wings
            ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-10, 0); ctx.moveTo(10, 0); ctx.lineTo(30, 0); ctx.stroke();
            // Wing Tips (Down)
            ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-30, 8); ctx.moveTo(30, 0); ctx.lineTo(30, 8); ctx.stroke();

            // --- Draw Outer Ring & Yaw ---
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.stroke();

            // Yaw Compass (Rotates opposite to Yaw)
            ctx.save();
            ctx.rotate(-yaw * Math.PI / 180);
            ctx.fillStyle = '#666666'; // Text color
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const dirs = [
                { a: 0, t: 'N' }, { a: 90, t: 'E' }, { a: 180, t: 'S' }, { a: 270, t: 'W' }
            ];

            dirs.forEach(d => {
                const rad = (d.a * Math.PI) / 180;
                // Move text slightly further out
                const x = Math.sin(rad) * (radius + 25);
                const y = -Math.cos(rad) * (radius + 25);
                ctx.fillText(d.t, x, y);
            });
            ctx.restore();

            // Yaw Pointer (Fixed Top)
            ctx.fillStyle = '#FF6B6B';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, -radius - 25);
            ctx.lineTo(-6, -radius - 15);
            ctx.lineTo(6, -radius - 15);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.restore(); // Final restore
        };

        const renderLoop = () => {
            draw();
            animationFrameId = requestAnimationFrame(renderLoop);
        };
        renderLoop();

        const handleResize = () => draw();
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
        };
    }, [roll, pitch, yaw]);

    return (
        <div ref={containerRef} className="w-full h-full min-h-[250px] relative bg-gray-900 overflow-hidden">
            <canvas ref={canvasRef} className="block w-full h-full" />
        </div>
    );
}
