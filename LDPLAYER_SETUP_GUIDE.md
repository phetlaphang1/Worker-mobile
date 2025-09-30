# 📱 Hướng dẫn chạy Worker trên LDPlayer

## 🎯 Mục tiêu
Chạy hệ thống Worker hiện tại (giao diện web) TRONG trình duyệt Android trên LDPlayer, thay vì chạy trên Chrome PC.

## 📋 Các bước thực hiện

### 1️⃣ **Khởi động Server trên PC**
```bash
# Mở terminal trong thư mục gốc
npm run dev
```
Server sẽ chạy tại: `http://localhost:5000`

### 2️⃣ **Cấu hình LDPlayer**

#### A. Tìm IP của PC
```cmd
ipconfig
```
Tìm IPv4 Address (ví dụ: 192.168.1.100)

#### B. Mở LDPlayer và cài đặt
1. Mở LDPlayer
2. Vào **Settings** → **Network**
3. Chọn **Bridge Mode** (để LDPlayer và PC cùng mạng)

### 3️⃣ **Truy cập từ LDPlayer**

#### Cách 1: Dùng Chrome trong LDPlayer
1. Mở Chrome trong LDPlayer
2. Nhập địa chỉ: `http://[IP_PC]:5000`
   - Ví dụ: `http://192.168.1.100:5000`
3. Đăng nhập với:
   - Username: admin
   - Password: securepassword123

#### Cách 2: Dùng IP đặc biệt (nếu Bridge mode không hoạt động)
- Thử: `http://10.0.2.2:5000` (IP host trong Android emulator)

### 4️⃣ **Tối ưu cho Mobile**

Hệ thống đã được cập nhật để responsive trên mobile:
- ✅ Giao diện tự động co giãn theo màn hình
- ✅ Touch-friendly buttons
- ✅ Mobile navigation menu
- ✅ Optimized cho màn hình dọc

## 🔧 Troubleshooting

### Không kết nối được từ LDPlayer?

1. **Tắt Windows Firewall tạm thời** hoặc thêm exception cho port 5000

2. **Sửa server để listen trên tất cả interfaces:**
   Mở file `server/index.ts`, tìm dòng:
   ```javascript
   server.listen({ port, host: "0.0.0.0" })
   ```

3. **Dùng ngrok để tạo tunnel:**
   ```bash
   npm install -g ngrok
   ngrok http 5000
   ```
   Sau đó dùng URL ngrok cung cấp

### LDPlayer lag hoặc chậm?

1. Tăng RAM cho LDPlayer: Settings → Advanced → Memory: 4096MB
2. Bật VT (Virtualization) trong BIOS
3. Giảm resolution: Settings → Display → 720x1280

## 🚀 Chạy Multiple Instances

1. **Tạo nhiều instance LDPlayer:**
   - LDMultiplayer → Add → New Instance

2. **Mỗi instance truy cập cùng địa chỉ:**
   - Instance 1: `http://192.168.1.100:5000`
   - Instance 2: `http://192.168.1.100:5000`
   - ...

3. **Sử dụng profiles khác nhau cho mỗi instance**

## 📱 Mobile App Mode (Tùy chọn)

Để có trải nghiệm như app native:

1. **Tạo shortcut trên home screen:**
   - Mở Chrome → Menu → Add to Home screen

2. **Fullscreen mode:**
   - Thêm vào URL: `?fullscreen=true`
   - Ví dụ: `http://192.168.1.100:5000?fullscreen=true`

## ✅ Checklist

- [ ] Server chạy trên PC (port 5000)
- [ ] Biết IP của PC
- [ ] LDPlayer đã cài Chrome
- [ ] LDPlayer Bridge mode hoặc NAT mode
- [ ] Firewall cho phép port 5000
- [ ] Có thể ping từ LDPlayer đến PC

## 📝 Note

- Hệ thống Worker vẫn chạy logic trên server (PC)
- LDPlayer chỉ là nơi hiển thị giao diện
- Có thể chạy nhiều LDPlayer instance cùng lúc
- Data được đồng bộ real-time qua WebSocket