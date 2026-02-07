#!/usr/bin/env python3
"""
數據格式協議測試範例

這個腳本演示如何使用自定義數據格式協議：
1. 編碼各種數據類型
2. 解碼數據包
3. CRC校驗
4. 錯誤處理

使用方法:
    python protocol_test_example.py
"""

import struct
import time
import math
from enum import IntEnum
from typing import Optional, Tuple

# ============================================================
# 數據類型定義
# ============================================================

class DataType(IntEnum):
    """數據類型ID枚舉"""
    # 載具 → 中控
    HEARTBEAT = 0x0101
    ATTITUDE = 0x0102
    MOTION = 0x0103
    GPS = 0x0104
    BATTERY = 0x0201
    
    # 中控 → 載具
    GCS_HEARTBEAT = 0x1001
    ARM_COMMAND = 0x1002
    SET_MODE = 0x1003
    RC_OVERRIDE = 0x1005
    SET_WAYPOINT = 0x1101

class DeviceID(IntEnum):
    """設備ID枚舉"""
    GCS = 0x01      # 中控
    UAV = 0x02      # 無人機
    UGV = 0x03      # 無人車
    BROADCAST = 0xFF # 廣播

# ============================================================
# 數據包編碼/解碼器
# ============================================================

class PacketCodec:
    """數據包編碼解碼器"""
    
    HEADER_BYTE = 0xFF
    FOOTER_BYTE = 0xFE
    VERSION = 0x01
    
    @staticmethod
    def crc16_ccitt(data: bytes) -> int:
        """計算CRC16-CCITT校驗碼"""
        crc = 0xFFFF
        for byte in data:
            crc ^= byte << 8
            for _ in range(8):
                if crc & 0x8000:
                    crc = (crc << 1) ^ 0x1021
                else:
                    crc = crc << 1
                crc &= 0xFFFF
        return crc
    
    @staticmethod
    def encode(source: DeviceID, target: DeviceID, data_type: DataType, 
               payload: bytes) -> bytes:
        """編碼數據包"""
        # 構建包頭（不含起始標識）
        header = struct.pack('<BBBBHH',
            PacketCodec.VERSION,  # 版本
            source,               # 來源
            target,               # 目標
            data_type & 0xFF,     # 數據類型低字節
            data_type >> 8,       # 數據類型高字節
            len(payload)          # 數據長度
        )
        
        # 計算CRC（從版本到數據載荷）
        crc_data = header + payload
        crc = PacketCodec.crc16_ccitt(crc_data)
        
        # 組裝完整數據包
        packet = struct.pack('B', PacketCodec.HEADER_BYTE)  # 起始
        packet += crc_data                                    # 包頭+載荷
        packet += struct.pack('<H', crc)                     # CRC
        packet += struct.pack('B', PacketCodec.FOOTER_BYTE)  # 結束
        
        return packet
    
    @staticmethod
    def decode(packet: bytes) -> Optional[Tuple[DeviceID, DeviceID, DataType, bytes]]:
        """解碼數據包"""
        if len(packet) < 11:  # 最小包長
            return None
            
        # 檢查起始和結束標識
        if packet[0] != PacketCodec.HEADER_BYTE or packet[-1] != PacketCodec.FOOTER_BYTE:
            return None
        
        # 解析包頭
        version, source, target, type_low, type_high, length = struct.unpack(
            '<BBBBHH', packet[1:9]
        )
        
        if version != PacketCodec.VERSION:
            return None
        
        data_type = (type_high << 8) | type_low
        
        # 提取載荷
        payload = packet[9:9+length]
        
        # 驗證CRC
        crc_expected = struct.unpack('<H', packet[9+length:11+length])[0]
        crc_actual = PacketCodec.crc16_ccitt(packet[1:9+length])
        
        if crc_expected != crc_actual:
            print(f"❌ CRC校驗失敗: 期望 0x{crc_expected:04X}, 實際 0x{crc_actual:04X}")
            return None
        
        return (DeviceID(source), DeviceID(target), DataType(data_type), payload)

# ============================================================
# 數據結構定義
# ============================================================

