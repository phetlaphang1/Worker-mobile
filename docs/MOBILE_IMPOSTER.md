# MobileImposter - Human-like Behavior for Mobile Automation

## 📖 Overview

**MobileImposter** is adapted from `Imposter.ts` (browser/Puppeteer) to work with **ADB-based mobile automation**. It provides human-like behaviors to make your mobile automation **undetectable**.

---

## 🎯 Core Concept: Browser → Mobile Adaptation

| Browser (Puppeteer) | Mobile (ADB) | Adapted? |
|---------------------|--------------|----------|
| **Mouse Movement (Bézier)** | **Swipe with curve** | ✅ YES |
| **Click** | **Tap** | ✅ YES |
| **Typing** | **Input text** | ✅ YES |
| **Scroll** | **Swipe vertical** | ✅ YES |
| **Gaussian Delay** | **Random delay** | ✅ 100% COPIED |
| **Reading Time** | **Reading Time** | ✅ 100% COPIED |
| **Thinking Pause** | **Thinking Pause** | ✅ 100% COPIED |

---

## 🚀 Available in Scripts

All scripts now have access to the **`human`** object:

```javascript
// In your script
await human.tap(x, y);          // Human-like tap
await human.type('hello');      // Human-like typing
await human.swipe(x1, y1, x2, y2); // Human-like swipe
await human.think();            // Thinking delay
```

---

## 📚 API Reference

### **1. human.tap(x, y, options?)**

Human-like tap with random offset and delays.

**Parameters:**
- `x`, `y`: Tap coordinates
- `options` (optional):
  - `preTapDelay`: `[min, max]` delay before tap (default: `[50, 150]`)
  - `postTapDelay`: `[min, max]` delay after tap (default: `[100, 300]`)
  - `offsetRange`: Random offset in pixels (default: `15`)

**Examples:**
```javascript
// Basic human tap
await human.tap(180, 300);

// Tap with custom delays
await human.tap(180, 300, {
  preTapDelay: [200, 400],
  postTapDelay: [300, 600],
  offsetRange: 25
});
```

**What it does:**
1. Pre-tap delay (50-150ms) - like moving finger to screen
2. Random offset (±15px) - "fat finger" effect
3. Execute tap
4. Post-tap delay (100-300ms) - like lifting finger

---

### **2. human.type(text, options?)**

Human-like typing with variable speed and random pauses.

**Parameters:**
- `text`: Text to type
- `options` (optional):
  - `charDelay`: `[min, max]` delay per character (default: `[80, 200]`)
  - `pauseChance`: Probability to pause (default: `0.03` = 3%)
  - `pauseDelay`: `[min, max]` pause duration (default: `[500, 1500]`)

**Examples:**
```javascript
// Basic human typing
await human.type('username@example.com');

// Slow typing with more pauses
await human.type('password123', {
  charDelay: [150, 300],
  pauseChance: 0.1 // 10% pause chance
});
```

**What it does:**
1. Type each character with random delay (80-200ms)
2. 3% chance to pause (thinking/hesitation)
3. Pause duration: 500-1500ms

---

### **3. human.swipe(x1, y1, x2, y2, options?)**

Human-like swipe with Bézier curve path.

**Parameters:**
- `x1, y1`: Start coordinates
- `x2, y2`: End coordinates
- `options` (optional):
  - `addCurve`: Add Bézier curve (default: `true`)
  - `wobble`: Add human wobble (default: `true`)
  - `durationRange`: `[min, max]` swipe duration (default: `[300, 600]`)

**Examples:**
```javascript
// Swipe with curve
await human.swipe(180, 500, 180, 200);

// Straight swipe (no curve)
await human.swipe(180, 500, 180, 200, {
  addCurve: false,
  wobble: false
});
```

**What it does:**
1. Generate Bézier control points for curved path
2. Calculate 10-50 touch points along curve
3. Add human wobble to each point (±3px)
4. Execute multi-step swipe
5. Post-swipe delay (200-500ms)

---

### **4. human.scroll(distance, options?)**

Human-like scroll (vertical swipe).

**Parameters:**
- `distance`: Scroll distance in pixels (positive = down, negative = up)
- `options` (optional):
  - `centerX`: X coordinate for scroll (default: `180`)
  - `startY`: Starting Y coordinate (default: `400`)

