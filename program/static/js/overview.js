// Overview Page Main JavaScript
class OverviewPage {
    constructor() {
        this.vehicles = [];
        this.vehicleStates = {};
        this.updateInterval = null;
        this.attitudeIndicator = null;
        this.chartManager = null;
        this.currentVehicle = 'UAV1';
        this.streamRefreshInterval = null; // MJPEG 串流刷新間隔
        
        this.init();
    }
    
    init() {
        // 初始化組件
        this.initAttitudeIndicator();
        this.initChartManager();
        this.initTimeDisplay();
        this.initEventListeners();
        
        // 載入初始數據
        this.loadVehicles();
        this.startDataUpdates();
        
        // 初始化相機顯示（延遲一點確保 DOM 已準備好）
        setTimeout(() => {
            this.updateCameraDisplay();
        }, 500);
        
        console.log('Overview page initialized');
    }
    
    initAttitudeIndicator() {
        if (document.getElementById('attitudeCanvas')) {
            this.attitudeIndicator = new AttitudeIndicator('attitudeCanvas');
        }
    }
    
    initChartManager() {
        this.chartManager = new ChartManager();
    }
    
    initTimeDisplay() {
        // 更新時間顯示（使用合理的固定值）
        const updateTime = () => {
            const now = new Date();
            // 使用當前時間，但可以調整為固定值
            const timeStr = now.toLocaleTimeString('zh-TW', { 
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            const dateStr = now.toLocaleDateString('zh-TW', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            
            const timeEl = document.getElementById('currentTime');
            const dateEl = document.getElementById('currentDate');
            
            if (timeEl) timeEl.textContent = timeStr;
            if (dateEl) dateEl.textContent = dateStr;
        };
        
        // 立即更新一次
        updateTime();
        
        // 每秒更新
        setInterval(updateTime, 1000);
    }
    
    initEventListeners() {
        // 載具選擇器
        const attitudeSelect = document.getElementById('attitudeVehicleSelect');
        const chartSelect = document.getElementById('chartVehicleSelect');
        
        if (attitudeSelect) {
            attitudeSelect.addEventListener('change', (e) => {
                this.currentVehicle = e.target.value;
                this.updateAttitudeDisplay();
            });
        }
        
        if (chartSelect) {
            chartSelect.addEventListener('change', (e) => {
                this.currentVehicle = e.target.value;
                this.chartManager.clearChartData();
            });
        }
        
        // 清除訊息
        const clearBtn = document.getElementById('clearMessages');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearMessages();
            });
        }
    }
    
    async loadVehicles() {
        try {
            const response = await fetch('/api/vehicles');
            const data = await response.json();
            
            if (data.success) {
                this.vehicles = data.vehicles;
                this.renderSystemStatusCards();
            }
        } catch (error) {
            console.error('Failed to load vehicles:', error);
        }
    }
    
    async loadVehicleStates() {
        try {
            const response = await fetch('/api/vehicles/states');
            const data = await response.json();
            
            if (data.success) {
                this.vehicleStates = data.data;
                this.updateAllDisplays();
            }
        } catch (error) {
            console.error('Failed to load vehicle states:', error);
        }
    }
    
    renderSystemStatusCards() {
        const container = document.getElementById('systemStatusCards');
        if (!container) return;
        
        // 這裡我們不每次重繪，避免閃爍，除非數量變了
        if (container.children.length === this.vehicles.length) {
            this.updateSystemStatusCardsValues();
            return;
        }
        
        container.innerHTML = '';
        
        this.vehicles.forEach(vehicleId => {
            const card = this.createSystemStatusCard(vehicleId);
            container.appendChild(card);
        });
    }
    
    createSystemStatusCard(vehicleId) {
        const card = document.createElement('div');
        card.className = 'card system-status-card mb-3';
        card.id = `statusCard-${vehicleId}`;
        
        // 初始內容
        card.innerHTML = this.getSystemStatusCardHTML(vehicleId, {});
        
        return card;
    }
    
