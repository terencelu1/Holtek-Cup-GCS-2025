# MAVLink 與自定義協議轉換映射

本文檔說明如何在 MAVLink 協議和自定義數據格式之間進行雙向轉換。

**版本**: v1.0  
**最後更新**: 2025-11-21

---

## 📋 轉換架構

```
┌──────────┐      MAVLink      ┌──────────┐    自定義協議    ┌──────────┐
│   飛控    │ ←──────────────→ │ 樹莓派   │ ←──────────────→ │   中控    │
│ (Pixhawk)│                   │(Adapter) │                  │   系統    │
└──────────┘                   └──────────┘                  └──────────┘
```

**轉換器位置**: 載具端樹莓派  
**轉換方向**: 雙向

---

## 📤 載具 → 中控（MAVLink → 自定義協議）

### 1. HEARTBEAT → 0x0101 心跳包

#### MAVLink 輸入
```python
# MAVLink HEARTBEAT 訊息
msg.type              # MAV_TYPE
msg.autopilot         # MAV_AUTOPILOT
msg.base_mode         # MAV_MODE_FLAG
msg.custom_mode       # uint32
msg.system_status     # MAV_STATE
msg.mavlink_version   # uint8
```

#### 轉換邏輯
```python
def convert_heartbeat(mavlink_msg):
    """將 MAVLink HEARTBEAT 轉換為自定義協議"""
    import time
    
    # 提取武裝狀態（從 base_mode）
    armed = bool(mavlink_msg.base_mode & mavlink.MAV_MODE_FLAG_SAFETY_ARMED)
    
    # 轉換飛行模式（ArduPilot Rover）
    mode_map = {
        0: 0x00,   # MANUAL
        3: 0x07,   # STEERING → HOLD
        4: 0x07,   # HOLD
        5: 0x04,   # LOITER
        10: 0x03,  # AUTO
        11: 0x05,  # RTL
        15: 0x02,  # GUIDED
    }
    mode = mode_map.get(mavlink_msg.custom_mode, 0x00)
    
    # 轉換系統狀態
    status_map = {
        mavlink.MAV_STATE_UNINIT: 0,      # 待機
        mavlink.MAV_STATE_BOOT: 0,        # 待機
        mavlink.MAV_STATE_CALIBRATING: 0, # 待機
        mavlink.MAV_STATE_STANDBY: 0,     # 待機
        mavlink.MAV_STATE_ACTIVE: 1,      # 運行中
        mavlink.MAV_STATE_CRITICAL: 3,    # 錯誤
        mavlink.MAV_STATE_EMERGENCY: 3,   # 錯誤
        mavlink.MAV_STATE_POWEROFF: 0,    # 待機
    }
    system_status = status_map.get(mavlink_msg.system_status, 0)
    
    # 構建自定義協議數據
    heartbeat = Heartbeat(
        timestamp=int(time.time() * 1000),
        armed=armed,
        mode=mode,
        system_status=system_status,
        online=True
    )
    
    return heartbeat
```

---

### 2. ATTITUDE → 0x0102 姿態數據

#### MAVLink 輸入
```python
# MAVLink ATTITUDE 訊息
msg.time_boot_ms      # uint32 (毫秒)
msg.roll              # float (弧度)
msg.pitch             # float (弧度)
msg.yaw               # float (弧度)
msg.rollspeed         # float (弧度/秒)
msg.pitchspeed        # float (弧度/秒)
msg.yawspeed          # float (弧度/秒)
```

#### 轉換邏輯
```python
def convert_attitude(mavlink_msg):
    """將 MAVLink ATTITUDE 轉換為自定義協議"""
    
    # 直接映射，無需轉換
    attitude = Attitude(
        timestamp=mavlink_msg.time_boot_ms,
        roll=mavlink_msg.roll,
        pitch=mavlink_msg.pitch,
        yaw=mavlink_msg.yaw,
        roll_speed=mavlink_msg.rollspeed,
        pitch_speed=mavlink_msg.pitchspeed,
        yaw_speed=mavlink_msg.yawspeed
    )
    
    return attitude
```

---

### 3. VFR_HUD → 0x0103 運動數據