**Examples:**
```javascript
// Scroll down 300px
await human.scroll(300);

// Scroll up 200px
await human.scroll(-200);

// Custom scroll position
await human.scroll(400, {
  centerX: 200,
  startY: 500
});
```

---

### **5. human.quickTap(x, y)**

Quick tap with less delay (faster interaction).

```javascript
await human.quickTap(180, 300);
// Pre-delay: 20-50ms, Post-delay: 50-100ms
```

---

### **6. human.slowTap(x, y)**

Slow tap with more delay (careful interaction).

```javascript
await human.slowTap(180, 300);
// Pre-delay: 200-400ms, Post-delay: 300-600ms
```

---

### **7. human.think()**

Thinking delay (800-2000ms) - simulates hesitation.

```javascript
await human.think();
// Random delay: 800-2000ms with Gaussian distribution
```

---

### **8. human.read(textLength)**

Reading delay based on text length (200-250 words/min).

```javascript
await human.read(100); // Read 100 characters (~2-3 seconds)
await human.read(500); // Read 500 characters (~10-15 seconds)
```

**Formula:**
```
words = textLength / 5
readingTime = (words / 250) * 60 * 1000 ms
actualDelay = random(readingTime * 0.8, readingTime * 1.2)
```

---

### **9. human.delay(min, max)**

Random delay with **Gaussian distribution** (from Imposter.ts).

```javascript
await human.delay(500, 1500);
// Gaussian random delay: 500-1500ms
```

---

### **10. human.randomOffset(min, max)**

Generate random offset value.

```javascript
const offsetX = human.randomOffset(-10, 10);
const offsetY = human.randomOffset(-10, 10);
await helpers.tap(180 + offsetX, 300 + offsetY);
```

---

### **11. human.idle(duration?)**

Random idle behavior (random movements).

```javascript
await human.idle(5000); // Random movements for 5 seconds
```

---

## 🔬 How Core Algorithms Were Adapted

### **1. Bézier Curve Movement**

**Browser (Imposter.ts):**
```typescript
// Move mouse from A → B with Bézier curve
moveMouseHumanLike(page, targetX, targetY) {
  for (let i = 0; i <= steps; i++) {
    const point = calculateBezierPoint(p0, p1, p2, p3, t);
    await page.mouse.move(point.x, point.y);
  }
}
```

**Mobile (MobileImposter.ts):**
```typescript
// Swipe from A → B with Bézier curve (multi-touch)
humanSwipe(helpers, x1, y1, x2, y2) {
  const touchPoints = [];
  for (let i = 0; i <= steps; i++) {
    const point = calculateBezierPoint(p0, p1, p2, p3, t);
    const wobble = addHumanWobble(point, t);
    touchPoints.push(wobble);
  }
  // Execute multi-step swipe via ADB
  executeMultiTouchSwipe(helpers, touchPoints);
}
```

**Adaptation**: Mouse movement → Multi-touch swipe ✅

---

### **2. Gaussian Random Delay**

**COPIED 100% from Imposter.ts** - No changes needed!

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

This produces more realistic delays than uniform random! 📊

---

### **3. Human Wobble**

**COPIED 100% from Imposter.ts** - Works perfectly for mobile!

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

---

## 📊 Comparison: Basic vs Human

### **Robot Behavior (DETECTABLE):**
```javascript
await helpers.tap(180, 300);
await helpers.tap(180, 400);
await helpers.tap(180, 500);
await helpers.type('This is typed instantly');
```

**Problems:**
- ❌ No delays between actions
- ❌ Exact same coordinates (no offset)
- ❌ Instant typing (no human speed variation)
- ❌ Looks like a bot!

---

### **Human Behavior (UNDETECTABLE):**
```javascript
await human.tap(180, 300);        // Random offset + delays
await human.think();              // Pause 800-2000ms
await human.tap(180, 400);
await human.delay(300, 800);      // Random delay
await human.tap(180, 500);
await human.type('This is typed with variable speed');
```

**Benefits:**
- ✅ Random delays between actions
- ✅ Random offset for each tap (fat finger)
- ✅ Variable typing speed
- ✅ Looks like a real person!

---

## 🎯 Real-World Examples

### **Example 1: Twitter Login**

