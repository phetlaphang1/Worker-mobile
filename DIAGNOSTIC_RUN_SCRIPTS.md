# 🔍 Diagnostic: Run Scripts Not Working

## 📋 Checklist Để Debug

Khi ấn button "Run Scripts" không chạy, kiểm tra theo thứ tự:

### ✅ 1. Check Browser Console (F12)

Xem có lỗi JavaScript không:
- Mở DevTools (F12)
- Tab "Console"
- Ấn "Run Scripts"
- Xem có error màu đỏ không

**Các lỗi thường gặp:**
- ❌ `Network Error` - Server không chạy
- ❌ `CORS Error` - CORS issue
- ❌ `500 Internal Server Error` - Lỗi server
- ❌ `404 Not Found` - Endpoint không tồn tại

### ✅ 2. Check Network Tab

Xem request có được gửi không:
- Tab "Network" trong DevTools
- Ấn "Run Scripts"
- Tìm request đến `/api/profiles/run-all-with-scripts`
- Click vào để xem:
  - Status code (200 = OK, 500 = Error)
  - Request payload (profileIds, params)
  - Response body (error message nếu có)

### ✅ 3. Check Server Logs

Xem server có nhận request không:

```bash
# Nếu đang chạy server
# Xem console output khi ấn "Run Scripts"
```

**Log cần tìm:**
```
[API] Run All requested with params: onlyInactive=false, delay=2000, maxConcurrent=1
[RUN ALL] Total loaded profiles: 5
[RUN ALL] Profile IDs: 8, 10, 12, 13, 14
```

### ✅ 4. Check Profiles Have Scripts

Kiểm tra profiles có scriptContent không:

```bash
# Check profile 8
cat data/profiles/8.json | grep -A 5 "scriptContent"

# Check tất cả profiles
for f in data/profiles/*.json; do
  echo "=== $(basename $f) ==="
  cat $f | grep -o '"scriptContent":"[^"]*"' | head -c 100
  echo ""
done
```

### ✅ 5. Check DirectScriptService Initialized

Trong server logs lúc khởi động, cần thấy:

```
[SERVER] DirectMobileScriptService initialized
[SERVER] Server started on port 5051
```

Nếu KHÔNG thấy → Service chưa khởi tạo đúng.

### ✅ 6. Check Profile Status

Profiles phải ở trạng thái **active** mới chạy được script:

```bash
# Check status của tất cả profiles
cat data/profiles/*.json | grep '"status"'
```

**Output mong đợi:**
```json
"status": "active"  ✅ OK
"status": "inactive"  ❌ Cần launch trước
```

### ✅ 7. Manual Test API

Test trực tiếp bằng curl/Postman:

```bash
# Test run-all-with-scripts
curl -X POST http://localhost:5051/api/profiles/run-all-with-scripts \
  -H "Content-Type: application/json" \
  -d '{
    "onlyInactive": false,
    "delay": 2000,
    "maxConcurrent": 1
  }'
```

**Response mong đợi:**
```json
{
  "success": true,
  "successCount": 3,
  "failCount": 0,
  "scriptsExecuted": 3,
  "message": "Launched 3 profile(s), executed 3 script(s)"
}
```

## 🔧 Common Issues & Fixes

### ❌ Issue 1: "Direct Script Service not initialized"

**Lỗi:**
```json
{
  "error": "Direct Script Service not initialized"
}
```

**Nguyên nhân:** DirectScriptService = null

**Fix:**
1. Check file `server/index.ts` line 105:
```typescript
const directScriptService = new DirectMobileScriptService(ldPlayerController, profileManager);
```

2. Check file `server/routes/index.ts` có import đúng không:
```typescript
const { directScriptService } = services;
```

3. Restart server

---

### ❌ Issue 2: No profiles have scripts

**Lỗi:**
```json
{
  "scriptsExecuted": 0,
  "message": "Launched 3 profile(s), executed 0 script(s)"
}
```

