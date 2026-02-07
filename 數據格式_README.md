# 數據格式定義文檔集

> 中控系統與載具（UAV/UGV）之間的通訊數據格式定義

**版本**: v1.0  
**最後更新**: 2025-11-21  
**狀態**: ✅ 已完成定義，待實現

---

## 📚 文檔結構

```
數據格式文檔集/
├── 📖 數據格式定義.md          ⭐ [核心] 完整協議規範
├── 💻 數據格式實現參考.md       ⭐ [開發] Python/C/Arduino實現
├── 📋 數據類型速查表.md         ⭐ [常用] 快速參考手冊
├── 🔄 MAVLink轉換映射.md       [轉換] 協議轉換指南
├── 📝 數據格式文檔總覽.md       [導航] 文檔導航與使用指南
├── 🧪 protocol_test_example.py [測試] Python測試範例
└── 📘 數據格式_README.md       [本文件] 總覽說明
```

---

## 🎯 快速開始

### 第一次使用？從這裡開始

```
1️⃣ 閱讀「數據類型速查表.md」- 了解整體架構（15分鐘）
2️⃣ 閱讀「數據格式定義.md」的第1-3章 - 理解包格式（30分鐘）
3️⃣ 運行「protocol_test_example.py」- 動手測試（10分鐘）
4️⃣ 根據開發需求選擇對應章節深入學習
```

### 運行測試範例

```bash
# 確保已安裝Python 3.8+
python protocol_test_example.py
```

預期輸出：
```
╔==========================================================╗
║               數據格式協議測試範例                        ║
║                    Protocol v1.0                         ║
╚==========================================================╝

============================================================
測試 1: 心跳包 (HEARTBEAT)
============================================================
原始數據: 心跳包: 武裝=是, 模式=GUIDED, 狀態=運行中
...
✅ 解碼成功: 心跳包: 武裝=是, 模式=GUIDED, 狀態=運行中
```

---

## 📖 協議概述

### 協議特點

- ✅ **簡單高效**: 二進制格式，開銷小
- ✅ **可靠性高**: CRC16校驗，錯誤檢測
- ✅ **可擴展**: 預留數據類型ID空間
- ✅ **跨平台**: Python、C、Arduino全支援
- ✅ **MAVLink相容**: 可與MAVLink協議轉換

### 包格式一覽

```
+------+------+------+------+--------+----------+---------+-----+-----+
| 0xFF | 版本 | 來源 | 目標 | 數據ID | 數據長度 | 數據載荷 | CRC | 0xFE |
+------+------+------+------+--------+----------+---------+-----+-----+
| 1B   | 1B   | 1B   | 1B   |  2B    |    2B    |   N字節  | 2B  | 1B  |
+------+------+------+------+--------+----------+---------+-----+-----+
```

**最小包長**: 11 字節（不含數據載荷）

### 數據類型範圍

| 範圍 | 方向 | 類別 |
|------|------|------|
| 0x0100-0x01FF | 載具→中控 | 基礎狀態（心跳、姿態、GPS等）|
| 0x0200-0x02FF | 載具→中控 | 電源狀態（電池、充電）|
| 0x0300-0x03FF | 載具→中控 | 系統狀態（負載、日誌）|
| 0x0400-0x04FF | 載具→中控 | 影像數據 |
| 0x1000-0x10FF | 中控→載具 | 控制命令（武裝、模式、RC）|
| 0x1100-0x11FF | 中控→載具 | 導航任務（航點、任務）|
| 0x1200-0x12FF | 中控→載具 | 位置分享 |
| 0x1080-0x108F | 雙向 | 回應與確認 |

---

## 🚀 使用場景

### 場景1: 實現中控系統（Web端）

**技術棧**: Python + Flask/FastAPI  
**主要文檔**:
- 數據格式實現參考.md (Python實現)
- 數據類型速查表.md (數據類型查詢)