#### MAVLink 輸入
```python
# MAVLink VFR_HUD 訊息
msg.airspeed          # float (m/s)
msg.groundspeed       # float (m/s)
msg.heading           # int16 (度, 0-360)
msg.throttle          # uint16 (百分比, 0-100)
msg.alt               # float (米)
msg.climb             # float (m/s)
```

#### 轉換邏輯
```python
def convert_motion(mavlink_msg):
    """將 MAVLink VFR_HUD 轉換為自定義協議"""
    import time
    
    motion = Motion(
        timestamp=int(time.time() * 1000),
        ground_speed=mavlink_msg.groundspeed,
        air_speed=mavlink_msg.airspeed,
        vertical_speed=mavlink_msg.climb,
        heading=float(mavlink_msg.heading),
        throttle=int(mavlink_msg.throttle)
    )
    
    return motion
```

---

### 4. GPS_RAW_INT + GLOBAL_POSITION_INT → 0x0104 GPS數據

#### MAVLink 輸入
```python
# MAVLink GPS_RAW_INT
msg.time_usec         # uint64 (微秒)
msg.fix_type          # uint8 (0-6)
msg.lat               # int32 (度 × 1e7)
msg.lon               # int32 (度 × 1e7)
msg.alt               # int32 (毫米)
msg.eph               # uint16 (cm)
msg.epv               # uint16 (cm)
msg.vel               # uint16 (cm/s)
msg.cog               # uint16 (度 × 100)
msg.satellites_visible # uint8
msg.h_acc             # uint32 (mm)
msg.v_acc             # uint32 (mm)
msg.vel_acc           # uint32 (mm/s)
msg.hdg_acc           # uint32 (度 × 1e5)
```

#### 轉換邏輯
```python
def convert_gps(gps_raw_msg):
    """將 MAVLink GPS_RAW_INT 轉換為自定義協議"""
    
    gps = GPS(
        timestamp=int(gps_raw_msg.time_usec / 1000),  # 微秒→毫秒
        latitude=gps_raw_msg.lat / 1e7,               # 轉換為度
        longitude=gps_raw_msg.lon / 1e7,              # 轉換為度
        altitude=gps_raw_msg.alt / 1000.0,            # 毫米→米
        fix_type=gps_raw_msg.fix_type,
        satellites=gps_raw_msg.satellites_visible,
        hdop=int(gps_raw_msg.eph / 10)                # cm→dm, ×10存儲
    )
    
    return gps
```

---

### 5. SYS_STATUS + BATTERY_STATUS → 0x0201 電池狀態

#### MAVLink 輸入
```python
# MAVLink SYS_STATUS
msg.voltage_battery    # uint16 (mV)
msg.current_battery    # int16 (cA, 10mA)
msg.battery_remaining  # int8 (%)

# MAVLink BATTERY_STATUS
msg.temperature        # int16 (°C × 100)
msg.voltages           # uint16[10] (mV)
msg.current_battery    # int16 (cA)
msg.current_consumed   # int32 (mAh)
msg.energy_consumed    # int32 (hJ)
msg.battery_remaining  # int8 (%)
msg.charge_state       # uint8
```

#### 轉換邏輯
```python
def convert_battery(sys_status_msg, battery_msg=None):
    """將 MAVLink 電池訊息轉換為自定義協議"""
    import time
    
    # 基礎數據來自 SYS_STATUS
    voltage = sys_status_msg.voltage_battery / 1000.0  # mV → V
    current = sys_status_msg.current_battery / 100.0   # cA → A
    percent = sys_status_msg.battery_remaining
    
    # 詳細數據來自 BATTERY_STATUS（如果有）
    temperature = 25.0  # 預設值
    charging = 0
    remaining_mah = 0
    
    if battery_msg:
        temperature = battery_msg.temperature / 100.0  # °C
        charging = 1 if battery_msg.charge_state == 1 else 0
        remaining_mah = battery_msg.current_consumed
    
    battery = Battery(
        timestamp=int(time.time() * 1000),
        voltage=voltage,
        current=current,
        temperature=temperature,
        percent=percent if percent >= 0 else 0,
        charging=charging,
        remaining_mah=remaining_mah
    )
    
    return battery
```

---

### 6. STATUSTEXT → 0x0302 日誌訊息

