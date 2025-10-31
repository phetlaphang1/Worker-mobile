# 📱 Worker-Mobile

**LDPlayer Automation System** - Hệ thống automation cho Android emulator với antidetect features.

## ✨ Tính Năng

- 🎭 **Antidetect**: Device fingerprinting, human behavior simulation
- 📱 **Multi-Instance**: Quản lý nhiều LDPlayer instances
- 🤖 **Script Automation**: Execute JavaScript scripts trên mobile (giống Puppeteer)
- 🔄 **Task Management**: Queue, retry, concurrency control
- 🎯 **Profile Management**: Tạo, clone, quản lý profiles với isolated sessions
- 📊 **Real-time Monitoring**: WebSocket status updates
- 🔐 **Proxy Support**: Per-instance proxy configuration

## 🚀 Quick Start

### Development Mode
```bash
npm install
npm run dev
```
Truy cập: http://localhost:7000

### Production Mode
```bash
npm install
npm run build
npm start
```
Truy cập: http://localhost:5051

## 🛠️ Yêu Cầu

- **OS**: Windows 10/11 (64-bit)
- **Node.js**: v18+
- **LDPlayer**: v9
- **RAM**: 8GB+ (khuyến nghị 16GB)
- **CPU**: 4 cores+

## 📖 Tech Stack

- **Backend**: Node.js + TypeScript + Express
- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Emulator**: LDPlayer 9 + ADB
- **Process Management**: PM2
- **Real-time**: WebSocket

## 🎓 Architecture

```
┌─────────────────────────────────────────┐
│     React Dashboard (Client)            │
│  - Profile Management                   │
│  - Script Editor                        │
│  - Visual Device Emulator               │
└──────────────┬──────────────────────────┘
               │ HTTP/WebSocket
┌──────────────▼──────────────────────────┐
│     Express API (Server)                │
│  - ProfileManager                       │
│  - DirectMobileScriptService            │
│  - FingerprintService                   │
│  - LDPlayerController                   │
└──────────────┬──────────────────────────┘
               │ ADB Commands
┌──────────────▼──────────────────────────┐
│     LDPlayer 9 (Android Emulator)       │
│  - Multiple Instances                   │
│  - Unique Fingerprints                  │
└─────────────────────────────────────────┘
```

## 🔧 Scripts

```bash
# Development
npm run dev              # Start dev server (client + server)
npm run dev:server       # Server only
npm run dev:client       # Client only

# Build
npm run build            # Build both client & server
npm run build:client     # Build client
npm run build:server     # Build server

# Production
npm start                # Start production server

# PM2
npm run pm2:start        # Start with PM2
npm run pm2:status       # Check PM2 status
npm run pm2:logs         # View PM2 logs
npm run pm2:stop         # Stop all PM2 processes

# Utilities
npm run setup-adb        # Setup ADB for all instances
npm run detect-ldplayer  # Detect LDPlayer installation
```

## 📁 Project Structure

```
Worker-Mobile/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   └── services/    # API services
│   └── vite.config.ts
├── server/              # Express backend
│   ├── core/            # Core services
│   │   └── LDPlayerController.ts
│   ├── services/        # Business logic
│   │   ├── ProfileManager.ts
│   │   ├── DirectMobileScriptService.ts
│   │   └── FingerprintService.ts
│   ├── antidetect/      # Antidetect features
│   │   ├── FingerprintGenerator.ts
│   │   └── MobileImposter.ts
│   └── routes/          # API routes
├── scripts/             # Utility scripts
├── script-templates/    # Script templates (Twitter, Facebook, etc.)
├── data/profiles/       # Profile storage
└── public/              # Static assets
```

## 🎨 Features Highlight

### Device Fingerprinting
- 40+ real device templates (Samsung, Xiaomi, Google Pixel, etc.)
- Unique IMEI, Android ID, MAC address per instance
- Resolution spoofing (apps see real device resolution)

### Human Behavior Simulation
- Gaussian random delays (bell curve distribution)
- Bézier curve swipes (natural finger movement)
- Human wobble effect (hand shake)
- Variable typing speed

### Script Execution
- Puppeteer-like API for mobile
- Direct ADB control (no Appium overhead)
- XPath element finding
- Real-time log broadcasting

## 📝 Example Script

```javascript
// Login to Twitter
log('Opening Twitter...');
await helpers.launchApp('com.twitter.android');
await helpers.sleep(3000);

const usernameField = await helpers.findElementByXPath(
  '//*[@resource-id="com.twitter.android:id/login_identifier"]'
);
await human.tap(usernameField.center.x, usernameField.center.y);
await human.type(context.profile.metadata.accounts.x.username);
await human.think();

await helpers.tapByXPath('//*[@resource-id="com.twitter.android:id/cta_button"]');
log('Login success!');
```

## 🐛 Troubleshooting

Xem [DEPLOYMENT.md](DEPLOYMENT.md) phần "Xử Lý Lỗi Thường Gặp"

## 📞 Support

- Issues: Create GitHub issue
- Docs: Check `DEPLOYMENT.md`

## 📄 License

Private / Internal Use

---

**Made with ❤️ for Mobile Automation**
