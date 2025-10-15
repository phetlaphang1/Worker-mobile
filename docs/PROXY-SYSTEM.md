```markdown
# Proxy Management System

## Overview

Hệ thống quản lý proxy pool với khả năng:
- **Auto-assign proxy** cho mỗi instance (1 instance = 1 IP riêng)
- **Proxy rotation** với nhiều strategies (round-robin, random, least-used)
- **Sticky assignment** - Instance luôn dùng cùng 1 proxy
- **Health checking** - Tự động kiểm tra proxy có hoạt động không
- **Load từ file** - Import/export danh sách proxies

---

## Architecture

```
┌─────────────────┐
│  Proxy File     │
│  (proxies.txt)  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐      ┌──────────────────┐
│  ProxyManager   │─────→│   ProxyPool      │
│                 │      │  (Rotation Logic)│
└────────┬────────┘      └──────────────────┘
         │
         ↓
┌─────────────────┐      ┌──────────────────┐
│  Assignments    │      │  Health Checker  │
│  (Instance→IP)  │      │  (Curl Test)     │
└─────────────────┘      └──────────────────┘
```

---

## Features

### 1. Proxy Pool Management

**Load proxies từ file**:
```typescript
const proxyManager = new ProxyManager({
  proxies: [],
  rotationStrategy: 'round-robin',
  maxUsagePerProxy: 100
});

// Load từ file
await proxyManager.loadProxiesFromFile('./data/proxies.txt');
```

**Add proxy manually**:
```typescript
proxyManager.addProxy({
  type: 'http',
  host: '1.2.3.4',
  port: 8080,
  username: 'user',
  password: 'pass'
});
```

### 2. Rotation Strategies

**Round Robin** - Xoay vòng tuần tự:
```typescript
{
  rotationStrategy: 'round-robin'
}
// proxy1 → proxy2 → proxy3 → proxy1 → ...
```

**Random** - Chọn ngẫu nhiên:
```typescript
{
  rotationStrategy: 'random'
}
// Random proxy mỗi lần
```

**Least Used** - Dùng proxy ít được sử dụng nhất:
```typescript
{
  rotationStrategy: 'least-used'
}
// Tự động balance load
```

### 3. Sticky Assignment (1 Instance = 1 IP)

**Auto-assign với sticky**:
```typescript
// Instance sẽ LUÔN dùng cùng 1 proxy
const proxy = proxyManager.assignProxyToInstance('instance-1', true);

// Lần sau gọi lại → vẫn proxy cũ
const sameProxy = proxyManager.assignProxyToInstance('instance-1', true);
```

**Manual assign proxy cụ thể**:
```typescript
// Assign proxy tại index 5 cho instance
proxyManager.assignSpecificProxy('instance-1', 5, true);
```

### 4. Proxy Rotation (Force Change)

```typescript
// Đổi proxy khẩn cấp (khi proxy bị block)
const newProxy = proxyManager.rotateProxyForInstance('instance-1');
```

### 5. Health Checking

**Manual health check**:
```typescript
// Check 1 proxy
await proxyManager.checkProxyHealth(proxy);

// Check tất cả
await proxyManager.checkAllProxiesHealth();
```

**Auto health check**:
```typescript
// Start auto check mỗi 5 phút
proxyManager.startHealthCheck(300000);

// Stop
proxyManager.stopHealthCheck();
```

---

## API Endpoints

### List All Proxies
```http
GET /api/proxies

Response:
{
  "total": 10,
  "proxies": [
    {
      "type": "http",
      "host": "1.2.3.4",
      "port": 8080,
      "hasAuth": true
    }
  ]
}
```

### Add Proxy
```http
POST /api/proxies
Content-Type: application/json

{
  "type": "http",
  "host": "1.2.3.4",
  "port": 8080,
  "username": "user",
  "password": "pass"
}

Response:
{
  "success": true,
  "proxy": {
    "type": "http",
    "host": "1.2.3.4",
    "port": 8080,
    "hasAuth": true
  }
}
```

### Remove Proxy
```http
DELETE /api/proxies/1.2.3.4/8080

Response:
{
  "success": true,
  "message": "Removed proxy 1.2.3.4:8080"
}
```

### Get Proxy Statistics
```http
GET /api/proxies/stats

Response:
{
  "total": 10,
  "healthy": 8,
  "unhealthy": 2,
  "unchecked": 0,
  "assignments": 5,
  "stickyAssignments": 5,
  "healthStatus": [...]
}
```

### Assign Proxy to Instance
```http
POST /api/proxies/assign/instance-1
Content-Type: application/json

