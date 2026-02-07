// 3D Map Test with MapLibre GL JS + Waypoint Management

class Map3DTest {
    constructor() {
        this.map = null;
        this.vehicleMarkers = {};
        this.vehicleData = {};
        this.isFollowingUAV = false;
        this.waypoints = [];
        this.waypointMarkers = [];
        this.routeSource = null;
        this.isAddingWaypoint = false;
        this.missions = [];
        this.missionPreview = null;
        this.init();
    }

    init() {
        this.initMap();
        this.initControls();
        this.startDataUpdate();
    }

    initMap() {
        // 初始化 MapLibre GL 地圖
        this.map = new maplibregl.Map({
            container: 'map',
            style: {
                'version': 8,
                'sources': {
                    'osm': {
                        'type': 'raster',
                        'tiles': [
                            'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'
                        ],
                        'tileSize': 256,
                        'attribution': '© OpenStreetMap'
                    }
                },
                'layers': [{
                    'id': 'osm',
                    'type': 'raster',
                    'source': 'osm',
                    'minzoom': 0,
                    'maxzoom': 22
                }]
            },
            center: [120.224492, 23.024031],
            zoom: 18,
            pitch: 60,
            bearing: 0,
            antialias: true
        });

        // 添加導航控制
        this.map.addControl(new maplibregl.NavigationControl({
            visualizePitch: true
        }), 'bottom-right');

        // 地圖載入完成
        this.map.on('load', () => {
            this.initVehicleMarkers();
            this.addHomePoint();
            this.initRouteLayer();
        });

        // 監聽地圖移動
        this.map.on('move', () => {
            if (!this.isUpdatingFromSlider) {
                this.updateSlidersFromMap();
            }
        });

        // 監聽地圖點擊（添加航點）
        this.map.on('click', (e) => {
            if (this.isAddingWaypoint) {
                this.addWaypoint(e.lngLat);
            }
        });

        // 更改游標樣式
        this.map.on('mouseenter', () => {
            if (this.isAddingWaypoint) {
                this.map.getCanvas().style.cursor = 'crosshair';
            }
        });
    }

