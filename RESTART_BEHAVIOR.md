# 🔄 Hành Vi Khởi Động Lại Hệ Thống

## ✅ Đã Thực Hiện

### 1. **Reset Trạng Thái Khi Startup**

Mỗi khi server khởi động (`npm run dev`), hệ thống sẽ:

```typescript
// server/index.ts (line ~362)
directScriptService.clearAllTasks();
```

- ✅ **Xóa tất cả tasks pending/running** từ session trước
- ✅ **Queue trống** - Không còn script cũ nào đang chờ
- ✅ **Fresh start** - UI sẽ không thấy tasks cũ

### 2. **PM2 Status Hiển Thị Trên UI**

**Vấn đề cũ**: PM2 library có bug trên Windows, throw uncaught exceptions.

**Giải pháp mới**: Dùng PM2 CLI thay vì library

```typescript
// server/services/PM2Service.ts
static async getAllInstancesStatus(): Promise<PM2InstanceStatus[]> {
  const { execSync } = await import('child_process');
  const output = execSync('pm2 jlist', { encoding: 'utf-8' });
  const processList = JSON.parse(output);
  // ... parse and return
}
```

- ✅ **Không còn lỗi** `ReqSocket.connectHandler`
- ✅ **UI hiển thị PM2 status** - Realtime worker info
- ✅ **Windows-safe** - Sử dụng CLI command thay vì library

### 3. **Graceful Shutdown**

Khi tắt server (Ctrl+C), hệ thống sẽ:

```typescript
// server/index.ts - gracefulShutdown()
1. Stop device monitor
2. Stop task executor
3. Deactivate all profiles (stop scripts)
4. Stop all LDPlayer instances (if running)
5. Stop PM2 workers
6. Close server
```

- ✅ **Tắt LDPlayer instances** khi server tắt
- ✅ **Stop PM2 workers** (optional - có thể giữ chạy)
- ✅ **Clean exit** - Không để process zombie

---

## 🎯 Quy Trình Khởi Động Đúng

### Bước 1: Start PM2 Workers (Chỉ 1 lần)

```bash
pm2 start ecosystem.workers.config.cjs
pm2 save
```

**PM2 workers sẽ tự động restart nếu crash**, không cần start lại thủ công.

### Bước 2: Start Development Server

```bash
npm run dev
```

Server sẽ:
1. Kill process cũ trên port 5051/7000 (nếu có)
2. **Clear all tasks** từ session trước
3. Sync PM2 status
4. Start server + client

### Bước 3: Restart Server (Khi Code Thay Đổi)

**Option A: Nodemon tự động restart**
- Nodemon sẽ watch file changes và auto-restart
- Tasks sẽ tự động clear

**Option B: Manual restart**
```bash
# Ctrl+C để stop
npm run dev  # Start lại
```

---

## 🔍 Kiểm Tra PM2 Status Trên UI

### API Endpoint

```bash
# Test PM2 status
curl http://localhost:5051/api/pm2/system/info
```

**Response:**
```json
{
  "success": true,
  "info": {
    "totalProcesses": 7,
    "onlineProcesses": 7,
    "totalMemory": 370,
    "totalCpu": 0
  }
}
```

### UI Dashboard

Mở `http://localhost:7000`, bạn sẽ thấy:

- **PM2 System Info** card:
  - Total Processes: 7
  - Online: 7
  - Memory: ~370MB
  - CPU: 0-5%

- **Per-Profile PM2 Status**:
  - Worker PID
  - Memory usage
  - CPU %
  - Uptime
  - Restart count

---

## ⚠️ Những Điều Cần Biết

### PM2 Workers Độc Lập

PM2 workers (instance-13 đến instance-19) **KHÔNG tự động tắt** khi server tắt, trừ khi:
- Bạn explicitly call `pm2 stop all`
- Graceful shutdown hoàn tất (có thể mất 10-20s)

**Tại sao?**
- PM2 là process manager riêng biệt
- Workers tiếp tục chạy ngay cả khi server crash
- Tốt cho production (high availability)

### Tắt Thủ Công PM2 Workers

```bash
# Stop tất cả PM2 workers
pm2 stop all

# Hoặc stop từng worker
pm2 stop instance-13
pm2 stop instance-14
# ...
```

### LDPlayer Instances

**Không tự động tắt** khi server tắt, nhưng:
- Graceful shutdown sẽ call `stopAllInstances()`
- Có thể mất 20-30s để quit tất cả instances
- Nếu force kill server (kill -9), instances vẫn chạy

**Tắt thủ công:**
```bash
"D:\LDPlayer\LDPlayer9\ldconsole.exe" quitall
```

---

## 🐛 Troubleshooting

### UI không hiển thị PM2 status

1. **Check PM2 có chạy không:**
   ```bash
   pm2 list
   ```

2. **Test API trực tiếp:**
   ```bash
   curl http://localhost:5051/api/pm2/system/info
   ```

3. **Xem server logs:**
   ```
   [SERVER] 🔄 Syncing PM2 status with profiles...
   [SERVER] ✅ Found 7 PM2 instances running
   ```

### Scripts không chạy sau restart

**Nguyên nhân**: Tasks bị clear khi restart.

**Giải pháp**: Chạy script lại từ UI - đây là behavior mong muốn!

### PM2 workers không start

```bash
# Restart PM2 daemon
pm2 kill
pm2 start ecosystem.workers.config.cjs
pm2 save
```

### Port conflict

```bash
# Check ports
netstat -ano | findstr :5051
netstat -ano | findstr :7000

# Kill process
taskkill /F /PID <PID>
```

---

## 📝 Changes Made

### Files Modified

1. **server/services/PM2Service.ts**
   - Replace PM2 library calls với CLI commands
   - Fix Windows compatibility bug
   - Method: `getAllInstancesStatus()` now uses `execSync('pm2 jlist')`

2. **server/index.ts**
   - Add `clearAllTasks()` on startup (line ~362)
   - Keep existing graceful shutdown logic
   - Clear tasks before starting device monitor

3. **server/services/DirectMobileScriptService.ts**
   - Add `clearAllTasks()` method
   - Clear queue and running scripts map

### Behavior Changes

| Before | After |
|--------|-------|
| PM2 status không hiển thị (disabled) | ✅ PM2 status hiển thị trên UI |
| Tasks từ session cũ còn pending | ✅ Tasks clear khi restart |
| PM2 library throw errors | ✅ Dùng CLI, không lỗi |
| UI không biết PM2 workers | ✅ UI hiển thị 7 workers |

---

## 🚀 Production Recommendations

### Auto-Start PM2 on Boot

```bash
# Enable PM2 startup
pm2 startup

# Save current process list
pm2 save
```

### Monitor PM2 Health

```bash
# Real-time monitoring
pm2 monit

# View logs
pm2 logs

# Check memory leaks
pm2 describe instance-13
```

### Restart Strategy

**Development**: Restart server thoải mái, PM2 workers giữ nguyên.

**Production**:
```bash
# Restart server without downtime
pm2 reload ecosystem.config.cjs --env production

# Restart specific worker
pm2 restart instance-13
```

---

**Last Updated**: 2025-10-27
**Version**: 2.0 - PM2 CLI Integration
**Status**: ✅ Tested on Windows 11
