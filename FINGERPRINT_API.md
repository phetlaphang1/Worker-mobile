# 🎭 Fingerprint Randomization API - GemLogin-like Anti-Detect

## 📖 Tổng quan

Fingerprint Service cho phép fake device fingerprint Android để tránh bị detect, tương tự như **GemLogin** hoặc **Phonebox**.

## ✨ **AUTO-FINGERPRINT FEATURE** (Mới!)

Hệ thống **TỰ ĐỘNG apply fingerprint** khi tạo/clone profile! Không cần gọi API riêng.

### **Mặc định: TỰ ĐỘNG BẬT**
- ✅ **Tạo profile mới** → Tự động apply random fingerprint
- ✅ **Clone profile** → Tự động apply fingerprint MỚI (khác profile gốc)
- ⚙️ **Có thể TẮT** bằng cách set `autoApplyFingerprint: false`

## 🔧 Cách hoạt động

LDPlayer cho phép modify device fingerprint qua:
1. **LDConsole commands** - Nhanh nhất, không cần instance running
2. **ADB shell commands** - Fallback, cần instance đang chạy

## 📱 Các thông tin có thể fake

- ✅ **IMEI** (15 số với Luhn checksum)
- ✅ **Android ID** (16 ký tự hex)
- ✅ **Device Model** (VD: Samsung Galaxy S21, Xiaomi Redmi Note 11)
- ✅ **Manufacturer** (Samsung, Xiaomi, Google, OnePlus...)
- ✅ **Brand** (samsung, Redmi, google, OnePlus...)
- ✅ **MAC Address** (WiFi/Bluetooth)
- ✅ **Serial Number**
- ✅ **Phone Number** (optional)
- ✅ **SIM Serial (ICCID)** (optional)

---

## 🚀 API Endpoints

### 1. Generate Random Fingerprint

Tạo fingerprint ngẫu nhiên (không apply vào instance).

```http
POST /api/fingerprint/generate
Content-Type: application/json

{
  "brand": "samsung",  // Optional: samsung, Redmi, google, OnePlus, OPPO, vivo, realme
  "includePhoneNumber": true  // Optional: include phone number
}
```

**Response:**
```json
{
  "success": true,
  "fingerprint": {
    "imei": "354224079314237",
    "androidId": "a3f2d1c4b5e60798",
    "model": "SM-G991B",
    "manufacturer": "samsung",
    "brand": "samsung",
    "device": "o1s",
    "macAddress": "02:1A:3F:D2:8B:C4",
    "serialNumber": "ABC123DEF456",
    "simSerial": "8986031234567890123",
    "phoneNumber": "+11234567890",
    "buildId": "TP1A.220624.014",
    "buildDisplay": "SM-G991B-TP1A.220624.014",
    "fingerprint": "samsung/o1sxxx/o1s:13/TP1A.220624.014/G991BXXU5EWGA:user/release-keys"
  }
}
```

---

### 2. Apply Fingerprint to Instance

Apply fingerprint vào LDPlayer instance.

```http
POST /api/fingerprint/apply/:instanceName
Content-Type: application/json

{
  "fingerprint": {  // Optional: auto-generate if not provided
    "imei": "354224079314237",
    "androidId": "a3f2d1c4b5e60798",
    // ... (full fingerprint object)
  },
  "method": "auto",  // auto | ldconsole | adb
  "requireRestart": false  // Restart instance after applying
}
```

**Response:**
```json
{
  "success": true,
  "instanceName": "test21323",
  "fingerprint": { /* applied fingerprint */ },
  "message": "Fingerprint applied successfully"
}
```

---

### 3. Batch Apply Fingerprints

Apply fingerprints vào nhiều instances cùng lúc.

```http
POST /api/fingerprint/apply-batch
Content-Type: application/json

{
  "instanceNames": ["test21323", "test456", "test789"],
  "useSameBrand": true,  // Tất cả dùng cùng brand
  "brand": "samsung",  // Optional: brand name
  "method": "auto"  // auto | ldconsole | adb
}
```

**Response:**
```json
{
  "success": true,
  "total": 3,
  "successCount": 3,
  "results": [
    {
      "instanceName": "test21323",
      "fingerprint": { /* ... */ }
    },
    // ...
  ]
}
```

---

### 4. Get Current Fingerprint

Đọc fingerprint hiện tại từ instance (requires running instance).

```http
GET /api/fingerprint/:instanceName
```

**Response:**
```json
{
  "success": true,
  "instanceName": "test21323",
  "fingerprint": {
    "imei": "354224079314237",
    "androidId": "a3f2d1c4b5e60798",
    // ...
  }
}
```

---

### 5. Get Cached Fingerprint

Lấy fingerprint từ cache (nhanh, không cần instance running).

```http
GET /api/fingerprint/cache/:instanceName
```

---

### 6. Verify Fingerprint

Kiểm tra xem fingerprint đã apply đúng chưa.

```http
POST /api/fingerprint/verify/:instanceName
Content-Type: application/json

{
  "expectedFingerprint": { /* fingerprint object */ }
}
```