{
  "sticky": true,
  "proxyIndex": 3  // Optional - manual assignment
}

Response:
{
  "success": true,
  "instanceName": "instance-1",
  "proxy": {
    "type": "http",
    "host": "1.2.3.4",
    "port": 8080
  },
  "sticky": true
}
```

### Rotate Proxy for Instance
```http
POST /api/proxies/rotate/instance-1

Response:
{
  "success": true,
  "instanceName": "instance-1",
  "newProxy": {
    "type": "http",
    "host": "5.6.7.8",
    "port": 3128
  }
}
```

### Remove Proxy Assignment
```http
DELETE /api/proxies/assign/instance-1

Response:
{
  "success": true,
  "message": "Removed proxy assignment for instance-1"
}
```

### Get All Assignments
```http
GET /api/proxies/assignments

Response:
{
  "total": 5,
  "assignments": [
    {
      "instanceName": "instance-1",
      "proxy": {
        "type": "http",
        "host": "1.2.3.4",
        "port": 8080
      },
      "assignedAt": "2025-10-15T10:00:00Z",
      "sticky": true
    }
  ]
}
```

### Get Proxy for Instance
```http
GET /api/proxies/assignment/instance-1

Response:
{
  "instanceName": "instance-1",
  "proxy": {
    "type": "http",
    "host": "1.2.3.4",
    "port": 8080,
    "hasAuth": true
  }
}
```

### Trigger Health Check
```http
POST /api/proxies/health-check

Response:
{
  "success": true,
  "message": "Health check started"
}
```

### Start Auto Health Check
```http
POST /api/proxies/start-health-check
Content-Type: application/json

{
  "intervalMs": 300000  // 5 minutes
}

Response:
{
  "success": true,
  "message": "Started health check every 300000ms"
}
```

### Stop Auto Health Check
```http
POST /api/proxies/stop-health-check

Response:
{
  "success": true,
  "message": "Stopped health check"
}
```

### Load Proxies from File
```http
POST /api/proxies/load
Content-Type: application/json

{
  "filePath": "./data/proxies.txt"  // Optional
}

Response:
{
  "success": true,
  "loaded": 10,
  "message": "Loaded 10 proxies from file"
}
```

### Save Proxies to File
```http
POST /api/proxies/save
Content-Type: application/json

{
  "filePath": "./data/proxies.txt"  // Optional
}

Response:
{
  "success": true,
  "message": "Proxies saved to file"
}
```

---

## Proxy File Format

**File**: `data/proxies.txt`

```
# HTTP Proxies
http://1.2.3.4:8080
http://user:pass@5.6.7.8:3128

# SOCKS5 Proxies
socks5://10.20.30.40:1080
socks5://proxyuser:proxypass@192.168.1.100:1080

# HTTPS Proxies
https://50.60.70.80:443
https://user:pass@51.61.71.81:8443
```

**Format**: `type://[username:password@]host:port`

**Supported Types**:
- `http`
- `https`
- `socks4`
- `socks5`

---

## Integration with ProfileManager

### Auto-assign proxy khi launch instance:

```typescript
import { getProxyManager } from './routes/proxy.js';

// In ProfileManager.activateProfile()
const proxyManager = getProxyManager();

if (proxyManager) {
  // Assign proxy với sticky = true (1 instance = 1 IP)
  const proxy = proxyManager.assignProxyToInstance(profile.instanceName, true);

  if (proxy) {
    // Apply proxy to LDPlayer instance
    await this.controller.setProxyAdvanced(profile.instanceName, proxy);

    // Update profile
    profile.network = {
      useProxy: true,
      proxyType: proxy.type,
      proxyHost: proxy.host,
      proxyPort: proxy.port,
      proxyUsername: proxy.username,
      proxyPassword: proxy.password
    };

    await this.saveProfile(profile);
  }
}
```

---

## Usage Examples

### Example 1: Load proxies và auto-assign

```typescript
// Initialize proxy manager
const proxyManager = initializeProxyManager({
  proxies: [],
  rotationStrategy: 'least-used',
  maxUsagePerProxy: 100
});

// Load proxies
await proxyManager.loadProxiesFromFile('./data/proxies.txt');

// Start health check
proxyManager.startHealthCheck(300000); // 5 minutes

// When launching instances
for (const instance of instances) {
  const proxy = proxyManager.assignProxyToInstance(instance.name, true);

  if (proxy) {
    await ldController.setProxyAdvanced(instance.name, proxy);
  }
}
```

### Example 2: Manual proxy rotation

