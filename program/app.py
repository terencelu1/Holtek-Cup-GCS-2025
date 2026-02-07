"""
UAV × UGV Control Center - Flask 應用主文件
總覽頁面（Overview）實現 - 整合 MAVLink 數據
"""
import os
import sys
import time
import logging
import threading
import math
import random
import requests
from pathlib import Path
from flask import Flask, render_template, jsonify, request, send_from_directory

# 設定日誌
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 添加 MAVLink 模組路徑
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# 導入配置和 MAVLink 模組
import config
from mavlink_module.connection import MAVLinkConnection
from mavlink_module.telemetry import MAVLinkTelemetry
from mavlink_module.rover_controller import RoverController

# 創建 Flask 應用
app = Flask(
    __name__,
    template_folder='templates',
    static_folder='static'
)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'uav-ugv-control-center-2025')

# 初始化 SocketIO
from flask_socketio import SocketIO
# Remove async_mode='threading' so it can auto-detect eventlet/gevent
socketio = SocketIO(app, cors_allowed_origins="*")

# 全局 MAVLink 對象（保留但不再使用，改為從樹莓派獲取數據）
mavlink_connection = None
mavlink_telemetry = None
rover_controller = None

# 樹莓派 API 配置
# UAV 樹莓派
RASPBERRY_PI_UAV_IP = '172.20.10.5'
RASPBERRY_PI_UAV_PORT = 8000
RASPBERRY_PI_UAV_IMU_URL = f'http://{RASPBERRY_PI_UAV_IP}:{RASPBERRY_PI_UAV_PORT}/imu_data'
RASPBERRY_PI_UAV_STATUS_URL = f'http://{RASPBERRY_PI_UAV_IP}:{RASPBERRY_PI_UAV_PORT}/'
RASPBERRY_PI_UAV_VIDEO_URL = f'http://{RASPBERRY_PI_UAV_IP}:{RASPBERRY_PI_UAV_PORT}/video_feed'

# UGV 樹莓派
RASPBERRY_PI_UGV_IP = '172.20.10.10'
RASPBERRY_PI_UGV_PORT = 8000
RASPBERRY_PI_UGV_VIDEO_URL = f'http://{RASPBERRY_PI_UGV_IP}:{RASPBERRY_PI_UGV_PORT}/video_feed'

# 保留舊的變數名稱以向後兼容
RASPBERRY_PI_IP = RASPBERRY_PI_UAV_IP
RASPBERRY_PI_PORT = RASPBERRY_PI_UAV_PORT
RASPBERRY_PI_IMU_URL = RASPBERRY_PI_UAV_IMU_URL
RASPBERRY_PI_STATUS_URL = RASPBERRY_PI_UAV_STATUS_URL