**Response:**
```json
{
  "success": true,
  "instanceName": "test21323",
  "isValid": true,
  "message": "Fingerprint verified"
}
```

---

### 7. Export Fingerprint to JSON

Export fingerprint để backup.

```http
GET /api/fingerprint/export/:instanceName
```

**Response:** File download `test21323_fingerprint.json`

---

### 8. Import Fingerprint from JSON

Restore fingerprint từ backup.

```http
POST /api/fingerprint/import/:instanceName
Content-Type: application/json

{
  "fingerprintJson": "{\"imei\":\"354224079314237\", ...}"
}
```

---

### 9. Get Available Brands

Lấy danh sách brands có sẵn.

```http
GET /api/fingerprint/brands
```

**Response:**
```json
{
  "success": true,
  "brands": ["samsung", "Redmi", "google", "OnePlus", "OPPO", "vivo", "realme"],
  "count": 7
}
```

---

### 10. Get Device Templates

Lấy tất cả templates thiết bị có sẵn.

```http
GET /api/fingerprint/templates
```

**Response:**
```json
{
  "success": true,
  "templates": [
    {
      "brand": "samsung",
      "manufacturer": "samsung",
      "model": "SM-G991B",
      "device": "o1s",
      "buildId": "TP1A.220624.014",
      "fingerprint": "samsung/o1sxxx/o1s:13/TP1A.220624.014/G991BXXU5EWGA:user/release-keys",
      "resolution": "1080x2400",
      "dpi": 450
    },
    // ... 12 templates total
  ],
  "count": 12
}
```

---

## 🚀 **QUICK START - Auto-Fingerprint**

### **1. Tạo profile MỚI (auto-fingerprint enabled)**

```javascript
// Tự động apply random fingerprint khi tạo
await fetch('http://localhost:5051/api/profiles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: "My Profile",
    // autoApplyFingerprint: true (default - không cần khai báo)
  })
});

// ✅ Profile đã có fingerprint unique!
```

### **2. Tạo profile với BRAND cụ thể**

```javascript
await fetch('http://localhost:5051/api/profiles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: "Samsung Profile",
    autoApplyFingerprint: true,
    fingerprintBrand: "samsung"  // Chỉ định brand
  })
});

// ✅ Profile với Samsung Galaxy S21/S21+/A52 random
```

### **3. Clone profile với fingerprint MỚI**

```javascript
// Clone profile → TỰ ĐỘNG apply fingerprint khác profile gốc
await fetch('http://localhost:5051/api/profiles/1/clone', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    newName: "Cloned Profile",
    // autoApplyFingerprint: true (default)
  })
});

// ✅ Clone có apps giống gốc + fingerprint KHÁC!
```

### **4. Tắt auto-fingerprint (nếu cần)**

```javascript
// Tạo profile KHÔNG apply fingerprint tự động
await fetch('http://localhost:5051/api/profiles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: "Manual Profile",
    autoApplyFingerprint: false  // TẮT auto-apply
  })
});

// Sau đó apply fingerprint manual nếu cần
await fetch('http://localhost:5051/api/fingerprint/apply/Manual_Profile_1', {
  method: 'POST'
});
```

---

## 💡 Use Cases

### Use Case 1: Tạo profile mới với fingerprint unique

```javascript
// CÁCH CŨ (manual):
// 1. Create instance
const instance = await createInstance("my_profile");

// 2. Apply random fingerprint
await fetch('http://localhost:5051/api/fingerprint/apply/my_profile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'ldconsole',
    requireRestart: false
  })
});

// 3. Launch instance
await launchInstance("my_profile");

// CÁCH MỚI (auto):
// 1. Create profile → TỰ ĐỘNG có fingerprint!
await fetch('http://localhost:5051/api/profiles', {
  method: 'POST',
  body: JSON.stringify({ name: "my_profile" })
});

// ✅ Xong! Profile đã có fingerprint unique
```

---

### Use Case 2: Batch tạo 10 profiles với fingerprints khác nhau

```javascript
// CÁCH CŨ (manual):
// 1. Create 10 instances
const instanceNames = [];
for (let i = 0; i < 10; i++) {
  const instance = await createInstance(`profile_${i}`);
  instanceNames.push(instance.name);
}

// 2. Batch apply fingerprints
await fetch('http://localhost:5051/api/fingerprint/apply-batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    instanceNames,
    useSameBrand: false,  // Mỗi profile khác brand
    method: 'ldconsole'
  })
});

// 3. Launch all
for (const name of instanceNames) {
  await launchInstance(name);
}

// CÁCH MỚI (auto - SIÊU NHANH):
// 1. Create 10 profiles → TỰ ĐỘNG có fingerprints!
for (let i = 0; i < 10; i++) {
  await fetch('http://localhost:5051/api/profiles', {
    method: 'POST',
    body: JSON.stringify({ name: `profile_${i}` })
  });
}

// ✅ Xong! 10 profiles đã có 10 fingerprints unique
```

---

### Use Case 3: Clone profile nhưng change fingerprint