    getSystemStatusCardHTML(vehicleId, state) {
        const battery = state.battery || {};
        const position = state.position || {};
        const motion = state.motion || {};
        
        return `
            <div class="card-header">
                <div class="vehicle-header">
                    <span class="vehicle-name">${vehicleId}</span>
                    <span class="badge vehicle-type-badge ${state.type === 'uav' ? 'bg-primary' : 'bg-success'}">
                        ${state.type === 'uav' ? 'UAV' : 'UGV'}
                    </span>
                </div>
            </div>
            <div class="card-body">
                <!-- Status Section -->
                <div class="status-section mb-3">
                    <h6 class="section-title"><i class="fas fa-info-circle"></i> 狀態</h6>
                    <div class="status-grid">
                        <div class="status-item">
                            <label>Arm:</label>
                            <div class="value">
                                <button class="btn btn-sm ${state.armed ? 'btn-success' : 'btn-secondary'}" 
                                        onclick="overviewPage.toggleArm('${vehicleId}')">
                                    ${state.armed ? 'ARMED' : 'DISARMED'}
                                </button>
                            </div>
                        </div>
                        <div class="status-item">
                            <label>Mode:</label>
                            <div class="value">
                                <span class="badge bg-info">${state.mode || 'UNKNOWN'}</span>
                            </div>
                        </div>
                        <div class="status-item">
                            <label>GPS:</label>
                            <div class="value">
                                <span class="badge ${state.gps?.fix >= 3 ? 'bg-success' : 'bg-warning'}">
                                    ${state.gps?.fix || 0}D | ${state.gps?.satellites || 0} 星
                                </span>
                            </div>
                        </div>
                        <div class="status-item">
                            <label>更新:</label>
                            <div class="value">${state.linkHealth?.heartbeatHz || 0} Hz</div>
                        </div>
                    </div>
                </div>

                <!-- Battery Section -->
                <div class="status-section mb-3">
                    <h6 class="section-title"><i class="fas fa-battery-half"></i> 電池</h6>
                    <div class="battery-info">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="battery-voltage">${(battery.voltage || 0).toFixed(1)}V</span>
                            <span class="battery-percent ${battery.percent < 20 ? 'text-danger' : battery.percent < 50 ? 'text-warning' : 'text-success'}">
                                ${battery.percent || 0}%
                            </span>
                        </div>
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar ${battery.percent < 20 ? 'bg-danger' : battery.percent < 50 ? 'bg-warning' : 'bg-success'}" 
                                 style="width: ${battery.percent || 0}%">
                            </div>
                        </div>
                        ${battery.charging ? '<small class="text-success"><i class="fas fa-bolt"></i> 充電中</small>' : ''}
                    </div>
                </div>

                <!-- Position Section -->
                <div class="status-section mb-2">
                    <h6 class="section-title"><i class="fas fa-map-marker-alt"></i> 位置</h6>
                    <div class="position-grid">
                        <div class="position-item">
                            <label>緯度:</label>
                            <div class="value">${(position.lat || 0).toFixed(6)}°</div>
                        </div>
                        <div class="position-item">
                            <label>經度:</label>
                            <div class="value">${(position.lon || 0).toFixed(6)}°</div>
                        </div>
                        ${state.type === 'uav' ? `
                        <div class="position-item">
                            <label>高度:</label>
                            <div class="value">${(position.altitude || 0).toFixed(1)} m</div>
                        </div>
                        ` : ''}
                        <div class="position-item">
                            <label>速度:</label>
                            <div class="value">${(motion.groundSpeed || 0).toFixed(1)} m/s</div>
                        </div>
                    </div>
                </div>

                <div class="data-update-info ${state.dataStale ? 'data-stale' : ''}">
                    ${state.dataStale ? '⚠ 無數據' : '✓ 數據正常'}
                </div>
            </div>
        `;
    }

