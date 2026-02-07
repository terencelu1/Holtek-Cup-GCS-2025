# API 快速參考

## 服務器地址
```
http://172.20.10.5:8000
```

## 端點列表

### 1. 相機串流
```
GET /video_feed
```
- **格式**: MJPEG multipart stream
- **解析度**: 1280x720 @ 15 FPS
- **使用**: `<img src="http://IP:8000/video_feed" />`

### 2. IMU 數據
```
GET /imu_data
```
- **格式**: JSON
- **更新頻率**: 建議 10-20 Hz (每 50-100ms)

### 3. 服務器狀態
```
GET /
```
- **格式**: JSON
- **用途**: 查詢服務器配置和狀態

---

## IMU 數據格式

### 請求
```javascript
fetch('http://IP:8000/imu_data')
    .then(r => r.json())
    .then(data => console.log(data));
```

### 響應 JSON
```json
{
  "pitch": 45.23,      // 俯仰角 (0-359度)
  "roll": 12.45,       // 翻滾角 (0-359度)
  "yaw": 180.67,       // 偏航角 (0-359度)
  "altitude": 10.5,    // 高度 (米)
  "accel": {
    "x": 0.12,         // X軸加速度 (m/s²)
    "y": -0.05,        // Y軸加速度 (m/s²)
    "z": 9.81          // Z軸加速度 (m/s²)
  },
  "timestamp": 1234567890.123
}
```

---

## 最小示例

### HTML
```html
<img src="http://IP:8000/video_feed" />
<script>
setInterval(async () => {
    const data = await fetch('http://IP:8000/imu_data').then(r => r.json());
    console.log(data);
}, 100);
</script>
```

### Python
```python
import requests
import cv2

# 相機
cap = cv2.VideoCapture('http://IP:8000/video_feed')

# IMU
while True:
    data = requests.get('http://IP:8000/imu_data').json()
    print(f"Pitch: {data['pitch']:.2f}°")
    time.sleep(0.1)
```

---

詳細文檔請參考: `API規格說明.md`