```javascript
// CÁCH CŨ (manual):
// 1. Clone profile (clones apps + data)
const clonedProfile = await cloneProfile("source_profile", "cloned_profile");

// 2. Apply new fingerprint to cloned profile
await fetch('http://localhost:5051/api/fingerprint/apply/cloned_profile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    method: 'ldconsole'
  })
});

// Result: Cloned profile with same apps but different fingerprint!

// CÁCH MỚI (auto - 1 DÒNG):
await fetch('http://localhost:5051/api/profiles/1/clone', {
  method: 'POST',
  body: JSON.stringify({ newName: "cloned_profile" })
});

// ✅ Xong! Clone có apps giống gốc + fingerprint KHÁC tự động!
```

---

### Use Case 4: Export/Import fingerprints (backup)

```javascript
// Export fingerprint
const response = await fetch('http://localhost:5051/api/fingerprint/export/my_profile');
const fingerprintJson = await response.text();

// Save to file or database
localStorage.setItem('profile_fingerprint', fingerprintJson);

// Later: Import to new profile
await fetch('http://localhost:5051/api/fingerprint/import/new_profile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fingerprintJson: localStorage.getItem('profile_fingerprint')
  })
});
```

---

## 🎯 Real Device Templates

Hệ thống có **12 device templates** thực tế:

| Brand | Model | Android Version |
|-------|-------|-----------------|
| Samsung | Galaxy S21 (SM-G991B) | 13 |
| Samsung | Galaxy S21+ (SM-G996B) | 13 |
| Samsung | Galaxy A52 (SM-A525F) | 13 |
| Xiaomi | Redmi Note 11 | 13 |
| Xiaomi | Redmi Note 12 Pro | 13 |
| Google | Pixel 7 | 14 |
| Google | Pixel 6 | 14 |
| OnePlus | OnePlus 9 | 13 |
| OnePlus | Nord 2 | 13 |
| OPPO | CPH2269 | 13 |
| Vivo | V2111 | 13 |
| Realme | RMX3393 | 13 |

---

## ⚠️ Important Notes

### 1. LDConsole vs ADB Methods

| Method | Tốc độ | Requires Running | Best For |
|--------|---------|------------------|----------|
| **ldconsole** | Nhanh nhất | ❌ No | Bulk operations, initial setup |
| **adb** | Chậm hơn | ✅ Yes | Fine-tuning, running instances |
| **auto** | Smart | Auto | Recommended (tự chọn method phù hợp) |

### 2. When to Restart Instance

Một số thay đổi **CẦN restart** để có hiệu lực:
- ✅ IMEI, Android ID, MAC Address → **NO restart needed** (via ldconsole)
- ⚠️ Device Model, Manufacturer → **Restart recommended** for full effect

### 3. Fingerprint Persistence

- Fingerprints applied via **ldconsole** → **Persistent** (saved to instance config)
- Fingerprints applied via **ADB** → **Non-persistent** (reset on reboot)

---

## 🔥 Advanced: Custom Fingerprint

Tạo fingerprint tùy chỉnh:

```javascript
const customFingerprint = {
  imei: "354224079999999",  // Custom IMEI
  androidId: "custom123456789abcdef",
  model: "Custom Device",
  manufacturer: "MyCompany",
  brand: "MyBrand",
  device: "mydevice",
  macAddress: "02:AA:BB:CC:DD:EE",
  serialNumber: "CUSTOM123456",
  buildId: "CUSTOM.BUILD.001",
  buildDisplay: "Custom-Build-001",
  fingerprint: "MyBrand/mydevice/mydevice:13/CUSTOM.BUILD.001/ABC:user/release-keys"
};

await fetch('http://localhost:5051/api/fingerprint/apply/my_profile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fingerprint: customFingerprint,
    method: 'ldconsole'
  })
});
```

---

## 📊 Statistics

Xem thống kê fingerprint service:

```http
GET /api/fingerprint/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalCached": 15,
    "cachedInstances": ["test21323", "profile_1", "profile_2", ...],
    "availableBrands": ["samsung", "Redmi", "google", ...],
    "totalDeviceTemplates": 12
  }
}
```

---

## ✅ Checklist: Tích hợp Fingerprint vào workflow

- [x] **Generate random fingerprint** - Tạo fingerprint ngẫu nhiên
- [x] **Apply to instance** - Apply vào instance (ldconsole or ADB)
- [x] **Batch apply** - Apply hàng loạt cho nhiều instances
- [x] **Export/Import** - Backup và restore fingerprints
- [x] **Verify** - Kiểm tra fingerprint đã apply đúng
- [x] **12 Real device templates** - Templates thiết bị thực tế
- [x] **Luhn algorithm** - IMEI hợp lệ với checksum

---

## 🎉 Kết luận

Hệ thống Fingerprint Service đã hoàn thiện với đầy đủ tính năng giống **GemLogin**:

✅ Random IMEI, Android ID, MAC, Serial
✅ 12 Real device templates (Samsung, Xiaomi, Google, OnePlus...)
✅ Batch operations
✅ Export/Import fingerprints
✅ LDConsole và ADB methods
✅ RESTful API đầy đủ

**Giờ bạn có thể tạo hàng trăm profiles với fingerprints unique để tránh bị detect!** 🚀
