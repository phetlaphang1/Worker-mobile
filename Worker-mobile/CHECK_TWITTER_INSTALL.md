# Kiểm tra Twitter Installation

## Vấn đề: Twitter đã chọn nhưng không có trong instance

### 1. Kiểm tra log server
Khi launch profile, server sẽ log:
```
Installing twitter from apks/twitter.apk...
twitter installed successfully on [profile-name]
```

Nếu không thấy log này, có nghĩa là:
- APK file không tồn tại trong folder `apks/`
- Package name mapping không đúng
- Lỗi khi cài đặt APK

### 2. Kiểm tra APK file tồn tại
```bash
# Xem danh sách APK trong folder
ls Worker-mobile/apks/

# Đảm bảo có file twitter.apk hoặc x.apk
```

### 3. Kiểm tra package name
File `server/utils/scanApks.ts` có mapping:
```typescript
const PACKAGE_NAME_MAP: Record<string, string> = {
  twitter: 'com.twitter.android',
  x: 'com.twitter.android',
  // ...
};
```

File APK phải có tên khớp với key (vd: `twitter.apk` hoặc `x.apk`)

### 4. Kiểm tra APK có cài vào instance không

Kết nối ADB và kiểm tra:
```bash
# Lấy port của instance (thường 5555, 5557, 5559...)
adb -s 127.0.0.1:5555 shell pm list packages | grep twitter

# Kết quả mong đợi:
# package:com.twitter.android
```

### 5. Download Twitter/X APK đúng

Twitter đã đổi tên thành X, nên cần download APK mới:
- Vào https://www.apkmirror.com/apk/x-corp/twitter/
- Download phiên bản mới nhất (X - formerly Twitter)
- Đổi tên file thành `x.apk` hoặc `twitter.apk`
- Đặt vào folder `Worker-mobile/apks/`

### 6. Test thủ công cài APK

```bash
# Test cài APK thủ công
adb -s 127.0.0.1:5555 install Worker-mobile/apks/twitter.apk

# Nếu báo lỗi, có thể do:
# - APK bị hỏng
# - Architecture không tương thích (arm64 vs x86)
# - Android version không support
```

## Giải pháp tự động mở Google

Đã thêm chức năng tự động mở app sau khi launch instance:

### Cơ chế hoạt động:
1. Launch instance → Đợi 5 giây instance boot xong
2. Tìm app Google có sẵn theo thứ tự:
   - Chrome (`com.android.chrome`)
   - Google App (`com.google.android.googlequicksearchbox`)
   - Browser mặc định (`com.android.browser`)
3. Launch app đầu tiên tìm thấy

### Customize app tự động mở

Sửa file `server/services/ProfileManager.ts`, method `autoLaunchApp`:
```typescript
const googlePackages = [
  'com.android.chrome',                      // Chrome
  'com.google.android.googlequicksearchbox', // Google app
  'com.android.browser',                     // Browser
  'com.twitter.android',                     // Twitter/X (nếu muốn)
];
```

## Test

1. Launch profile mới
2. Xem log server có dòng:
   ```
   Waiting for instance to boot: [profile-name]
   Launching com.android.chrome on [profile-name]
   com.android.chrome launched successfully
   ```
3. Instance sẽ tự động mở Chrome/Google sau 5 giây