```typescript
// Instance bị block IP → rotate proxy
const newProxy = proxyManager.rotateProxyForInstance('instance-1');

if (newProxy) {
  // Apply new proxy
  await ldController.setProxyAdvanced('instance-1', newProxy);

  // Restart instance để áp dụng proxy mới
  await ldController.restartInstance('instance-1');
}
```

### Example 3: Get statistics

```typescript
const stats = proxyManager.getStats();

console.log(`Total proxies: ${stats.total}`);
console.log(`Healthy: ${stats.healthy}`);
console.log(`Unhealthy: ${stats.unhealthy}`);
console.log(`Active assignments: ${stats.assignments}`);

// Check which instances are using which proxies
stats.assignments.forEach(a => {
  console.log(`${a.instanceName} → ${a.proxy}`);
});
```

---

## Health Check Details

Health check sử dụng `curl` để test proxy:

```bash
curl -x http://1.2.3.4:8080 -U user:pass --max-time 10 https://httpbin.org/ip
```

**Response**:
```json
{
  "origin": "1.2.3.4"  // Proxy IP
}
```

**Health Status**:
- ✅ **Healthy**: Response trong 10s, có IP
- ❌ **Unhealthy**: Timeout hoặc lỗi
- **Fail Count**: Số lần failed liên tiếp

**Auto-remove unhealthy proxies** (optional):
```typescript
// Sau mỗi health check, remove proxies có fail count > 3
const stats = proxyManager.getStats();
stats.healthStatus.forEach(h => {
  if (!h.isHealthy && h.failCount > 3) {
    proxyManager.removeProxy(h.proxy.host, h.proxy.port);
  }
});
```

---

## Best Practices

### 1. Sticky Assignment cho Multi-Accounting
```typescript
// Mỗi account/profile PHẢI dùng cùng 1 IP
proxyManager.assignProxyToInstance(profile.instanceName, true);
```

### 2. Health Check định kỳ
```typescript
// Check mỗi 5 phút
proxyManager.startHealthCheck(300000);
```

### 3. Backup proxy list
```typescript
// Save proxies to file định kỳ
await proxyManager.saveProxiesToFile('./backup/proxies-backup.txt');
```

### 4. Monitor proxy usage
```typescript
// Check usage stats
const stats = proxyManager.getStats();

// Alert if too many unhealthy proxies
if (stats.unhealthy > stats.total * 0.3) {
  // 30% proxies failed
  logger.warn('Too many unhealthy proxies!');
}
```

---

## Troubleshooting

### Proxy không hoạt động

1. **Check health**:
```bash
curl -x http://1.2.3.4:8080 https://httpbin.org/ip
```

2. **Check LDPlayer proxy settings**:
```bash
ldconsole getprop --name "instance-1" --key "net.proxy"
```

3. **Check ADB proxy**:
```bash
adb -s 127.0.0.1:5573 shell settings get global http_proxy
```

### Proxy bị block

```typescript
// Rotate immediately
const newProxy = proxyManager.rotateProxyForInstance('instance-1');
await ldController.setProxyAdvanced('instance-1', newProxy);
await ldController.restartInstance('instance-1');
```

### Load balancing không đều

```typescript
// Use 'least-used' strategy
const proxyManager = new ProxyManager({
  proxies: [],
  rotationStrategy: 'least-used'
});

// Check usage
const stats = proxyManager.getStats();
console.log(stats.poolStats.usageStats);
```

---

## Security Notes

⚠️ **IMPORTANT**:
- Proxy credentials được lưu trong `data/proxies.txt` - **KHÔNG commit file này lên git**
- Add `data/proxies.txt` vào `.gitignore`
- Sử dụng environment variables cho sensitive data
- Mã hóa proxy credentials nếu cần

**.gitignore**:
```
data/proxies.txt
data/proxy-backup.txt
```

---

## Future Enhancements

- [ ] WebSocket notification khi proxy failed
- [ ] Auto-rotate khi detect IP block
- [ ] Proxy geolocation matching (VN instance → VN proxy)
- [ ] Proxy cost tracking (premium proxies)
- [ ] Proxy speed testing (latency, bandwidth)
- [ ] Proxy blacklist (block bad proxies)
- [ ] Integration with proxy providers API (buy/renew proxies)

---

## Version History

- **v1.0** (2025-10-15): Initial release
  - Proxy pool management
  - Sticky assignments
  - Health checking
  - API endpoints

---

## Support

For issues or questions:
- Check health status: `GET /api/proxies/stats`
- Check logs: `logs/combined.log`
- Test proxy manually: `curl -x proxy https://httpbin.org/ip`
```
