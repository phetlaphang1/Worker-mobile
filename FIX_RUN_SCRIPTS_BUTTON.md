# ✅ Fix: Run Scripts Button Issue

## 🔍 Phân Tích

### ❓ Vấn Đề Ban Đầu
Bạn gặp vấn đề: **Ấn button "Run Scripts" trên các instance không chạy được**

### 📊 Hiểu Rõ Requirements

Sau khi clarify với bạn, hệ thống có 2 loại buttons:

1. **"Run All"** button:
   - Launch TẤT CẢ instances
   - Run scripts trên TẤT CẢ instances
   - API: `POST /api/profiles/run-all-with-scripts`

2. **"Run" button (riêng lẻ)**:
   - Launch 1 instance cụ thể
   - Run script của instance đó
   - API: `POST /api/profiles/:id/launch`

### ✅ Kết Quả Kiểm Tra

**Backend API:**
- ✅ Endpoint `/api/profiles/:id/launch` **ĐÃ TỒN TẠI** (line 875)
- ✅ Logic **ĐÚNG**:
  ```typescript
  // 1. Launch instance
  await profileManager.activateProfile(profileId);

  // 2. Execute script if exists
  const scriptContent = profile.metadata?.scriptContent;
  if (scriptContent && scriptContent.trim() !== '') {
    const task = await directScriptService.queueScript(scriptContent, profileId);
  }
  ```

**Frontend:**
- ✅ Button "Run" gọi `launchProfileMutation`
- ✅ Mutation gọi đúng API: `POST /api/profiles/${profileId}/launch`
- ✅ Handle response đúng

## 🐛 Nguyên Nhân Có Thể

Nếu button "Run" không hoạt động, có thể do:

### 1. **Profile Không Có Script**

Check xem profile có `metadata.scriptContent` không:

```bash
# Check profile 8
cat data/profiles/8.json | grep -A 2 "scriptContent"
```

**Fix:** Record script trong Automation Builder và save vào profile.

---

### 2. **DirectScriptService Chưa Khởi Tạo**

Check logs khi khởi động server:

```
[SERVER] DirectMobileScriptService initialized ✅
```

Nếu không thấy → Check `server/index.ts` line 105.

---

### 3. **Instance Tên Không Khớp**

Nếu instanceName trong profile không khớp với tên trong LDPlayer:

```bash
# Check profiles
curl http://localhost:5051/api/diagnostic/run-scripts

# Check LDPlayer instances
"D:\LDPlayer\LDPlayer9\ldconsole.exe" list2
```

**Fix:** Xóa profile orphaned hoặc update instanceName.

---

### 4. **Browser Console Errors**

Mở DevTools (F12) → Console tab → Ấn "Run" → Xem có lỗi không.

**Common errors:**
- `Network Error` - Server không chạy
- `500 Internal Server Error` - Lỗi backend
- `404 Not Found` - Endpoint không tồn tại (không phải case này)

---

## 🔧 Diagnostic Steps

### Step 1: Check System Status

```bash
curl http://localhost:5051/api/diagnostic/run-scripts
```

**Expected:**
```json
{
  "systemStatus": {
    "directScriptServiceInitialized": true,
    "profileManagerInitialized": true
  },
  "profiles": [
    {
      "id": 8,
      "name": "Instance_3",
      "status": "inactive",
      "hasScript": true,
      "scriptLength": 2794
    }
  ],
  "summary": {
    "profilesWithScripts": 5
  }
}
```

---

### Step 2: Manual Test API

```bash
# Test launch profile 8
curl -X POST http://localhost:5051/api/profiles/8/launch
```

**Expected response:**
```json
{
  "success": true,
  "message": "Profile launched and script executing",
  "execution": {
    "taskId": "direct_script_xxx",
    "status": "RUNNING",
    "profileName": "Instance_3",
    "timestamp": "2025-10-21T...",
    "config": {
      "profileId": 8,
      "instanceName": "Instance_3_8",
      "port": 5611
    }
  }
}
```

---

### Step 3: Check Server Logs

Khi ấn button "Run", server logs phải hiện:

```
[LAUNCH] Launching instance for profile Instance_3 (current status: inactive)
Executing script for profile Instance_3
[SCRIPT] Starting script execution for profile: Instance_3 (ID: 8)
[SCRIPT] Connecting ADB to 127.0.0.1:5611...
[SCRIPT] Executing user script now...
```

Nếu KHÔNG thấy logs → Request không tới server → Check:
- Server có chạy không?
- Client gọi đúng URL không?
- CORS settings OK không?

---

### Step 4: Check Browser Network Tab

DevTools → Network tab → Ấn "Run" → Tìm request `/launch`

Check:
- Request URL: `http://localhost:5051/api/profiles/8/launch`
- Method: `POST`
- Status: `200 OK` (nếu success) hoặc `500` (nếu error)
- Response body: JSON với execution info

---

## ✅ Giải Pháp

### Nếu Profile Không Có Script:

1. Vào **Automation Builder**
2. Chọn profile cần edit
3. Record actions (tap, type, swipe, ...)
4. Ấn **"Copy"** hoặc **"Download"**
5. Script tự động lưu vào `profile.metadata.scriptContent`

### Nếu DirectScriptService Chưa Khởi Tạo:

Check `server/index.ts` line 105:
```typescript
const directScriptService = new DirectMobileScriptService(ldPlayerController, profileManager);
```

Restart server.

### Nếu Instance Orphaned:

```bash
# Xóa profile orphaned
rm data/profiles/15.json  # (ví dụ profile 15)
```

Hoặc re-import instances:
```bash
curl -X POST http://localhost:5051/api/profiles/scan-and-import
```

---

## 📝 Tóm Tắt

**API Endpoints:**

| Button | Endpoint | Chức Năng |
|--------|----------|-----------|
| **Run All** | `POST /api/profiles/run-all-with-scripts` | Launch tất cả + Run tất cả scripts |
| **Run** (riêng lẻ) | `POST /api/profiles/:id/launch` | Launch 1 instance + Run script của nó |

**Flow:**
```
Button "Run"
  → launchProfileMutation.mutate({ profileId: 8 })
  → POST /api/profiles/8/launch
  → profileManager.activateProfile(8)  // Launch instance
  → directScriptService.queueScript()  // Run script
  → Response with execution info
```

---

## 🎯 Next Steps

1. **Check diagnostic endpoint:**
   ```bash
   curl http://localhost:5051/api/diagnostic/run-scripts
   ```

2. **Test manual launch:**
   ```bash
   curl -X POST http://localhost:5051/api/profiles/8/launch
   ```

3. **Check browser console** khi ấn "Run"

4. **Check server logs** khi ấn "Run"

5. **Cung cấp thông tin:**
   - Browser console errors (nếu có)
   - Server logs (nếu có)
   - Network tab response (nếu có)

Với thông tin này tôi sẽ debug chính xác hơn!

---

**Status**: ✅ API đã có sẵn và hoạt động. Cần kiểm tra xem tại sao client không nhận được response hoặc có lỗi gì khi gọi.