class Heartbeat:
    """心跳包數據結構"""
    FORMAT = '<IBBBB'
    SIZE = 8
    
    def __init__(self, timestamp: int, armed: bool, mode: int, 
                 system_status: int, online: bool):
        self.timestamp = timestamp
        self.armed = armed
        self.mode = mode
        self.system_status = system_status
        self.online = online
    
    def encode(self) -> bytes:
        return struct.pack(self.FORMAT, 
            self.timestamp,
            1 if self.armed else 0,
            self.mode,
            self.system_status,
            1 if self.online else 0
        )
    
    @classmethod
    def decode(cls, data: bytes):
        timestamp, armed, mode, status, online = struct.unpack(cls.FORMAT, data)
        return cls(timestamp, bool(armed), mode, status, bool(online))
    
    def __str__(self):
        mode_names = {0: 'MANUAL', 2: 'GUIDED', 3: 'AUTO', 5: 'RTL'}
        status_names = {0: '待機', 1: '運行中', 2: '執行任務', 3: '錯誤'}
        return (f"心跳包: 武裝={'是' if self.armed else '否'}, "
                f"模式={mode_names.get(self.mode, f'0x{self.mode:02X}')}, "
                f"狀態={status_names.get(self.system_status, '未知')}")

class Attitude:
    """姿態數據結構"""
    FORMAT = '<Iffffff'
    SIZE = 28
    
    def __init__(self, timestamp: int, roll: float, pitch: float, yaw: float,
                 roll_speed: float, pitch_speed: float, yaw_speed: float):
        self.timestamp = timestamp
        self.roll = roll
        self.pitch = pitch
        self.yaw = yaw
        self.roll_speed = roll_speed
        self.pitch_speed = pitch_speed
        self.yaw_speed = yaw_speed
    
    def encode(self) -> bytes:
        return struct.pack(self.FORMAT,
            self.timestamp, self.roll, self.pitch, self.yaw,
            self.roll_speed, self.pitch_speed, self.yaw_speed
        )
    
    @classmethod
    def decode(cls, data: bytes):
        values = struct.unpack(cls.FORMAT, data)
        return cls(*values)
    
    def __str__(self):
        return (f"姿態: Roll={math.degrees(self.roll):.1f}°, "
                f"Pitch={math.degrees(self.pitch):.1f}°, "
                f"Yaw={math.degrees(self.yaw):.1f}°")

class GPS:
    """GPS數據結構"""
    FORMAT = '<IddffBBH'
    SIZE = 28
    
    def __init__(self, timestamp: int, latitude: float, longitude: float,
                 altitude: float, fix_type: int, satellites: int, hdop: int):
        self.timestamp = timestamp
        self.latitude = latitude
        self.longitude = longitude
        self.altitude = altitude
        self.fix_type = fix_type
        self.satellites = satellites
        self.hdop = hdop
    
    def encode(self) -> bytes:
        return struct.pack(self.FORMAT,
            self.timestamp, self.latitude, self.longitude, self.altitude,
            self.fix_type, self.satellites, self.hdop
        )
    
    @classmethod
    def decode(cls, data: bytes):
        values = struct.unpack(cls.FORMAT, data)
        return cls(*values)
    
    def __str__(self):
        fix_names = {0: '無GPS', 1: '無定位', 2: '2D', 3: '3D', 4: 'DGPS', 5: 'RTK浮點', 6: 'RTK固定'}
        return (f"GPS: {self.latitude:.6f}°N, {self.longitude:.6f}°E, "
                f"高度={self.altitude:.1f}m, "
                f"定位={fix_names.get(self.fix_type, '未知')}, "
                f"衛星={self.satellites}顆")

class SetWaypoint:
    """設定航點命令"""
    FORMAT = '<IHHddfffIB3x'
    SIZE = 36
    
    def __init__(self, timestamp: int, waypoint_id: int, waypoint_count: int,
                 latitude: float, longitude: float, altitude: float,
                 speed: float, hold_time: int, action: int):
        self.timestamp = timestamp
        self.waypoint_id = waypoint_id
        self.waypoint_count = waypoint_count
        self.latitude = latitude
        self.longitude = longitude
        self.altitude = altitude
        self.speed = speed
        self.hold_time = hold_time
        self.action = action
    
    def encode(self) -> bytes:
        return struct.pack(self.FORMAT,
            self.timestamp, self.waypoint_id, self.waypoint_count,
            self.latitude, self.longitude, self.altitude,
            self.speed, self.hold_time, self.action
        )
    
    @classmethod
    def decode(cls, data: bytes):
        values = struct.unpack(cls.FORMAT, data)
        return cls(*values[:9])
    
    def __str__(self):
        action_names = {0: '經過', 1: '停留', 2: '拍照', 3: '降落'}
        return (f"航點 {self.waypoint_id+1}/{self.waypoint_count}: "
                f"{self.latitude:.6f}°N, {self.longitude:.6f}°E, "
                f"高度={self.altitude}m, "
                f"動作={action_names.get(self.action, '未知')}")