# 載具狀態存儲
vehicle_states = {
    'UAV1': {
        'vehicleId': 'UAV1',
        'type': 'uav',
        'timestamp': time.time(),
        'armed': False,
        'mode': 'RTL',
        'gps': {'fix': 3, 'satellites': 14, 'hdop': 0.7},
        'battery': {'voltage': 15.4, 'percent': 78, 'remainingMin': 12, 'charging': False},
        'position': {'lat': 23.024087, 'lon': 120.224649, 'altitude': 13.2},
        'attitude': {'rollDeg': -2.3, 'pitchDeg': 1.1, 'yawDeg': 180.0},
        'rc': {'throttle': 0.55, 'roll': 0.02, 'pitch': -0.10, 'yaw': 0.00},
        'motion': {'groundSpeed': 3.2, 'verticalSpeed': -0.3},
        'linkHealth': {'heartbeatHz': 20, 'latencyMs': 80, 'packetLossPercent': 1.2, 'linkType': 'UDP'},
        'systemHealth': {'cpu': 35, 'memory': 40, 'temperature': 55},
        'chargeStatus': {'charging': False, 'chargeVoltage': None, 'chargeCurrent': None},
        'cameraUrl': f'http://{RASPBERRY_PI_UAV_IP}:{RASPBERRY_PI_UAV_PORT}/video_feed',
        'lastChargingState': False
    },
    'UGV1': {
        'vehicleId': 'UGV1',
        'type': 'ugv',
        'timestamp': time.time(),
        'armed': False,
        'mode': 'HOLD',
        # 模擬數據（系統狀態、電池、位置等）
        'gps': {'fix': 3, 'satellites': 12, 'hdop': 0.9},
        'battery': {'voltage': 14.8, 'percent': 85, 'remainingMin': 45, 'charging': False},
        'position': {'lat': 23.023975, 'lon': 120.224334, 'altitude': 0.0},
        # 初始姿態（會被 MAVLink 真實數據覆蓋）
        'attitude': {'rollDeg': 0.0, 'pitchDeg': 0.0, 'yawDeg': 0.0},
        # 初始 RC（會被 MAVLink 真實數據覆蓋）
        'rc': {'throttle': 0.0, 'roll': 0.0, 'pitch': 0.0, 'yaw': 0.0},
        # 初始運動（會被 MAVLink 真實數據覆蓋）
        'motion': {'groundSpeed': 0.0, 'verticalSpeed': 0.0},
        'linkHealth': {'heartbeatHz': 20, 'latencyMs': 75, 'packetLossPercent': 0.8, 'linkType': 'Serial'},
        'systemHealth': {'cpu': 30, 'memory': 35, 'temperature': 50},
        'chargeStatus': {'charging': False, 'chargeVoltage': None, 'chargeCurrent': None},
        'cameraUrl': f'http://{RASPBERRY_PI_UGV_IP}:{RASPBERRY_PI_UGV_PORT}/video_feed',
        'lastChargingState': False
    }
}

# 歷史數據存儲（用於圖表）
history_data = {
    'UAV1': {'attitude': [], 'rc': [], 'motion': [], 'altitude': []},
    'UGV1': {'attitude': [], 'rc': [], 'motion': [], 'altitude': []}
}

# 訊息中心數據
messages = []

# 系統日誌（用於性能與紀錄頁面）
system_logs = []

# 充電歷史紀錄
charging_history = []

# Companion 系統初始運行時間（隨機生成，之後開始計時）
companion_start_time = time.time() - (
    random.randint(1, 5) * 86400 +  # 1-5天
    random.randint(1, 23) * 3600 +  # 1-23小時
    random.randint(1, 59) * 60 +    # 1-59分鐘
    random.randint(1, 59)            # 1-59秒
)

# 回放緩衝設定（秒）- 控制保留多少歷史數據用於回放
playback_buffer_seconds = 300  # 預設5分鐘

def add_log(vehicle_id, level, message):
    """添加系統日誌"""
    global system_logs
    system_logs.append({
        'timestamp': time.time(),
        'vehicleId': vehicle_id,
        'level': level,
        'message': message
    })
    # 限制日誌數量
    if len(system_logs) > 1000:
        system_logs = system_logs[-1000:]

def init_mavlink():
    """初始化 MAVLink 連接"""
    global mavlink_connection, mavlink_telemetry, rover_controller
    
    try:
        # 使用 config.py 中的配置
        connection_string = config.MAVLINK_CONNECTION_STRING
        baudrate = config.MAVLINK_BAUDRATE
        
        logger.info(f"正在連接到 MAVLink: {connection_string} @ {baudrate}")
        
        mavlink_connection = MAVLinkConnection(connection_string, baudrate)
        mavlink_telemetry = MAVLinkTelemetry(mavlink_connection)
        rover_controller = RoverController(mavlink_connection, mavlink_telemetry)
        
        # 嘗試連接
        if mavlink_connection.connect():
            logger.info("MAVLink 連接成功")
            # 配置數據流
            rover_controller.configure_data_streams()
        else:
            logger.warning("MAVLink 連接失敗，將持續重試")
            
    except Exception as e:
        logger.error(f"MAVLink 初始化錯誤: {e}")