#### MAVLink 輸入
```python
# MAVLink STATUSTEXT
msg.severity          # uint8 (MAV_SEVERITY)
msg.text              # char[50]
```

#### 轉換邏輯
```python
def convert_statustext(mavlink_msg):
    """將 MAVLink STATUSTEXT 轉換為自定義協議"""
    import time
    
    # MAVLink severity 與自定義協議相同 (0-7)
    severity = mavlink_msg.severity
    
    # 解碼文本（去除尾部空字符）
    text = mavlink_msg.text.decode('utf-8', errors='ignore').rstrip('\x00')
    
    log_msg = LogMessage(
        timestamp=int(time.time() * 1000),
        severity=severity,
        source=0,  # 系統
        message=text
    )
    
    return log_msg
```

---

## 📥 中控 → 載具（自定義協議 → MAVLink）

### 1. 0x1001 心跳包 → HEARTBEAT

#### 自定義協議輸入
```python
# 0x1001 心跳包
timestamp             # uint32
gcs_online            # uint8
control_mode          # uint8
```

#### 轉換邏輯
```python
def send_gcs_heartbeat(master, gcs_heartbeat):
    """將自定義心跳包轉換為 MAVLink HEARTBEAT"""
    
    master.mav.heartbeat_send(
        type=mavlink.MAV_TYPE_GCS,          # 地面控制站
        autopilot=mavlink.MAV_AUTOPILOT_INVALID,
        base_mode=0,
        custom_mode=0,
        system_status=mavlink.MAV_STATE_ACTIVE
    )
```

---

### 2. 0x1002 武裝命令 → COMMAND_LONG

#### 自定義協議輸入
```python
# 0x1002 武裝/解除武裝
timestamp             # uint32
arm                   # uint8 (0=解除, 1=武裝)
force                 # uint8
```

#### 轉換邏輯
```python
def send_arm_command(master, arm_cmd):
    """將武裝命令轉換為 MAVLink COMMAND_LONG"""
    
    master.mav.command_long_send(
        master.target_system,
        master.target_component,
        mavlink.MAV_CMD_COMPONENT_ARM_DISARM,  # 命令ID: 400
        0,                                      # confirmation
        1.0 if arm_cmd.arm else 0.0,          # param1: 1=arm, 0=disarm
        21196.0 if arm_cmd.force else 0.0,    # param2: 強制武裝魔術數字
        0, 0, 0, 0, 0                          # param3-7
    )
```

---

### 3. 0x1003 模式切換 → SET_MODE

#### 自定義協議輸入
```python
# 0x1003 模式切換
timestamp             # uint32
mode                  # uint8
submode               # uint8
```

#### 轉換邏輯
```python
def send_set_mode(master, mode_cmd):
    """將模式切換命令轉換為 MAVLink SET_MODE"""
    
    # 反向映射模式
    mode_map = {
        0x00: 0,   # MANUAL
        0x02: 15,  # GUIDED
        0x03: 10,  # AUTO
        0x04: 5,   # LOITER
        0x05: 11,  # RTL
        0x06: 6,   # FOLLOW
        0x07: 4,   # HOLD
    }
    
    custom_mode = mode_map.get(mode_cmd.mode, 0)
    
    master.mav.set_mode_send(
        master.target_system,
        mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
        custom_mode
    )
```

---

### 4. 0x1004 設定Home Point → COMMAND_LONG

#### 自定義協議輸入
```python
# 0x1004 設定Home Point
timestamp             # uint32
use_current           # uint8
latitude              # double
longitude             # double
altitude              # float
```

#### 轉換邏輯
```python
def send_set_home(master, home_cmd):
    """將設定Home命令轉換為 MAVLink COMMAND_LONG"""
    
    master.mav.command_long_send(
        master.target_system,
        master.target_component,
        mavlink.MAV_CMD_DO_SET_HOME,          # 命令ID: 179
        0,                                     # confirmation
        1.0 if home_cmd.use_current else 0.0, # param1
        0, 0, 0,                               # param2-4
        home_cmd.latitude,                     # param5
        home_cmd.longitude,                    # param6
        home_cmd.altitude                      # param7
    )
```

---

### 5. 0x1005 RC Override → RC_CHANNELS_OVERRIDE