    initRouteLayer() {
        // 添加路線圖層
        this.map.addSource('route', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': []
                }
            }
        });

        this.map.addLayer({
            'id': 'route',
            'type': 'line',
            'source': 'route',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#007bff',
                'line-width': 3,
                'line-dasharray': [2, 2]
            }
        });
    }

    addWaypoint(lngLat) {
        const altitude = parseFloat(document.getElementById('waypointAltitude').value) || 50;
        const vehicle = document.getElementById('waypointVehicleSelect').value;
        
        const waypoint = {
            id: Date.now(),
            lat: lngLat.lat,
            lon: lngLat.lng,
            altitude: altitude,
            vehicle: vehicle,
            order: this.waypoints.length + 1
        };

        this.waypoints.push(waypoint);

        // 創建航點標記
        const markerEl = document.createElement('div');
        markerEl.innerHTML = `
            <div style="background: #007bff; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,123,255,0.4);">
                ${waypoint.order}
            </div>
        `;

        const marker = new maplibregl.Marker({ element: markerEl })
            .setLngLat([waypoint.lon, waypoint.lat])
            .setPopup(new maplibregl.Popup().setHTML(`
                <b>航點 ${waypoint.order}</b><br>
                經度: ${waypoint.lon.toFixed(6)}<br>
                緯度: ${waypoint.lat.toFixed(6)}<br>
                高度: ${waypoint.altitude}m<br>
                載具: ${waypoint.vehicle}
            `))
            .addTo(this.map);

        this.waypointMarkers.push(marker);

        // 更新UI
        this.updateWaypointList();
        this.updateRoute();

        // 停止添加模式
        this.isAddingWaypoint = false;
        this.map.getCanvas().style.cursor = '';
        const btn = document.getElementById('addWaypointBtn');
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-primary');
        btn.innerHTML = '<i class="fas fa-plus"></i> 點擊地圖新增航點';
    }

    removeWaypoint(id) {
        const index = this.waypoints.findIndex(wp => wp.id === id);
        if (index !== -1) {
            // 移除標記
            this.waypointMarkers[index].remove();
            this.waypointMarkers.splice(index, 1);
            
            // 移除航點
            this.waypoints.splice(index, 1);

            // 重新排序
            this.waypoints.forEach((wp, i) => {
                wp.order = i + 1;
            });

            // 重新創建所有標記（更新序號）
            this.waypointMarkers.forEach(marker => marker.remove());
            this.waypointMarkers = [];

            this.waypoints.forEach(wp => {
                const markerEl = document.createElement('div');
                markerEl.innerHTML = `
                    <div style="background: #007bff; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,123,255,0.4);">
                        ${wp.order}
                    </div>
                `;

                const marker = new maplibregl.Marker({ element: markerEl })
                    .setLngLat([wp.lon, wp.lat])
                    .setPopup(new maplibregl.Popup().setHTML(`
                        <b>航點 ${wp.order}</b><br>
                        經度: ${wp.lon.toFixed(6)}<br>
                        緯度: ${wp.lat.toFixed(6)}<br>
                        高度: ${wp.altitude}m<br>
                        載具: ${wp.vehicle}
                    `))
                    .addTo(this.map);

                this.waypointMarkers.push(marker);
            });

            this.updateWaypointList();
            this.updateRoute();
        }
    }

    clearWaypoints() {
        this.waypointMarkers.forEach(marker => marker.remove());
        this.waypointMarkers = [];
        this.waypoints = [];
        this.updateWaypointList();
        this.updateRoute();
    }

    updateWaypointList() {
        const listEl = document.getElementById('waypointList');
        const countEl = document.getElementById('waypointCount');
        
        countEl.textContent = this.waypoints.length;

        if (this.waypoints.length === 0) {
            listEl.innerHTML = `
                <div class="text-center text-muted small py-3">
                    點擊「新增航點」後，再點擊地圖上的位置
                </div>
            `;
            document.getElementById('executeWaypointsBtn').disabled = true;
            document.getElementById('previewRouteBtn').disabled = true;
            return;
        }

        document.getElementById('executeWaypointsBtn').disabled = false;
        document.getElementById('previewRouteBtn').disabled = false;

        listEl.innerHTML = this.waypoints.map(wp => `
            <div class="waypoint-item">
                <div class="waypoint-header">
                    <span class="waypoint-title">
                        <i class="fas fa-map-pin"></i> 航點 ${wp.order}
                    </span>
                    <div class="waypoint-actions">
                        <button class="btn btn-xs btn-outline-primary" onclick="map3DTest.flyToWaypoint(${wp.id})">
                            <i class="fas fa-crosshairs"></i>
                        </button>
                        <button class="btn btn-xs btn-outline-danger" onclick="map3DTest.removeWaypoint(${wp.id})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div class="waypoint-info">
                    <span><i class="fas fa-map-marker-alt"></i> ${wp.lat.toFixed(5)}, ${wp.lon.toFixed(5)}</span>
                    <span><i class="fas fa-arrow-up"></i> ${wp.altitude}m</span>
                    <span><i class="fas fa-${wp.vehicle === 'UAV1' ? 'plane' : 'robot'}"></i> ${wp.vehicle}</span>
                </div>
            </div>
        `).join('');
    }

    updateRoute() {
        if (this.waypoints.length === 0) {
            this.map.getSource('route').setData({
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': []
                }
            });
            return;
        }

        const coordinates = this.waypoints.map(wp => [wp.lon, wp.lat]);

        this.map.getSource('route').setData({
            'type': 'Feature',
            'properties': {},
            'geometry': {
                'type': 'LineString',
                'coordinates': coordinates
            }
        });
    }

    flyToWaypoint(id) {
        const waypoint = this.waypoints.find(wp => wp.id === id);
        if (waypoint) {
            this.map.flyTo({
                center: [waypoint.lon, waypoint.lat],
                zoom: 19,
                duration: 1500
            });
        }
    }

    previewRoute() {
        if (this.waypoints.length < 2) {
            alert('至少需要 2 個航點才能預覽路線');
            return;
        }

        // 飛到第一個航點
        const firstWp = this.waypoints[0];
        this.map.flyTo({
            center: [firstWp.lon, firstWp.lat],
            zoom: 18,
            pitch: 60,
            bearing: 0,
            duration: 2000
        });

        // 高亮路線
        this.map.setPaintProperty('route', 'line-color', '#ffc107');
        this.map.setPaintProperty('route', 'line-width', 4);

        setTimeout(() => {
            this.map.setPaintProperty('route', 'line-color', '#007bff');
            this.map.setPaintProperty('route', 'line-width', 3);
        }, 3000);
    }

    executeWaypoints() {
        if (this.waypoints.length === 0) {
            alert('請先添加航點');
            return;
        }

        const vehicle = this.waypoints[0].vehicle;
        
        if (confirm(`確定要將 ${this.waypoints.length} 個航點發送給 ${vehicle} 嗎？`)) {
            console.log('執行航點任務:', this.waypoints);
            alert(`已將 ${this.waypoints.length} 個航點發送給 ${vehicle}`);
            
            // 創建任務
            const mission = {
                id: Date.now(),
                vehicle: vehicle,
                type: 'waypoint',
                typeName: '航點任務',
                status: 'running',
                startTime: new Date().toLocaleString(),
                waypoints: [...this.waypoints]
            };
            
            this.missions.push(mission);
            this.updateMissionList();
            
            // 這裡可以調用 API 發送航點到後端
            // fetch('/api/waypoints', { method: 'POST', body: JSON.stringify(this.waypoints) })
        }
    }

    startMission() {
        const vehicle = document.getElementById('missionVehicleSelect').value;
        const missionType = document.getElementById('missionTypeSelect').value;
        const missionTypeText = document.getElementById('missionTypeSelect').selectedOptions[0].text;
        
        // 創建任務
        const mission = {
            id: Date.now(),
            vehicle: vehicle,
            type: missionType,
            typeName: missionTypeText,
            status: 'running',
            startTime: new Date().toLocaleString()
        };
        
        this.missions.push(mission);
        this.updateMissionList();
        this.showMissionPreview(mission);
        
        console.log('開始任務:', mission);
        alert(`已開始任務: ${missionTypeText}\n載具: ${vehicle}`);
    }

    showMissionPreview(mission) {
        // 根據任務類型顯示預覽路徑
        const vehiclePos = this.vehicleMarkers[mission.vehicle].getLngLat();
        
        switch(mission.type) {
            case 'rtl':
                // Return to Home - 顯示回家路徑
                this.drawMissionPath([
                    [vehiclePos.lng, vehiclePos.lat],
                    [120.224447, 23.024221] // Home Point
                ], '#ffc107');
                break;
                
            case 'follow_ugv':
            case 'follow_uav':
                // Follow - 顯示跟隨指示
                const targetVehicle = mission.type === 'follow_ugv' ? 'UGV1' : 'UAV1';
                const targetPos = this.vehicleMarkers[targetVehicle].getLngLat();
                this.drawMissionPath([
                    [vehiclePos.lng, vehiclePos.lat],
                    [targetPos.lng, targetPos.lat]
                ], '#17a2b8');
                break;
                
            case 'charge_station':
                // Charge Station - 顯示到充電站路徑
                this.drawMissionPath([
                    [vehiclePos.lng, vehiclePos.lat],
                    [120.224300, 23.024000] // 假設充電站位置
                ], '#28a745');
                break;
        }
        
        // 3秒後清除預覽
        setTimeout(() => {
            this.clearMissionPath();
        }, 3000);
    }

    drawMissionPath(coordinates, color) {
        if (this.map.getSource('mission-preview')) {
            this.map.removeLayer('mission-preview');
            this.map.removeSource('mission-preview');
        }
        
        this.map.addSource('mission-preview', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': coordinates
                }
            }
        });
        
        this.map.addLayer({
            'id': 'mission-preview',
            'type': 'line',
            'source': 'mission-preview',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': color,
                'line-width': 4,
                'line-dasharray': [1, 2]
            }
        });
    }

    clearMissionPath() {
        if (this.map.getSource('mission-preview')) {
            this.map.removeLayer('mission-preview');
            this.map.removeSource('mission-preview');
        }
    }

    stopMission(id) {
        const index = this.missions.findIndex(m => m.id === id);
        if (index !== -1) {
            this.missions[index].status = 'completed';
            this.updateMissionList();
        }
    }

    cancelMission(id) {
        const index = this.missions.findIndex(m => m.id === id);
        if (index !== -1) {
            if (confirm('確定要取消此任務嗎？')) {
                this.missions.splice(index, 1);
                this.updateMissionList();
            }
        }
    }

    updateMissionList() {
        const listEl = document.getElementById('missionList');
        const countEl = document.getElementById('missionCount');
        
        const runningMissions = this.missions.filter(m => m.status === 'running');
        countEl.textContent = runningMissions.length;
        
        if (this.missions.length === 0) {
            listEl.innerHTML = `
                <div class="text-center text-muted small py-2">
                    無進行中的任務
                </div>
            `;
            return;
        }
        
        listEl.innerHTML = this.missions.map(mission => `
            <div class="mission-item">
                <div class="mission-header">
                    <span class="mission-title">
                        <i class="fas fa-${mission.vehicle === 'UAV1' ? 'plane' : 'robot'}"></i>
                        ${mission.typeName}
                    </span>
                    <span class="mission-status ${mission.status}">
                        ${mission.status === 'running' ? '執行中' : '已完成'}
                    </span>
                </div>
                <div class="mission-info">
                    <div>載具: ${mission.vehicle}</div>
                    <div>開始時間: ${mission.startTime}</div>
                    ${mission.waypoints ? `<div>航點數: ${mission.waypoints.length}</div>` : ''}
                </div>
                ${mission.status === 'running' ? `
                    <div class="mission-actions">
                        <button class="btn btn-xs btn-outline-warning" onclick="map3DTest.stopMission(${mission.id})">
                            <i class="fas fa-stop"></i> 停止
                        </button>
                        <button class="btn btn-xs btn-outline-danger" onclick="map3DTest.cancelMission(${mission.id})">
                            <i class="fas fa-times"></i> 取消
                        </button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    addHomePoint() {
        const homeEl = document.createElement('div');
        homeEl.innerHTML = `
            <div style="background: rgba(255,165,0,0.9); width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(255,165,0,0.5);">
                <i class="fas fa-home" style="color: white; font-size: 16px;"></i>
            </div>
        `;
        
        new maplibregl.Marker({ element: homeEl })
            .setLngLat([120.224447, 23.024221])
            .setPopup(new maplibregl.Popup().setHTML('<b>Home Point</b><br>起始點'))
            .addTo(this.map);
    }

    initVehicleMarkers() {
        this.vehicleData.UAV1 = { altitude: 50 };
        this.vehicleData.UGV1 = { altitude: 0 };

        const uavEl = this.createUAVMarker(50);
        this.vehicleMarkers.UAV1 = new maplibregl.Marker({
            element: uavEl,
            anchor: 'bottom'
        })
            .setLngLat([120.224649, 23.024087])
            .addTo(this.map);

        const ugvEl = this.createUGVMarker();
        this.vehicleMarkers.UGV1 = new maplibregl.Marker({
            element: ugvEl,
            anchor: 'bottom'
        })
            .setLngLat([120.224334, 23.023975])
            .addTo(this.map);
    }

    createUAVMarker(altitude) {
        const el = document.createElement('div');
        el.className = 'uav-3d-marker';
        
        const shadowSize = Math.max(20, 60 - altitude * 0.5);
        const shadowBlur = Math.max(2, altitude * 0.1);
        const shadowOpacity = Math.max(0.1, 1 - altitude * 0.01);
        
        el.innerHTML = `
            <div class="uav-altitude">${altitude.toFixed(1)}m</div>
            <div class="uav-body">
                <i class="fas fa-plane uav-icon"></i>
            </div>
            <div class="uav-shadow" style="width: ${shadowSize}px; filter: blur(${shadowBlur}px); opacity: ${shadowOpacity};"></div>
            <div class="uav-label">UAV1</div>
        `;
        
        return el;
    }

    createUGVMarker() {
        const el = document.createElement('div');
        el.className = 'ugv-3d-marker';
        el.innerHTML = `
            <div class="ugv-body">
                <i class="fas fa-robot ugv-icon"></i>
            </div>
            <div class="ugv-label">UGV1</div>
        `;
        return el;
    }

    updateUAVMarker(altitude) {
        if (this.vehicleMarkers.UAV1 && this.vehicleData.UAV1) {
            this.vehicleData.UAV1.altitude = altitude;
            
            const newEl = this.createUAVMarker(altitude);
            const lngLat = this.vehicleMarkers.UAV1.getLngLat();
            
            this.vehicleMarkers.UAV1.remove();
            this.vehicleMarkers.UAV1 = new maplibregl.Marker({
                element: newEl,
                anchor: 'bottom'
            })
                .setLngLat(lngLat)
                .addTo(this.map);
        }
    }

    initControls() {
        // 傾斜角度滑桿
        const pitchSlider = document.getElementById('pitchSlider');
        const pitchValue = document.getElementById('pitchValue');
        pitchSlider.addEventListener('input', (e) => {
            const pitch = parseInt(e.target.value);
            pitchValue.textContent = pitch + '°';
            this.isUpdatingFromSlider = true;
            this.map.setPitch(pitch);
            setTimeout(() => { this.isUpdatingFromSlider = false; }, 100);
        });

        // 旋轉角度滑桿
        const bearingSlider = document.getElementById('bearingSlider');
        const bearingValue = document.getElementById('bearingValue');
        bearingSlider.addEventListener('input', (e) => {
            const bearing = parseInt(e.target.value);
            bearingValue.textContent = bearing + '°';
            this.isUpdatingFromSlider = true;
            this.map.setBearing(bearing);
            setTimeout(() => { this.isUpdatingFromSlider = false; }, 100);
        });

        // 縮放滑桿
        const zoomSlider = document.getElementById('zoomSlider');
        const zoomValue = document.getElementById('zoomValue');
        zoomSlider.addEventListener('input', (e) => {
            const zoom = parseFloat(e.target.value);
            zoomValue.textContent = zoom.toFixed(1);
            this.isUpdatingFromSlider = true;
            this.map.setZoom(zoom);
            setTimeout(() => { this.isUpdatingFromSlider = false; }, 100);
        });

        // 添加航點按鈕
        document.getElementById('addWaypointBtn').addEventListener('click', () => {
            this.isAddingWaypoint = !this.isAddingWaypoint;
            const btn = document.getElementById('addWaypointBtn');
            if (this.isAddingWaypoint) {
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-warning');
                btn.innerHTML = '<i class="fas fa-hand-pointer"></i> 點擊地圖選擇位置...';
                this.map.getCanvas().style.cursor = 'crosshair';
            } else {
                btn.classList.remove('btn-warning');
                btn.classList.add('btn-primary');
                btn.innerHTML = '<i class="fas fa-plus"></i> 點擊地圖新增航點';
                this.map.getCanvas().style.cursor = '';
            }
        });

        // 清除所有航點
        document.getElementById('clearWaypointsBtn').addEventListener('click', () => {
            if (this.waypoints.length > 0 && confirm('確定要清除所有航點嗎？')) {
                this.clearWaypoints();
            }
        });

        // 執行航點任務
        document.getElementById('executeWaypointsBtn').addEventListener('click', () => {
            this.executeWaypoints();
        });

        // 預覽路線
        document.getElementById('previewRouteBtn').addEventListener('click', () => {
            this.previewRoute();
        });

        // 開始任務
        document.getElementById('startMissionBtn').addEventListener('click', () => {
            this.startMission();
        });

        // 重置視角
        document.getElementById('resetViewBtn').addEventListener('click', () => {
            this.map.flyTo({
                center: [120.224492, 23.024031],
                zoom: 18,
                pitch: 60,
                bearing: 0,
                duration: 2000
            });
        });

        // 跟隨 UAV
        document.getElementById('followUAVBtn').addEventListener('click', () => {
            this.isFollowingUAV = !this.isFollowingUAV;
            const btn = document.getElementById('followUAVBtn');
            if (this.isFollowingUAV) {
                btn.classList.remove('btn-success');
                btn.classList.add('btn-warning');
                btn.innerHTML = '<i class="fas fa-plane"></i> 停止跟隨';
            } else {
                btn.classList.remove('btn-warning');
                btn.classList.add('btn-success');
                btn.innerHTML = '<i class="fas fa-plane"></i> 跟隨 UAV';
            }
        });

        // 地圖樣式切換
        document.getElementById('mapStyleSelect').addEventListener('change', (e) => {
            const style = e.target.value;
            let styleConfig;
            
            switch(style) {
                case 'osm':
                    styleConfig = {
                        'version': 8,
                        'sources': {
                            'osm': {
                                'type': 'raster',
                                'tiles': ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                                'tileSize': 256
                            }
                        },
                        'layers': [{
                            'id': 'osm',
                            'type': 'raster',
                            'source': 'osm'
                        }]
                    };
                    break;
                case 'satellite':
                    styleConfig = {
                        'version': 8,
                        'sources': {
                            'satellite': {
                                'type': 'raster',
                                'tiles': ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                                'tileSize': 256
                            }
                        },
                        'layers': [{
                            'id': 'satellite',
                            'type': 'raster',
                            'source': 'satellite'
                        }]
                    };
                    break;
                case 'dark':
                    styleConfig = {
                        'version': 8,
                        'sources': {
                            'dark': {
                                'type': 'raster',
                                'tiles': ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
                                'tileSize': 256
                            }
                        },
                        'layers': [{
                            'id': 'dark',
                            'type': 'raster',
                            'source': 'dark'
                        }]
                    };
                    break;
            }
            
            this.map.setStyle(styleConfig);
            
            // 重新添加路線圖層
            setTimeout(() => {
                this.initRouteLayer();
                this.updateRoute();
            }, 500);
        });

        // 其他控制
        document.getElementById('clearTrailsBtn').addEventListener('click', () => {
            console.log('清除軌跡');
        });

        document.getElementById('centerMapBtn').addEventListener('click', () => {
            this.map.flyTo({
                center: [120.224492, 23.024031],
                zoom: 18,
                duration: 1000
            });
        });
    }

    updateSlidersFromMap() {
        const pitch = Math.round(this.map.getPitch());
        const bearing = Math.round(this.map.getBearing());
        const zoom = this.map.getZoom().toFixed(1);

        document.getElementById('pitchSlider').value = pitch;
        document.getElementById('pitchValue').textContent = pitch + '°';

        document.getElementById('bearingSlider').value = bearing;
        document.getElementById('bearingValue').textContent = bearing + '°';

        document.getElementById('zoomSlider').value = zoom;
        document.getElementById('zoomValue').textContent = zoom;
    }

    startDataUpdate() {
        setInterval(() => {
            this.updateVehiclePositions();
        }, 1000);
    }

    async updateVehiclePositions() {
        try {
            const response = await fetch('/api/vehicles');
            const data = await response.json();

            if (data.UAV1 && this.vehicleMarkers.UAV1) {
                const pos = data.UAV1.position;
                const altitude = pos.altitude || 50;
                
                this.vehicleMarkers.UAV1.setLngLat([pos.lon, pos.lat]);
                
                if (Math.abs(altitude - this.vehicleData.UAV1.altitude) > 0.5) {
                    this.updateUAVMarker(altitude);
                }

                if (this.isFollowingUAV) {
                    this.map.easeTo({
                        center: [pos.lon, pos.lat],
                        duration: 1000
                    });
                }
            }

            if (data.UGV1 && this.vehicleMarkers.UGV1) {
                const pos = data.UGV1.position;
                this.vehicleMarkers.UGV1.setLngLat([pos.lon, pos.lat]);
            }
        } catch (error) {
            console.error('更新載具位置失敗:', error);
        }
    }
}

// 初始化（全局變數，供HTML onclick使用）
let map3DTest;
document.addEventListener('DOMContentLoaded', () => {
    map3DTest = new Map3DTest();
});