def fetch_raspberry_pi_imu():
    """從樹莓派獲取 IMU 數據（高頻率更新以獲得流暢的姿態顯示）"""
    try:
        response = requests.get(RASPBERRY_PI_IMU_URL, timeout=0.5)  # 縮短超時時間以支持高頻率
        if response.status_code == 200:
            return response.json()
        else:
            logger.warning(f"樹莓派 IMU API 返回錯誤: {response.status_code}")
            return None
    except requests.exceptions.RequestException as e:
        logger.debug(f"無法連接到樹莓派 IMU API: {e}")
        return None
    except Exception as e:
        logger.error(f"解析樹莓派 IMU 數據錯誤: {e}")
        return None

def update_raspberry_pi_data():
    """從樹莓派更新 UAV1 數據 - 使用樹莓派提供的 IMU 數據（新格式）"""
    global vehicle_states, history_data
    
    while True:
        try:
            # 從樹莓派獲取 IMU 數據
            imu_data = fetch_raspberry_pi_imu()
            
            if imu_data:
                # 映射到 UAV1 狀態
                uav_state = vehicle_states['UAV1']
                current_time = time.time()
                
                # 1. 姿態數據（新格式：直接是度數，0-359度）
                # 格式: pitch, roll, yaw (已經是度數)
                uav_state['attitude'] = {
                    'rollDeg': float(imu_data.get('roll', 0.0)),      # 翻滾角 (0-359度)
                    'pitchDeg': float(imu_data.get('pitch', 0.0)),    # 俯仰角 (0-359度)
                    'yawDeg': float(imu_data.get('yaw', 0.0))        # 偏航角 (0-359度)
                }
                
                # 2. 高度數據（新格式直接提供）
                if 'altitude' in imu_data:
                    uav_state['position']['altitude'] = float(imu_data.get('altitude', 0.0))
                
                # 3. 運動數據（從加速度估算或使用預設值）
                # 新格式提供 accel: {x, y, z}
                if 'accel' in imu_data:
                    accel = imu_data['accel']
                    # 可以從加速度計算速度（簡單積分），但這裡先保持當前值
                    # 或者可以從樹莓派獲取更多數據
                    if 'motion' not in uav_state:
                        uav_state['motion'] = {'groundSpeed': 0.0, 'verticalSpeed': 0.0}
                    # 可以根據加速度估算速度（可選）
                    # accel_magnitude = math.sqrt(accel.get('x', 0)**2 + accel.get('y', 0)**2 + accel.get('z', 0)**2)
                
                # 4. RC 數據（樹莓派不提供，保持當前值或設為 0）
                if 'rc' not in uav_state:
                    uav_state['rc'] = {'throttle': 0.0, 'roll': 0.0, 'pitch': 0.0, 'yaw': 0.0}
                
                uav_state['lastUpdateTime'] = current_time
                uav_state['timestamp'] = current_time
                
                # 更新歷史數據（用於性能圖表）
                history = history_data['UAV1']
                history['attitude'].append({
                    'timestamp': current_time,
                    'roll': uav_state['attitude']['rollDeg'],
                    'pitch': uav_state['attitude']['pitchDeg'],
                    'yaw': uav_state['attitude']['yawDeg']
                })
                history['rc'].append({
                    'timestamp': current_time,
                    'throttle': uav_state['rc']['throttle'],
                    'roll': uav_state['rc']['roll'],
                    'pitch': uav_state['rc']['pitch'],
                    'yaw': uav_state['rc']['yaw']
                })
                history['motion'].append({
                    'timestamp': current_time,
                    'groundSpeed': uav_state['motion']['groundSpeed'],
                    'throttle': uav_state['rc']['throttle']
                })
                
                # 高度數據（UAV）- 使用樹莓派提供的高度
                history['altitude'].append({
                    'timestamp': current_time,
                    'altitude': uav_state['position']['altitude']
                })
                
                # 限制歷史數據長度（根據回放緩衝設定保留數據）
                global playback_buffer_seconds
                current_time = time.time()
                cutoff_time = current_time - playback_buffer_seconds
                
                # 移除超過緩衝時間的舊數據
                for key in history:
                    # 過濾掉超過緩衝時間的數據
                    history[key] = [d for d in history[key] if d.get('timestamp', 0) >= cutoff_time]
                    
                    # 同時限制最大數據點數（防止內存溢出）
                    if len(history[key]) > 5000:
                        history[key] = history[key][-5000:]
                
                # 添加日誌（樹莓派數據更新）
                if random.random() < 0.01:  # 1% 機率
                    add_log('UAV1', 'info', f'樹莓派 IMU 數據更新: Roll {uav_state["attitude"]["rollDeg"]:.1f}°, Pitch {uav_state["attitude"]["pitchDeg"]:.1f}°, Alt {uav_state["position"]["altitude"]:.1f}m')
                
                # 發送 WebSocket 更新 (新增)
                socketio.emit('telemetry_data', {'vehicleId': 'UAV1', 'state': uav_state})
                
            else:
                # 無法獲取數據，標記為數據過期
                uav_state = vehicle_states['UAV1']
                uav_state['dataStale'] = True
                        
        except Exception as e:
            logger.error(f"樹莓派數據更新錯誤: {e}")
            import traceback
            logger.debug(traceback.format_exc())
        
        socketio.sleep(0.05) # 使用 socketio.sleep 而不是 time.sleep