#### 自定義協議輸入
```python
# 0x1005 RC Override
timestamp             # uint32
throttle              # int16 (-100 ~ 100)
roll                  # int16 (-100 ~ 100)
pitch                 # int16 (-100 ~ 100)
yaw                   # int16 (-100 ~ 100)
enable                # uint8
```

#### 轉換邏輯
```python
def send_rc_override(master, rc_cmd):
    """將RC Override命令轉換為 MAVLink RC_CHANNELS_OVERRIDE"""
    
    if not rc_cmd.enable:
        # 取消覆蓋（發送0）
        master.mav.rc_channels_override_send(
            master.target_system,
            master.target_component,
            0, 0, 0, 0, 0, 0, 0, 0  # 全部設為0
        )
        return
    
    # 轉換百分比到PWM（1000-2000）
    def percent_to_pwm(percent):
        return int(1500 + percent * 5)
    
    # Rover通道映射
    chan1 = percent_to_pwm(rc_cmd.roll)      # 轉向
    chan3 = percent_to_pwm(rc_cmd.throttle)  # 油門
    
    master.mav.rc_channels_override_send(
        master.target_system,
        master.target_component,
        chan1,  # 通道1: 轉向
        0,      # 通道2: 未使用
        chan3,  # 通道3: 油門
        0, 0, 0, 0, 0  # 通道4-8
    )
```

---

### 6. 0x1101 設定航點 → MISSION_ITEM_INT

#### 自定義協議輸入
```python
# 0x1101 設定航點
timestamp             # uint32
waypoint_id           # uint16
waypoint_count        # uint16
latitude              # double
longitude             # double
altitude              # float
speed                 # float
hold_time             # uint32
action                # uint8
```

#### 轉換邏輯
```python
def send_waypoint(master, wp_cmd):
    """將航點設置轉換為 MAVLink MISSION_ITEM_INT"""
    
    # 轉換動作類型
    command_map = {
        0: mavlink.MAV_CMD_NAV_WAYPOINT,     # 經過
        1: mavlink.MAV_CMD_NAV_LOITER_TIME,  # 停留
        2: mavlink.MAV_CMD_DO_DIGICAM_CONTROL, # 拍照
        3: mavlink.MAV_CMD_NAV_LAND,         # 降落
    }
    command = command_map.get(wp_cmd.action, mavlink.MAV_CMD_NAV_WAYPOINT)
    
    master.mav.mission_item_int_send(
        master.target_system,
        master.target_component,
        wp_cmd.waypoint_id,                   # seq
        mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT, # frame
        command,                               # command
        0,                                     # current
        1,                                     # autocontinue
        wp_cmd.hold_time / 1000.0,            # param1: hold time (秒)
        0,                                     # param2
        0,                                     # param3
        0,                                     # param4
        int(wp_cmd.latitude * 1e7),           # x (緯度 × 1e7)
        int(wp_cmd.longitude * 1e7),          # y (經度 × 1e7)
        wp_cmd.altitude,                       # z (高度)
        mavlink.MAV_MISSION_TYPE_MISSION      # mission_type
    )
```

---

### 7. 0x1102 任務控制 → COMMAND_LONG

#### 自定義協議輸入
```python
# 0x1102 任務控制
timestamp             # uint32
action                # uint8 (0=開始, 1=暫停, 2=繼續, 3=清除, 4=返航)
mission_type          # uint8
```

#### 轉換邏輯
```python
def send_mission_control(master, mission_cmd):
    """將任務控制轉換為 MAVLink 命令"""
    
    if mission_cmd.action == 0:  # 開始任務
        master.mav.command_long_send(
            master.target_system,
            master.target_component,
            mavlink.MAV_CMD_MISSION_START,
            0,  # confirmation
            0, 0, 0, 0, 0, 0, 0
        )
    
    elif mission_cmd.action == 3:  # 清除任務
        master.mav.mission_clear_all_send(
            master.target_system,
            master.target_component,
            mavlink.MAV_MISSION_TYPE_MISSION
        )
    
    elif mission_cmd.action == 4:  # 返航
        # 切換到RTL模式
        master.mav.set_mode_send(
            master.target_system,
            mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
            11  # RTL
        )
```

---

## 🔄 完整轉換器類別實現

