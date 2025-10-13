# Device Monitoring System

## Tổng quan

DeviceMonitor là service theo dõi real-time trạng thái LDPlayer instances với các tính năng:

✅ **Real-time Status Monitoring** - Kiểm tra liên tục trạng thái instance
✅ **ADB Logcat Streaming** - Ghi log realtime vào file riêng cho mỗi instance
✅ **Health Metrics** - CPU, RAM, Battery tracking
✅ **Auto Log Rotation** - Tự động rotate khi file log quá lớn

---

## API Endpoints

### 1. Lấy trạng thái tất cả devices

```bash
GET /api/monitor/devices
```

**Response:**
```json
{
  "success": true,
  "devices": [
    {
      "instanceName": "test21323",
      "index": 10,
      "port": 5572,
      "isRunning": true,
      "isAdbConnected": true,
      "lastChecked": "2025-01-13T10:30:00.000Z",
      "health": {
        "cpuUsage": 25,
        "memoryUsage": 1024,
        "batteryLevel": 100,
        "temperature": 35
      }
    }
  ],
  "statistics": {
    "totalInstances": 5,
    "runningInstances": 3,
    "connectedInstances": 3,
    "logcatProcesses": 3,
    "uptime": 5000
  },
  "isMonitoring": true
}
```

### 2. Lấy trạng thái device cụ thể

```bash
GET /api/monitor/devices/:instanceName
```

**Example:**
```bash
GET /api/monitor/devices/test21323
```

### 3. Đọc logcat của device

```bash
GET /api/monitor/devices/:instanceName/logcat?lines=100
```

**Parameters:**
- `lines` (optional): Số dòng log muốn đọc (default: 100)

**Response:**
```json
{
  "success": true,
  "instanceName": "test21323",
  "content": "01-13 10:30:05.123  1234  5678 W System.err: Warning message\n...",
  "lines": 100
}
```

### 4. Xóa logcat file

```bash
POST /api/monitor/devices/:instanceName/logcat/clear
```

### 5. Lấy monitoring statistics

```bash
GET /api/monitor/statistics
```

### 6. Start/Stop monitoring

```bash
POST /api/monitor/start
POST /api/monitor/stop
```

---

## Cấu hình

Device Monitor được tự động khởi động khi server start. Bạn có thể config trong `server/index.ts`:

```typescript
const deviceMonitor = new DeviceMonitor(ldPlayerController, {
  checkInterval: 5000,        // Scan mỗi 5 giây
  enableLogcat: true,         // Bật logcat streaming
  logcatDir: 'logs/devices',  // Thư mục lưu log
  logcatMaxSize: 50,          // Max 50MB per file
  enableHealthCheck: true     // Bật health metrics
});
```

---

## Log Files

Log files được lưu tại: `logs/devices/<instanceName>.log`

**Ví dụ:**
- `logs/devices/test21323.log`
- `logs/devices/Instance_0.log`

**Auto-rotation:** Khi file vượt quá `logcatMaxSize`, file cũ sẽ được rename thành `<name>.log.<timestamp>.old`

---

## Use Cases

### 1. Kiểm tra instance có đang chạy không

```typescript
const response = await fetch('http://localhost:5051/api/monitor/devices/test21323');
const { device } = await response.json();

if (device.isRunning && device.isAdbConnected) {
  console.log('✅ Instance đang hoạt động bình thường');
} else {
  console.log('❌ Instance có vấn đề');
}
```

### 2. Đọc log để debug

```typescript
const response = await fetch('http://localhost:5051/api/monitor/devices/test21323/logcat?lines=500');
const { content } = await response.json();

// Tìm error trong log
if (content.includes('ERROR')) {
  console.log('⚠️ Phát hiện lỗi trong logcat');
}
```

### 3. Theo dõi health metrics

```typescript
const response = await fetch('http://localhost:5051/api/monitor/devices');
const { devices } = await response.json();

devices.forEach(device => {
  if (device.health?.cpuUsage > 80) {
    console.log(`⚠️ ${device.instanceName} CPU cao: ${device.health.cpuUsage}%`);
  }
});
```

---

## Lưu ý

1. **Logcat chỉ chạy khi instance đang active** - Nếu instance dừng, logcat process cũng tự động dừng
2. **Health metrics cần ADB connection** - Nếu ADB disconnect, health sẽ undefined
3. **Log file rotation** - Kiểm tra định kỳ thư mục `logs/devices` để clean up file .old
4. **Performance** - Monitoring chạy background, ít ảnh hưởng performance

---

## Troubleshooting

### Không thấy log được ghi

**Nguyên nhân:** Instance chưa connect ADB

**Giải pháp:**
```bash
POST /api/profiles/refresh-status  # Sync lại trạng thái
```

### Log file quá lớn

**Cách kiểm tra:**
```bash
ls -lh logs/devices/
```

**Cách clear:**
```bash
POST /api/monitor/devices/test21323/logcat/clear
```

### Monitor không hoạt động

**Kiểm tra status:**
```bash
GET /api/monitor/statistics
```

**Restart monitor:**
```bash
POST /api/monitor/stop
POST /api/monitor/start
```

---

## Advanced Usage

### Custom logcat filter

Modify `DeviceMonitor.ts` để filter log theo nhu cầu:

```typescript
// Chỉ lấy error logs
const logcatProcess = spawn(adbPath, [
  '-s', `127.0.0.1:${port}`,
  'logcat',
  '-v', 'time',
  '*:E'  // Error only
]);

// Hoặc filter theo tag
const logcatProcess = spawn(adbPath, [
  '-s', `127.0.0.1:${port}`,
  'logcat',
  '-v', 'time',
  'MyApp:V',    // Verbose for MyApp
  '*:S'         // Silent for others
]);
```

---

## Conclusion

DeviceMonitor giúp bạn:
- 🔍 **Phát hiện sớm** instance crash/disconnect
- 📝 **Debug dễ dàng** với logcat realtime
- 📊 **Monitor performance** CPU/RAM
- 💾 **Lưu trữ log** cho phân tích sau này

**Auto-start:** Service tự động khởi động khi server start, không cần config thêm!