**核心功能**:
```python
# 1. 接收載具數據
def receive_vehicle_data(packet: bytes):
    source, target, data_type, payload = PacketCodec.decode(packet)
    
    if data_type == DataType.HEARTBEAT:
        heartbeat = Heartbeat.decode(payload)
        update_vehicle_status(heartbeat)
    
    elif data_type == DataType.GPS:
        gps = GPS.decode(payload)
        update_vehicle_position(gps)

# 2. 發送控制命令
def send_arm_command(vehicle_id: str, arm: bool):
    cmd = ArmCommand(timestamp=..., arm=arm, force=False)
    packet = PacketCodec.encode(
        DeviceID.GCS, DeviceID.UAV,
        DataType.ARM_COMMAND, cmd.encode()
    )
    send_to_vehicle(vehicle_id, packet)
```

---

### 場景2: 實現載具端（樹莓派）

**技術棧**: Python + pymavlink  
**主要文檔**:
- MAVLink轉換映射.md (協議轉換)
- 數據格式實現參考.md (Python實現)

**核心功能**:
```python
from pymavlink import mavlink
from protocol_converter import ProtocolConverter

# 初始化
master = mavlink.mavlink_connection('COM6', baud=9600)
converter = ProtocolConverter(master)

# MAVLink → 自定義協議
while True:
    msg = master.recv_match(blocking=False)
    if msg:
        result = converter.mavlink_to_custom(msg)
        if result:
            data_type, custom_data = result
            packet = PacketCodec.encode(
                DeviceID.UAV, DeviceID.GCS,
                data_type, custom_data.encode()
            )
            send_to_gcs(packet)
```

---

### 場景3: 實現載具端（Arduino/ESP32）

**技術棧**: C/C++ + Arduino  
**主要文檔**:
- 數據格式實現參考.md (C/Arduino實現)
- 數據類型速查表.md

**核心功能**:
```cpp
#include "packet_protocol.h"

void loop() {
    // 發送心跳包
    if (millis() - last_heartbeat > 1000) {
        send_heartbeat();
        last_heartbeat = millis();
    }
    
    // 接收命令
    if (Serial2.available()) {
        uint8_t buffer[512];
        // ... 讀取數據包
        DeviceID source, target;
        DataType data_type;
        uint8_t payload[256];
        uint16_t payload_size;
        
        if (packet_decode(buffer, buffer_size, &source, &target,
                         &data_type, payload, &payload_size)) {
            handle_command(data_type, payload, payload_size);
        }
    }
}
```

---

## 📊 常用數據類型

### 高頻數據（需要優化性能）

| ID | 名稱 | 頻率 | 包大小 | 頻寬 |
|----|------|------|--------|------|
| 0x0102 | 姿態數據 | 20 Hz | 39 B | 780 B/s |
| 0x0103 | 運動數據 | 10 Hz | 35 B | 350 B/s |
| 0x1005 | RC Override | 20 Hz | 27 B | 540 B/s |

### 關鍵命令（需要確認機制）

| ID | 名稱 | 說明 | 需要回應 |
|----|------|------|---------|
| 0x1002 | 武裝/解除武裝 | 安全關鍵 | ✅ 0x1080 |
| 0x1003 | 模式切換 | 飛行模式 | ✅ 0x1080 |
| 0x1101 | 設定航點 | 任務規劃 | ✅ 0x1080 |
| 0x1102 | 任務控制 | 開始/停止 | ✅ 0x1080 |

---

## 🔧 開發工具

### Python環境設置

```bash
# 安裝依賴
pip install pymavlink pyserial

# 測試協議
python protocol_test_example.py
```

### C/Arduino環境設置

```
1. 複製 packet_protocol.h 和 packet_protocol.c 到專案
2. 包含標頭檔: #include "packet_protocol.h"
3. 編譯並測試
```

---

## ✅ 開發檢查清單

### 載具端開發
- [ ] 實現數據包編碼/解碼
- [ ] 實現MAVLink轉換器
- [ ] 實現心跳包發送（1 Hz）
- [ ] 實現姿態數據發送（20 Hz）
- [ ] 實現GPS數據發送（5 Hz）
- [ ] 實現命令接收與確認
- [ ] 測試CRC校驗
- [ ] 測試錯誤處理
- [ ] 測試通訊穩定性