**Nguyên nhân:** Profiles không có `metadata.scriptContent`

**Fix:**
1. Vào **Automation Builder**
2. Record script cho mỗi profile
3. Ấn "Copy" hoặc "Download"
4. Paste vào **Profile Settings → Scripts**
5. Save

Hoặc manual edit `data/profiles/X.json`:
```json
{
  "metadata": {
    "scriptContent": "log('Hello');\nawait helpers.sleep(1000);"
  }
}
```

---

### ❌ Issue 3: Profiles are inactive

**Lỗi:**
```
[RUN ALL] Skipping profile 8: success=false
```

**Nguyên nhân:** Profile status = "inactive"

**Fix:**
1. Ấn "Launch All" trước
2. Đợi profiles active
3. Ấn "Run Scripts"

Hoặc set `onlyInactive: false` trong request body.

---

### ❌ Issue 4: Script execution fails

**Lỗi trong logs:**
```
[SCRIPT] Error executing script for profile 8: ...
```

**Nguyên nhân:** Lỗi trong script code

**Fix:**
1. Check script syntax
2. Check `helpers`, `human`, `cloudflare` APIs có sẵn không
3. Check profile có accounts không (nếu script dùng `profile.metadata.accounts`)

---

### ❌ Issue 5: CORS error in browser

**Lỗi:**
```
Access to fetch at 'http://localhost:5051' from origin 'http://localhost:5173' has been blocked by CORS
```

**Fix:**
Check `server/index.ts` có CORS config:
```typescript
app.use(cors({
  origin: '*',
  credentials: true
}));
```

---

## 🧪 Quick Diagnostic Script

Tạo script test nhanh:

```bash
#!/bin/bash
# diagnostic-run-scripts.sh

echo "=== 1. Check Server Running ==="
curl -s http://localhost:5051/api/health || echo "❌ Server not running"

echo -e "\n=== 2. Check Profiles ==="
curl -s http://localhost:5051/api/profiles | jq '.[] | {id, name, status}'

echo -e "\n=== 3. Test Run Scripts ==="
curl -X POST http://localhost:5051/api/profiles/run-all-with-scripts \
  -H "Content-Type: application/json" \
  -d '{"onlyInactive": false}' | jq '.'

echo -e "\n=== 4. Check Tasks ==="
curl -s http://localhost:5051/api/scripts | jq '.[] | {id, status, profileId}'
```

Run:
```bash
chmod +x diagnostic-run-scripts.sh
./diagnostic-run-scripts.sh
```

---

## 📊 Expected Flow

Khi ấn "Run Scripts", flow đúng:

1. **Client sends request:**
   ```
   POST /api/profiles/run-all-with-scripts
   Body: { onlyInactive: false, delay: 2000, maxConcurrent: 1 }
   ```

2. **Server processes:**
   ```
   [API] Run All requested
   [RUN ALL] Total loaded profiles: 5
   [RUN ALL] Processing 5 results to queue scripts...
   [RUN ALL] Queueing script for profile Instance_3 (ID: 8)...
   [RUN ALL] ✅ Queued script task direct_script_xxx for profile Instance_3
   ```

3. **DirectScriptService executes:**
   ```
   [SCRIPT] Starting script execution for profile: Instance_3 (ID: 8)
   [SCRIPT] Connecting ADB to 127.0.0.1:5611...
   [SCRIPT] Executing user script...
   [SCRIPT] Script execution completed successfully
   ```

4. **Client receives response:**
   ```json
   {
     "success": true,
     "successCount": 5,
     "scriptsExecuted": 5,
     "scriptTasks": [...]
   }
   ```

---

## 🎯 Next Steps

Nếu vẫn không chạy, cung cấp:
1. **Browser console errors** (screenshot)
2. **Network tab** (request/response)
3. **Server logs** (khi ấn Run Scripts)
4. **Profile status** (`curl http://localhost:5051/api/profiles | jq`)

Với thông tin này tôi sẽ debug chính xác hơn!