# ============================================================
# 測試函數
# ============================================================

def print_packet_hex(packet: bytes, label: str):
    """以十六進制格式打印數據包"""
    print(f"\n{label}")
    print(f"長度: {len(packet)} 字節")
    print(f"十六進制: {packet.hex(' ').upper()}")
    
    # 解析包頭
    if len(packet) >= 11:
        header = packet[0]
        version = packet[1]
        source = packet[2]
        target = packet[3]
        data_type = packet[4] | (packet[5] << 8)
        length = packet[6] | (packet[7] << 8)
        footer = packet[-1]
        crc = packet[-3] | (packet[-2] << 8)
        
        print(f"結構:")
        print(f"  起始: 0x{header:02X}")
        print(f"  版本: 0x{version:02X}")
        print(f"  來源: 0x{source:02X} ({DeviceID(source).name})")
        print(f"  目標: 0x{target:02X} ({DeviceID(target).name})")
        print(f"  數據類型: 0x{data_type:04X} ({DataType(data_type).name})")
        print(f"  數據長度: {length} 字節")
        print(f"  CRC: 0x{crc:04X}")
        print(f"  結束: 0x{footer:02X}")

def test_heartbeat():
    """測試心跳包"""
    print("\n" + "="*60)
    print("測試 1: 心跳包 (HEARTBEAT)")
    print("="*60)
    
    # 創建心跳數據
    heartbeat = Heartbeat(
        timestamp=int(time.time() * 1000),
        armed=True,
        mode=2,  # GUIDED
        system_status=1,  # 運行中
        online=True
    )
    
    print(f"原始數據: {heartbeat}")
    
    # 編碼
    payload = heartbeat.encode()
    packet = PacketCodec.encode(
        source=DeviceID.UAV,
        target=DeviceID.GCS,
        data_type=DataType.HEARTBEAT,
        payload=payload
    )
    
    print_packet_hex(packet, "編碼後的數據包:")
    
    # 解碼
    result = PacketCodec.decode(packet)
    if result:
        source, target, data_type, decoded_payload = result
        decoded_heartbeat = Heartbeat.decode(decoded_payload)
        print(f"\n✅ 解碼成功: {decoded_heartbeat}")
    else:
        print("\n❌ 解碼失敗")

def test_attitude():
    """測試姿態數據"""
    print("\n" + "="*60)
    print("測試 2: 姿態數據 (ATTITUDE)")
    print("="*60)
    
    # 創建姿態數據
    attitude = Attitude(
        timestamp=int(time.time() * 1000),
        roll=math.radians(-5.2),   # -5.2度
        pitch=math.radians(3.1),   # 3.1度
        yaw=math.radians(180.0),   # 180度
        roll_speed=0.01,
        pitch_speed=-0.02,
        yaw_speed=0.05
    )
    
    print(f"原始數據: {attitude}")
    
    # 編碼
    payload = attitude.encode()
    packet = PacketCodec.encode(
        source=DeviceID.UAV,
        target=DeviceID.GCS,
        data_type=DataType.ATTITUDE,
        payload=payload
    )
    
    print_packet_hex(packet, "編碼後的數據包:")
    
    # 解碼
    result = PacketCodec.decode(packet)
    if result:
        source, target, data_type, decoded_payload = result
        decoded_attitude = Attitude.decode(decoded_payload)
        print(f"\n✅ 解碼成功: {decoded_attitude}")
    else:
        print("\n❌ 解碼失敗")

