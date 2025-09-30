# Worker Mobile - LDPlayer Automation System

A mobile automation system designed to work with LDPlayer Android emulator, providing advanced automation capabilities for mobile applications.

## Features

- 🤖 **LDPlayer Control**: Full control over LDPlayer instances via ADB
- 👤 **Multi-Profile Management**: Create and manage multiple device profiles
- 📱 **Mobile App Automation**: Automate Twitter and other mobile apps
- 🎯 **Task Execution**: Queue-based task system with retry logic
- 🌐 **Proxy Support**: Configure proxies for each profile
- 📍 **GPS Spoofing**: Set custom locations for each instance
- 🔒 **Anti-Detection**: Human-like behavior simulation
- 🔄 **Real-time Updates**: WebSocket support for live status updates

## Prerequisites

- Windows OS (LDPlayer is Windows-only)
- LDPlayer 9 installed
- Node.js 18+
- ADB tools (included with LDPlayer)

## Installation

1. Clone the repository
2. Navigate to Worker-mobile directory:
```bash
cd Worker-mobile
npm install
```

3. Configure environment variables in `.env`:
```env
LDPLAYER_PATH=C:\LDPlayer\LDPlayer9
LDCONSOLE_PATH=C:\LDPlayer\LDPlayer9\ldconsole.exe
ADB_PATH=C:\LDPlayer\LDPlayer9\adb.exe
PORT=5051
```

## Usage

### Start the server:
```bash
npm run dev
```

### API Endpoints

#### Profiles
- `GET /api/profiles` - Get all profiles
- `POST /api/profiles` - Create new profile
- `PUT /api/profiles/:id` - Update profile
- `DELETE /api/profiles/:id` - Delete profile
- `POST /api/profiles/:id/activate` - Activate profile
- `POST /api/profiles/:id/deactivate` - Deactivate profile

#### Tasks
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Add new task
- `DELETE /api/tasks/:id` - Cancel task

#### Instances
- `GET /api/instances` - Get all instances
- `POST /api/instances/:name/launch` - Launch instance
- `POST /api/instances/:name/stop` - Stop instance

#### Device Control
- `POST /api/device/:port/tap` - Perform tap
- `POST /api/device/:port/swipe` - Perform swipe
- `POST /api/device/:port/text` - Input text
- `POST /api/device/:port/screenshot` - Take screenshot

### WebSocket Events

Connect to `ws://localhost:5051` for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:5051');

// Get status
ws.send(JSON.stringify({
  type: 'get_status'
}));

// Create profile
ws.send(JSON.stringify({
  type: 'create_profile',
  config: {
    name: 'Profile 1',
    settings: {
      resolution: '720,1280',
      dpi: 240
    }
  }
}));

// Add task
ws.send(JSON.stringify({
  type: 'add_task',
  task: {
    type: 'twitter_like',
    profileId: 'profile_123',
    data: {
      username: 'user123',
      password: 'pass123',
      likeCount: 5
    }
  }
}));
```

## Task Types

- `twitter_like` - Like tweets
- `twitter_follow` - Follow users
- `twitter_retweet` - Retweet posts
- `twitter_comment` - Comment on tweets
- `twitter_post` - Post new tweets
- `custom` - Custom automation tasks

## Architecture

```
Worker-mobile/
├── src/
│   ├── core/
│   │   └── LDPlayerController.ts    # LDPlayer control via ADB
│   ├── automation/
│   │   ├── MobileAutomation.ts      # Base automation class
│   │   └── TwitterMobileAutomation.ts # Twitter-specific automation
│   ├── services/
│   │   ├── ProfileManager.ts        # Profile management
│   │   └── TaskExecutor.ts          # Task execution engine
│   ├── routes/
│   │   └── index.ts                 # API routes
│   ├── utils/
│   │   └── logger.ts                # Logging utility
│   └── index.ts                     # Main entry point
├── package.json
├── tsconfig.json
└── .env
```

## Security Notes

- Store sensitive credentials securely
- Use proxies for better anonymity
- Implement rate limiting for automation
- Rotate device fingerprints regularly

## Troubleshooting

### ADB Connection Issues
```bash
# Restart ADB server
adb kill-server
adb start-server

# Check connected devices
adb devices
```

### LDPlayer Instance Not Starting
- Ensure LDPlayer path is correct in .env
- Check if virtualization is enabled in BIOS
- Verify sufficient system resources

### Profile Creation Failed
- Check available disk space
- Ensure write permissions in data directory
- Verify LDPlayer is not running instances manually

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## License

MIT