def update_ugv_mock_data():
    """更新 UGV1 模擬數據（IMU 等）"""
    import random
    
    while True:
        try:
            current_time = time.time()
            state = vehicle_states['UGV1']
            
            # 更新姿態數據（模擬）
            state['attitude']['rollDeg'] += random.uniform(-0.2, 0.2)
            state['attitude']['pitchDeg'] += random.uniform(-0.2, 0.2)
            state['attitude']['yawDeg'] += random.uniform(-1.0, 1.0)
            
            # 限制姿態角度範圍
            state['attitude']['rollDeg'] = max(-45, min(45, state['attitude']['rollDeg']))
            state['attitude']['pitchDeg'] = max(-45, min(45, state['attitude']['pitchDeg']))
            state['attitude']['yawDeg'] = state['attitude']['yawDeg'] % 360
            
            # 更新運動數據（模擬）
            state['motion']['groundSpeed'] = random.uniform(0.0, 2.0)
            state['motion']['verticalSpeed'] = 0.0  # UGV 通常沒有垂直速度
            
            # 更新 RC 數據（模擬）
            state['rc']['throttle'] = random.uniform(0.0, 0.5)
            state['rc']['roll'] = random.uniform(-0.3, 0.3)
            state['rc']['pitch'] = random.uniform(-0.1, 0.1)
            state['rc']['yaw'] = random.uniform(-0.2, 0.2)
            
            state['lastUpdateTime'] = current_time
            state['timestamp'] = current_time
            
            # 更新歷史數據（用於性能圖表）
            history = history_data['UGV1']
            history['attitude'].append({
                'timestamp': current_time,
                'roll': state['attitude']['rollDeg'],
                'pitch': state['attitude']['pitchDeg'],
                'yaw': state['attitude']['yawDeg']
            })
            history['rc'].append({
                'timestamp': current_time,
                'throttle': state['rc']['throttle'],
                'roll': state['rc']['roll'],
                'pitch': state['rc']['pitch'],
                'yaw': state['rc']['yaw']
            })
            history['motion'].append({
                'timestamp': current_time,
                'groundSpeed': state['motion']['groundSpeed'],
                'throttle': state['rc']['throttle']
            })
            
            # 高度數據（UGV 通常為 0）
            history['altitude'].append({
                'timestamp': current_time,
                'altitude': state['position']['altitude']
            })
            
            # 限制歷史數據長度（根據回放緩衝設定保留數據）
            global playback_buffer_seconds
            current_time = time.time()
            cutoff_time = current_time - playback_buffer_seconds
            
            # 移除超過緩衝時間的舊數據
            for key in history:
                # 過濾掉超過緩衝時間的數據
                history[key] = [d for d in history[key] if d.get('timestamp', 0) >= cutoff_time]
                
                # 同時限制最大數據點數（防止內存溢出）
                if len(history[key]) > 5000:
                    history[key] = history[key][-5000:]
            
            # 偶爾添加日誌（模擬）
            if random.random() < 0.01:  # 1% 機率
                add_log('UGV1', 'info', f'模擬數據更新: 速度 {state["motion"]["groundSpeed"]:.2f} m/s')
            
            # 發送 WebSocket 更新 (新增)
            socketio.emit('telemetry_data', {'vehicleId': 'UGV1', 'state': state})
            
            socketio.sleep(0.1)  # 10Hz 更新
        except:
            socketio.sleep(1)

