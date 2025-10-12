# 🛠️ Utility Scripts

Collection of utility scripts for managing LDPlayer instances and profiles.

## 📜 Available Scripts

### 🔌 `enable-usb-debugging.ts`

**Automatically enable USB Debugging for all LDPlayer instances via ADB**

```bash
npm run enable-usb-debugging
```

**What it does:**
- ✅ Scans all LDPlayer instances
- ✅ Launches instances if not running
- ✅ Enables ADB debugging in LDPlayer settings
- ✅ Connects via ADB to each instance
- ✅ Enables Developer Options in Android system
- ✅ Enables USB Debugging toggle
- ✅ Reports success/failure for each instance

**When to use:**
- After cloning instances (Android Developer Options are NOT cloned)
- After creating new instances
- When getting "Could not determine ADB port" errors
- Bulk setup for multiple instances

**Requirements:**
- LDPlayer instances must be created first
- Instances will be auto-launched if not running
- Requires LDPlayer rooted instances (default)

---

### 📐 `sync-resolution.ts`

**Sync resolution settings from Profile JSON to actual LDPlayer instances**

```bash
npm run sync-resolution
```

**What it does:**
- ✅ Reads resolution from all profile JSON files
- ✅ Compares with actual LDPlayer instance resolution
- ✅ Applies resolution changes via `ldconsole modify`
- ✅ Reboots running instances to apply changes
- ✅ Reports sync summary

**When to use:**
- After manually editing profile JSON files
- When resolution in UI doesn't match actual instance
- Bulk sync all instances to their configured resolution

**Note:** Resolution changes via UI should auto-apply (see ProfileManager.ts:334-415). Use this script only if auto-update fails.

---

### 🔍 `setup-all-adb.ts`

**Enable ADB debugging for all LDPlayer instances (LDPlayer layer only)**

```bash
npm run setup-adb
```

**What it does:**
- ✅ Scans all LDPlayer instances
- ✅ Enables `adb.debug=1` in LDPlayer settings
- ✅ Reboots instances to apply changes

**When to use:**
- Initial setup of LDPlayer instances
- When ADB port is not being exposed

**Limitation:** This only enables ADB at LDPlayer level. You still need to enable USB Debugging in Android system (use `enable-usb-debugging.ts` instead for full setup).

---

## 🎯 Recommended Workflow

### For New/Cloned Instances:

```bash
# 1. Create or clone instances via UI
# 2. Auto-enable USB Debugging for all
npm run enable-usb-debugging

# 3. Restart server to reconnect ADB
npm run pm2:restart

# 4. Start using instances!
```

### For Resolution Issues:

```bash
# Sync all resolutions from profile JSON to LDPlayer
npm run sync-resolution

# Restart server
npm run pm2:restart
```

---

## ⚠️ Important Notes

### Why Can't Android Developer Options Be Cloned?

When you clone an LDPlayer instance using `ldconsole copy`:
- ✅ **Virtual machine settings** are copied (resolution, CPU, RAM)
- ✅ **Installed apps** are copied (APK files + data)
- ❌ **Android system settings** are NOT copied (stored in system database)

Android Developer Options and USB Debugging toggle are stored in `/data/data/com.android.providers.settings/databases/settings.db`, which Android resets on "first boot" after cloning.

### Solution:

Use the **automated script** to enable USB Debugging:

```bash
npm run enable-usb-debugging
```

This script uses ADB commands to modify Android settings database directly, enabling Developer Options and USB Debugging without manual UI interaction.

---

## 📚 Related Documentation

- [ADB_SETUP_GUIDE.md](../ADB_SETUP_GUIDE.md) - Complete guide for ADB setup
- [ProfileManager.ts](../server/services/ProfileManager.ts) - Profile management code
- [LDPlayerController.ts](../server/core/LDPlayerController.ts) - LDPlayer control code

---

## 🐛 Troubleshooting

### Script fails with "Cannot get ADB port"

**Cause:** Instance is not running or ADB not enabled in LDPlayer

**Solution:**
1. Make sure instance is running (script will auto-launch if not)
2. Wait for instance to fully boot (30 seconds)
3. Run script again

### Script reports success but USB Debugging still not working

**Cause:** Some Android ROMs have additional security

**Solution:**
1. Manually open instance UI
2. Go to Settings > Developer Options
3. Verify "USB Debugging" toggle is ON
4. If not, toggle it manually

### "unauthorized" when running ADB commands

**Cause:** Need to accept ADB authorization popup in Android

**Solution:**
1. Open instance UI
2. Look for "Allow USB debugging?" popup
3. Check "Always allow" and tap OK
4. Run script again

---

**💡 Tip:** Run `npm run enable-usb-debugging` after every batch of instance cloning to save time!
