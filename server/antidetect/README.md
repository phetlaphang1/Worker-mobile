# Antidetect System

Hệ thống antidetect cho mobile automation với human-like behaviors.

---

## 📂 Structure

```
antidetect/
├── imposter.ts          # Original Puppeteer version (browser automation)
├── MobileImposter.ts    # ✨ NEW: Mobile adaptation (ADB automation)
└── README.md            # This file
```

---

## 🎯 Files Overview

### **1. imposter.ts** (Original - Browser Only)

**Platform**: Puppeteer (Browser automation)

**Status**: ❌ **NOT USED** in current system (system uses ADB, not Puppeteer)

**Features**:
- Human-like mouse movement with Bézier curves
- Human-like click with delays
- Human-like typing with variable speed
- Gaussian random delays
- Reading time simulation
- Thinking pauses

**Why not used?**
- Designed for `puppeteer.Page` (browser)
- Current system uses ADB (mobile)
- Cannot be used directly with mobile automation

---

### **2. MobileImposter.ts** ✨ **NEW**

**Platform**: ADB (Mobile automation)

**Status**: ✅ **ACTIVE** - Integrated into DirectMobileScriptService

**Features** (Adapted from imposter.ts):
- ✅ Human-like tap (adapted from click)
- ✅ Human-like typing (adapted from typing)
- ✅ Human-like swipe with Bézier curves (adapted from mouse movement)
- ✅ Human-like scroll (adapted from scroll)
- ✅ Gaussian random delays (COPIED 100%)
- ✅ Reading time simulation (COPIED 100%)
- ✅ Thinking pauses (COPIED 100%)

**Available in all scripts via `human` object:**
```javascript
await human.tap(x, y);
await human.type('text');
await human.swipe(x1, y1, x2, y2);
await human.scroll(distance);
await human.think();
await human.read(textLength);
await human.delay(min, max);
```

**Integration**: `server/services/DirectMobileScriptService.ts:6, 897-1003`

---

## 🔄 Adaptation Mapping

| Imposter.ts (Browser) | MobileImposter.ts (Mobile) | Adaptation |
|----------------------|---------------------------|------------|
| `page.mouse.move()` | Multi-touch swipe | Mouse movement → Swipe with curve |
| `page.mouse.click()` | `helpers.tap()` | Click → Tap with offset + delays |
| `page.keyboard.type()` | `helpers.type()` | Typing → Variable speed typing |
| `window.scrollBy()` | Vertical swipe | Scroll → Swipe up/down |
| Gaussian delays | Gaussian delays | ✅ COPIED 100% |
| Bézier curves | Bézier curves | ✅ COPIED 100% |
| Reading time | Reading time | ✅ COPIED 100% |
| Thinking pauses | Thinking pauses | ✅ COPIED 100% |

---

## 📚 Core Algorithms (Shared)

### **1. Gaussian Random Delay**

**Copied from Imposter.ts - Works perfectly for mobile!**

```typescript
getRandomDelay(min, max) {
  const gaussian = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };

  const normalized = (gaussian() + 3) / 6;
  const clamped = Math.max(0, Math.min(1, normalized));

  return min + (max - min) * clamped;
}
```

**Why Gaussian?**
- Normal random: Flat distribution (unrealistic)
- Gaussian random: Bell curve (realistic - humans cluster around average)

---

### **2. Bézier Curve Calculation**

**Copied from Imposter.ts - Used for natural swipe paths!**

```typescript
calculateBezierPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
  const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;

  return { x, y };
}
```

**Usage in mobile**:
- Browser: Smooth mouse cursor movement
- Mobile: Curved swipe gesture path

---

### **3. Human Wobble**

**Copied from Imposter.ts - Adds hand shake effect!**

```typescript
addHumanWobble(point, t) {
  const wobbleIntensity = Math.sin(t * Math.PI) * 3;
  const wobbleX = (Math.random() - 0.5) * wobbleIntensity;
  const wobbleY = (Math.random() - 0.5) * wobbleIntensity;

  return {
    x: point.x + wobbleX,
    y: point.y + wobbleY
  };
}
```

**Effect**: Adds ±3px wobble along the path (strongest at midpoint)

---

## 🚀 Usage

### **In Scripts:**

```javascript
// Launch app
await helpers.launchApp('com.twitter.android');
await helpers.sleep(3000);

// Human-like interactions
await human.think();              // Think before acting
await human.tap(180, 300);        // Tap with offset + delays
await helpers.sleep(500);

await human.type('username@example.com'); // Variable speed typing

await human.think();              // Think again

await human.tap(180, 500);        // Tap Next

// Human-like scrolling
await human.scroll(300);          // Scroll down with curve

// Reading delay
await human.read(100);            // Read tweet (~100 chars)
```

### **Comparison:**

```javascript
// ❌ ROBOTIC (Detectable)
await helpers.tap(180, 300);
await helpers.tap(180, 400);
await helpers.type('instant typing');

// ✅ HUMAN-LIKE (Undetectable)
await human.tap(180, 300);
await human.think();
await human.tap(180, 400);
await human.type('variable speed typing');
```

---

## 📖 Documentation

- **Full API**: `docs/MOBILE_IMPOSTER.md`
- **Examples**: `script-templates/EXAMPLE_HUMAN_BEHAVIOR.js`

---

## 🎓 Technical Notes

### **Why Adaptation Was Needed**

**Imposter.ts** was designed for **Puppeteer** (browser):
```typescript
// Browser API
await page.mouse.move(x, y);
await page.mouse.click();
await page.keyboard.type(text);
```

**Our system** uses **ADB** (mobile):
```typescript
// ADB API
await helpers.tap(x, y);
await helpers.type(text);
await helpers.swipe(x1, y1, x2, y2);
```

**Solution**: Adapt algorithms while preserving core logic!

---

### **What Was Preserved**

✅ **100% Preserved**:
- Gaussian delay algorithm
- Bézier curve calculation
- Human wobble calculation
- Reading time formula
- Thinking delay ranges

✅ **Adapted**:
- Mouse movement → Swipe gesture
- Click → Tap with offset
- Keyboard typing → ADB text input
- Browser scroll → Vertical swipe

---

## 🔗 Integration

**DirectMobileScriptService** exposes both:

1. **`helpers`** - Basic ADB commands (fast, robotic)
2. **`human`** - Human-like behaviors (realistic, undetectable)

Users can choose based on needs:
- Speed-critical tasks: Use `helpers`
- Stealth required: Use `human`

---

## ✅ Conclusion

**MobileImposter** successfully adapts **Imposter.ts** to mobile automation:

- ✅ Core algorithms preserved (Gaussian, Bézier, wobble)
- ✅ Behaviors adapted to mobile (tap, swipe, type)
- ✅ Easy to use (`human.*` API)
- ✅ Integrated into all scripts
- ✅ Fully documented

**Result**: Undetectable mobile automation! 🎯