    updateSystemStatusCardsValues() {
        this.vehicles.forEach(vehicleId => {
            const card = document.getElementById(`statusCard-${vehicleId}`);
            if (card) {
                const state = this.vehicleStates[vehicleId] || {};
                card.innerHTML = this.getSystemStatusCardHTML(vehicleId, state);
                
                const isConnected = !state.dataStale;
                if (isConnected) {
                    card.classList.add('connected');
                    card.classList.remove('disconnected');
                } else {
                    card.classList.add('disconnected');
                    card.classList.remove('connected');
                }
            }
        });
    }
    
    updateAllDisplays() {
        // 更新系統狀態卡片
        this.renderSystemStatusCards();
        
        // 更新電池狀態
        this.updateBatteryDisplay();
        
        // 更新位置資訊
        this.updatePositionDisplay();
        
        // 更新姿態指示器
        this.updateAttitudeDisplay();
        
        // 更新圖表
        this.updateCharts();
        
        // 更新鏡頭
        this.updateCameraDisplay();
        
        // 更新訊息中心
        this.updateMessageCenter();
        
        // 更新任務狀態
        this.updateMissionStatus();
    }
    
    updateBatteryDisplay() {
        const container = document.getElementById('batteryStatusContent');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.vehicles.forEach(vehicleId => {
            const state = this.vehicleStates[vehicleId];
            if (!state) return;
            
            const battery = state.battery || {};
            const batteryItem = document.createElement('div');
            batteryItem.className = 'battery-item';
            
            const percent = battery.percent || 0;
            const progressClass = percent > 50 ? 'bg-success' : 
                                 percent > 20 ? 'bg-warning' : 'bg-danger';
            
            batteryItem.innerHTML = `
                <label>${vehicleId} (${state.type === 'uav' ? 'UAV' : 'UGV'})</label>
                <div class="battery-value">${(battery.voltage || 0).toFixed(1)}V | ${percent.toFixed(0)}%</div>
                <div class="progress battery-progress">
                    <div class="progress-bar ${progressClass}" role="progressbar" 
                         style="width: ${percent}%">${percent.toFixed(0)}%</div>
                </div>
                ${state.type === 'ugv' && battery.charging ? 
                    `<small class="text-info"><i class="fas fa-bolt"></i> 充電中</small>` : ''}
                ${state.type === 'ugv' ? 
                    `<small class="text-muted">續航: ${battery.remainingMin || 0} 分鐘</small>` : ''}
            `;
            
            container.appendChild(batteryItem);
        });
    }
    
    updatePositionDisplay() {
        const container = document.getElementById('positionInfoContent');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.vehicles.forEach(vehicleId => {
            const state = this.vehicleStates[vehicleId];
            if (!state) return;
            
            const position = state.position || {};
            const motion = state.motion || {};
            
            const positionItem = document.createElement('div');
            positionItem.className = 'position-item';
            positionItem.innerHTML = `
                <label>${vehicleId}</label>
                <div class="position-value">
                    緯度: ${position.lat?.toFixed(6) || '0.000000'}<br>
                    經度: ${position.lon?.toFixed(6) || '0.000000'}<br>
                    ${state.type === 'uav' ? `高度: ${(position.altitude || 0).toFixed(1)} m<br>` : ''}
                    速度: ${(motion.groundSpeed || 0).toFixed(1)} m/s
                </div>
            `;
            
            container.appendChild(positionItem);
        });
    }
    
    updateAttitudeDisplay() {
        const state = this.vehicleStates[this.currentVehicle];
        if (!state || !this.attitudeIndicator) return;
        
        const attitude = state.attitude || {};
        
        // 更新姿態指示器
        this.attitudeIndicator.update({
            rollDeg: attitude.rollDeg || 0,
            pitchDeg: attitude.pitchDeg || 0,
            yawDeg: attitude.yawDeg || 0,
            dataStale: state.dataStale || false
        });
        
        // 更新數值顯示
        const rollEl = document.getElementById('rollValue');
        const pitchEl = document.getElementById('pitchValue');
        const yawEl = document.getElementById('yawValue');
        
        if(rollEl) rollEl.textContent = `${(attitude.rollDeg || 0).toFixed(1)}°`;
        if(pitchEl) pitchEl.textContent = `${(attitude.pitchDeg || 0).toFixed(1)}°`;
        if(yawEl) yawEl.textContent = `${(attitude.yawDeg || 0).toFixed(1)}°`;
    }
    