@app.route('/')
@app.route('/overview')
@app.route('/map')
@app.route('/performance')
@app.route('/system')
def main_app():
    """React SPA 入口點"""
    return send_from_directory('static/react_dist', 'index.html')

@app.route('/static/react_dist/<path:filename>')
def serve_react_assets(filename):
    return send_from_directory('static/react_dist', filename)

@app.route('/models/<path:filename>')
def serve_models(filename):
    return send_from_directory('static/react_dist/models', filename)

@app.route('/map/3d-test')
def map_3d_test_page():
    return render_template('map_3d_test.html')

@app.route('/api/vehicles')
def get_vehicles():
    """獲取所有載具列表"""
    return jsonify({
        'success': True,
        'vehicles': list(vehicle_states.keys())
    })

@app.route('/api/vehicles/states')
def get_all_vehicle_states():
    """獲取所有載具的狀態"""
    states = {}
    current_time = time.time()
    
    for vehicle_id, state in vehicle_states.items():
        state_copy = state.copy()
        state_copy['timestamp'] = current_time
        
        # 檢查數據新鮮度
        time_since_update = current_time - state.get('lastUpdateTime', state['timestamp'])
        state_copy['dataStale'] = time_since_update > 2.0 # 放寬到2秒
        
        states[vehicle_id] = state_copy
    
    return jsonify({
        'success': True,
        'data': states,
        'timestamp': current_time
    })

@app.route('/api/logs')
def get_logs():
    """獲取系統日誌"""
    return jsonify({
        'success': True,
        'logs': system_logs[-500:],  # 返回最近500條
        'total': len(system_logs)
    })

@app.route('/api/vehicle/<vehicle_id>/history')
def get_vehicle_history(vehicle_id):
    """獲取載具的歷史數據（用於圖表）"""
    if vehicle_id not in history_data:
        return jsonify({
            'success': False,
            'error': f'Vehicle {vehicle_id} not found'
        }), 404
    
    # 返回最近30秒的數據
    current_time = time.time()
    cutoff_time = current_time - 30
    
    history = history_data[vehicle_id]
    filtered_history = {
        'attitude': [d for d in history['attitude'] if d['timestamp'] >= cutoff_time],
        'rc': [d for d in history['rc'] if d['timestamp'] >= cutoff_time],
        'motion': [d for d in history['motion'] if d['timestamp'] >= cutoff_time]
    }
    
    return jsonify({
        'success': True,
        'data': filtered_history
    })