```javascript
await helpers.launchApp('com.twitter.android');
await helpers.sleep(3000);

await helpers.waitForText('Log in', { timeout: 10000 });

// Human thinking before clicking
await human.think();

// Tap login button with human behavior
await human.tap(180, 500);

await helpers.sleep(2000);

// Get account from profile
const account = helpers.getAccount('twitter');

// Tap username field
await human.tap(180, 300);
await helpers.sleep(500);

// Human-like typing
await human.type(account.username);

// Think before tapping Next
await human.think();

// Tap Next
await human.tap(180, 600);
await helpers.sleep(2000);

// Tap password field
await human.tap(180, 300);
await helpers.sleep(500);

// Type password
await human.type(account.password);

// Think before login
await human.think();

// Tap Login
await human.tap(180, 600);
```

---

### **Example 2: Reading Timeline**

```javascript
await helpers.launchApp('com.twitter.android');
await helpers.sleep(3000);

for (let i = 0; i < 10; i++) {
  // Human reading time (~100 chars per tweet)
  await human.read(100);

  // 20% chance to get distracted
  if (Math.random() < 0.2) {
    await human.delay(1000, 3000);
  }

  // Human-like scroll
  await human.scroll(300);

  // 10% chance to scroll back (re-read)
  if (Math.random() < 0.1) {
    await human.scroll(-150);
    await human.read(50);
  }
}
```

---

### **Example 3: Posting Tweet**

```javascript
await helpers.launchApp('com.twitter.android');
await helpers.sleep(3000);

// Think before tapping compose
await human.think();

// Tap compose button (FAB)
await human.tap(300, 550);
await helpers.sleep(1500);

// Tap text area
await human.tap(180, 200);
await helpers.sleep(500);

// Human-like typing with pauses
await human.type('Hello from human-like automation! 🤖', {
  charDelay: [100, 250],
  pauseChance: 0.05
});

// Read what was typed (proof-reading)
await human.read(42); // Length of tweet

// Think before posting
await human.think();

// Tap Post button
await human.tap(310, 50);
```

---

## 🧪 Testing

See `script-templates/EXAMPLE_HUMAN_BEHAVIOR.js` for complete examples.

---

## 📈 Benefits

1. **✅ Undetectable**: Looks like real human behavior
2. **✅ Realistic Delays**: Gaussian distribution (not uniform random)
3. **✅ Variable Speed**: Typing, swiping, tapping all vary
4. **✅ Random Offsets**: Fat finger effect
5. **✅ Bézier Curves**: Natural swipe paths
6. **✅ Thinking Pauses**: Realistic hesitation
7. **✅ Reading Time**: Based on text length
8. **✅ Easy to Use**: Simple API

---

## 🔗 Related Files

- **Source**: `server/antidetect/MobileImposter.ts`
- **Integration**: `server/services/DirectMobileScriptService.ts` (line 6, 897-1003)
- **Original**: `server/antidetect/imposter.ts` (Puppeteer version)
- **Examples**: `script-templates/EXAMPLE_HUMAN_BEHAVIOR.js`

---

## 🎓 Technical Notes

### **Why Gaussian Distribution?**

Normal random distribution produces unrealistic delays:
```javascript
// Uniform random (BAD)
delay = 100 + Math.random() * 200; // Flat distribution

// Gaussian random (GOOD)
delay = getRandomDelay(100, 300); // Bell curve - more natural!
```

**Gaussian distribution** creates delays that cluster around the middle value, with occasional outliers - just like real humans! 📊

---

### **Why Bézier Curves?**

Real humans don't move in straight lines:
```javascript
// Straight swipe (ROBOTIC)
await helpers.swipe(x1, y1, x2, y2);

// Curved swipe (HUMAN-LIKE)
await human.swipe(x1, y1, x2, y2); // Adds Bézier curve automatically
```

Bézier curves create natural curved paths with 4 control points (p0, p1, p2, p3).

---

## 🚀 Future Enhancements

- [ ] Adaptive delays based on screen distance
- [ ] Learn from user's actual behavior patterns
- [ ] Multi-finger gestures (pinch, rotate)
- [ ] Pressure simulation (if supported)
- [ ] Context-aware delays (different delays for different apps)

---

## 📝 Conclusion

**MobileImposter** successfully adapts **Imposter.ts** (browser) to **mobile automation** while preserving all core algorithms:

- ✅ Bézier curves: Mouse movement → Swipe gesture
- ✅ Gaussian delays: 100% copied
- ✅ Human wobble: 100% copied
- ✅ Reading time: 100% copied
- ✅ Thinking delays: 100% copied

Use `human.*` helpers instead of `helpers.*` for undetectable automation! 🎯
