# Worker-Mobile: BoxPhone System on LDPlayer

Hệ thống automation trên LDPlayer giống BoxPhone - chạy nhiều instances và execute scripts.

## 🚀 Quick Start

### 1. Setup

```bash
# Install dependencies
npm install

# Copy .env.example → .env
cp .env.example .env

# Edit .env
LDCONSOLE_PATH=D:\LDPlayer\LDPlayer9\ldconsole.exe
ADB_PATH=D:\LDPlayer\LDPlayer9\adb.exe
PORT=5051
```

### 2. Development Mode (Hot Reload)

```bash
npm run dev
```

**2 servers sẽ chạy:**
- 🔥 **Dev server (HMR):** http://localhost:5173 ← Dùng cái này để dev!
- 📦 **API server:** http://localhost:5051

**Mở browser:** `http://localhost:5173`

→ Edit code → Auto reload! ⚡

### 3. Production Mode

```bash
# Build
npm run build

# Run
npm start
```

**Mở browser:** `http://localhost:5051`

### 3. Test hệ thống

```bash
npm test
```

## 📚 Cách sử dụng

### Tạo Profile (LDPlayer instance)

```bash
POST /api/profiles
{
  "name": "Worker 1",
  "settings": {
    "resolution": "720,1280",
    "cpu": 2,
    "memory": 2048
  }
}
```

### Launch Profile (Khởi động LDPlayer)

```bash
POST /api/profiles/:profileId/activate
```

### Execute Script (Chạy automation)

```bash
POST /api/profiles/:profileId/execute-script
{
  "scriptType": "twitter",
  "scriptName": "likeTweets",
  "scriptData": {
    "searchQuery": "blockchain",
    "count": 5
  }
}
```

## 📝 Available Scripts

### Twitter Scripts

- `likeTweets` - Like tweets
- `followUser` - Follow user
- `postTweet` - Post tweet
- `retweet` - Retweet
- `searchAndRead` - Search and scroll

### Custom Scripts

```javascript
{
  "scriptType": "custom",
  "scriptName": "custom",
  "scriptData": {
    "adbCommands": [
      { "type": "tap", "x": 360, "y": 640 },
      { "type": "swipe", "x1": 360, "y1": 800, "x2": 360, "y2": 200 },
      { "type": "input", "text": "Hello" },
      { "type": "wait", "duration": 2000 }
    ]
  }
}
```

## 🎯 Workflow

```
1. Create Profiles → 2. Activate Profiles → 3. Execute Scripts → 4. Monitor → 5. Cleanup
```

## 📊 API Endpoints

```
# Profiles
GET    /api/profiles              - List profiles
POST   /api/profiles              - Create profile
POST   /api/profiles/:id/activate - Launch instance
POST   /api/profiles/:id/deactivate - Stop instance

# Scripts
POST   /api/profiles/:id/execute-script - Execute script
GET    /api/scripts               - List all scripts
GET    /api/scripts/:id           - Get script status

# Twitter Shortcuts
POST   /api/twitter/like          - Like tweets
POST   /api/twitter/post          - Post tweet
POST   /api/twitter/follow        - Follow user

# Statistics
GET    /api/statistics            - Get stats
```

## 🔥 Example: Chạy 5 instances cùng lúc

```javascript
// Tạo 5 profiles
const profiles = [];
for (let i = 0; i < 5; i++) {
  const res = await axios.post('/api/profiles', {
    name: `Worker ${i + 1}`,
    settings: { resolution: '720,1280', cpu: 2, memory: 2048 }
  });
  profiles.push(res.data.profile);
}

// Launch tất cả
await Promise.all(
  profiles.map(p => axios.post(`/api/profiles/${p.id}/activate`))
);

// Execute scripts trên tất cả
await Promise.all(
  profiles.map(p =>
    axios.post(`/api/profiles/${p.id}/execute-script`, {
      scriptType: 'twitter',
      scriptName: 'likeTweets',
      scriptData: { searchQuery: 'crypto', count: 3 }
    })
  )
);
```

## ⚙️ Configuration

### Profile Settings

```javascript
{
  settings: {
    resolution: '720,1280',  // Screen resolution
    dpi: 240,                // Screen DPI
    cpu: 2,                  // CPU cores
    memory: 2048             // RAM in MB
  },
  network: {
    useProxy: true,
    proxyHost: '123.45.67.89',
    proxyPort: 8080
  },
  location: {
    latitude: 21.028511,
    longitude: 105.804817    // GPS location
  }
}
```

## 🔧 Troubleshooting

**Server không start:** Check LDCONSOLE_PATH in .env
**Instance không launch:** Tắt LDPlayer và thử lại
**Script timeout:** Tăng memory cho instance (2GB → 3GB)

## 📈 Performance

- 1 instance: ~2s create, ~15s launch, ~3-5s/script
- 5 instances: ~25-30 tasks/minute
- 10 instances: ~45-50 tasks/minute
