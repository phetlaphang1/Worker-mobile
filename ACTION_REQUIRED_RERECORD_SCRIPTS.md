# ⚠️ ACTION REQUIRED: Re-record Scripts

## 🎯 Tình Huống Hiện Tại

### ✅ Đã Hoàn Thành:
1. ✅ Fixed script generator code (`VisualDeviceEmulator.tsx`)
2. ✅ Cleared old broken script from Profile 8
3. ✅ Reloaded profiles in memory
4. ✅ Build client thành công

### ⚠️ Cần Làm BÂY GIỜ:
**RE-RECORD scripts mới cho Profile 8** (và các profiles khác nếu cần)

---

## 🚀 Hướng Dẫn Re-record (3 Phút)

### **Bước 1: Mở UI**

```bash
# Nếu chưa chạy client dev server:
cd client
npm run dev

# Hoặc nếu đã build:
# Mở browser: http://localhost:5173
```

---

### **Bước 2: Vào Automation Builder**

1. Mở `http://localhost:5173` trong browser
2. Click tab **"Automation"** (hoặc **"Mobile Builder"**)
3. Chọn profile **"Instance_3"** (ID: 8)
4. Device emulator sẽ hiện ra

---

### **Bước 3: Record Actions**

1. Click button **"Start Recording"** (hoặc icon record)

2. Click vào device screen để record actions:
   - **Open App**: Click "Apps" → Select "Twitter/X"
   - **Tap**: Click vào các buttons, links
   - **Type**: Click vào input fields → Type text
   - **Wait**: Click "Add Wait" → Set duration
   - **Swipe**: Click & drag trên screen

3. **Ví dụ flow Twitter login:**
   ```
   1. Open App: Twitter/X
   2. Wait: 3000ms
   3. Tap: Login button (example coords)
   4. Wait: 2000ms
   5. Tap: Username field
   6. Type: [Select account] → username
   7. Wait: 1000ms
   8. Tap: Next button
   9. Wait: 2000ms
   10. Tap: Password field
   11. Type: [Select account] → password
   12. Wait: 1000ms
   13. Tap: Login button
   ```

4. Click **"Stop Recording"**

---

### **Bước 4: Copy Script**

1. Sau khi record xong, script sẽ generate tự động

2. Click button **"Copy"** hoặc **"Download"**

3. Script sẽ tự động lưu vào `profile.metadata.scriptContent`

4. **Verify script đúng:**
   - Variables có dạng: `tapX_0`, `tapX_1`, `tapX_2`,... (UNIQUE!)
   - Không còn duplicate `const tapX` nữa
   - Dùng `human.*` APIs thay vì `helpers.*`

---

### **Bước 5: Test Script**

1. Click button **"Run"** trên profile Instance_3

2. Xem logs trong console

3. **Kết quả mong đợi:**
   ```
   ✅ Script execution started
   ✅ App launched
   ✅ Human-like tap at X%, Y%
   ✅ Script completed successfully
   ```

---

## 🔍 Verify Script Format

**Script MỚI (đúng):**
```javascript
// Step 1: click
const tapX_0 = Math.round((68.61 / 100) * screenSize.width);  // ✅ Unique
const tapY_0 = Math.round((95.88 / 100) * screenSize.height);
await human.tap(tapX_0, tapY_0);

// Step 2: wait
await human.delay(2800, 3200);

// Step 3: click
const tapX_2 = Math.round((83.15 / 100) * screenSize.width);  // ✅ Unique
const tapY_2 = Math.round((95.42 / 100) * screenSize.height);
await human.tap(tapX_2, tapY_2);
```

**Script CŨ (sai) - KHÔNG còn như này nữa:**
```javascript
// Step 1: click
const tapX = Math.round(...);  // ❌
const tapY = Math.round(...);

// Step 2: click
const tapX = Math.round(...);  // ❌ Duplicate! Error!
const tapY = Math.round(...);
```

---

## 📝 Alternative: Manual Script (Quick Test)

Nếu chỉ muốn test nhanh mà chưa muốn record:

### **Option A: Simple Test Script**

```javascript
log('🚀 Test script...');
await helpers.launchApp('com.twitter.android');
await helpers.sleep(5000);
log('✅ App opened!');
```

Copy script này vào Profile Settings → Scripts tab.

### **Option B: Use API**

```bash
curl -X PUT http://localhost:5051/api/profiles/8 \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "scriptContent": "log(\"Test\");\nawait helpers.launchApp(\"com.twitter.android\");\nlog(\"Done\");"
    }
  }'
```

---

## 🎯 Summary

| Step | Action | Status |
|------|--------|--------|
| 1 | Fix code generator | ✅ Done |
| 2 | Build client | ✅ Done |
| 3 | Clear old script | ✅ Done |
| 4 | **Re-record new script** | ⚠️ **TODO** |
| 5 | Test script | ⚠️ Pending |

---

## ⏱️ Timeline

- **Code fix**: ✅ Done (~30 min)
- **Re-record script**: ⚠️ **Cần làm ngay** (~3 phút)
- **Test**: ⏳ After re-record (~1 phút)

**Total time remaining: ~4 phút**

---

## 💡 Tips

1. **Record slowly** - Đừng click quá nhanh, để device emulator kịp capture
2. **Use waits** - Thêm wait giữa các actions để app kịp load
3. **Test coordinates** - Verify tọa độ đúng trước khi record full flow
4. **Save frequently** - Click "Copy" sau mỗi recording session

---

## 🚨 Nếu Không Muốn Re-record

Dùng script test đơn giản:

```javascript
log('🚀 Starting...');
await helpers.launchApp('com.twitter.android');
await helpers.sleep(3000);
log('✅ Done!');
```

Paste vào Profile 8 settings để test button "Run" hoạt động.

---

**ACTION REQUIRED:** ⚠️ **Vào UI và re-record script cho Profile 8 ngay!**

**URL:** http://localhost:5173 → Automation → Profile Instance_3 → Record

⏱️ **ETA: 3 phút**
