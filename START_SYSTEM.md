# 🚀 Hướng Dẫn Khởi Động Hệ Thống Worker-Mobile

## 📋 Tóm tắt hệ thống

**Kiến trúc**:
- Backend API Server (port 5051)
- Frontend UI (port 7000)
- PM2 Instance Workers (7 workers cho 6 profiles)

**Profiles hiện có**:
- Profile 13 (ccccc_13)
- Profile 14 (ddddd_14)
- Profile 16 (worker_16_16)
- Profile 17 (worker_17_17)
- Profile 18 (worker_18_18)
- Profile 19 (worker_19_19)

---

## 🎯 Khởi động hệ thống

### Bước 1: Khởi động PM2 Workers

```bash
pm2 start ecosystem.workers.config.cjs
pm2 save
```

**Kiểm tra PM2 workers**:
```bash
pm2 list
```

Kết quả mong đợi: 7 processes (instance-13 đến instance-19) với status `online`

### Bước 2: Khởi động Development Server

```bash
npm run dev
```

Lệnh này sẽ khởi động:
- **Server** trên `http://localhost:5051`
- **Frontend** trên `http://localhost:7000`

### Bước 3: Truy cập UI

Mở browser:
```
http://localhost:7000
```

---

## 📊 Kiểm tra trạng thái

### PM2 Workers
```bash
# Xem danh sách processes
pm2 list

# Xem logs realtime
pm2 logs

# Xem logs của worker cụ thể
pm2 logs instance-13

# Monitor CPU/Memory
pm2 monit
```

### API Server
```bash
# Test profiles endpoint
curl http://localhost:5051/api/profiles

# Test PM2 info (sẽ trả về empty do disable PM2Service)
curl http://localhost:5051/api/pm2/system/info
```

### LDPlayer Instances
```bash
# Liệt kê tất cả instances
"D:\LDPlayer\LDPlayer9\ldconsole.exe" list2

# Lọc worker instances
"D:\LDPlayer\LDPlayer9\ldconsole.exe" list2 | findstr worker
```

---

## 🛠️ Các lệnh hữu ích

### PM2 Management

```bash
# Restart tất cả workers
pm2 restart all

# Restart worker cụ thể
pm2 restart instance-13

# Stop tất cả
pm2 stop all

# Delete tất cả
pm2 delete all

# Reload PM2 config
pm2 startOrReload ecosystem.workers.config.cjs

# Lưu config hiện tại
pm2 save

# Khôi phục từ saved config
pm2 resurrect
```

### Development

```bash
# Build server
npm run build:server

# Build client
npm run build:client

# Build cả hai
npm run build

# Chỉ chạy server
npm run dev:server

# Chỉ chạy client
npm run dev:client
```

### LDPlayer Control

```bash
# Launch instance
"D:\LDPlayer\LDPlayer9\ldconsole.exe" launch --name "worker_16_16"

# Quit instance
"D:\LDPlayer\LDPlayer9\ldconsole.exe" quit --name "worker_16_16"

# Reboot instance
"D:\LDPlayer\LDPlayer9\ldconsole.exe" reboot --name "worker_16_16"

# Get ADB port
"D:\LDPlayer\LDPlayer9\ldconsole.exe" getprop --name "worker_16_16" --key "adb_debug_port"
```

---

## ⚠️ Xử lý sự cố

### PM2 workers không start

```bash
# Kiểm tra logs
pm2 logs --err

# Xóa và start lại
pm2 delete all
pm2 start ecosystem.workers.config.cjs
pm2 save
```

### Server không kết nối được

```bash
# Kiểm tra port có bị chiếm không
netstat -ano | findstr :5051

# Kill process trên port
taskkill /F /PID <PID>
```

### UI không load profiles

1. Kiểm tra server đang chạy: `netstat -ano | findstr :5051`
2. Kiểm tra client đang chạy: `netstat -ano | findstr :7000`
3. Hard refresh browser: `Ctrl + Shift + R`
4. Kiểm tra console logs trong browser (F12)

### PM2 daemon issues

```bash
# Kill PM2 daemon
pm2 kill

# Start lại
pm2 start ecosystem.workers.config.cjs
```

---

## 🔍 Thông tin kỹ thuật

### Ports

| Service | Port | Protocol |
|---------|------|----------|
| API Server | 5051 | HTTP |
| Frontend | 7000 | HTTP |
| WebSocket | 5051 | WS |
| LDPlayer ADB | 5632-5649 | TCP |

### PM2 Configuration

- **Config file**: `ecosystem.workers.config.cjs`
- **Log directory**: `logs/pm2/instances/`
- **Worker script**: `dist/workers/instance-worker.js`
- **Auto-restart**: Enabled
- **Max memory**: 300MB per worker
- **Min uptime**: 5 seconds
- **Max restarts**: 10 times

### Environment Variables

PM2 workers sử dụng các biến môi trường:
- `NODE_ENV`: production
- `PROFILE_ID`: 13-19
- `INSTANCE_NAME`: tên instance LDPlayer
- `ADB_PORT`: port ADB của instance

---

## 📝 Notes

### PM2Service Limitation

Do bug của PM2 library trên Windows, `PM2Service.connect()` đã được disable:
- Server KHÔNG thể query trạng thái PM2 workers qua API
- PM2 UI sẽ không hiển thị realtime data
- Sử dụng `pm2 list` command để xem trạng thái

### Fingerprint

Mỗi profile clone đã được tự động áp dụng device fingerprint:
- IMEI ngẫu nhiên
- Android ID ngẫu nhiên
- Model, Brand, Manufacturer giữ nguyên (OPPO CPH2269)

### Missing Profile 15

Profile 15 (worker_15) bị thiếu LDPlayer instance. Hệ thống vẫn hoạt động bình thường với 6 profiles còn lại.

---

## 🚀 Production Deployment

Khi deploy lên production:

1. Build assets:
   ```bash
   npm run build
   ```

2. Start PM2 ecosystem:
   ```bash
   pm2 start ecosystem.config.cjs --env production
   pm2 save
   ```

3. Enable PM2 startup:
   ```bash
   pm2 startup
   # Copy và chạy command được hiển thị
   ```

4. Monitor:
   ```bash
   pm2 monit
   pm2 logs
   ```

---

**Last Updated**: 2025-10-27
**System Status**: ✅ Running
**Total Profiles**: 6 (missing profile 15)
**PM2 Workers**: 7 online
