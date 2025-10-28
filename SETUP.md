# Hướng dẫn Setup Worker-mobile trên máy mới

## Yêu cầu hệ thống

### 1. Phần mềm cần cài đặt

- **Node.js**: Version 20.19.0 hoặc 22.x trở lên
  - Download: https://nodejs.org/
  - Kiểm tra version: `node --version`

- **npm**: Version 10.x trở lên (đi kèm với Node.js)
  - Kiểm tra version: `npm --version`

- **LDPlayer 9**: Emulator Android
  - Download: https://www.ldplayer.net/
  - Ghi nhớ đường dẫn cài đặt (ví dụ: `D:\LDPlayer\LDPlayer9`)

- **Git** (khuyến nghị để quản lý code)
  - Download: https://git-scm.com/

### 2. Cấu hình hệ thống tối thiểu

- **RAM**: Tối thiểu 8GB (khuyến nghị 16GB cho multi-instance)
- **CPU**: 4 cores trở lên
- **Ổ cứng**: 20GB trống

## Các bước setup

### Bước 1: Copy source code

Có 2 cách:

#### Cách 1: Dùng Git (khuyến nghị)
```bash
git clone <repository-url>
cd Worker-mobile
```

#### Cách 2: Copy thủ công
Copy toàn bộ thư mục source, **NHƯNG KHÔNG copy các thư mục sau:**
- `node_modules/` (sẽ cài lại)
- `dist/` (sẽ build lại)
- `data/` (dữ liệu local)
- `.env` (sẽ config lại)

### Bước 2: Cài đặt LDPlayer

1. Download và cài đặt LDPlayer 9
2. Ghi nhớ đường dẫn cài đặt (thường là `C:\LDPlayer\LDPlayer9` hoặc `D:\LDPlayer\LDPlayer9`)
3. Chạy LDPlayer ít nhất 1 lần để khởi tạo

### Bước 3: Cấu hình file .env

1. Copy file mẫu:
```bash
copy .env.example .env
```

2. Mở file `.env` và chỉnh sửa các thông số sau:

```env
# LDPlayer Configuration - QUAN TRỌNG: Phải đúng đường dẫn trên máy mới
LDPLAYER_PATH=D:\LDPlayer\LDPlayer9
LDCONSOLE_PATH=D:\LDPlayer\LDPlayer9\ldconsole.exe
ADB_PATH=D:\LDPlayer\LDPlayer9\adb.exe

# Server Configuration
PORT=5051
NODE_ENV=development

# Mobile Automation
AUTO_RUN_ENABLE=false
MAX_INSTANCES=7

# Instance Resource Configuration
INSTANCE_CPU=1
INSTANCE_MEMORY=1536
INSTANCE_RESOLUTION=360,640
INSTANCE_DPI=160

# Appium Configuration
APPIUM_HOST=127.0.0.1
APPIUM_PORT=4723

# Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=securepassword123
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=1d
```

**Lưu ý**: Đường dẫn LDPlayer phải chính xác theo máy của bạn!

### Bước 4: Cài đặt dependencies

1. Mở Command Prompt hoặc PowerShell
2. Di chuyển đến thư mục project:
```bash
cd D:\BArmy\Worker-mobile
```

3. Cài đặt packages:
```bash
npm install
```

**Nếu gặp lỗi EBADENGINE**: Nâng cấp Node.js lên version 22.x

**Nếu gặp lỗi permission**: Chạy CMD/PowerShell với quyền Administrator

### Bước 5: Build project

```bash
# Build cả client và server
npm run build

# Hoặc build riêng
npm run build:client
npm run build:server
```

### Bước 6: Tạo thư mục cần thiết

Tạo các thư mục nếu chưa có:

```bash
mkdir data
mkdir data\profiles
mkdir apks
mkdir logs
```

### Bước 7: Chạy thử

#### Development mode (khuyến nghị cho lần đầu):
```bash
npm run dev
```

Hoặc chạy riêng server và client:
```bash
# Terminal 1 - Server
npm run dev:server

# Terminal 2 - Client
npm run dev:client
```

#### Production mode (dùng PM2):
```bash
npm run pm2:start
npm run pm2:status
npm run pm2:logs
```

### Bước 8: Kiểm tra

1. Mở trình duyệt: http://localhost:7000 (dev) hoặc http://localhost:5051 (production)
2. Login với username/password từ file .env
3. Kiểm tra xem LDPlayer có được phát hiện không

## Khắc phục lỗi thường gặp

### Lỗi: "Cannot find LDPlayer"

**Nguyên nhân**: Đường dẫn LDPlayer trong .env không đúng

**Giải pháp**:
1. Kiểm tra LDPlayer đã cài đặt chưa
2. Tìm đường dẫn chính xác (thường ở `C:\LDPlayer` hoặc `D:\LDPlayer`)
3. Cập nhật lại trong file `.env`:
```env
LDPLAYER_PATH=<đường dẫn đúng>
LDCONSOLE_PATH=<đường dẫn đúng>\ldconsole.exe
ADB_PATH=<đường dẫn đúng>\adb.exe
```

### Lỗi: "EBADENGINE Unsupported engine"

**Nguyên nhân**: Node.js version không phù hợp

**Giải pháp**:
- Nâng cấp Node.js lên version 22.x từ https://nodejs.org/
- Sau đó chạy lại `npm install`

### Lỗi: "Port 5051 already in use"

**Nguyên nhân**: Port đang được sử dụng bởi process khác

**Giải pháp**:
```bash
# Tìm process đang dùng port
netstat -ano | findstr :5051

# Kill process (thay <PID> bằng process ID tìm được)
taskkill /F /PID <PID>
```

Hoặc đổi port trong file `.env`:
```env
PORT=5052
```

### Lỗi: "npm install" chạy rất chậm

**Giải pháp**:
1. Xóa cache npm:
```bash
npm cache clean --force
```

2. Xóa node_modules và cài lại:
```bash
rmdir /s /q node_modules
npm install
```

### Lỗi: Build bị lỗi TypeScript

**Giải pháp**:
1. Xóa thư mục dist cũ:
```bash
rmdir /s /q dist
```

2. Build lại:
```bash
npm run build:server
```

## Checklist hoàn thành

- [ ] Đã cài Node.js 22.x
- [ ] Đã cài LDPlayer 9
- [ ] Đã copy source code (không bao gồm node_modules, dist, data, .env)
- [ ] Đã tạo file .env từ .env.example
- [ ] Đã cập nhật đường dẫn LDPlayer trong .env
- [ ] Đã chạy `npm install` thành công
- [ ] Đã chạy `npm run build` thành công
- [ ] Đã tạo các thư mục cần thiết (data, apks, logs)
- [ ] Đã chạy thử bằng `npm run dev`
- [ ] Đã truy cập được web interface

## Lệnh hữu ích

```bash
# Kiểm tra version
node --version
npm --version

# Xem logs PM2
npm run pm2:logs

# Restart PM2
npm run pm2:restart

# Stop PM2
npm run pm2:stop

# Xóa tất cả PM2 processes
npm run pm2:delete

# Detect LDPlayer
npm run detect-ldplayer

# Setup ADB cho tất cả instances
npm run setup-adb
```

## Liên hệ hỗ trợ

Nếu gặp vấn đề, hãy cung cấp:
1. Thông báo lỗi đầy đủ
2. Node.js version (`node --version`)
3. npm version (`npm --version`)
4. Đường dẫn LDPlayer
5. Hệ điều hành (Windows version)