@app.route('/api/vehicle/<vehicle_id>/history/full')
def get_vehicle_history_full(vehicle_id):
    """獲取載具的完整歷史數據（用於回放）"""
    if vehicle_id not in history_data:
        return jsonify({
            'success': False,
            'error': f'Vehicle {vehicle_id} not found'
        }), 404
    
    history = history_data[vehicle_id]
    
    # 計算時間範圍
    all_times = []
    for key in ['attitude', 'rc', 'motion', 'altitude']:
        if history[key]:
            all_times.extend([d['timestamp'] for d in history[key]])
    
    if not all_times:
        return jsonify({
            'success': True,
            'data': {
                'attitude': [],
                'rc': [],
                'motion': [],
                'altitude': []
            },
            'startTime': time.time(),
            'endTime': time.time(),
            'duration': 0
        })
    
    start_time = min(all_times)
    end_time = max(all_times)
    duration = end_time - start_time
    
    return jsonify({
        'success': True,
        'data': {
            'attitude': history['attitude'],
            'rc': history['rc'],
            'motion': history['motion'],
            'altitude': history['altitude']
        },
        'startTime': start_time,
        'endTime': end_time,
        'duration': duration
    })

@app.route('/api/messages')
def get_messages():
    """獲取訊息中心的訊息"""
    # 嘗試從 telemetry 獲取最新消息
    if mavlink_telemetry:
        status_msgs = mavlink_telemetry.get_status_messages(5)
        for msg in status_msgs:
            # 避免重複（簡單檢查時間戳）
            if not any(m['timestamp'] == msg['timestamp'] for m in messages):
                messages.append({
                    'timestamp': msg['timestamp'],
                    'vehicle': 'UGV1',
                    'level': 'info', # 可根據 severity 調整
                    'message': msg['text']
                })
                
    return jsonify({
        'success': True,
        'data': messages[-50:]
    })

@app.route('/api/charging/history')
def get_charging_history():
    """獲取充電歷史紀錄"""
    # 如果沒有歷史紀錄，返回一筆模擬數據
    if len(charging_history) == 0:
        import random
        mock_history = [{
            'vehicleId': 'UAV1',
            'startTime': time.time() - 3600 * 2,  # 2小時前
            'endTime': time.time() - 3600,  # 1小時前
            'startSOC': 20.0,
            'endSOC': 85.0,
            'duration': 3600  # 1小時
        }]
        return jsonify({
            'success': True,
            'history': mock_history
        })
    
    return jsonify({
        'success': True,
        'history': charging_history[-50:]  # 返回最近50條
    })

@app.route('/api/system/settings', methods=['POST'])
def update_system_settings():
    """更新系統設定（包括回放緩衝）"""
    global playback_buffer_seconds
    data = request.get_json() or {}
    
    if 'playbackBuffer' in data:
        playback_buffer_seconds = int(data['playbackBuffer'])
        if playback_buffer_seconds < 60:
            playback_buffer_seconds = 60
        elif playback_buffer_seconds > 3600:
            playback_buffer_seconds = 3600
    
    return jsonify({
        'success': True,
        'message': '設定已更新',
        'playbackBuffer': playback_buffer_seconds
    })

@app.route('/api/raspberry-pi/status')
def get_raspberry_pi_status():
    """獲取樹莓派連接狀態"""
    try:
        response = requests.get(RASPBERRY_PI_STATUS_URL, timeout=2.0)
        if response.status_code == 200:
            return jsonify({
                'success': True,
                'connected': True,
                'status': response.json() if response.headers.get('content-type', '').startswith('application/json') else {'message': 'Connected'}
            })
        else:
            return jsonify({
                'success': False,
                'connected': False,
                'error': f'HTTP {response.status_code}'
            })
    except requests.exceptions.RequestException as e:
        return jsonify({
            'success': False,
            'connected': False,
            'error': str(e)
        }), 503

@app.route('/api/raspberry-pi/imu')
def get_raspberry_pi_imu():
    """獲取樹莓派 IMU 數據（測試端點）"""
    imu_data = fetch_raspberry_pi_imu()
    if imu_data:
        return jsonify({
            'success': True,
            'data': imu_data
        })
    else:
        return jsonify({
            'success': False,
            'error': '無法從樹莓派獲取 IMU 數據'
        }), 503

