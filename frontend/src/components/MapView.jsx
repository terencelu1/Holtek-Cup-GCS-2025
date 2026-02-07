import React, { useEffect, useRef, useState } from 'react';
import Map, { Source, Layer, NavigationControl, ScaleControl, FullscreenControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

// Mapbox Token - 請在此填入您的 Mapbox API Token
const MAPBOX_TOKEN = '';

export default function MapView({ vehicles, is3D = true, onToggle3D, orbitMode = false, onToggleOrbit, onClick, cursor, waypoints: propWaypoints, missions = [] }) {
    const mapRef = useRef(null);
    const containerRef = useRef(null); // Container Ref for ResizeObserver
    const waypoints = propWaypoints || []; // Ensure waypoints is always defined locally

    const [viewState, setViewState] = useState({
        longitude: 120.224649,
        latitude: 23.024087,
        zoom: 18,
        pitch: is3D ? 45 : 0,
        bearing: 0
    });

    const orbitFrameRef = useRef(null);
    const isInteracting = useRef(false); // Track user interaction

    // ResizeObserver to fix white block issue
    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver(() => {
            if (mapRef.current) {
                mapRef.current.resize();
            }
        });

        resizeObserver.observe(containerRef.current);

        return () => {
            if (containerRef.current) resizeObserver.unobserve(containerRef.current);
            resizeObserver.disconnect();
        };
    }, []); // Empty dependency array means runs once on mount (and cleanup on unmount)

    // 當 is3D 改變時，更新視角
    useEffect(() => {
        if (mapRef.current) {
            mapRef.current.easeTo({
                pitch: is3D ? 45 : 0,
                duration: 1000
            });
        }
    }, [is3D]);

    // Orbit Animation Logic
    useEffect(() => {
        // Prepare initial position if entering orbit mode
        if (orbitMode && is3D) {
            const uav = vehicles.find(v => v.vehicleId === 'UAV1');
            if (uav) {
                // Only snap if we just started orbit? 
                // For now, let's just animate bearing, no snap. 
                // User wants to ZOOM, so we shouldn't force zoom/pos constantly.
            }

            const animate = () => {
                // Only Update if NOT interacting
                if (!isInteracting.current) {
                    setViewState(prev => ({
                        ...prev,
                        bearing: (prev.bearing + 0.2) % 360
                    }));
                }
                orbitFrameRef.current = requestAnimationFrame(animate);
            };
            orbitFrameRef.current = requestAnimationFrame(animate);
        } else {
            // Clean up immediately when mode changes
            if (orbitFrameRef.current) {
                cancelAnimationFrame(orbitFrameRef.current);
                orbitFrameRef.current = null;
            }
        }
        return () => {
            if (orbitFrameRef.current) cancelAnimationFrame(orbitFrameRef.current);
        };
    }, [orbitMode, is3D]); // Removed `vehicles` dependency to prevent resetting position on every telemetry update

    // Interaction Handlers (Refined)
    const onMoveStart = (evt) => {
        // If triggered by user (mouse/touch/wheel), pause orbit
        if (evt.originalEvent) {
            isInteracting.current = true;
        }
    };

    const onMoveEnd = (evt) => {
        // Resume on end
        if (evt.originalEvent) {
            isInteracting.current = false;
        }
    };

    // Fallback: Wheel event on container to catch zoom start aggressively
    const onContainerWheel = () => {
        isInteracting.current = true;
        // Reset after a short delay if no moveEnd fires? 
        // onMoveEnd should fire.
    };

    // 生成 Waypoint GeoJSON
    const waypointGeoJSON = {
        type: 'FeatureCollection',
        features: waypoints.map((wp) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [wp.lon, wp.lat] },
            properties: { order: wp.order }
        }))
    };

    // 生成 Wayback Line GeoJSON
    const waypointLineGeoJSON = {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: [...waypoints].sort((a, b) => a.order - b.order).map(wp => [wp.lon, wp.lat])
        }
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-full rounded-xl overflow-hidden shadow-lg border border-ui-panel-border relative"
            style={{ cursor: cursor || 'grab' }}
            onWheel={onContainerWheel} // Capture wheel to pause orbit immediately
        >
            <Map
                {...viewState}
                onMove={evt => setViewState(evt.viewState)}
                onMoveStart={onMoveStart}
                onMoveEnd={onMoveEnd}
                onClick={onClick}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/light-v11"
                mapboxAccessToken={MAPBOX_TOKEN}
                ref={mapRef}
                terrain={is3D ? { source: 'mapbox-dem', exaggeration: 1.5 } : undefined}
            >
                <Source
                    id="mapbox-dem"
                    type="raster-dem"
                    url="mapbox://mapbox.mapbox-terrain-dem-v1"
                    tileSize={512}
                    maxzoom={14}
                />

                {/* 3D 建築物 */}
                <Layer
                    id="3d-buildings"
                    source="composite"
                    source-layer="building"
                    filter={['==', 'extrude', 'true']}
                    type="fill-extrusion"
                    minzoom={15}
                    paint={{
                        'fill-extrusion-color': '#aaa',
                        'fill-extrusion-height': [
                            'interpolate',
                            ['linear'], ['zoom'],
                            15, 0,
                            15.05, ['get', 'height']
                        ],
                        'fill-extrusion-base': [
                            'interpolate',
                            ['linear'], ['zoom'],
                            15, 0,
                            15.05, ['get', 'min_height']
                        ],
                        'fill-extrusion-opacity': 0.6
                    }}
                />

                {/* Waypoint Markers */}
                <Source id="waypoints-data" type="geojson" data={waypointGeoJSON}>
                    <Layer
                        id="waypoint-circles"
                        type="circle"
                        paint={{
                            'circle-radius': 8,
                            'circle-color': '#0ea5e9', // Sky blue
                            'circle-stroke-width': 2,
                            'circle-stroke-color': '#fff'
                        }}
                    />
                    <Layer
                        id="waypoint-labels"
                        type="symbol"
                        layout={{
                            'text-field': ['get', 'order'],
                            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                            'text-size': 10
                        }}
                        paint={{ 'text-color': '#fff' }}
                    />
                </Source>

                {/* Waypoint Line */}
                <Source id="waypoints-line" type="geojson" data={waypointLineGeoJSON}>
                    <Layer
                        id="waypoint-path"
                        type="line"
                        paint={{
                            'line-color': '#0ea5e9', // Sky blue
                            'line-width': 2,
                            'line-dasharray': [2, 1]
                        }}
                    />
                </Source>

                {/* 載具簡單標記 */}
                {vehicles.map(v => (
                    <Source key={v.vehicleId} id={`vehicle-${v.vehicleId}`} type="geojson" data={{
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [v.position.lon, v.position.lat] }
                    }}>
                        <Layer
                            id={`vehicle-dot-${v.vehicleId}`}
                            type="circle"
                            paint={{
                                'circle-radius': 6,
                                'circle-color': v.type === 'uav' ? '#06b6d4' : '#f97316',
                                'circle-stroke-width': 1,
                                'circle-stroke-color': '#fff'
                            }}
                        />
                    </Source>
                ))}

                <NavigationControl position="top-right" />
                <FullscreenControl position="top-right" />
                <ScaleControl />
            </Map>

            {/* Custom Map Controls Overlay - Unified Capsule */}
            <div className="absolute top-4 right-12 z-10 flex items-center gap-2">
                <div className="bg-white/90 backdrop-blur rounded-lg shadow-sm border border-ui-panel-border p-1 flex items-center">
                    <button
                        onClick={() => {
                            if (onToggle3D) onToggle3D(false);
                            if (onToggleOrbit) onToggleOrbit(false);
                            if (mapRef.current) mapRef.current.easeTo({ pitch: 0, duration: 1000 });
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${!is3D ? 'bg-white text-cyan-600 shadow-sm ring-1 ring-gray-100' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        2D
                    </button>
                    <button
                        onClick={() => {
                            if (onToggle3D) onToggle3D(true);
                            if (onToggleOrbit) onToggleOrbit(false); // Fix: Explicitly disable Orbit when clicking 3D
                            if (mapRef.current) mapRef.current.easeTo({ pitch: 60, duration: 1000 });
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${is3D && !orbitMode ? 'bg-cyan-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        3D
                    </button>
                    {is3D && (
                        <button
                            onClick={() => { if (onToggleOrbit) onToggleOrbit(!orbitMode); }}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${orbitMode ? 'bg-amber-500 text-white shadow-md animate-pulse' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            <i className="fas fa-cube text-[10px]"></i> SURROUND
                        </button>
                    )}
                </div>

                <button
                    onClick={() => {
                        const uav = vehicles.find(v => v.vehicleId === 'UAV1');
                        if (uav && mapRef.current) {
                            mapRef.current.flyTo({
                                center: [uav.position.lon, uav.position.lat],
                                zoom: 19,
                                pitch: is3D ? 60 : 0
                            });
                        }
                    }}
                    className="w-9 h-9 bg-white/90 backdrop-blur rounded-lg shadow-sm border border-ui-panel-border flex items-center justify-center text-gray-500 hover:text-cyan-600 hover:bg-white transition-all transform hover:scale-105 active:scale-95"
                    title="Recenter on UAV"
                >
                    <i className="fas fa-crosshairs"></i>
                </button>
            </div>
        </div>
    );
}