### 中控端開發
- [ ] 實現數據包編碼/解碼
- [ ] 實現數據接收與解析
- [ ] 實現心跳包監控
- [ ] 實現連線狀態檢測
- [ ] 實現控制命令發送
- [ ] 實現命令確認機制
- [ ] 實現UI數據更新
- [ ] 測試多載具支援
- [ ] 測試高頻數據處理

---

## 📏 性能指標

### 延遲要求

| 數據類型 | 最大延遲 | 超時處理 |
|---------|---------|---------|
| 心跳包 | 100ms | 3秒標記離線 |
| 姿態數據 | 50ms | 500ms標記過時 |
| 控制命令 | 100ms | 2秒重發或報錯 |
| RC Override | 50ms | 500ms自動釋放 |

### 頻寬估算

```
基礎數據流（無影像）:
- 心跳包: 19 B/s
- 姿態數據: 780 B/s
- GPS數據: 195 B/s
- 電池狀態: 62 B/s
總計: 約 1.1 KB/s

完整數據流（含影像）:
- 基礎數據: 1.1 KB/s
- 影像數據 (720p, 10fps): 約 50 KB/s
總計: 約 51 KB/s
```

---

## 🐛 故障排除

### 問題1: CRC校驗失敗
**原因**:
- 字節序錯誤（應為Little Endian）
- CRC計算範圍錯誤
- 數據傳輸損壞

**解決方案**:
1. 檢查字節序設定
2. 參考 `數據格式定義.md § CRC16計算`
3. 檢查通訊品質（錯誤率）

---

### 問題2: 數據包解析錯誤
**原因**:
- 起始/結束標識錯誤
- 數據長度不匹配
- 緩衝區溢出

**解決方案**:
1. 確認 0xFF 起始和 0xFE 結束標識
2. 驗證數據長度欄位
3. 增大接收緩衝區

---

### 問題3: 連線不穩定
**原因**:
- 心跳包丟失
- 網路延遲高
- 設備重啟

**解決方案**:
1. 實現心跳包超時重連
2. 調整超時時間（建議3秒）
3. 記錄連線狀態日誌

---

## 🔗 相關資源

### 內部文檔
- [指令包_要求.md](./指令包_要求.md) - 原始需求
- [通訊協議說明.md](./通訊協議說明.md) - MAVLink協議說明
- [SETUP.md](./SETUP.md) - 系統安裝指南

### 外部資源
- [MAVLink 官方文檔](https://mavlink.io/)
- [ArduPilot 開發文檔](https://ardupilot.org/dev/)
- [CRC 計算器](https://crccalc.com/)

---

## 📝 版本歷史

### v1.0 (2025-11-21) - 初始版本
- ✅ 定義基礎數據包格式
- ✅ 定義所有數據類型ID（0x0100-0x12FF）
- ✅ 提供Python/C/Arduino實現範例
- ✅ 提供MAVLink轉換映射
- ✅ 提供測試範例程式

### v1.1 (計劃中)
- ⏳ 數據包分片機制
- ⏳ 數據壓縮支援
- ⏳ 完整的錯誤碼定義
- ⏳ 性能優化指南

---

## 📞 支援

如有問題或建議：
1. 查閱相關技術文檔
2. 運行測試範例驗證
3. 通過 GitHub Issues 提問
4. 提交 Pull Request 改進

---

## 📄 授權

本協議定義文檔為專案內部使用。

---

**文檔維護**: 專案團隊  
**聯絡方式**: GitHub Issues  
**最後更新**: 2025-11-21

---

## 🎓 學習路徑

```
初級 (第1週)
└─ 閱讀「數據類型速查表.md」
└─ 運行「protocol_test_example.py」
└─ 理解基本數據包格式

中級 (第2-3週)
└─ 深入「數據格式定義.md」
└─ 實現簡單的編碼/解碼器
└─ 測試單向數據傳輸

高級 (第4週+)
└─ 學習「MAVLink轉換映射.md」
└─ 實現完整的協議棧
└─ 優化性能與錯誤處理
└─ 支援多載具系統
```

---

**祝開發順利！** 🚀

