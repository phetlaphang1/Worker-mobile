# 🔥 Development Mode - Hot Reload

## 🚀 Quick Start

### **Chế độ phát triển với Hot Reload:**

```bash
cd Worker-mobile
npm run dev
```

Sẽ tự động:
- ✅ **Server hot-reload** (nodemon) - Port 5051
- ✅ **Client hot-reload** (Vite HMR) - Port 5173
- ✅ **Auto build khi save file**

---

## 🎯 Cách sử dụng

### **1. Start dev mode:**

```bash
npm run dev
```

**Output:**
```
🚀 Server started
  API Server: http://localhost:5051

🔥 Vite dev server running
  Local:   http://localhost:5173
  Network: http://192.168.1.x:5173
```

### **2. Mở browser:**

**Development URL:** `http://localhost:5173`

- Có HMR (Hot Module Replacement)
- Tự động reload khi sửa code
- Error overlay hiện trên màn hình
- Fast Refresh cho React

**Production URL:** `http://localhost:5051`

- Serve từ `public/` folder (build output)
- Dùng khi test production build

---

## 📝 Workflow phát triển

### **Chỉnh sửa UI (Client):**

```bash
# Edit files trong client/src/
# Ví dụ: Dashboard.tsx

# 1. Mở file
code client/src/components/dashboard/Dashboard.tsx

# 2. Chỉnh sửa code
# 3. Save (Ctrl+S)

→ Browser TỰ ĐỘNG reload! ⚡
```

### **Chỉnh sửa Server:**

```bash
# Edit files trong server/
# Ví dụ: ProfileManager.ts

# 1. Mở file
code server/services/ProfileManager.ts

# 2. Chỉnh sửa code
# 3. Save (Ctrl+S)

→ Server TỰ ĐỘNG restart! 🔄
→ Console hiện: "🔄 Server restarting..."
```

---

## ⚡ Hot Reload Features

### **Client (Vite HMR):**

✅ **Fast Refresh** - Giữ React state khi reload
✅ **Error Overlay** - Hiện lỗi trực tiếp trên browser
✅ **Instant Update** - Thay đổi trong <100ms
✅ **CSS Hot Reload** - Không cần reload page

### **Server (Nodemon):**

✅ **Auto restart** khi sửa `.ts`, `.js`, `.json`
✅ **Watch server/** folder
✅ **Ignore** node_modules, dist, logs
✅ **Delay 500ms** để tránh restart nhiều lần

---

## 🎨 Dev vs Production

| Feature | Dev Mode (5173) | Production (5051) |
|---------|----------------|-------------------|
| **URL** | localhost:5173 | localhost:5051 |
| **Hot Reload** | ✅ Instant | ❌ Need rebuild |
| **Source Maps** | ✅ Full | ❌ Minified |
| **Error Overlay** | ✅ Yes | ❌ No |
| **Build Speed** | ⚡ Fast | 🐢 Slow |
| **File Size** | 📦 Large | 📦 Small (optimized) |

---

## 🔧 Commands

```bash
# Full dev mode (Server + Client hot-reload)
npm run dev

# Chỉ server (no client)
npm run dev:server-only

# Chỉ client (no server)
npm run dev:client

# Build production
npm run build

# Run production build
npm start
```

---

## 📊 File Watch

### **Vite watch (Client):**

```
client/src/**/*.tsx
client/src/**/*.ts
client/src/**/*.css
client/index.html
```

**→ Auto reload browser khi save**

### **Nodemon watch (Server):**

```
server/**/*.ts
server/**/*.js
server/**/*.json
```

**→ Auto restart server khi save**

---

## 💡 Tips

### **1. VSCode Auto Save:**

```json
// .vscode/settings.json
{
  "files.autoSave": "afterDelay",
  "files.autoSaveDelay": 1000
}
```

→ Auto reload mỗi khi gõ xong!

### **2. Multiple Terminal:**

```bash
# Terminal 1 - Dev mode
npm run dev

# Terminal 2 - Test scripts
npm test

# Terminal 3 - Logs
tail -f logs/server.log
```

### **3. Browser DevTools:**

- **React DevTools** - Debug components
- **Network tab** - Xem API calls
- **Console** - Xem logs

---

## ⚙️ Config Files

### **Vite Config** (`client/vite.config.ts`):

```typescript
server: {
  port: 5173,
  hmr: {
    overlay: true, // Show errors
  },
  watch: {
    usePolling: true, // Better for Windows
    interval: 100,
  },
}
```

### **Nodemon Config** (`nodemon.json`):

```json
{
  "watch": ["server/**/*"],
  "ext": "ts,js,json",
  "delay": 500,
  "exec": "tsx server/index.ts"
}
```

---

## 🐛 Troubleshooting

### **Q: Browser không auto-reload?**

```bash
# 1. Check Vite dev server chạy chưa
# Mở http://localhost:5173 → Phải thấy trang

# 2. Hard reload browser
Ctrl + Shift + R

# 3. Xóa cache
Ctrl + Shift + Delete
```

### **Q: Server không auto-restart?**

```bash
# 1. Check nodemon running
ps aux | grep nodemon

# 2. Restart dev mode
Ctrl + C → npm run dev

# 3. Check file path đúng chưa
# Phải save trong server/** folder
```

### **Q: Port 5173 bị chiếm?**

```bash
# Kill process
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Hoặc đổi port trong vite.config.ts
server: { port: 3000 }
```

### **Q: Changes không apply?**

```bash
# 1. Check file saved chưa
# 2. Check terminal có errors không
# 3. Build lại production:
npm run build
```

---

## 🎯 Best Practices

### **Khi phát triển UI:**

```bash
1. Mở http://localhost:5173 (dev server)
2. Mở DevTools (F12)
3. Edit client/src/**
4. Save → Xem changes ngay lập tức
5. Không cần reload browser!
```

### **Khi phát triển API:**

```bash
1. Edit server/**
2. Save → Server auto restart
3. Test API với Postman/curl
4. Check logs trong console
```

### **Trước khi commit:**

```bash
# Build production để check lỗi
npm run build

# Nếu build OK → Ready to commit!
git add .
git commit -m "Update UI"
```

---

## 🚀 Performance

**Dev mode (HMR):**
- Edit → Save → See changes: **~100ms** ⚡

**Production build:**
- Edit → Build → Deploy: **~5-10s** 🐢

**→ Dev mode nhanh gấp 50 lần!**

---

## 📝 Summary

```bash
# 1 command để bật tất cả:
npm run dev

# Giờ:
✅ Edit client code → Auto reload browser
✅ Edit server code → Auto restart server
✅ Error overlay hiện ngay trên screen
✅ Fast Refresh giữ React state
✅ Develop nhanh hơn 10x!
```

**Happy coding! 🔥**
