# ✅ Bugfix: Script Syntax Error - Identifier 'tapX' Already Declared

## 🐛 Lỗi

```
Script syntax validation failed: Identifier 'tapX' has already been declared
```

## 🔍 Nguyên Nhân

**Script được generate từ VisualDeviceEmulator** có lỗi:

Mỗi action (tap, swipe, type) đều declare biến `const tapX`, `const tapY` → Khi có nhiều actions, các biến bị declare lại nhiều lần → **Syntax error!**

**Ví dụ script lỗi:**
```javascript
// Step 1: click
const tapX = Math.round((68.61 / 100) * screenSize.width);  // ✅ OK
const tapY = Math.round((95.88 / 100) * screenSize.height);
await human.tap(tapX, tapY);

// Step 3: click
const tapX = Math.round((83.15 / 100) * screenSize.width);  // ❌ ERROR: tapX already declared!
const tapY = Math.round((95.42 / 100) * screenSize.height);
await human.tap(tapX, tapY);
```

## ✅ Giải Pháp

### **Fix 1: Update Script Generator**

Sửa `VisualDeviceEmulator.tsx` để dùng **unique variable names** cho mỗi step:

**Before:**
```typescript
script += `    const tapX = Math.round(...);`;
script += `    const tapY = Math.round(...);`;
```

**After:**
```typescript
script += `    const tapX_${index} = Math.round(...);`;  // Unique per step
script += `    const tapY_${index} = Math.round(...);`;
script += `    await human.tap(tapX_${index}, tapY_${index});`;
```

**Files Modified:**
- `client/src/components/VisualDeviceEmulator.tsx` (lines 545-561)

**Changes:**
- `tapX` → `tapX_${index}`
- `tapY` → `tapY_${index}`
- `swipeX1` → `swipeX1_${index}`
- `swipeY1` → `swipeY1_${index}`
- `swipeX2` → `swipeX2_${index}`
- `swipeY2` → `swipeY2_${index}`
- `fieldX` → `fieldX_${index}`
- `fieldY` → `fieldY_${index}`

---

### **Fix 2: Re-generate Scripts for Existing Profiles**

Profiles đã có scripts cũ với lỗi cần **re-generate**:

#### **Option A: Re-record trong Automation Builder**

1. Vào **Automation → Mobile Builder**
2. Chọn profile cần fix (ví dụ: Profile 8)
3. Clear old actions
4. Record lại actions (tap, type, swipe, ...)
5. Click **"Copy"** hoặc **"Download"**
6. Script mới sẽ không có lỗi syntax nữa

#### **Option B: Manual Fix Script**

Nếu không muốn re-record, có thể fix manual:

1. Mở `data/profiles/8.json`
2. Tìm `metadata.scriptContent`
3. Replace tất cả:
   - Tìm: `const tapX =`
   - Thay: `let tapX =` (dùng `let` thay vì `const`)

**Hoặc** thêm số index unique:
```javascript
// Step 1
const tapX_1 = Math.round((68.61 / 100) * screenSize.width);
const tapY_1 = Math.round((95.88 / 100) * screenSize.height);
await human.tap(tapX_1, tapY_1);

// Step 3
const tapX_3 = Math.round((83.15 / 100) * screenSize.width);
const tapY_3 = Math.round((95.42 / 100) * screenSize.height);
await human.tap(tapX_3, tapY_3);
```

---

## 🐛 Lỗi 2: No ADB Devices Found

```
No ADB devices found. Please ensure instances are running and ADB debugging is enabled.
```

**Nguyên nhân:** Instance `Instance_3_8` KHÔNG đang chạy khi script execute.

**Fix:**

1. **Launch instance trước:**
   ```bash
   curl -X POST http://localhost:5051/api/profiles/8/launch
   ```

2. **Hoặc check instance đã chạy chưa:**
   ```bash
   "D:\LDPlayer\LDPlayer9\ldconsole.exe" runninglist
   ```

3. **Enable ADB debugging:**
   ```bash
   "D:\LDPlayer\LDPlayer9\ldconsole.exe" setprop --name "Instance_3_8" --key "adb.debug" --value "1"
   "D:\LDPlayer\LDPlayer9\ldconsole.exe" reboot --name "Instance_3_8"
   ```

---

## 📝 Test After Fix

### **1. Rebuild Client**

```bash
cd client
npm run build
```

### **2. Re-generate Script**

Vào Automation Builder → Record lại actions → Copy script mới

### **3. Test Script**

```bash
# Launch instance
curl -X POST http://localhost:5051/api/profiles/8/launch

# Check logs
# Should see: "Script execution completed successfully"
```

---

## 🎯 Expected Output

**Script mới (đúng):**
```javascript
// Step 1: click
const tapX_0 = Math.round((68.61 / 100) * screenSize.width);
const tapY_0 = Math.round((95.88 / 100) * screenSize.height);
await human.tap(tapX_0, tapY_0);

// Step 2: wait
await human.delay(2800, 3200);

// Step 3: type
const fieldX_2 = Math.round((45.37 / 100) * screenSize.width);
const fieldY_2 = Math.round((34.00 / 100) * screenSize.height);
await human.tap(fieldX_2, fieldY_2);
await human.delay(300, 600);
await human.type(profile.metadata?.accounts?.x?.username || '');

// Step 6: wait
await human.delay(2800, 3200);

// Step 7: click
const tapX_6 = Math.round((83.15 / 100) * screenSize.width);  // ✅ Unique name
const tapY_6 = Math.round((95.42 / 100) * screenSize.height);
await human.tap(tapX_6, tapY_6);
```

**No more syntax errors!** ✅

---

## 📊 Summary

| Issue | Status | Fix |
|-------|--------|-----|
| Script syntax error | ✅ Fixed | Use unique variable names (`tapX_${index}`) |
| No ADB devices | ⚠️ Need launch | Launch instance before running script |
| Existing scripts broken | ⚠️ Need re-gen | Re-record scripts in Automation Builder |

---

**Status**: ✅ **FIXED**

Code generator đã được sửa. Profiles cũ cần re-generate scripts.