```python
# protocol_converter.py
from pymavlink import mavlink
import time
from typing import Optional

class ProtocolConverter:
    """MAVLink 與自定義協議之間的轉換器"""
    
    def __init__(self, mavlink_connection):
        self.master = mavlink_connection
        
    # ========== MAVLink → 自定義協議 ==========
    
    def mavlink_to_custom(self, msg) -> Optional[tuple]:
        """
        轉換 MAVLink 訊息到自定義協議
        
        Returns:
            (data_type, payload) 或 None
        """
        msg_type = msg.get_type()
        
        if msg_type == 'HEARTBEAT':
            return (DataType.HEARTBEAT, self.convert_heartbeat(msg))
        
        elif msg_type == 'ATTITUDE':
            return (DataType.ATTITUDE, self.convert_attitude(msg))
        
        elif msg_type == 'VFR_HUD':
            return (DataType.MOTION, self.convert_motion(msg))
        
        elif msg_type == 'GPS_RAW_INT':
            return (DataType.GPS, self.convert_gps(msg))
        
        elif msg_type == 'SYS_STATUS':
            return (DataType.BATTERY, self.convert_battery(msg))
        
        elif msg_type == 'STATUSTEXT':
            return (DataType.LOG_MESSAGE, self.convert_statustext(msg))
        
        return None
    
    def convert_heartbeat(self, msg):
        armed = bool(msg.base_mode & mavlink.MAV_MODE_FLAG_SAFETY_ARMED)
        mode_map = {0: 0x00, 3: 0x07, 4: 0x07, 5: 0x04, 
                   10: 0x03, 11: 0x05, 15: 0x02}
        mode = mode_map.get(msg.custom_mode, 0x00)
        
        return Heartbeat(
            timestamp=int(time.time() * 1000),
            armed=armed,
            mode=mode,
            system_status=1 if msg.system_status == mavlink.MAV_STATE_ACTIVE else 0,
            online=True
        )
    
    # ... (其他轉換方法)
    
    # ========== 自定義協議 → MAVLink ==========
    
    def custom_to_mavlink(self, data_type: DataType, payload: bytes):
        """
        轉換自定義協議到 MAVLink 並發送
        """
        if data_type == DataType.ARM_COMMAND:
            arm_cmd = ArmCommand.decode(payload)
            self.send_arm_command(arm_cmd)
        
        elif data_type == DataType.SET_MODE:
            mode_cmd = SetMode.decode(payload)
            self.send_set_mode(mode_cmd)
        
        elif data_type == DataType.RC_OVERRIDE:
            rc_cmd = RCOverride.decode(payload)
            self.send_rc_override(rc_cmd)
        
        elif data_type == DataType.SET_WAYPOINT:
            wp_cmd = SetWaypoint.decode(payload)
            self.send_waypoint(wp_cmd)
        
        # ... (其他命令)
    
    def send_arm_command(self, cmd):
        self.master.mav.command_long_send(
            self.master.target_system,
            self.master.target_component,
            mavlink.MAV_CMD_COMPONENT_ARM_DISARM,
            0,
            1.0 if cmd.arm else 0.0,
            21196.0 if cmd.force else 0.0,
            0, 0, 0, 0, 0
        )
    
    # ... (其他發送方法)
```

---

## 📊 轉換性能

### 延遲估算

| 轉換方向 | 處理時間 | 說明 |
|---------|---------|------|
| MAVLink → 自定義 | < 1ms | 數據解析+編碼 |
| 自定義 → MAVLink | < 1ms | 數據解析+發送 |

### 頻寬開銷

| 協議 | 心跳包 | 姿態包 | GPS包 | 說明 |
|------|--------|--------|-------|------|
| MAVLink | 9 B | 28 B | 35 B | 原始協議 |
| 自定義協議 | 19 B | 39 B | 39 B | 含完整包頭 |
| 開銷比例 | +111% | +39% | +11% | 小包開銷較大 |

---

## 🔗 相關文檔

- [數據格式定義.md](./數據格式定義.md)
- [通訊協議說明.md](./通訊協議說明.md)
- [MAVLink 官方文檔](https://mavlink.io/)

---

**版本**: v1.0  
**最後更新**: 2025-11-21