def test_gps():
    """測試GPS數據"""
    print("\n" + "="*60)
    print("測試 3: GPS數據 (GPS)")
    print("="*60)
    
    # 創建GPS數據（台中某處）
    gps = GPS(
        timestamp=int(time.time() * 1000),
        latitude=24.163162,
        longitude=120.646854,
        altitude=150.5,
        fix_type=3,  # 3D定位
        satellites=14,
        hdop=80  # 0.8 * 100
    )
    
    print(f"原始數據: {gps}")
    
    # 編碼
    payload = gps.encode()
    packet = PacketCodec.encode(
        source=DeviceID.UGV,
        target=DeviceID.GCS,
        data_type=DataType.GPS,
        payload=payload
    )
    
    print_packet_hex(packet, "編碼後的數據包:")
    
    # 解碼
    result = PacketCodec.decode(packet)
    if result:
        source, target, data_type, decoded_payload = result
        decoded_gps = GPS.decode(decoded_payload)
        print(f"\n✅ 解碼成功: {decoded_gps}")
    else:
        print("\n❌ 解碼失敗")

def test_waypoint():
    """測試航點設置"""
    print("\n" + "="*60)
    print("測試 4: 航點設置 (SET_WAYPOINT)")
    print("="*60)
    
    # 創建航點命令
    waypoint = SetWaypoint(
        timestamp=int(time.time() * 1000),
        waypoint_id=0,
        waypoint_count=5,
        latitude=24.163162,
        longitude=120.646854,
        altitude=50.0,
        speed=5.0,
        hold_time=0,
        action=0  # 經過
    )
    
    print(f"原始數據: {waypoint}")
    
    # 編碼
    payload = waypoint.encode()
    packet = PacketCodec.encode(
        source=DeviceID.GCS,
        target=DeviceID.UAV,
        data_type=DataType.SET_WAYPOINT,
        payload=payload
    )
    
    print_packet_hex(packet, "編碼後的數據包:")
    
    # 解碼
    result = PacketCodec.decode(packet)
    if result:
        source, target, data_type, decoded_payload = result
        decoded_waypoint = SetWaypoint.decode(decoded_payload)
        print(f"\n✅ 解碼成功: {decoded_waypoint}")
    else:
        print("\n❌ 解碼失敗")

def test_error_handling():
    """測試錯誤處理"""
    print("\n" + "="*60)
    print("測試 5: 錯誤處理")
    print("="*60)
    
    # 測試1: 損壞的起始標識
    print("\n測試 5.1: 錯誤的起始標識")
    bad_packet = b'\xFE\x01\x02\x01\x01\x01\x00\x08' + b'\x00' * 8 + b'\xFE'
    result = PacketCodec.decode(bad_packet)
    print(f"結果: {'❌ 正確拒絕' if result is None else '⚠️  應該拒絕但通過了'}")
    
    # 測試2: CRC錯誤
    print("\n測試 5.2: CRC校驗錯誤")
    heartbeat = Heartbeat(
        timestamp=int(time.time() * 1000),
        armed=True, mode=2, system_status=1, online=True
    )
    payload = heartbeat.encode()
    packet = PacketCodec.encode(DeviceID.UAV, DeviceID.GCS, 
                               DataType.HEARTBEAT, payload)
    
    # 修改一個字節製造CRC錯誤
    bad_packet = bytearray(packet)
    bad_packet[10] ^= 0xFF  # 翻轉一個字節
    bad_packet = bytes(bad_packet)
    
    result = PacketCodec.decode(bad_packet)
    print(f"結果: {'❌ 正確拒絕' if result is None else '⚠️  應該拒絕但通過了'}")
    
    # 測試3: 包長度不足
    print("\n測試 5.3: 包長度不足")
    short_packet = b'\xFF\x01\x02\x01'
    result = PacketCodec.decode(short_packet)
    print(f"結果: {'❌ 正確拒絕' if result is None else '⚠️  應該拒絕但通過了'}")

def main():
    """主測試函數"""
    print("╔" + "="*58 + "╗")
    print("║" + " "*15 + "數據格式協議測試範例" + " "*16 + "║")
    print("║" + " "*20 + "Protocol v1.0" + " "*23 + "║")
    print("╚" + "="*58 + "╝")
    
    # 執行所有測試
    test_heartbeat()
    test_attitude()
    test_gps()
    test_waypoint()
    test_error_handling()
    
    print("\n" + "="*60)
    print("測試完成!")
    print("="*60)
    print("\n📖 更多資訊請參考:")
    print("  - 數據格式定義.md")
    print("  - 數據格式實現參考.md")
    print("  - 數據類型速查表.md")
    print("  - MAVLink轉換映射.md")

if __name__ == '__main__':
    main()