@app.route('/api/companion/status')
def get_companion_status():
    """獲取 Companion 系統狀態"""
    global companion_start_time
    
    try:
        import psutil
        
        # 獲取系統資源使用情況
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
        
        # 獲取溫度（如果可用）
        try:
            temps = psutil.sensors_temperatures()
            if temps:
                # 嘗試獲取 CPU 溫度
                cpu_temp = temps.get('cpu_thermal', temps.get('coretemp', {}))
                if cpu_temp and len(cpu_temp) > 0:
                    temperature = cpu_temp[0].current
                else:
                    temperature = 50.0  # 預設值
            else:
                temperature = 50.0
        except:
            temperature = 50.0
        
        # 計算運行時間：從初始隨機時間開始計時
        uptime = int(time.time() - companion_start_time)
        
        return jsonify({
            'success': True,
            'status': {
                'cpu': cpu_percent,
                'memory': memory_percent,
                'temperature': temperature,
                'uptime': uptime
            }
        })
    except ImportError:
        # 如果 psutil 不可用，返回模擬數據
        # 計算運行時間：從初始隨機時間開始計時
        uptime = int(time.time() - companion_start_time)
        
        return jsonify({
            'success': True,
            'status': {
                'cpu': 35.0,
                'memory': 40.0,
                'temperature': 50.0,
                'uptime': uptime
            }
        })
    except Exception as e:
        logger.error(f"Failed to get companion status: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/control/<vehicle_id>/arm', methods=['POST'])
def arm_vehicle(vehicle_id):
    """武裝載具（注意：現在飛控連接到樹莓派，控制命令需要通過樹莓派轉發）"""
    data = request.get_json() or {}
    arm = data.get('arm', True)
    
    if vehicle_id == 'UGV1':
        # 現在飛控連接到樹莓派，控制命令需要通過樹莓派 API 轉發
        # 這裡暫時返回成功，實際實現需要樹莓派提供控制 API
        # TODO: 實現通過樹莓派 API 轉發控制命令
        messages.append({
            'timestamp': time.time(),
            'vehicle': vehicle_id,
            'level': 'warning',
            'message': f'控制命令需要通過樹莓派轉發（功能待實現）'
        })
        return jsonify({
            'success': True,
            'message': '控制命令已發送（需通過樹莓派轉發）'
        })
        
    elif vehicle_id == 'UAV1':
        # Mock UAV arming
        vehicle_states[vehicle_id]['armed'] = arm
        return jsonify({'success': True})
        
    return jsonify({'success': False, 'error': 'Unknown vehicle'})

@app.route('/api/control/<vehicle_id>/mode', methods=['POST'])
def change_mode(vehicle_id):
    """切換載具模式（注意：現在飛控連接到樹莓派，控制命令需要通過樹莓派轉發）"""
    data = request.get_json() or {}
    mode = data.get('mode', 'MANUAL')
    
    if vehicle_id == 'UGV1':
        # 現在飛控連接到樹莓派，控制命令需要通過樹莓派 API 轉發
        # 這裡暫時返回成功，實際實現需要樹莓派提供控制 API
        # TODO: 實現通過樹莓派 API 轉發控制命令
        messages.append({
            'timestamp': time.time(),
            'vehicle': vehicle_id,
            'level': 'warning',
            'message': f'模式切換命令需要通過樹莓派轉發（功能待實現）'
        })
        return jsonify({
            'success': True,
            'message': '模式切換命令已發送（需通過樹莓派轉發）'
        })
        
    elif vehicle_id == 'UAV1':
        vehicle_states[vehicle_id]['mode'] = mode
        return jsonify({'success': True})
        
    return jsonify({'success': False})

# 模擬數據更新（用於 UAV1 - 只更新非 IMU 數據，IMU 數據來自樹莓派）
def update_uav_other_data():
    """更新 UAV1 其他數據（位置、電池等），IMU 數據由樹莓派提供"""
    import random
    
    while True:
        try:
            current_time = time.time()
            state = vehicle_states['UAV1']
            
            # 注意：不再更新姿態數據，因為 IMU 數據來自樹莓派
            # 姿態數據由 update_raspberry_pi_data() 更新
            
            # 更新位置
            state['position']['altitude'] += random.uniform(-0.1, 0.1)
            state['position']['altitude'] = max(0, state['position']['altitude'])
            
            # 追蹤充電狀態變化
            current_charging = state['battery'].get('charging', False) or state['chargeStatus'].get('charging', False)
            last_charging = state.get('lastChargingState', False)
            
            if current_charging != last_charging:
                if current_charging:
                    # 開始充電
                    charging_history.append({
                        'vehicleId': 'UAV1',
                        'startTime': current_time,
                        'endTime': None,
                        'startSOC': state['battery']['percent'],
                        'endSOC': None,
                        'duration': None
                    })
                else:
                    # 結束充電
                    for record in reversed(charging_history):
                        if record['vehicleId'] == 'UAV1' and record['endTime'] is None:
                            record['endTime'] = current_time
                            record['endSOC'] = state['battery']['percent']
                            record['duration'] = current_time - record['startTime']
                            break
                state['lastChargingState'] = current_charging
            
            state['lastUpdateTime'] = current_time
            state['timestamp'] = current_time
            
            # 偶爾添加日誌（模擬）
            if random.random() < 0.01:  # 1% 機率
                add_log('UAV1', 'info', f'位置更新: {state["position"]["lat"]:.6f}, {state["position"]["lon"]:.6f}')
            
            # 注意：歷史數據中的 attitude、rc、motion 由 update_raspberry_pi_data() 更新
            # 這裡只更新高度數據（如果需要）
            history_data['UAV1']['altitude'].append({
                'timestamp': current_time,
                'altitude': state['position']['altitude']
            })
            
            # 限制歷史數據長度（根據回放緩衝設定保留數據）
            global playback_buffer_seconds
            current_time = time.time()
            cutoff_time = current_time - playback_buffer_seconds
            
            # 移除超過緩衝時間的舊數據
            for key in history_data['UAV1']:
                # 過濾掉超過緩衝時間的數據
                history_data['UAV1'][key] = [d for d in history_data['UAV1'][key] if d.get('timestamp', 0) >= cutoff_time]
                
                # 同時限制最大數據點數（防止內存溢出）
                if len(history_data['UAV1'][key]) > 5000:
                    history_data['UAV1'][key] = history_data['UAV1'][key][-5000:]
            
            socketio.sleep(0.1)
        except:
            socketio.sleep(1)

if __name__ == '__main__':
    # 不再初始化 MAVLink（改為從樹莓派獲取數據）
    # init_mavlink()
    logger.info("使用樹莓派作為 UAV 數據源，UGV 使用模擬數據")
    logger.info(f"樹莓派 IMU API: {RASPBERRY_PI_IMU_URL}")
    
    # 啟動樹莓派數據更新線程（更新 UAV1 的 IMU 數據）
    socketio.start_background_task(update_raspberry_pi_data)
    
    # 啟動 UAV1 其他數據更新線程（位置、電池等，不包含 IMU）
    socketio.start_background_task(update_uav_other_data)
    
    # 啟動 UGV1 模擬數據線程（包含 IMU 數據）
    socketio.start_background_task(update_ugv_mock_data)
    
    logger.info("啟動 UAV × UGV Control Center...")
    logger.info("總覽頁面: http://localhost:5000")
    logger.info(f"UAV1 相機串流: {RASPBERRY_PI_UAV_VIDEO_URL}")
    logger.info(f"UGV1 相機串流: {RASPBERRY_PI_UGV_VIDEO_URL}")
    logger.info("UAV1: 使用樹莓派 IMU 數據")
    logger.info("UGV1: 使用模擬 IMU 數據")
    
    # 使用 socketio.run 代替 app.run
    socketio.run(
        app,
        host='0.0.0.0',
        port=5001,
        debug=True,
        use_reloader=False  # 避免重複啟動線程
    )
