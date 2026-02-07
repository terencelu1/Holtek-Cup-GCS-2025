# UAV × UGV Control Center

一個整合無人機（UAV）與無人車（UGV）的 Web 控制中心系統，支援即時監控、任務管理、性能分析與系統管理。

## 專案簡介

本專案是一個基於 Flask 的 Web 控制介面，用於監控和管理 UAV 與 UGV 系統。系統整合了 MAVLink 通訊協定，提供即時數據顯示、地圖導航、性能分析與系統設定等功能。

## 主要功能

### 1. 總覽頁面（Overview）
- **即時姿態指示器**：顯示載具的 Roll、Pitch、Yaw 角度（使用真實 MAVLink 數據）
- **性能圖表**：即時顯示姿態、RC 輸入、運動數據的歷史趨勢
- **電池狀態**：顯示電壓、容量、充電狀態
- **位置資訊**：GPS 座標、高度、衛星數量
- **鏡頭畫面**：UAV 和 UGV 的即時影像
- **訊息中心**：系統訊息與警告
- **系統狀態卡片**：載具狀態總覽

### 2. 地圖與任務頁面（Map & Missions）
- **互動地圖**：使用 Leaflet.js 顯示載具位置
- **載具圖示**：UAV 和 UGV 的圖示，顯示方向與狀態
- **軌跡顯示**：載具移動路徑
- **Home Point**：設定與顯示返航點
- **狀態面板**：載具旁邊顯示即時狀態資訊
- **任務管理**：航點規劃與任務執行

### 3. 性能與記錄頁面（Performance & Logs）
- **完整性能圖表**：
  - 姿態圖表（Roll、Pitch、Yaw）
  - RC 輸入圖表（Throttle、Roll、Pitch、Yaw）
  - 運動圖表（Ground Speed、Throttle）
  - 高度圖表（UAV）
- **回放功能**：支援歷史數據回放，可調整播放速度
- **系統日誌**：顯示系統運行日誌，支援 CSV 匯出
- **可調參數**：時間範圍、更新頻率、平滑濾波

### 4. 系統與電源頁面（System & Power）
- **系統設定**：
  - 前端更新頻率（5/10/20 Hz）
  - 高頻資料顯示開關（IMU）
  - 回放緩衝設定
- **連線健康監控**：Heartbeat、Latency、Packet Loss
- **Companion 系統狀態**：CPU、記憶體、溫度、運行時間
- **充電狀態**：電池資訊、充電電流/電壓、估計充飽時間
- **充電歷史紀錄**：充電記錄查詢
- **系統健康總分**：綜合評分圓形儀表（0-100 分）

## 技術架構

### 後端
- **Flask**：Web 框架
- **pymavlink**：MAVLink 通訊協定
- **pyserial**：串列通訊
- **psutil**：系統資源監控

### 前端
- **Bootstrap 5**：響應式 UI 框架
- **Chart.js**：圖表繪製
- **Leaflet.js**：互動地圖
- **Canvas API**：姿態指示器繪製
- **JavaScript (ES6)**：前端邏輯

### 通訊協定
- **MAVLink**：與 Pixhawk 飛控通訊
- **HTTP Long Polling**：即時數據更新
- **REST API**：數據與控制介面

## 安裝與設定

### 環境需求
- Python 3.8+
- pip

### 安裝步驟

1. **克隆倉庫**
```bash
git clone https://github.com/terencelu1/Holtek_MAP_GCS.git
cd Holtek_MAP_GCS
```

2. **安裝依賴**
```bash
cd program
pip install -r requirements.txt
```

3. **設定配置**
編輯 `program/config.py`，設定 MAVLink 連接參數：
```python
MAVLINK_CONNECTION_STRING = 'COM6'  # 或 'udp:127.0.0.1:14550'
MAVLINK_BAUDRATE = 9600
```

4. **啟動應用**
```bash
# Windows
python app.py

# 或使用啟動腳本
start.bat
```

5. **訪問系統**
打開瀏覽器訪問：`http://localhost:5000`

## 專案結構

```
.
├── program/                 # 主程式目錄
│   ├── app.py              # Flask 應用主文件
│   ├── config.py           # 配置文件
│   ├── mavlink_module/     # MAVLink 通訊模組
│   │   ├── connection.py   # MAVLink 連接
│   │   ├── telemetry.py    # 遙測數據處理
│   │   └── rover_controller.py  # 載具控制
│   ├── templates/          # HTML 模板
│   │   ├── overview.html   # 總覽頁面
│   │   ├── map.html        # 地圖頁面
│   │   ├── performance.html # 性能頁面
│   │   └── system.html     # 系統頁面
│   ├── static/             # 靜態資源
│   │   ├── css/            # 樣式文件
│   │   ├── js/             # JavaScript 文件
│   │   └── images/         # 圖片資源
│   └── requirements.txt     # Python 依賴
├── data/                    # 數據與資源
│   ├── icon/               # 載具圖示
│   └── Picture/            # 圖片資源
└── README.md               # 本文件
```

## 配置說明

### MAVLink 連接設定
在 `program/config.py` 中設定：
- `MAVLINK_CONNECTION_STRING`：連接字串（COM 埠或 UDP）
- `MAVLINK_BAUDRATE`：波特率（預設 9600）

### 系統設定
在 Web 介面的「系統與電源」頁面可以設定：
- 前端更新頻率：5/10/20 Hz
- 回放緩衝時間：60-3600 秒

## 數據來源

### 真實數據（MAVLink）
- 姿態數據（Roll、Pitch、Yaw）
- RC 輸入（Throttle、Roll、Pitch、Yaw）
- 運動數據（Ground Speed、Vertical Speed）

### 模擬數據
- 電池狀態
- GPS 位置
- 系統健康狀態
- 充電狀態

## 系統健康評分

系統健康總分（0-100 分）根據以下項目評分：

1. **連線健康（40%）**
   - Heartbeat 頻率
   - 延遲（Latency）
   - 封包遺失率

2. **系統健康（30%）**
   - CPU 使用率
   - 記憶體使用率
   - 溫度

3. **電池狀態（20%）**
   - 電池容量

4. **GPS 狀態（10%）**
   - GPS 定位品質

## 功能特色

- 即時數據監控（真實 MAVLink 數據）
- 互動式地圖顯示
- 歷史數據回放
- 系統健康監控
- 充電管理
- 響應式設計
- 多載具支援（UAV + UGV）

## 開發說明

### 數據流程
1. MAVLink 數據 → `mavlink_module/telemetry.py` → 處理與解析
2. 處理後的數據 → `app.py` → 更新 `vehicle_states`
3. 前端通過 HTTP API 獲取數據 → 更新 UI

### 頁面結構
- 所有頁面使用統一的導航欄和側邊欄
- 使用 Bootstrap 5 進行響應式布局
- 使用 Chart.js 繪製性能圖表

## 授權

本專案為學術研究用途。

## 貢獻者

- terencelu1

## 相關連結

- GitHub: https://github.com/terencelu1/Holtek_MAP_GCS

## 聯絡資訊

如有問題或建議，請透過 GitHub Issues 聯繫。

---

**注意**：本系統需要與 Pixhawk 飛控或相容的 MAVLink 設備連接才能使用完整功能。