    updateCharts() {
        const state = this.vehicleStates[this.currentVehicle];
        if (!state || !this.chartManager) return;
        
        this.chartManager.updateChartData(this.currentVehicle, state);
    }
    
    updateCameraDisplay(vehicleId = null) {
        // 同時更新 UAV 和 UGV 兩個鏡頭
        this.updateSingleCamera('UAV1', 'UAV');
        this.updateSingleCamera('UGV1', 'UGV');
    }
    
    updateSingleCamera(vehicleId, prefix) {
        const state = this.vehicleStates[vehicleId] || {};
        
        const streamImg = document.getElementById(`cameraStream${prefix}`);
        const img = document.getElementById(`cameraImage${prefix}`);
        
        // 設定視頻串流 URL
        let streamUrl = '';
        if (vehicleId === 'UAV1') {
            streamUrl = 'http://172.20.10.5:8000/video_feed';
        } else if (vehicleId === 'UGV1') {
            streamUrl = 'http://172.20.10.10:8000/video_feed';
        }
        
        // 如果是 UAV1 或 UGV1，使用 MJPEG 串流
        if (streamUrl) {
            if (streamImg) {
                // 如果串流源還沒設置或改變了，更新它
                const baseUrl = streamUrl.split('?')[0]; // 獲取基礎 URL（不含參數）
                const currentSrc = streamImg.getAttribute('src') || '';
                const currentBaseUrl = currentSrc ? currentSrc.split('?')[0] : '';
                
                if (currentBaseUrl !== baseUrl || !currentSrc) {
                    console.log(`設置 ${vehicleId} MJPEG 串流:`, streamUrl);
                    // multipart/x-mixed-replace 格式不需要時間戳，瀏覽器會自動更新
                    streamImg.src = streamUrl;
                    
                    // 顯示串流並隱藏靜態圖片
                    streamImg.style.display = 'block';
                    if (img) img.style.display = 'none';
                    
                    // 圖片載入成功後確認
                    streamImg.onload = () => {
                        console.log(`${vehicleId} MJPEG 串流載入成功`);
                    };
                    
                    // 處理錯誤
                    streamImg.onerror = (e) => {
                        console.error(`${vehicleId} MJPEG 串流載入失敗:`, e, 'URL:', streamUrl);
                        streamImg.style.display = 'none';
                        if (img) img.style.display = 'block';
                    };
                } else {
                    // 源已經設置，確保顯示串流
                    streamImg.style.display = 'block';
                    if (img) img.style.display = 'none';
                }
                
                // multipart/x-mixed-replace 格式會自動更新，不需要手動刷新
            }
        } else {
            // 確保串流圖片完全隱藏並清除源
            if (streamImg) {
                streamImg.style.display = 'none';
                streamImg.src = ''; // 清除源，避免繼續載入
            }
            
            // 確保靜態圖片顯示
            if (img) {
                img.style.display = 'block';
                
                // 更新圖片路徑（如果後端有提供）
                if (state.cameraUrl) {
                    const currentSrc = img.getAttribute('src');
                    if (currentSrc !== state.cameraUrl) {
                        img.src = state.cameraUrl;
                    }
                }
            }
        }
        
        // 更新鏡頭覆蓋資訊
        const modeEl = document.getElementById(`cameraMode${prefix}`);
        const batteryEl = document.getElementById(`cameraBattery${prefix}`);
        const altSpeedEl = document.getElementById(`cameraAltSpeed${prefix}`);
        const timeEl = document.getElementById(`cameraTime${prefix}`);
        
        if (modeEl) modeEl.textContent = state.mode || '--';
        if (batteryEl) batteryEl.textContent = `${(state.battery?.percent || 0).toFixed(0)}%`;
        
        if (altSpeedEl) {
            if (state.type === 'uav') {
                altSpeedEl.textContent = 
                    `${(state.position?.altitude || 0).toFixed(1)} m / ${(state.motion?.groundSpeed || 0).toFixed(1)} m/s`;
            } else {
                altSpeedEl.textContent = 
                    `0.0 m / ${(state.motion?.groundSpeed || 0).toFixed(1)} m/s`;
            }
        }
        
        if (timeEl) {
            const now = new Date();
            timeEl.textContent = now.toLocaleTimeString('zh-TW', { hour12: false });
        }
    }
    
    async updateMessageCenter() {
        try {
            const response = await fetch('/api/messages');
            const data = await response.json();
            
            if (data.success) {
                this.renderMessages(data.data);
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }
    
    renderMessages(messages) {
        const container = document.getElementById('messageCenter');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (messages.length === 0) {
            container.innerHTML = '<div class="text-center text-muted p-3">暫無訊息</div>';
            return;
        }
        
        messages.slice(-20).reverse().forEach(msg => {
            const messageItem = document.createElement('div');
            messageItem.className = `message-item ${msg.level || 'info'}`;
            
            const time = new Date(msg.timestamp * 1000);
            messageItem.innerHTML = `
                <div class="message-header">
                    <span class="message-vehicle">${msg.vehicle || 'System'}</span>
                    <span class="message-time">${time.toLocaleTimeString('zh-TW')}</span>
                </div>
                <div class="message-text">${msg.message || ''}</div>
            `;
            
            container.appendChild(messageItem);
        });
    }
    
    clearMessages() {
        const container = document.getElementById('messageCenter');
        if (container) {
            container.innerHTML = '<div class="text-center text-muted p-3">暫無訊息</div>';
        }
    }
    
    updateMissionStatus() {
        // 更新 UAV 任務狀態
        const uavState = this.vehicleStates['UAV1'];
        const ugvState = this.vehicleStates['UGV1'];
        
        const uavStatusEl = document.getElementById('missionStatusUAV');
        const ugvStatusEl = document.getElementById('missionStatusUGV');
        
        if (uavStatusEl && uavState) {
            const mode = uavState.mode || 'UNKNOWN';
            let badgeClass = 'bg-secondary';
            let statusText = mode;
            
            // 根據模式設定顯示文字和顏色
            if (mode === 'RTL') {
                badgeClass = 'bg-warning';
                statusText = 'Return to Home';
            } else if (mode === 'AUTO') {
                badgeClass = 'bg-success';
                statusText = '自動任務中';
            } else if (mode === 'GUIDED') {
                badgeClass = 'bg-info';
                statusText = '引導模式';
            } else if (mode === 'HOLD' || mode === 'LOITER') {
                badgeClass = 'bg-secondary';
                statusText = '待命中';
            } else if (mode === 'MANUAL') {
                badgeClass = 'bg-primary';
                statusText = '手動模式';
            }
            
            uavStatusEl.innerHTML = `<span class="badge ${badgeClass}">${statusText}</span>`;
        }
        
        if (ugvStatusEl && ugvState) {
            const mode = ugvState.mode || 'UNKNOWN';
            let badgeClass = 'bg-secondary';
            let statusText = mode;
            
            // 根據模式設定顯示文字和顏色
            if (mode === 'RTL') {
                badgeClass = 'bg-warning';
                statusText = 'Return to Home';
            } else if (mode === 'AUTO') {
                badgeClass = 'bg-success';
                statusText = '自動任務中';
            } else if (mode === 'GUIDED') {
                badgeClass = 'bg-info';
                statusText = '引導模式';
            } else if (mode === 'HOLD' || mode === 'LOITER') {
                badgeClass = 'bg-secondary';
                statusText = '待命中';
            } else if (mode === 'MANUAL') {
                badgeClass = 'bg-primary';
                statusText = '手動模式';
            }
            
            ugvStatusEl.innerHTML = `<span class="badge ${badgeClass}">${statusText}</span>`;
        }
    }
    
    async toggleArm(vehicleId) {
        const state = this.vehicleStates[vehicleId];
        if (!state) return;
        
        const newArmState = !state.armed;
        
        try {
            const response = await fetch(`/api/control/${vehicleId}/arm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ arm: newArmState })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.loadVehicleStates();
            } else {
                alert('武裝/解除武裝失敗: ' + (data.error || '未知錯誤'));
            }
        } catch (error) {
            console.error('Failed to toggle arm:', error);
            alert('請求失敗');
        }
    }
    
    startDataUpdates() {
        // 立即載入一次
        this.loadVehicleStates();
        
        // 每40ms更新一次（25Hz，確保姿態儀流暢顯示）
        this.updateInterval = setInterval(() => {
            this.loadVehicleStates();
        }, 40);
    }
    
    stopDataUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        // 清除串流刷新間隔
        if (this.streamRefreshInterval) {
            clearInterval(this.streamRefreshInterval);
            this.streamRefreshInterval = null;
        }
    }
}

// ==================== LIDAR 顯示類 ====================
class LidarDisplay {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.ws = null;
        this.isConnected = false;
        this.lidarData = {
            angle_min: 0,
            angle_increment: 0,
            range_max: 16.0,
            ranges: []
        };
        
        // 顯示設定
        this.scale = 15; // 像素/米（較小以適應卡片）
        this.pointSize = 1;
        
        // 座標修正選項
        this.flipX = false;
        this.flipY = true;
        this.flipAngle = false;
        this.rotationOffset = 0;
        
        // WebSocket 設定
        this.wsUrl = 'ws://172.20.10.10:8765';
        
        this.init();
    }
    
    init() {
        this.initCanvas();
        this.connectWebSocket();
        console.log('[LIDAR] 初始化完成');
    }
    
    initCanvas() {
        this.canvas = document.getElementById('lidarCanvas');
        if (!this.canvas) {
            console.error('[LIDAR] Canvas 元素未找到');
            return;
        }
        
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        
        this.ctx = this.canvas.getContext('2d');
        
        // 監聽視窗大小變化
        window.addEventListener('resize', () => {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
            this.draw();
        });
    }
    
    connectWebSocket() {
        try {
            console.log(`[LIDAR] 正在連接到: ${this.wsUrl}`);
            this.updateStatus('連接中...', 'warning');
            
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.onopen = () => {
                console.log('[LIDAR] WebSocket 已連接');
                this.isConnected = true;
                this.updateStatus('已連接', 'success');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleLidarData(data);
                } catch (e) {
                    console.error('[LIDAR] 解析錯誤:', e);
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('[LIDAR] WebSocket 錯誤:', error);
                this.updateStatus('連接錯誤', 'danger');
            };
            
            this.ws.onclose = () => {
                console.log('[LIDAR] WebSocket 已斷開');
                this.isConnected = false;
                this.updateStatus('未連接', 'secondary');
                
                // 5 秒後重連
                setTimeout(() => this.connectWebSocket(), 5000);
            };
        } catch (e) {
            console.error('[LIDAR] 連接失敗:', e);
            this.updateStatus('未連接', 'secondary');
        }
    }
    
    handleLidarData(data) {
        if (data.type === 'status' || data.type === 'error') {
            return;
        }
        
        // 正規化資料
        this.lidarData = {
            angle_min: data.angle_min || data.angleMin || 0,
            angle_increment: data.angle_increment || data.angleIncrement || 0,
            range_max: data.range_max || data.rangeMax || 16.0,
            ranges: data.ranges || data.data || []
        };
        
        // 更新統計
        this.updateStats();
        
        // 重繪
        this.draw();
    }
    
    updateStats() {
        const pointCountEl = document.getElementById('lidarPointCount');
        const minRangeEl = document.getElementById('lidarMinRange');
        const maxRangeEl = document.getElementById('lidarMaxRange');
        
        if (pointCountEl) pointCountEl.textContent = this.lidarData.ranges.length;
        
        // 計算最短距離（過濾有效數據）
        const validRanges = this.lidarData.ranges.filter(r => 
            isFinite(r) && r > 0 && r <= this.lidarData.range_max
        );
        
        if (minRangeEl) {
            if (validRanges.length > 0) {
                const minRange = Math.min(...validRanges);
                minRangeEl.textContent = `${minRange.toFixed(2)} m`;
            } else {
                minRangeEl.textContent = '- m';
            }
        }
        
        if (maxRangeEl) maxRangeEl.textContent = `${this.lidarData.range_max.toFixed(1)} m`;
    }
    
    updateStatus(text, type) {
        const statusEl = document.getElementById('lidarConnectionStatus');
        if (statusEl) {
            statusEl.textContent = text;
            statusEl.className = `badge bg-${type}`;
        }
    }
    
    draw() {
        if (!this.ctx || !this.canvas) return;
        
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // 清空畫布（淺色背景）
        this.ctx.fillStyle = '#e8e8e8';
        this.ctx.fillRect(0, 0, width, height);
        
        // 繪製網格和座標軸（簡化版）
        this.drawGrid(centerX, centerY, width, height);
        this.drawAxes(centerX, centerY, width, height);
        
        // 繪製 LIDAR 點
        this.drawLidarPoints(centerX, centerY);
    }
    
    drawGrid(centerX, centerY, width, height) {
        this.ctx.strokeStyle = '#cccccc';
        this.ctx.lineWidth = 1;
        
        const gridSpacing = this.scale * 2; // 每 2 米一格
        
        // 繪製距離圓
        for (let r = 2; r <= this.lidarData.range_max; r += 2) {
            const radius = r * this.scale;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.stroke();
        }
    }
    
    drawAxes(centerX, centerY, width, height) {
        this.ctx.strokeStyle = '#999999';
        this.ctx.lineWidth = 1;
        
        // X 軸
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(width, centerY);
        this.ctx.stroke();
        
        // Y 軸
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, 0);
        this.ctx.lineTo(centerX, height);
        this.ctx.stroke();
    }
    
    drawLidarPoints(centerX, centerY) {
        const { angle_min, angle_increment, range_max, ranges } = this.lidarData;
        
        if (!ranges || ranges.length === 0) return;
        
        const rotRad = this.rotationOffset * Math.PI / 180;
        let angle = angle_min;
        
        for (let i = 0; i < ranges.length; i++) {
            const range = ranges[i];
            
            if (!isFinite(range) || range <= 0 || range > range_max) {
                angle += angle_increment;
                continue;
            }
            
            let adjustedAngle = angle;
            if (this.flipAngle) adjustedAngle = -adjustedAngle;
            adjustedAngle += rotRad;
            
            let x = range * Math.cos(adjustedAngle);
            let y = range * Math.sin(adjustedAngle);
            
            if (this.flipX) x = -x;
            if (this.flipY) y = -y;
            
            const canvasX = centerX + x * this.scale;
            const canvasY = centerY - y * this.scale;
            
            // 根據距離設置顏色
            const normalizedRange = range / range_max;
            const r = Math.floor(255 * normalizedRange);
            const b = Math.floor(255 * (1 - normalizedRange));
            const color = `rgb(${r}, 0, ${b})`;
            
            this.ctx.fillStyle = color;
            this.ctx.fillRect(canvasX, canvasY, this.pointSize, this.pointSize);
            
            angle += angle_increment;
        }
    }
}

// 初始化頁面
let overviewPage;
let lidarDisplay;

document.addEventListener('DOMContentLoaded', () => {
    overviewPage = new OverviewPage();
    window.overviewPage = overviewPage; // 供全局訪問
    
    // 初始化 LIDAR 顯示
    lidarDisplay = new LidarDisplay();
    window.lidarDisplay = lidarDisplay; // 供 Console 調試使用
});
